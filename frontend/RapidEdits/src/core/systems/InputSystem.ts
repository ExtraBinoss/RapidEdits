import { globalEventBus } from "../EventBus";
import { PlaybackSystem } from "./PlaybackSystem";
import { TimelineSystem } from "./TimelineSystem";
import { SelectionSystem } from "./SelectionSystem";

export class InputSystem {
    private mouseX: number = 0;
    private mouseY: number = 0;

    // Dependencies to trigger actions
    private playbackSystem?: PlaybackSystem;
    // @ts-ignore
    private timelineSystem?: TimelineSystem; // Reserved for future shortcuts
    private selectionSystem?: SelectionSystem;

    constructor() {
        this.setupGlobalMouseTracking();
        this.setupShortcuts();
    }

    public bindSystems(
        playback: PlaybackSystem,
        timeline: TimelineSystem,
        selection: SelectionSystem,
    ) {
        this.playbackSystem = playback;
        this.timelineSystem = timeline;
        this.selectionSystem = selection;
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
                    if (this.playbackSystem) {
                        this.playbackSystem.togglePlayback();
                        globalEventBus.emit({
                            type: "SHOW_FEEDBACK",
                            payload: {
                                icon: this.playbackSystem.getIsPlaying()
                                    ? "Play"
                                    : "Pause",
                            },
                        });
                    }
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    if (this.playbackSystem) {
                        this.playbackSystem.setVolume(
                            Math.min(1, this.playbackSystem.getVolume() + 0.1),
                        );
                    }
                    break;
                case "ArrowDown":
                    e.preventDefault();
                    if (this.playbackSystem) {
                        this.playbackSystem.setVolume(
                            Math.max(0, this.playbackSystem.getVolume() - 0.1),
                        );
                    }
                    break;
                case "Delete":
                case "Backspace":
                    // Optional: bind delete key directly or keep it in UI
                    if (this.selectionSystem) {
                        this.selectionSystem.deleteSelectedClips();
                    }
                    break;
            }
        });
    }
}
