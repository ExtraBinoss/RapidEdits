import { AssetSystem } from "./systems/AssetSystem";
import { TimelineSystem } from "./systems/TimelineSystem";
import { SelectionSystem } from "./systems/SelectionSystem";
import { PlaybackSystem } from "./systems/PlaybackSystem";
import { InputSystem } from "./systems/InputSystem";
import { globalEventBus } from "./events/EventBus";
import type { Asset } from "../types/Media";
import type { Track, Clip } from "../types/Timeline";

export class EditorEngine {
    // Public Systems
    public assetSystem: AssetSystem;
    public timelineSystem: TimelineSystem;
    public selectionSystem: SelectionSystem;
    public playbackSystem: PlaybackSystem;
    public inputSystem: InputSystem;

    // Tools State
    private activeTool: "select" | "razor" = "select";

    // Renderer Access
    private _renderer: any = null; // Type: ThreeRenderer

    constructor() {
        this.assetSystem = new AssetSystem();
        this.timelineSystem = new TimelineSystem(this.assetSystem);
        this.selectionSystem = new SelectionSystem(this.timelineSystem);
        this.playbackSystem = new PlaybackSystem();
        this.inputSystem = new InputSystem();

        // Bind Input System
        this.inputSystem.bindSystems(
            this.playbackSystem,
            this.timelineSystem,
            this.selectionSystem,
        );
    }

    // --- Facade Methods (Delegation) ---

    // Timeline
    public getTracks(): Track[] {
        return this.timelineSystem.getTracks();
    }

    public addTrack(type: "video" | "audio" | "text" | "image" | "custom"): Track {
        return this.timelineSystem.addTrack(type);
    }

    public addClip(assetId: string, targetTrackId: number, startTime: number) {
        this.timelineSystem.addClip(assetId, targetTrackId, startTime);
    }

    public updateClip(id: string, updates: Partial<Clip>) {
        this.timelineSystem.updateClip(id, updates);
    }

    public splitClip(clipId: string, time: number) {
        this.timelineSystem.splitClip(clipId, time);
    }

    // Snapping
    public toggleSnapping() {
        return this.timelineSystem.toggleSnapping();
    }

    public getIsSnappingEnabled() {
        return this.timelineSystem.getIsSnappingEnabled();
    }

    public getSnapPoints(excludeClipId?: string): number[] {
        return this.timelineSystem.getSnapPoints(
            this.getCurrentTime(),
            excludeClipId,
        );
    }

    public getClosestSnapPoint(
        time: number,
        thresholdSeconds: number,
        excludeClipId?: string,
    ): number | null {
        return this.timelineSystem.getClosestSnapPoint(
            time,
            thresholdSeconds,
            this.getCurrentTime(),
            excludeClipId,
        );
    }

    // Tools
    public setTool(tool: "select" | "razor") {
        this.activeTool = tool;
        globalEventBus.emit({ type: "TOOL_CHANGED", payload: tool });
    }

    public getTool() {
        return this.activeTool;
    }

    // Selection
    public selectClip(id: string, toggle: boolean = false) {
        this.selectionSystem.selectClip(id, toggle);
    }

    public getSelectedClipIds() {
        return this.selectionSystem.getSelectedClipIds();
    }

    public deleteSelectedClips() {
        this.selectionSystem.deleteSelectedClips();
    }

    public unlinkSelectedClips() {
        this.selectionSystem.unlinkSelectedClips();
    }

    // Playback
    public togglePlayback() {
        this.playbackSystem.togglePlayback();
    }

    public seek(time: number) {
        this.playbackSystem.seek(time);
    }

    public setVolume(vol: number) {
        this.playbackSystem.setVolume(vol);
    }

    public getCurrentTime(): number {
        return this.playbackSystem.getCurrentTime();
    }

    public getIsPlaying(): boolean {
        return this.playbackSystem.getIsPlaying();
    }

    // Asset
    public async addAsset(file: File): Promise<Asset> {
        return this.assetSystem.addAsset(file);
    }

    public removeAsset(id: string) {
        this.assetSystem.removeAsset(id);
    }

    public getAsset(id: string): Asset | undefined {
        return this.assetSystem.getAsset(id);
    }

    public getMousePosition() {
        return this.inputSystem.getMousePosition();
    }

    public registerRenderer(renderer: any) {
        this._renderer = renderer;
    }

    public getRenderer() {
        return this._renderer;
    }
}

export const editorEngine = new EditorEngine();
