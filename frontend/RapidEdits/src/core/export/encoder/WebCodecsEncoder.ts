import type { ExportBackend } from "../api/ExportBackend";
import ExportWorker from "../workers/export.worker.ts?worker"; // Vite worker import

export class WebCodecsEncoder {
    private worker: Worker;
    private sessionId: string;

    constructor(
        backend: ExportBackend,
        sessionId: string,
        config: {
            width: number;
            height: number;
            fps: number;
            bitrate?: number;
        },
    ) {
        this.sessionId = sessionId;

        this.worker = new ExportWorker();
        this.worker.onmessage = (e) => {
            const { type, error } = e.data;
            if (type === "error") {
                console.error("[ExportWorker Error]", error);
                // Can we bubble this up?
            } else if (type === "progress") {
                // optional: buble up bytes exported
            }
        };

        // Init Worker
        this.worker.postMessage({
            type: "init",
            payload: {
                ...config,
                sessionId: this.sessionId,
                apiUrl: "http://localhost:4001", // Should ideally from backend config/env, hardcoded for now matching backend
                format: (config as any).format,
            },
        });
    }

    public async encodeFrame(frame: VideoFrame, keyFrame: boolean) {
        // Transfer the frame to the worker
        // We cannot await the result here easily without complex ID tracking,
        // but encoding is fire-and-forget for the pipeline loop usually.
        // The backpressure is handled by the worker queue implicitly (it won't block main thread).
        this.worker.postMessage(
            {
                type: "encode",
                payload: { frame, keyFrame },
            },
            [frame], // TRANSFER ownership
        );
    }

    public async close() {
        return new Promise<void>((resolve, reject) => {
            this.worker.onmessage = (e) => {
                if (e.data.type === "done") {
                    this.worker.terminate();
                    resolve();
                } else if (e.data.type === "error") {
                    reject(e.data.error);
                }
            };
            this.worker.postMessage({ type: "close" });
        });
    }
}
