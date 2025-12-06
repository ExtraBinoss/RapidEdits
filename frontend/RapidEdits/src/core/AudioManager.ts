import { editorEngine } from "./EditorEngine";
import { resourceManager } from "./ResourceManager";
import type { Clip } from "../types/Timeline";

export class AudioManager {
    constructor() {
        // Optional: could listen to events to optimize, but loop is safer for sync
    }

    public async sync(
        currentTime: number,
        isPlaying: boolean,
        masterVolume: number,
    ) {
        const tracks = editorEngine.getTracks();

        const activeClips: Clip[] = [];
        tracks.forEach((track) => {
            if (track.type !== "audio" || track.isMuted) return;

            const clip = track.clips.find(
                (c) =>
                    currentTime >= c.start &&
                    currentTime < c.start + c.duration,
            );
            if (clip) activeClips.push(clip);
        });

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

                // Sync Volume
                element.volume = masterVolume;
                element.muted = false;

                // Calculate internal time
                const clipTime = currentTime - clip.start + clip.offset;

                // Sync Threshold
                // If video, be very passive (let ThreeRenderer drive)
                // If audio, be moderately strict
                const threshold = asset.type === "video" ? 0.5 : 0.3;

                // Sync Playback Time
                const drift = Math.abs(element.currentTime - clipTime);
                if (drift > threshold) {
                    // Only seek if significantly off
                    if (!element.seeking) {
                        console.warn(
                            `[Audio] Sync Seek: ${drift.toFixed(3)}s > ${threshold}s`,
                        );
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
}

export const audioManager = new AudioManager();
