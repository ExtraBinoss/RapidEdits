import { editorEngine } from "./EditorEngine";
import { resourceManager } from "./ResourceManager";
import type { Clip } from "../types/Timeline";

export class AudioManager {
    constructor() {
        // Optional: could listen to events to optimize, but loop is safer for sync
    }

    private lastActiveAssetIds: Set<string> = new Set();

    public async sync(
        currentTime: number,
        isPlaying: boolean,
        masterVolume: number,
    ) {
        const tracks = editorEngine.getTracks();
        const activeClips: Clip[] = [];
        const currentActiveAssetIds = new Set<string>();

        tracks.forEach((track) => {
            if (track.type !== "audio" || track.isMuted) return;

            const clip = track.clips.find(
                (c) =>
                    currentTime >= c.start &&
                    currentTime < c.start + c.duration,
            );
            if (clip) {
                activeClips.push(clip);
                currentActiveAssetIds.add(clip.assetId);
            }
        });

        // 1. cleanup stale audio
        for (const assetId of this.lastActiveAssetIds) {
            if (!currentActiveAssetIds.has(assetId)) {
                // Was playing, now isn't -> Ensure paused
                const asset = editorEngine.getAsset(assetId);
                if (asset) {
                    // We don't await because good chance it's cached.
                    // If strictly not cached, it wasn't playing anyway.
                    resourceManager.getElement(asset, "audio").then((el) => {
                        el.pause();
                    });
                }
            }
        }
        this.lastActiveAssetIds = currentActiveAssetIds;

        for (const clip of activeClips) {
            const asset = editorEngine.getAsset(clip.assetId);
            if (!asset) continue;

            try {
                // Request 'audio' variant to ensure we get a separate element from the video renderer
                // This prevents seeking conflicts if the same asset is used for video and audio tracks at different times
                const element = await resourceManager.getElement(
                    asset,
                    "audio",
                );

                // Safety check
                if (
                    element instanceof HTMLVideoElement &&
                    element.readyState < 2
                )
                    continue;

                // Calculate internal time
                const clipTime = currentTime - clip.start + clip.offset;

                // --- Sync Volume (including transitions) ---
                let volumeMultiplier = 1.0;
                const transitions = clip.data?.transitions;

                if (transitions) {
                    // Fade In
                    if (transitions.fadeIn) {
                        const duration = transitions.fadeIn.duration || 1.0;
                        const progress = (currentTime - clip.start) / duration;
                        if (progress >= 0 && progress <= 1) {
                            const alpha = this.applyEasing(
                                progress,
                                transitions.fadeIn.easing || "linear",
                            );
                            volumeMultiplier *= alpha;
                        } else if (progress < 0) {
                            volumeMultiplier = 0;
                        }
                    }

                    // Fade Out
                    if (transitions.fadeOut) {
                        const duration = transitions.fadeOut.duration || 1.0;
                        const fadeOutStart =
                            clip.start + clip.duration - duration;
                        const progress = (currentTime - fadeOutStart) / duration;
                        if (progress >= 0 && progress <= 1) {
                            const alpha = this.applyEasing(
                                progress,
                                transitions.fadeOut.easing || "linear",
                            );
                            volumeMultiplier *= 1.0 - alpha;
                        } else if (progress > 1) {
                            volumeMultiplier = 0;
                        }
                    }
                }

                element.volume = masterVolume * volumeMultiplier;
                element.muted = false;

                // Sync Threshold
                // If video, be very passive (let ThreeRenderer drive)
                // If audio, be moderately strict
                const threshold = asset.type === "video" ? 0.5 : 0.3;

                // Sync Playback Time
                const drift = Math.abs(element.currentTime - clipTime);
                if (drift > threshold) {
                    // Only seek if significantly off
                    if (!element.seeking) {
                        /*
                        console.warn(
                            `[Audio] Sync Seek: ${drift.toFixed(3)}s > ${threshold}s`,
                        );
                        */
                        element.currentTime = clipTime;
                    }
                }

                // Sync Play State
                if (isPlaying) {
                    if (element.paused) {
                        const playPromise = element.play();
                        if (playPromise !== undefined) {
                            playPromise.catch(() => {
                                // Ignore auto-play blocks
                            });
                        }
                    }
                } else {
                    if (!element.paused) element.pause();
                }
            } catch (e) {
                console.error("Audio sync error", e);
            }
        }
    }

    private applyEasing(progress: number, easing: string): number {
        switch (easing) {
            case "easeIn":
                return progress * progress;
            case "easeOut":
                return progress * (2 - progress);
            case "easeInOut":
                return progress < 0.5
                    ? 2 * progress * progress
                    : -1 + (4 - 2 * progress) * progress;
            case "linear":
            default:
                return progress;
        }
    }
}

export const audioManager = new AudioManager();
