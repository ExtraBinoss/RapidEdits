import { editorEngine } from "../EditorEngine";

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

        try {
            const renderer = editorEngine.getRenderer();
            if (!renderer) throw new Error("Renderer not found");

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

            // Pause playback
            if (editorEngine.getIsPlaying()) editorEngine.togglePlayback();

            onProgress(0, "Rendering Frames...");

            for (let i = 0; i < frameCount; i++) {
                if (this.shouldStop) throw new Error("Cancelled");

                const time = i * dt;
                editorEngine.seek(time);

                // Wait for renderer to update
                // 1. Force a "render/sync" cycle on the engine/renderer to update internal video time
                (renderer as any).render();

                // 2. Wait for all active videos to seek to the target time
                const activeVideos = (renderer as any).getActiveVideoElements();
                if (activeVideos.length > 0) {
                    await Promise.all(
                        activeVideos.map(async (videoEl: HTMLVideoElement) => {
                            const v = videoEl as any; // Cast to any to avoid TS issues with requestVideoFrameCallback
                            if (!v) return;

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
                                    setTimeout(r, 1000);
                                });
                            }

                            if (v.requestVideoFrameCallback) {
                                await new Promise((r) =>
                                    v.requestVideoFrameCallback(r),
                                );
                            } else {
                                if (v.seeking) {
                                    await new Promise((r) => {
                                        const onSeeked = () => {
                                            v.removeEventListener(
                                                "seeked",
                                                onSeeked,
                                            );
                                            r(null);
                                        };
                                        v.addEventListener("seeked", onSeeked);
                                        setTimeout(r, 500);
                                    });
                                }
                                await new Promise((r) => setTimeout(r, 20));
                            }
                        }),
                    );
                } else {
                    // No videos, just wait a tick for images/canvas
                    await new Promise((r) => requestAnimationFrame(r));
                }

                // Final render to canvas with updated textures
                (renderer as any).render();

                const canvas = renderer.renderer.domElement; // Access internal threejs renderer dom

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
        }
    }

    public cancel() {
        this.shouldStop = true;
    }
}

export const videoExportService = new VideoExportService();
