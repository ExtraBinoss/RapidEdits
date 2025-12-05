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

    constructor() {
        console.log("Editor Engine Initialized");
        this.initializeTracks();
        this.setupShortcuts();
    }

    private initializeTracks() {
        this.tracks = [
            {
                id: 1,
                name: "Video 1",
                type: "video",
                isMuted: false,
                isLocked: false,
                clips: [],
            },
            {
                id: 2,
                name: "Audio 1",
                type: "audio",
                isMuted: false,
                isLocked: false,
                clips: [],
            },
            {
                id: 3,
                name: "Overlay",
                type: "video",
                isMuted: false,
                isLocked: false,
                clips: [],
            },
            {
                id: 4,
                name: "Audio 2",
                type: "audio",
                isMuted: false,
                isLocked: false,
                clips: [],
            },
        ];
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

    public addClip(assetId: string, targetTrackId: number, startTime: number) {
        const asset = this.assets.get(assetId);
        if (!asset) return;

        const targetTrack = this.tracks.find((t) => t.id === targetTrackId);
        if (!targetTrack) return;

        // 1. Add Main Clip
        const mainClip = this.createClipObject(asset, targetTrackId, startTime);
        targetTrack.clips.push(mainClip);
        targetTrack.clips.sort((a, b) => a.start - b.start);

        // 2. If Video, try to add Audio part to the next available Audio track
        if (asset.type === MediaType.VIDEO) {
            const audioTrack = this.tracks.find(
                (t) => t.type === "audio" && t.id > targetTrackId,
            );

            if (audioTrack) {
                const audioClip = this.createClipObject(
                    asset,
                    audioTrack.id,
                    startTime,
                    'audio' // Force type audio for the separated track
                );
                // Link them visually? For now just ID match
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
        typeOverride?: MediaTypeValue
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