import * as THREE from "three";
import { editorEngine } from "../EditorEngine";
import { ThreeRenderer } from "../renderer/ThreeRenderer";

export interface ExportConfig {
    width: number;
    height: number;
    fps: number;
    bitrate: number;
    format: "mp4" | "webm";
}

export class ExportService {
    private baseUrl = "http://localhost:4001";
    private abortController: AbortController | null = null;
    private pendingUploads: Promise<void>[] = [];

    async exportVideo(
        config: ExportConfig,
        onProgress: (progress: number, status: string) => void
    ) {
        this.abortController = new AbortController();
        this.pendingUploads = [];

        const renderer = editorEngine.getRenderer() as ThreeRenderer;
        if (!renderer) throw new Error("Renderer not initialized");

        // 1. Save State & Setup
        const originalSize = new THREE.Vector2();
        renderer.renderer.getSize(originalSize);
        const originalIsPlaying = editorEngine.getIsPlaying();
        if (originalIsPlaying) editorEngine.togglePlayback(); // Pause
        
        // Enable precision mode
        if(typeof renderer.setCaptureMode === 'function') {
            renderer.setCaptureMode(true);
        }

        // Resize for Export
        this.resizeRenderer(renderer, config.width, config.height);

        let sessionId: string | null = null;

        try {
            // 2. Init Session
            onProgress(0, "Initializing Server Session...");
            sessionId = await this.initSession(config);

            // 3. Setup Encoder
            const duration = this.getProjectDuration();
            if (duration <= 0) throw new Error("Timeline is empty");
            
            const totalFrames = Math.ceil(duration * config.fps);
            const frameDuration = 1 / config.fps;

            const { encoder } = this.createEncoder(config, sessionId);

            // 4. Render Loop
            onProgress(0, "Starting Rendering...");
            
            for (let i = 0; i < totalFrames; i++) {
                if (this.abortController.signal.aborted) throw new Error("Export Cancelled");

                const time = i * frameDuration;
                
                // Seek
                editorEngine.seek(time);
                
                // Render to sync videos
                renderer.renderFrame(time, editorEngine.getTracks());
                
                // Wait for video seek
                await this.waitForSeek(renderer);
                
                // Re-render
                renderer.renderFrame(time, editorEngine.getTracks());
                
                // Create Frame
                const frame = new VideoFrame(renderer.renderer.domElement, {
                    timestamp: i * 1000000 / config.fps // microseconds
                });

                // Encode
                const keyFrame = i % (config.fps * 2) === 0;
                encoder.encode(frame, { keyFrame });
                frame.close();

                onProgress(Math.round((i / totalFrames) * 100), `Rendering Frame ${i}/${totalFrames}`);
                
                // Backpressure
                if (this.pendingUploads.length > 5) {
                    await Promise.all(this.pendingUploads);
                    this.pendingUploads = [];
                }
            }

            // 5. Finalize
            onProgress(100, "Finalizing Encoding...");
            await encoder.flush();
            await Promise.all(this.pendingUploads);
            
            onProgress(100, "Muxing on Server...");
            await this.finishSession(sessionId!);

            // Wait for FFmpeg to finish
            await this.waitForRender(sessionId!, onProgress);

            // Download
            this.downloadVideo(sessionId!);

        } catch (e: any) {
            console.error("Export Failed", e);
            throw e;
        } finally {
            // Restore State
            if(typeof renderer.setCaptureMode === 'function') {
                renderer.setCaptureMode(false);
            }
            this.resizeRenderer(renderer, originalSize.x, originalSize.y);
        }
    }

    cancel() {
        this.abortController?.abort();
    }

    // ... (helper methods)

    private async waitForRender(sessionId: string, onProgress: (p: number, s: string) => void) {
        let attempts = 0;
        while (attempts < 60) { // 60 seconds max wait
            if (this.abortController?.signal.aborted) throw new Error("Export Cancelled");
            
            const res = await fetch(`${this.baseUrl}/render/status/${sessionId}`);
            if (!res.ok) throw new Error("Failed to check status");
            
            const data = await res.json();
            if (data.status === 'done') return;
            if (data.status === 'error') throw new Error(`Render Error: ${data.error}`);
            
            onProgress(100, "Muxing on Server... " + (attempts % 4 === 0 ? "." : attempts % 4 === 1 ? ".." : "..."));
            
            await new Promise(r => setTimeout(r, 1000));
            attempts++;
        }
        throw new Error("Render timed out");
    }

    private resizeRenderer(renderer: ThreeRenderer, width: number, height: number) {
        renderer.renderer.setSize(width, height);
        const cam = renderer.camera;
        if (cam) {
            cam.left = -width / 2;
            cam.right = width / 2;
            cam.top = height / 2;
            cam.bottom = -height / 2;
            cam.updateProjectionMatrix();
        }
    }

    private getProjectDuration(): number {
        const tracks = editorEngine.getTracks();
        let maxTime = 0;
        tracks.forEach(track => {
            track.clips.forEach(clip => {
                const end = clip.start + clip.duration;
                if (end > maxTime) maxTime = end;
            });
        });
        return maxTime || 5;
    }

    private async waitForSeek(renderer: ThreeRenderer): Promise<void> {
        const videos = renderer.getActiveVideoElements();
        const promises = videos.map(video => {
            if (video.readyState >= 2 && !video.seeking) return Promise.resolve(); // readyState 2 (HAVE_CURRENT_DATA) is enough for frame
            return new Promise<void>(resolve => {
                const onSeeked = () => {
                    video.removeEventListener('seeked', onSeeked);
                    resolve();
                };
                setTimeout(onSeeked, 1000); 
                video.addEventListener('seeked', onSeeked, { once: true });
            });
        });
        await Promise.all(promises);
    }

    private async initSession(config: ExportConfig): Promise<string> {
        const res = await fetch(`${this.baseUrl}/render/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        if (!res.ok) throw new Error("Failed to init session");
        const data = await res.json();
        return data.sessionId;
    }

    private createEncoder(config: ExportConfig, sessionId: string) {
        const encoder = new VideoEncoder({
            output: (chunk, metadata) => {
                const buffer = new ArrayBuffer(chunk.byteLength);
                chunk.copyTo(buffer);
                
                const p = this.uploadChunk(sessionId, buffer);
                this.pendingUploads.push(p);
            },
            error: (e) => {
                console.error("Encoder Error", e);
            }
        });

        const codec = config.format === "webm" ? "vp09.00.10.08" : "avc1.4d002a"; 
        
        const encoderConfig: any = {
            codec,
            width: config.width,
            height: config.height,
            bitrate: config.bitrate,
            framerate: config.fps,
        };
        
        if (config.format === 'mp4') {
            encoderConfig.avc = { format: "annexb" };
        }

        encoder.configure(encoderConfig);

        return { encoder };
    }

    private async uploadChunk(sessionId: string, data: ArrayBuffer) {
        const res = await fetch(`${this.baseUrl}/render/append/${sessionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: data
        });
        if (!res.ok) throw new Error("Upload failed");
    }

    private async finishSession(sessionId: string) {
        const res = await fetch(`${this.baseUrl}/render/finish/${sessionId}`, {
            method: 'POST'
        });
        if (!res.ok) throw new Error("Finish failed");
    }

    private downloadVideo(sessionId: string) {
        const link = document.createElement('a');
        link.href = `${this.baseUrl}/render/download/${sessionId}`;
        link.download = '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

export const exportService = new ExportService();
