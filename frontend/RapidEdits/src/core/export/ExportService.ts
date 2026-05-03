import { editorEngine } from "../EditorEngine";
import { ThreeRenderer } from "../renderer/ThreeRenderer";
import { ResourceManager } from "../ResourceManager";
import { TextureAllocator } from "../renderer/textures/TextureAllocator";
import {
    Output,
    BufferTarget,
    Mp4OutputFormat,
    WebMOutputFormat,
    CanvasSource,
} from "mediabunny";

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
            pixelRatio: 1, // CRITICAL: Ensure we don't render at 2x/3x on retina screens
        });

        await renderer.init();

        try {
            // 2. Setup Mediabunny Output
            const target = new BufferTarget();
            const format =
                config.format === "mp4"
                    ? new Mp4OutputFormat()
                    : new WebMOutputFormat();

            const output = new Output({
                target,
                format,
            });

            // Configure Video Source
            // Use 'avc' (H.264) for MP4 and 'vp9' for WebM
            const codec = config.format === "mp4" ? "avc" : "vp9";

            const videoSource = new CanvasSource(exportCanvas, {
                codec,
                bitrate: config.bitrate,
                // Some browsers/encoders benefit from these hints
                latencyMode: "quality", // We want quality for export
                hardwareAcceleration: "prefer-hardware",
            });

            // Add video track with specified FPS metadata
            output.addVideoTrack(videoSource, { frameRate: config.fps });

            await output.start();

            // 3. Rendering Loop
            onProgress(0, "Starting Rendering...");

            const duration = this.getProjectDuration();
            if (duration <= 0) throw new Error("Timeline is empty");

            const totalFrames = Math.ceil(duration * config.fps);
            const frameDuration = 1 / config.fps;

            const tracks = editorEngine.getTracks();

            let lastYieldTime = performance.now();

            const stats = {
                prepare: 0,
                wait: 0,
                render: 0,
                encode: 0,
                total: 0,
                frameCount: 0
            };

            for (let i = 0; i < totalFrames; i++) {
                if (this.abortController.signal.aborted) {
                    throw new Error("Export Cancelled");
                }

                const frameStart = performance.now();
                const time = i * frameDuration;
                const renderTime = time + frameDuration * 0.5;

                // 1. Prepare Frame (Update positions, trigger seeks)
                const t1 = performance.now();
                const visibleClips = renderer.prepareFrame(renderTime, tracks);
                stats.prepare += performance.now() - t1;

                // 2. Wait for all resources in parallel
                const t2 = performance.now();
                await Promise.all([
                    renderer.waitForPendingLoads(),
                    this.waitForSeek(renderer)
                ]);
                stats.wait += performance.now() - t2;
                
                if (this.abortController.signal.aborted) throw new Error("Export Cancelled");

                // 3. Final Render (Actual GPU draw)
                const t3 = performance.now();
                renderer.renderOnly(visibleClips);
                stats.render += performance.now() - t3;

                // 4. Capture & Encode
                const t4 = performance.now();
                await videoSource.add(time, frameDuration);
                stats.encode += performance.now() - t4;

                stats.total += performance.now() - frameStart;
                stats.frameCount++;

                // Log every 30 frames
                if (i % 30 === 0 && i > 0) {
                    const avg = (ms: number) => (ms / stats.frameCount).toFixed(2);
                    console.log(`[Export] Frame ${i}/${totalFrames} | Avg: Prepare ${avg(stats.prepare)}ms, Wait ${avg(stats.wait)}ms, Render ${avg(stats.render)}ms, Encode ${avg(stats.encode)}ms`);
                }

                // 5. Yield occasionally to keep UI responsive
                const now = performance.now();
                if (now - lastYieldTime > 100) {
                    await new Promise((r) => setTimeout(r, 0));
                    lastYieldTime = now;
                }

                onProgress(
                    Math.round((i / totalFrames) * 100),
                    `Rendering Frame ${i}/${totalFrames}`,
                );
            }

            console.log(`[Export] Finished! Final Averages:`, {
                prepare: (stats.prepare / totalFrames).toFixed(2) + "ms",
                wait: (stats.wait / totalFrames).toFixed(2) + "ms",
                render: (stats.render / totalFrames).toFixed(2) + "ms",
                encode: (stats.encode / totalFrames).toFixed(2) + "ms",
                fps: (1000 / (stats.total / totalFrames)).toFixed(2)
            });

            // 4. Finalize
            onProgress(100, "Finalizing Encoding...");
            await output.finalize();

            const mimeType =
                config.format === "mp4" ? "video/mp4" : "video/webm";
            if (!target.buffer) {
                throw new Error("Export failed: No output buffer generated");
            }
            const blob = new Blob([target.buffer], { type: mimeType });
            const filename = `rapid_edits_export_${Date.now()}.${config.format}`;
            this.downloadBlob(blob, filename);
            return filename;
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
