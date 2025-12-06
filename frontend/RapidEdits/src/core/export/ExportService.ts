import * as THREE from "three";
import { editorEngine } from "../EditorEngine";
import { ThreeRenderer } from "../renderer/ThreeRenderer";
import { ResourceManager } from "../ResourceManager";
import { TextureAllocator } from "../renderer/textures/TextureAllocator";

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

        // 1. Setup Isolated Environment
        const exportResourceManager = new ResourceManager();
        const exportAllocator = new TextureAllocator(exportResourceManager);
        const exportCanvas = document.createElement('canvas');
        
        // Create Offscreen Renderer
        const renderer = new ThreeRenderer({
            canvas: exportCanvas,
            width: config.width,
            height: config.height,
            allocator: exportAllocator,
            isCaptureMode: true
        });

        await renderer.init();

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
            const tracks = editorEngine.getTracks();
            
            for (let i = 0; i < totalFrames; i++) {
                if (this.abortController.signal.aborted) throw new Error("Export Cancelled");

                const time = i * frameDuration;
                
                // Initial Render to load textures/create meshes
                renderer.renderFrame(time, tracks);

                // Wait for textures to load (if any new ones appeared)
                await renderer.waitForPendingLoads();
                
                // Wait for video seek (syncVideoFrame triggered seek in renderFrame)
                await this.waitForSeek(renderer);

                // Safety delay to ensure the video element has repainted with the new frame data
                // 'seeked' event fires when data is ready, but the compositor might need a tick to update.
                await new Promise(r => requestAnimationFrame(r));
                
                // Final Render for this frame
                renderer.renderFrame(time, tracks);
                
                // Create Frame from Canvas
                const frameTimestamp = Math.round(i * 1000000 / config.fps);
                const frameDurationVal = Math.round(1000000 / config.fps);

                const frame = new VideoFrame(exportCanvas, {
                    timestamp: frameTimestamp,
                    duration: frameDurationVal
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
            // Cleanup
            renderer.destroy();
            exportResourceManager.cleanup();
            // allocator is destroyed by renderer.destroy()
        }
    }

    cancel() {
        this.abortController?.abort();
    }

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
            if (video.readyState >= 2 && !video.seeking) return Promise.resolve();
            return new Promise<void>(resolve => {
                const onSeeked = () => {
                    video.removeEventListener('seeked', onSeeked);
                    resolve();
                };
                // Safety timeout in case seek doesn't fire (rare but possible)
                setTimeout(() => {
                    video.removeEventListener('seeked', onSeeked);
                    resolve();
                }, 1000); 
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

        // Always use H.264 (AVC) for the upload stream
        // The server will transcode to WebM/VP9 if needed.
        const codec = "avc1.4d002a"; 
        
        const encoderConfig: any = {
            codec,
            width: config.width,
            height: config.height,
            bitrate: config.bitrate,
            framerate: config.fps,
            avc: { format: "annexb" }
        };

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