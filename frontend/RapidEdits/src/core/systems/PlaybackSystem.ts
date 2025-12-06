import { globalEventBus } from "../EventBus";
import { audioManager } from "../AudioManager";

export class PlaybackSystem {
    private currentTime: number = 0;
    private isPlaying: boolean = false;
    private animationFrameId: number | null = null;
    private masterVolume: number = 1.0; // 0 to 1

    constructor() {}

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

    public getVolume(): number {
        return this.masterVolume;
    }
}
