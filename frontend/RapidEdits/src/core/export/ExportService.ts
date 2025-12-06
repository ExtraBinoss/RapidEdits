import { editorEngine } from "../EditorEngine";
import { ThreeRenderer } from "../renderer/ThreeRenderer";
import { TextureAllocator } from "../renderer/textures/TextureAllocator";
import { ResourceManager } from "../ResourceManager";

const API_URL = "http://localhost:4001";

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

        // Container for shadow renderer
        const container = document.createElement("div");
        Object.assign(container.style, {
            position: "fixed",
            top: "-9999px",
            width: `${config.width}px`,
            height: `${config.height}px`,
            visibility: "visible", // Ensure browser renders it
            pointerEvents: "none",
        });
        document.body.appendChild(container);

        // Isolated modules
        const exportResourceManager = new ResourceManager();
        const allocator = new TextureAllocator(exportResourceManager);
        const renderer = new ThreeRenderer(container, allocator, {
            isCaptureMode: true,
        });

        try {
            await renderer.init();
            renderer.setScaleMode("fill"); // Ensure full coverage

            // 1. Init Session
            onProgress(0, "Initializing...");
            const initRes = await fetch(`${API_URL}/render/init`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            const { sessionId } = await initRes.json();

            // 2. Capture Loop
            // Calculate total duration from tracks
            const tracks = editorEngine.getTracks();
            let maxTime = 0;
            tracks.forEach((t) => {
                t.clips.forEach((c) => {
                    maxTime = Math.max(maxTime, c.start + c.duration);
                });
            });
            const totalDuration = Math.max(1, maxTime);

            const frameCount = Math.ceil(totalDuration * config.fps);
            const dt = 1 / config.fps;

            onProgress(0, "Initializing Encoder...");

            // --- 2. WebCodecs Encoder Setup ---
            const chunkBuffer: Uint8Array[] = [];
            let bufferSize = 0;
            const FLUSH_THRESHOLD = 5 * 1024 * 1024; // 5MB

            const flushBuffer = async () => {
                if (chunkBuffer.length === 0) return;

                // Concatenate buffer
                const totalLength = chunkBuffer.reduce(
                    (acc, val) => acc + val.length,
                    0,
                );
                const combined = new Uint8Array(totalLength);
                let offset = 0;
                for (const chunk of chunkBuffer) {
                    combined.set(chunk, offset);
                    offset += chunk.length;
                }

                // Append to backend
                await fetch(`${API_URL}/render/append/${sessionId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/octet-stream" },
                    body: new Blob([combined]),
                });

                // Clear
                chunkBuffer.length = 0;
                bufferSize = 0;
            };

            const encoder = new VideoEncoder({
                output: (chunk, metadata) => {
                    const buffer = new Uint8Array(chunk.byteLength);
                    chunk.copyTo(buffer);
                    chunkBuffer.push(buffer);
                    bufferSize += buffer.byteLength;
                },
                error: (e) => {
                    console.error("Encoder error", e);
                    throw e;
                },
            });

            // Codec Configuration
            const isWebM = config.format === "webm";
            const codec = isWebM ? "vp09.00.31.08" : "avc1.640034";

            const encoderConfig: any = {
                codec,
                width: config.width,
                height: config.height,
                bitrate: config.bitrate || 15_000_000,
                framerate: config.fps,
            };
            if (!isWebM) {
                encoderConfig.avc = { format: "annexb" };
            }

            encoder.configure(encoderConfig);

            // --- 3. Render Loop ---
            onProgress(0, "Rendering & Encoding...");

            for (let i = 0; i < frameCount; i++) {
                if (this.shouldStop) throw new Error("Cancelled");

                const time = i * dt;

                // A. Sync Renderer logic
                renderer.renderFrame(time, tracks);

                const activeVideos = renderer.getActiveVideoElements();
                if (activeVideos.length > 0) {
                    await Promise.all(
                        activeVideos.map(async (v: any) => {
                            if (!v) return;
                            // Ensure attached
                            if (!v.parentNode) {
                                container.appendChild(v);
                                Object.assign(v.style, {
                                    opacity: "0.01",
                                    position: "absolute",
                                    top: "0",
                                    left: "0",
                                    width: "1px",
                                    height: "1px",
                                });
                            }

                            // 1. ReadyState
                            if (v.readyState < 2) {
                                await new Promise((r) => {
                                    const fn = () => {
                                        v.removeEventListener("canplay", fn);
                                        r(null);
                                    };
                                    v.addEventListener("canplay", fn);
                                    setTimeout(() => {
                                        v.removeEventListener("canplay", fn);
                                        r(null);
                                    }, 5000);
                                });
                            }

                            // 2. Seeking
                            if (v.seeking) {
                                await new Promise((r) => {
                                    const fn = () => {
                                        v.removeEventListener("seeked", fn);
                                        r(null);
                                    };
                                    v.addEventListener("seeked", fn);
                                    setTimeout(() => {
                                        v.removeEventListener("seeked", fn);
                                        r(null);
                                    }, 2000);
                                });
                            }

                            // 3. VideoFrame Verification
                            if (window.VideoFrame) {
                                const expected = v.currentTime * 1e6;
                                let attempts = 0;
                                while (attempts < 20) {
                                    try {
                                        const frame = new VideoFrame(v);
                                        const diff = Math.abs(
                                            frame.timestamp - expected,
                                        );
                                        frame.close();
                                        if (diff < 4000) break; // 4ms tolerance
                                    } catch (e) {}
                                    await new Promise((r) => setTimeout(r, 20));
                                    attempts++;
                                }
                            } else {
                                await new Promise((r) => setTimeout(r, 20));
                            }
                        }),
                    );
                } else {
                    if (i === 0) await new Promise((r) => setTimeout(r, 50));
                }

                // Final Render
                renderer.renderFrame(time, tracks);

                // B. Capture Frame for Encoder
                const canvas = renderer.renderer.domElement;
                const frame = new VideoFrame(canvas, {
                    timestamp: Math.round(i * dt * 1_000_000), // microseconds
                    duration: Math.round(dt * 1_000_000),
                });

                // Encode
                encoder.encode(frame, { keyFrame: i % config.fps === 0 });
                frame.close();

                // C. Flush Check
                if (bufferSize > FLUSH_THRESHOLD) {
                    await flushBuffer();
                }

                // Progress (Notify every frame or every few frames)
                const percent = Math.round((i / frameCount) * 100);
                onProgress(percent, `Rendering Frame ${i}/${frameCount}`);
            } // End Loop

            // Finals
            await encoder.flush();
            await flushBuffer();
            encoder.close();

            // 4. Finish Backend Process
            onProgress(100, "Muxing Video...");
            await fetch(`${API_URL}/render/finish/${sessionId}`, {
                method: "POST",
            });

            // Poll for completion
            let isDone = false;
            while (!isDone && !this.shouldStop) {
                const statusRes = await fetch(
                    `${API_URL}/render/status/${sessionId}`,
                );
                const status = await statusRes.json();

                if (status.status === "done") {
                    isDone = true;
                    // Trigger download
                    window.open(`${API_URL}/render/download/${sessionId}`);
                } else if (status.status === "error") {
                    throw new Error(status.error);
                } else {
                    await new Promise((r) => setTimeout(r, 1000));
                }
            }
        } catch (e: any) {
            console.error("Export failed", e);
            throw e;
        } finally {
            this.isExporting = false;

            // CLEANUP
            renderer.destroy();
            allocator.destroy();
            exportResourceManager.cleanup();

            if (document.body.contains(container)) {
                document.body.removeChild(container);
            }
        }
    }

    public cancel() {
        this.shouldStop = true;
    }
}

export const exportService = new ExportService();
