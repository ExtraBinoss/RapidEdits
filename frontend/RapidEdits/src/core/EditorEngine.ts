import { v4 as uuidv4 } from "uuid";
import { globalEventBus } from "./EventBus";
import { MediaType, type Asset, type MediaTypeValue } from "../types/Media";
import type { Track, Clip } from "../types/Timeline";
import { audioManager } from "./AudioManager";

export class EditorEngine {
    private assets: Map<string, Asset> = new Map();
    private tracks: Track[] = [];

    // State
    private currentTime: number = 0;
    private isPlaying: boolean = false;
    private animationFrameId: number | null = null;
    private masterVolume: number = 1.0; // 0 to 1
    private isSnappingEnabled: boolean = true;

    // ... mouse tracking ...

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

    public getSnapPoints(excludeClipId?: string): number[] {
        const points = new Set<number>();
        points.add(0);
        points.add(this.currentTime);

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
        excludeClipId?: string,
    ): number | null {
        if (!this.isSnappingEnabled) return null;

        const points = this.getSnapPoints(excludeClipId);
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

    private mouseX: number = 0;
    private mouseY: number = 0;

    constructor() {
        this.initializeTracks();
        this.setupShortcuts();
        this.setupGlobalMouseTracking();
    }

    private setupGlobalMouseTracking() {
        const updatePos = (e: MouseEvent) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        };

        window.addEventListener("mousemove", updatePos, { passive: true });
        window.addEventListener("mousedown", updatePos, {
            passive: true,
            capture: true,
        });
    }

    public getMousePosition() {
        return { x: this.mouseX, y: this.mouseY };
    }

    private initializeTracks() {
        this.tracks = [];
    }

    private setupShortcuts() {
        window.addEventListener("keydown", (e) => {
            // Ignore if input focused
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement
            )
                return;

            switch (e.code) {
                case "Space":
                    e.preventDefault();
                    this.togglePlayback();
                    globalEventBus.emit({
                        type: "SHOW_FEEDBACK",
                        payload: { icon: this.isPlaying ? "Play" : "Pause" },
                    });
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    this.setVolume(Math.min(1, this.masterVolume + 0.1));
                    break;
                case "ArrowDown":
                    e.preventDefault();
                    this.setVolume(Math.max(0, this.masterVolume - 0.1));
                    break;
            }
        });
    }

    // --- Asset Management ---

    public async addAsset(file: File): Promise<Asset> {
        const type = this.determineMediaType(file.type);
        const url = URL.createObjectURL(file);

        let duration = 0;
        if (type === MediaType.VIDEO || type === MediaType.AUDIO) {
            duration = await this.getMediaDuration(url);
        } else {
            duration = 5;
        }

        const asset: Asset = {
            id: uuidv4(),
            file,
            url,
            name: file.name,
            type,
            size: file.size,
            duration,
            createdAt: Date.now(),
        };

        this.assets.set(asset.id, asset);
        globalEventBus.emit({ type: "ASSET_ADDED", payload: asset });
        return asset;
    }

    public removeAsset(id: string) {
        if (this.assets.has(id)) {
            const asset = this.assets.get(id);
            if (asset?.url) URL.revokeObjectURL(asset.url);
            this.assets.delete(id);
            globalEventBus.emit({ type: "ASSET_REMOVED", payload: id });
        }
    }

    public getAsset(id: string): Asset | undefined {
        return this.assets.get(id);
    }

    // --- Timeline Management ---

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
        const asset = this.assets.get(assetId);
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

        // 1. Add Main Clip
        const mainClip = this.createClipObject(
            asset,
            targetTrack.id,
            startTime,
        );
        targetTrack.clips.push(mainClip);
        targetTrack.clips.sort((a, b) => a.start - b.start);

        // 2. If Video, try to add Audio part to an Audio track
        // Only if we haven't just redirected (i.e. if we are indeed handling a Video asset)
        if (asset.type === MediaType.VIDEO) {
            // Find an audio track that has space at the given time
            // Or if we just created a new video track (by checking if targetTrack has only 1 clip),
            // maybe we prefer a new audio track for symmetry?

            // Heuristic: Try to find ANY audio track where this clip fits
            let audioTrack = this.tracks
                .filter((t) => t.type === "audio")
                .find((track) => {
                    // Check for collision
                    // Simple collision check: does any clip overlap with [start, start + duration]
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
        // 1. Find the Primary Clip roughly to calculate delta
        let originalStart = -1;
        let originalAssetId = "";
        let deltaStart = 0;

        // Helper to find clip by ID
        const findClip = (targetId: string) => {
            for (const track of this.tracks) {
                const c = track.clips.find((x) => x.id === targetId);
                if (c) return c;
            }
            return null;
        };

        const primaryClip = findClip(id);
        if (!primaryClip) return;

        originalStart = primaryClip.start;
        originalAssetId = primaryClip.assetId;

        if (updates.start !== undefined) {
            deltaStart = updates.start - originalStart;
        }

        // 2. Perform updates on Primary AND Linked clips
        const clipsToUpdate = new Set<string>();
        clipsToUpdate.add(id);

        // Find linked clips (same asset, same start/duration, different type)
        if (deltaStart !== 0 && originalAssetId) {
            this.tracks.forEach((t) => {
                t.clips.forEach((c) => {
                    if (
                        c.id !== id &&
                        c.assetId === originalAssetId &&
                        Math.abs(c.start - originalStart) < 0.001
                    ) {
                        clipsToUpdate.add(c.id);
                    }
                });
            });
        }

        let anythingChanged = false;

        // 3. Apply updates
        for (let i = 0; i < this.tracks.length; i++) {
            const track = this.tracks[i];
            if (!track) continue;

            const indexesToUpdate = track.clips
                .map((c, idx) => (clipsToUpdate.has(c.id) ? idx : -1))
                .filter((idx) => idx !== -1);

            if (indexesToUpdate.length === 0) continue;

            // Create new Clips array
            const newClips = [...track.clips];

            indexesToUpdate.forEach((idx) => {
                const clip = newClips[idx];
                if (!clip) return;
                // Calculate specific updates for this clip
                // If it's the primary clip, use 'updates'
                // If it's a linked clip, apply calculated delta to start

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

            // Re-sort
            if (updates.start !== undefined || deltaStart !== 0) {
                newClips.sort((a, b) => a.start - b.start);
            }

            // Update Track
            this.tracks[i] = { ...track, clips: newClips } as Track;
            anythingChanged = true;
        }

        if (anythingChanged) {
            globalEventBus.emit({
                type: "TIMELINE_UPDATED",
                payload: undefined,
            });
        }
    }

    // --- Playback Controls ---

    public togglePlayback() {
        this.isPlaying = !this.isPlaying;
        globalEventBus.emit({
            type: "PLAYBACK_TOGGLED",
            payload: this.isPlaying,
        });

        if (this.isPlaying) {
            let lastTime = performance.now();

            const tick = () => {
                if (!this.isPlaying) return;

                const now = performance.now();
                const delta = (now - lastTime) / 1000;
                lastTime = now;

                this.currentTime += delta;
                globalEventBus.emit({
                    type: "PLAYBACK_TIME_UPDATED",
                    payload: this.currentTime,
                });

                // Sync Audio Loop
                audioManager.sync(
                    this.currentTime,
                    this.isPlaying,
                    this.masterVolume,
                );

                this.animationFrameId = requestAnimationFrame(tick);
            };

            this.animationFrameId = requestAnimationFrame(tick);
        } else {
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
            // Force one sync to pause everything
            audioManager.sync(this.currentTime, false, this.masterVolume);
        }
    }

    public seek(time: number) {
        this.currentTime = Math.max(0, time);
        globalEventBus.emit({
            type: "PLAYBACK_TIME_UPDATED",
            payload: this.currentTime,
        });
        // Sync immediately to scrub sound? Maybe debounce this
        audioManager.sync(this.currentTime, this.isPlaying, this.masterVolume);
    }

    public setVolume(vol: number) {
        this.masterVolume = Math.max(0, Math.min(1, vol));
        globalEventBus.emit({
            type: "VOLUME_CHANGED",
            payload: this.masterVolume,
        });
        globalEventBus.emit({
            type: "SHOW_FEEDBACK",
            payload: {
                icon: "Volume",
                text: `${Math.round(this.masterVolume * 100)}%`,
            },
        });
    }

    public getCurrentTime(): number {
        return this.currentTime;
    }

    public getIsPlaying(): boolean {
        return this.isPlaying;
    }

    // --- Helpers ---

    private determineMediaType(mimeType: string): MediaTypeValue {
        if (mimeType.startsWith("video/")) return MediaType.VIDEO;
        if (mimeType.startsWith("audio/")) return MediaType.AUDIO;
        if (mimeType.startsWith("image/")) return MediaType.IMAGE;
        return MediaType.UNKNOWN;
    }

    private getMediaDuration(url: string): Promise<number> {
        return new Promise((resolve) => {
            const element = document.createElement("video");
            element.preload = "metadata";

            const timeout = setTimeout(() => {
                console.warn("Metadata load timed out for:", url);
                resolve(0);
                element.remove();
            }, 3000);

            element.onloadedmetadata = () => {
                clearTimeout(timeout);
                if (element.duration === Infinity) {
                    console.warn("Duration is Infinity for:", url);
                    resolve(0);
                } else {
                    resolve(element.duration);
                }
                element.remove();
            };

            element.onerror = () => {
                clearTimeout(timeout);
                console.error("Failed to load metadata:", element.error, url);
                resolve(0);
                element.remove();
            };

            element.src = url;
        });
    }
}

export const editorEngine = new EditorEngine();
