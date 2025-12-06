import { v4 as uuidv4 } from "uuid";
import { globalEventBus } from "../EventBus";
import { MediaType, type Asset, type MediaTypeValue } from "../../types/Media";
import type { Track, Clip } from "../../types/Timeline";
import { AssetSystem } from "./AssetSystem";

export class TimelineSystem {
    private tracks: Track[] = [];
    private assetSystem: AssetSystem;

    constructor(assetSystem: AssetSystem) {
        this.assetSystem = assetSystem;
        this.initializeTracks();
    }

    private initializeTracks() {
        this.tracks = [];
    }

    public getTracks(): Track[] {
        return this.tracks;
    }

    public addTrack(type: "video" | "audio"): Track {
        const id =
            this.tracks.length > 0
                ? Math.max(...this.tracks.map((t) => t.id)) + 1
                : 1;
        const count = this.tracks.filter((t) => t.type === type).length + 1;
        const name = type === "video" ? `Video ${count}` : `Audio ${count}`;

        const newTrack: Track = {
            id,
            name,
            type,
            isMuted: false,
            isLocked: false,
            clips: [],
        };

        this.tracks.push(newTrack);
        globalEventBus.emit({ type: "TIMELINE_UPDATED", payload: undefined });
        return newTrack;
    }

    public addClip(assetId: string, targetTrackId: number, startTime: number) {
        const asset = this.assetSystem.getAsset(assetId);
        if (!asset) return;

        let targetTrack = this.tracks.find((t) => t.id === targetTrackId);
        if (!targetTrack) return;

        // Force correct track type
        // If trying to put Audio on Video track -> Switch to Audio track
        if (targetTrack.type === "video" && asset.type === MediaType.AUDIO) {
            // Find or create audio track
            let audioTrack = this.tracks.find((t) => t.type === "audio");
            if (!audioTrack) {
                audioTrack = this.addTrack("audio");
            }
            targetTrack = audioTrack;
        }
        // If trying to put Video on Audio track -> Switch to Video track
        else if (
            targetTrack.type === "audio" &&
            asset.type === MediaType.VIDEO
        ) {
            let videoTrack = this.tracks.find((t) => t.type === "video");
            if (!videoTrack) {
                videoTrack = this.addTrack("video");
            }
            targetTrack = videoTrack;
        }

        // Generate Group ID if this is a video with audio
        const groupId = asset.type === MediaType.VIDEO ? uuidv4() : undefined;

        // 1. Add Main Clip
        const mainClip = this.createClipObject(
            asset,
            targetTrack.id,
            startTime,
        );
        mainClip.groupId = groupId; // Set Group ID
        targetTrack.clips.push(mainClip);
        targetTrack.clips.sort((a, b) => a.start - b.start);

        // 2. If Video, try to add Audio part to an Audio track
        // Only if we haven't just redirected (i.e. if we are indeed handling a Video asset)
        if (asset.type === MediaType.VIDEO) {
            // Find an audio track that has space at the given time
            // Heuristic: Try to find ANY audio track where this clip fits
            let audioTrack = this.tracks
                .filter((t) => t.type === "audio")
                .find((track) => {
                    // Check for collision
                    const hasCollision = track.clips.some((clip) => {
                        const cStart = clip.start;
                        const cEnd = clip.start + clip.duration;
                        const newStart = startTime;
                        const newEnd = startTime + asset.duration!;

                        return cStart < newEnd && cEnd > newStart;
                    });
                    return !hasCollision;
                });

            // If no suitable track found, create one
            if (!audioTrack) {
                audioTrack = this.addTrack("audio");
            }

            if (audioTrack) {
                const audioClip = this.createClipObject(
                    asset,
                    audioTrack.id,
                    startTime,
                    "audio", // Force type audio for the separated track
                );
                audioClip.groupId = groupId; // Link via same Group ID
                audioTrack.clips.push(audioClip);
                audioTrack.clips.sort((a, b) => a.start - b.start);
            }
        }

        globalEventBus.emit({ type: "TIMELINE_UPDATED", payload: undefined });
    }

    private createClipObject(
        asset: Asset,
        trackId: number,
        start: number,
        typeOverride?: MediaTypeValue,
    ): Clip {
        return {
            id: uuidv4(),
            assetId: asset.id,
            trackId,
            name: asset.name,
            start,
            duration: asset.duration || 5,
            offset: 0,
            type: typeOverride || asset.type,
        };
    }

    public updateClip(id: string, updates: Partial<Clip>) {
        // Find Primary
        let groupId: string | undefined = undefined;
        let deltaStart = 0;
        let originalStart = 0;

        for (const track of this.tracks) {
            const clip = track.clips.find((c) => c.id === id);
            if (clip) {
                groupId = clip.groupId; // Get group ID
                originalStart = clip.start;
                break;
            }
        }

        if (updates.start !== undefined) {
            deltaStart = updates.start - originalStart;
        }

        // Identify clips to update: Primary + Same Group
        // OR if GroupId is undefined, just the primary.
        const clipsToUpdate = new Set<string>();
        clipsToUpdate.add(id);

        if (groupId && deltaStart !== 0) {
            this.tracks.forEach((t) => {
                t.clips.forEach((c) => {
                    if (c.groupId === groupId && c.id !== id) {
                        clipsToUpdate.add(c.id);
                    }
                });
            });
        }

        let anythingChanged = false;

        for (let i = 0; i < this.tracks.length; i++) {
            const track = this.tracks[i];
            if (!track) continue;

            const indexesToUpdate = track.clips
                .map((c, idx) => (clipsToUpdate.has(c.id) ? idx : -1))
                .filter((idx) => idx !== -1);

            if (indexesToUpdate.length === 0) continue;

            const newClips = [...track.clips];

            indexesToUpdate.forEach((idx) => {
                const clip = newClips[idx];
                if (!clip) return;

                let specificUpdates = {};
                if (clip.id === id) {
                    specificUpdates = updates;
                } else {
                    // Linked clip
                    specificUpdates = {
                        start: clip.start + deltaStart,
                    };
                }

                newClips[idx] = { ...clip, ...specificUpdates } as Clip;
            });

            if (updates.start !== undefined || deltaStart !== 0) {
                newClips.sort((a, b) => a.start - b.start);
            }

            const updatedTrack: Track = { ...track, clips: newClips } as Track;
            this.tracks[i] = updatedTrack;
            anythingChanged = true;
        }

        if (anythingChanged) {
            globalEventBus.emit({
                type: "TIMELINE_UPDATED",
                payload: undefined,
            });
        }
    }

    public updateTrackClips(trackId: number, newClips: Clip[]) {
        const trackIndex = this.tracks.findIndex((t) => t.id === trackId);
        if (trackIndex !== -1) {
            this.tracks[trackIndex] = {
                ...this.tracks[trackIndex],
                clips: newClips,
            } as Track;
            // We might want to trigger updates here, but often this is used internally by bulk operations
        }
    }

    // Snapping
    private isSnappingEnabled: boolean = true;

    public toggleSnapping() {
        this.isSnappingEnabled = !this.isSnappingEnabled;
        globalEventBus.emit({
            type: "SHOW_FEEDBACK",
            payload: {
                icon: "Magnet",
                text: this.isSnappingEnabled ? "Snapping On" : "Snapping Off",
            },
        });
        return this.isSnappingEnabled;
    }

    public getIsSnappingEnabled() {
        return this.isSnappingEnabled;
    }

    public getSnapPoints(
        currentTime: number,
        excludeClipId?: string,
    ): number[] {
        const points = new Set<number>();
        points.add(0);
        points.add(currentTime);

        this.tracks.forEach((track) => {
            track.clips.forEach((clip) => {
                if (clip.id === excludeClipId) return;
                points.add(clip.start);
                points.add(clip.start + clip.duration);
            });
        });

        return Array.from(points).sort((a, b) => a - b);
    }

    public getClosestSnapPoint(
        time: number,
        thresholdSeconds: number,
        currentTime: number,
        excludeClipId?: string,
    ): number | null {
        if (!this.isSnappingEnabled) return null;

        const points = this.getSnapPoints(currentTime, excludeClipId);
        let closest = null;
        let minDiff = thresholdSeconds;

        for (const point of points) {
            const diff = Math.abs(point - time);
            if (diff < minDiff) {
                minDiff = diff;
                closest = point;
            }
        }

        return closest;
    }
}
