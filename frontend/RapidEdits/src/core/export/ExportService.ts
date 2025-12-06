import { editorEngine } from "../EditorEngine";
import { ExportBackend } from "./api/ExportBackend";
import { WebCodecsEncoder } from "./encoder/WebCodecsEncoder";
import { RenderPipeline } from "./pipeline/RenderPipeline";

export interface ExportConfig {
    width: number;
    height: number;
    fps: number;
    bitrate?: number;
    format?: string;
}

export class ExportService {
    private isExporting = false;
    private shouldStop = false;

    public async exportVideo(
        config: ExportConfig,
        onProgress: (percent: number, status: string) => void,
    ) {
        if (this.isExporting) return;
        this.isExporting = true;
        this.shouldStop = false;

        // Components
        const backend = new ExportBackend();
        let pipeline: RenderPipeline | null = null;
        let encoder: WebCodecsEncoder | null = null;
        let sessionId: string | null = null;

        try {
            // 1. Init Session
            onProgress(0, "Initializing Session...");
            sessionId = await backend.initSession({
                width: config.width,
                height: config.height,
                fps: config.fps,
                format: config.format || "mp4",
            });

            // 2. Setup Pipeline
            onProgress(0, "Setting up Renderer...");
            pipeline = new RenderPipeline(config.width, config.height);
            await pipeline.init();

            // 3. Setup Encoder
            onProgress(0, "Initializing Encoder...");
            encoder = new WebCodecsEncoder(backend, sessionId, config);

            // 4. Calculate Duration
            const tracks = editorEngine.getTracks();
            console.log("[ExportDebug] Tracks:", tracks);
            let maxTime = 0;
            tracks.forEach((t) => {
                t.clips.forEach((c) => {
                    maxTime = Math.max(maxTime, c.start + c.duration);
                });
            });
            const totalDuration = Math.max(1, maxTime);
            console.log(
                "[ExportDebug] Total Duration:",
                totalDuration,
                "FPS:",
                config.fps,
            );

            // 5. Run Render Loop
            onProgress(0, "Rendering & Encoding...");
            await pipeline.run(
                encoder,
                totalDuration,
                config.fps,
                (p) => onProgress(p, `Rendering... ${p}%`),
                () => this.shouldStop,
            );

            // 6. Finish
            onProgress(100, "Finalizing...");
            await encoder.close();
            await backend.finishSession(sessionId);

            // 7. Poll for Completion
            let isDone = false;
            while (!isDone && !this.shouldStop) {
                const status = await backend.getStatus(sessionId);

                if (status.status === "done") {
                    isDone = true;
                    window.open(backend.getDownloadUrl(sessionId!));
                } else if (status.status === "error") {
                    throw new Error(status.error || "Unknown error");
                } else {
                    onProgress(
                        status.progress || 100,
                        `Processing: ${status.status}...`,
                    );
                    await new Promise((r) => setTimeout(r, 1000));
                }
            }
        } catch (e: any) {
            console.error("Export failed", e);
            throw e;
        } finally {
            this.isExporting = false;
            // Cleanup in reverse order
            if (encoder) {
                // Encoder might already be closed, but safe to ensure?
                // WebCodecsEncoder.close() handles flushing, so we only call if not already closed normally?
                // Actually our code calls close() in try block.
            }
            if (pipeline) pipeline.destroy();
        }
    }

    public cancel() {
        this.shouldStop = true;
    }
}

export const exportService = new ExportService();
