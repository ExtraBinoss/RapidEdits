import { editorEngine } from "../EditorEngine";
import { ThreeRenderer } from "../renderer/ThreeRenderer";
import { TextureAllocator } from "../renderer/textures/TextureAllocator";

const API_URL = "http://localhost:4001";

export class VideoExportService {
    private isExporting = false;
    private shouldStop = false;

    public async exportVideo(
        config: { width: number; height: number; fps: number; format: string },
        onProgress: (percent: number, status: string) => void,
    ) {
        if (this.isExporting) return;
        this.isExporting = true;
        this.shouldStop = false;

        // Container for shadow renderer
        const container = document.createElement("div");
        container.style.position = "fixed";
        container.style.top = "-9999px"; // Offscreen
        container.style.width = `${config.width}px`;
        container.style.height = `${config.height}px`;
        container.style.visibility = "hidden";
        document.body.appendChild(container);

        // Isolated modules
        const allocator = new TextureAllocator();
        const renderer = new ThreeRenderer(container, allocator);

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

            onProgress(0, "Rendering Frames...");

            for (let i = 0; i < frameCount; i++) {
                if (this.shouldStop) throw new Error("Cancelled");

                const time = i * dt;

                // Sync renderer to this time
                renderer.renderFrame(time, tracks);

                // Wait for all active videos in the SHADOW renderer to seek
                const activeVideos = renderer.getActiveVideoElements();

                if (activeVideos.length > 0) {
                    await Promise.all(
                        activeVideos.map(async (videoEl: HTMLVideoElement) => {
                            const v = videoEl as any;
                            if (!v) return;

                            // Force update if needed?
                            // Since we are NOT in main loop, we need to ensure the video elements are updated

                            // Check readiness
                            if (v.readyState < 2) {
                                await new Promise((r) => {
                                    const onCanPlay = () => {
                                        v.removeEventListener(
                                            "canplay",
                                            onCanPlay,
                                        );
                                        r(null);
                                    };
                                    v.addEventListener("canplay", onCanPlay);
                                    setTimeout(r, 2000);
                                });
                            }

                            // Robust waiting for frame
                            if (v.requestVideoFrameCallback) {
                                await new Promise((r) =>
                                    v.requestVideoFrameCallback(r),
                                );
                            } else {
                                // Fallback
                                await new Promise((r) => setTimeout(r, 20)); // basic drift wait
                            }
                        }),
                    );
                } else {
                    // Start up wait for images
                    if (i === 0) await new Promise((r) => setTimeout(r, 100));
                }

                // Final render to canvas with updated textures
                renderer.renderFrame(time, tracks);

                const canvas = renderer.renderer.domElement;

                // Get Blob
                const blob = await new Promise<Blob | null>((resolve) =>
                    canvas.toBlob(resolve, "image/png"),
                );

                if (!blob) continue;

                // Upload
                const formData = new FormData();
                formData.append("frame", blob);

                await fetch(`${API_URL}/render/frame/${sessionId}/${i}`, {
                    method: "POST",
                    body: formData,
                });

                const percent = Math.round((i / frameCount) * 100);
                onProgress(percent, `Rendering Frame ${i}/${frameCount}`);
            }

            // 3. Finish
            onProgress(100, "Encoding Video...");
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
            // Allocator destroy is handled by renderer destroy? No, separate modules.
            allocator.destroy();

            if (document.body.contains(container)) {
                document.body.removeChild(container);
            }
        }
    }

    public cancel() {
        this.shouldStop = true;
    }
}

export const videoExportService = new VideoExportService();
