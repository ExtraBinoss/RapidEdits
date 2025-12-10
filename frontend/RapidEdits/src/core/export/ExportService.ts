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
    private abortController: AbortController | null = null;

    async exportVideo(
        config: ExportConfig,
        onProgress: (progress: number, status: string) => void,
    ) {
        this.abortController = new AbortController();

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

        try {
            // 2. Setup MediaRecorder
            const stream = exportCanvas.captureStream(config.fps);

            // Check supported types
            let mimeType = "video/webm;codecs=vp9";
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = "video/webm;codecs=vp8";
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    mimeType = "video/webm";
                }
            }

            const recorder = new MediaRecorder(stream, {
                mimeType,
                videoBitsPerSecond: config.bitrate,
            });

            const chunks: Blob[] = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            const stopPromise = new Promise<void>((resolve) => {
                recorder.onstop = () => resolve();
            });

            onProgress(0, "Starting Rendering...");

            const duration = this.getProjectDuration();
            if (duration <= 0) throw new Error("Timeline is empty");

            const totalFrames = Math.ceil(duration * config.fps);
            const frameDuration = 1 / config.fps;
            // Start recording
            recorder.start();

            const startRenderTime = performance.now();
            const tracks = editorEngine.getTracks();

            for (let i = 0; i < totalFrames; i++) {
                if (this.abortController.signal.aborted) {
                    recorder.stop();
                    throw new Error("Export Cancelled");
                }

                const time = i * frameDuration;
                const renderTime = time + frameDuration * 0.5;

                // Initial Render to load textures/create meshes
                renderer.renderFrame(renderTime, tracks);

                // Wait for textures to load
                await renderer.waitForPendingLoads();

                // Wait for video seek
                await this.waitForSeek(renderer);

                // Double RAF: Ensure compositor has painted the new video frame to the texture
                await new Promise((r) =>
                    requestAnimationFrame(() => requestAnimationFrame(r)),
                );

                // Final Render for this frame
                renderer.renderFrame(renderTime, tracks);

                // Sync Timing: Ensure we don't run faster than real-time
                const expectedTime = (i + 1) * (1000 / config.fps);
                const elapsed = performance.now() - startRenderTime;
                const delay = expectedTime - elapsed;

                if (delay > 0) {
                    await new Promise((r) => setTimeout(r, delay));
                }

                onProgress(
                    Math.round((i / totalFrames) * 100),
                    `Rendering Frame ${i}/${totalFrames}`,
                );
            }

            // 3. Finalize
            onProgress(100, "Finalizing Encoding...");
            recorder.stop();
            await stopPromise;

            const blob = new Blob(chunks, { type: "video/webm" });
            this.downloadBlob(blob, `rapid_edits_export_${Date.now()}.webm`);
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

    private downloadBlob(blob: Blob, filename: string) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
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
}

export const exportService = new ExportService();
