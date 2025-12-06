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
    private uploadQueue: Promise<void> = Promise.resolve();
    private activeUploadCount = 0;

    async exportVideo(
        config: ExportConfig,
        onProgress: (progress: number, status: string) => void,
    ) {
        this.abortController = new AbortController();
        this.uploadQueue = Promise.resolve();
        this.activeUploadCount = 0;

        // 1. Setup Isolated Environment
        const exportResourceManager = new ResourceManager();
        const exportAllocator = new TextureAllocator(exportResourceManager);
        const exportCanvas = document.createElement("canvas");

        // Create Offscreen Renderer
        const renderer = new ThreeRenderer({
            canvas: exportCanvas,
            width: config.width,
            height: config.height,
            allocator: exportAllocator,
            isCaptureMode: true,
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
                if (this.abortController.signal.aborted)
                    throw new Error("Export Cancelled");

                // Seek to the CENTER of the frame (50% offset) to ensure we are safely within the frame boundary
                // This prevents sampling the previous frame due to floating point jitter.
                const time = i * frameDuration;
                const renderTime = time + frameDuration * 0.5;

                // Initial Render to load textures/create meshes
                renderer.renderFrame(renderTime, tracks);

                // Wait for textures to load (if any new ones appeared)
                await renderer.waitForPendingLoads();

                // Wait for video seek (syncVideoFrame triggered seek in renderFrame)
                await this.waitForSeek(renderer);

                // Double RAF: Ensure compositor has painted the new video frame to the texture
                await new Promise((r) =>
                    requestAnimationFrame(() => requestAnimationFrame(r)),
                );

                // Final Render for this frame
                renderer.renderFrame(renderTime, tracks);

                // Create Frame from Canvas
                // Use microsecond precision for timestamps
                const frameTimestamp = Math.round((i * 1000000) / config.fps);
                const frameDurationVal = Math.round(1000000 / config.fps);

                const frame = new VideoFrame(exportCanvas, {
                    timestamp: frameTimestamp,
                    duration: frameDurationVal,
                });

                // Encode
                const keyFrame = i % config.fps === 0;
                encoder.encode(frame, { keyFrame });
                frame.close();

                onProgress(
                    Math.round((i / totalFrames) * 100),
                    `Rendering Frame ${i}/${totalFrames}`,
                );

                // Backpressure: Check active uploads to prevent memory exhaustion
                // If we have more than 10 chunks pending upload, wait for the entire queue to drain/catch up.
                if (this.activeUploadCount > 10) {
                    await this.uploadQueue;
                }
            }

            // 5. Finalize
            onProgress(100, "Finalizing Encoding...");
            await encoder.flush();
            await this.uploadQueue; // Wait for all uploads to finish

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
        }
    }

    cancel() {
        this.abortController?.abort();
    }

    // ... (helper methods unchanged) ...

    private async waitForRender(
        sessionId: string,
        onProgress: (p: number, s: string) => void,
    ) {
        let attempts = 0;
        while (attempts < 60) {
            // 60 seconds max wait
            if (this.abortController?.signal.aborted)
                throw new Error("Export Cancelled");

            const res = await fetch(
                `${this.baseUrl}/render/status/${sessionId}`,
            );
            if (!res.ok) throw new Error("Failed to check status");

            const data = await res.json();
            if (data.status === "done") return;
            if (data.status === "error")
                throw new Error(`Render Error: ${data.error}`);

            onProgress(
                100,
                "Muxing on Server... " +
                    (attempts % 4 === 0
                        ? "."
                        : attempts % 4 === 1
                          ? ".."
                          : "..."),
            );

            await new Promise((r) => setTimeout(r, 1000));
            attempts++;
        }
        throw new Error("Render timed out");
    }

    private getProjectDuration(): number {
        const tracks = editorEngine.getTracks();
        let maxTime = 0;
        tracks.forEach((track) => {
            track.clips.forEach((clip) => {
                const end = clip.start + clip.duration;
                if (end > maxTime) maxTime = end;
            });
        });
        return maxTime || 5;
    }

    private async waitForSeek(renderer: ThreeRenderer): Promise<void> {
        const videos = renderer.getActiveVideoElements();
        const promises = videos.map((video) => {
            if (video.readyState >= 2 && !video.seeking)
                return Promise.resolve();
            return new Promise<void>((resolve) => {
                const onSeeked = () => {
                    video.removeEventListener("seeked", onSeeked);
                    resolve();
                };
                setTimeout(() => {
                    video.removeEventListener("seeked", onSeeked);
                    resolve();
                }, 1000);
                video.addEventListener("seeked", onSeeked, { once: true });
            });
        });
        await Promise.all(promises);
    }

    private async initSession(config: ExportConfig): Promise<string> {
        const res = await fetch(`${this.baseUrl}/render/init`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(config),
        });
        if (!res.ok) throw new Error("Failed to init session");
        const data = await res.json();
        return data.sessionId;
    }

    private createEncoder(config: ExportConfig, sessionId: string) {
        const encoder = new VideoEncoder({
            output: (chunk) => {
                const buffer = new ArrayBuffer(chunk.byteLength);
                chunk.copyTo(buffer);

                // STRICT ORDERING: Chain the upload to the queue
                this.activeUploadCount++;
                this.uploadQueue = this.uploadQueue.then(async () => {
                    try {
                        await this.uploadChunk(sessionId, buffer);
                    } finally {
                        this.activeUploadCount--;
                    }
                });
            },
            error: (e) => {
                console.error("Encoder Error", e);
            },
        });

        const codec = "avc1.4d002a";

        const encoderConfig: any = {
            codec,
            width: config.width,
            height: config.height,
            bitrate: config.bitrate,
            framerate: config.fps,
            latencyMode: "quality", // Prioritize quality/smoothness
            avc: { format: "annexb" },
        };

        encoder.configure(encoderConfig);

        return { encoder };
    }

    private async uploadChunk(sessionId: string, data: ArrayBuffer) {
        const res = await fetch(`${this.baseUrl}/render/append/${sessionId}`, {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: data,
        });
        if (!res.ok) throw new Error("Upload failed");
    }

    private async finishSession(sessionId: string) {
        const res = await fetch(`${this.baseUrl}/render/finish/${sessionId}`, {
            method: "POST",
        });
        if (!res.ok) throw new Error("Finish failed");
    }

    private downloadVideo(sessionId: string) {
        const link = document.createElement("a");
        link.href = `${this.baseUrl}/render/download/${sessionId}`;
        link.download = "";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

export const exportService = new ExportService();
