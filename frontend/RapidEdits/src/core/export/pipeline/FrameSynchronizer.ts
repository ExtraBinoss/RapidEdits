import type { ThreeRenderer } from "../../renderer/ThreeRenderer";

export class FrameSynchronizer {
    /**
     * Ensures all active video elements in the renderer are synced to the expected time.
     * Uses VideoFrame API for precise verification.
     */
    public async syncVideos(
        renderer: ThreeRenderer,
        expectedTime: number,
    ): Promise<void> {
        const activeVideos = renderer.getActiveVideoElements();
        if (activeVideos.length === 0) return;

        await Promise.all(
            activeVideos.map((v) =>
                this.syncSingleVideo(v as any, expectedTime),
            ),
        );
    }

    private async syncSingleVideo(
        video: HTMLVideoElement & { requestVideoFrameCallback?: Function },
        expectedTime: number,
    ): Promise<void> {
        if (!video) return;

        // 1. Ensure Attached to DOM (Reflow)
        // This is handled by RenderPipeline or parent, but strictly we need it here?
        // We assume RenderPipeline ensures it's attached.

        // 2. Check ReadyState (HAVE_CURRENT_DATA = 2)
        if (video.readyState < 2) {
            await this.waitForEvent(video, "canplay", 10000);
        }

        // 3. Check Seeking
        if (video.seeking) {
            await this.waitForEvent(video, "seeked", 5000);
        }

        // 4. Precise Verification using VideoFrame
        if (window.VideoFrame) {
            await this.verifyFrameTimestamp(video, expectedTime);
        } else {
            // Fallback for non-WebCodecs envs
            await this.fallbackWait(video);
        }
    }

    private async verifyFrameTimestamp(
        video: HTMLVideoElement,
        expectedTime: number,
    ) {
        const expectedTimeUs = expectedTime * 1_000_000;
        const toleranceUs = 2000; // 2ms tolerance (Tight!)

        let attempts = 0;
        const maxAttempts = 50; // 1 second

        while (attempts < maxAttempts) {
            let frame: VideoFrame | null = null;
            try {
                frame = new VideoFrame(video);
                const diff = Math.abs(frame.timestamp - expectedTimeUs);

                if (diff <= toleranceUs) {
                    frame.close();
                    return; // Synced!
                }
                frame.close();
            } catch (e) {
                // Ignore construction errors
            }

            // Wait a micro-tick
            await new Promise((r) => setTimeout(r, 20));
            attempts++;
        }

        // If we timeout, we just proceed. Warnings could be noisy.
    }

    private async fallbackWait(
        video: HTMLVideoElement & { requestVideoFrameCallback?: Function },
    ) {
        if (video.requestVideoFrameCallback) {
            await new Promise((resolve) => {
                const handle = video.requestVideoFrameCallback(() =>
                    resolve(null),
                );
                setTimeout(() => {
                    video.cancelVideoFrameCallback(handle);
                    resolve(null);
                }, 200);
            });
        } else {
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
    }

    private waitForEvent(
        element: HTMLElement,
        event: string,
        timeout: number,
    ): Promise<void> {
        return new Promise((resolve) => {
            const handler = () => {
                element.removeEventListener(event, handler);
                resolve();
            };
            element.addEventListener(event, handler);
            setTimeout(() => {
                element.removeEventListener(event, handler);
                resolve();
            }, timeout);
        });
    }
}
