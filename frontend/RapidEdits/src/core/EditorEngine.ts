import { v4 as uuidv4 } from "uuid";
import { AssetSystem } from "./systems/AssetSystem";
import { TimelineSystem } from "./systems/TimelineSystem";
import { SelectionSystem } from "./systems/SelectionSystem";
import { PlaybackSystem } from "./systems/PlaybackSystem";
import { InputSystem } from "./systems/InputSystem";
import { RecordingSystem } from "./systems/RecordingSystem";
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
    public recordingSystem: RecordingSystem;

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
        this.recordingSystem = new RecordingSystem();

        // Bind Input System
        this.inputSystem.bindSystems(
            this.playbackSystem,
            this.timelineSystem,
            this.selectionSystem,
        );

        // Listen for recording finished
        globalEventBus.on('RECORDING_FINISHED', async ({ blob, cursorData }) => {
            await this.handleRecordingFinished(blob, cursorData);
        });
    }

    private async handleRecordingFinished(blob: Blob, cursorData: any[]) {
        // 1. Create a File object
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `Recording-${timestamp}.webm`;
        const file = new File([blob], filename, { type: 'video/webm' });

        // 2. Add to Asset System
        const asset = await this.assetSystem.addAsset(file);

        // 3. Find/Create Video Track
        let videoTrack = this.timelineSystem.getTracks().find(t => t.type === 'video');
        if (!videoTrack) videoTrack = this.timelineSystem.addTrack('video');

        // 4. Add Clip to Timeline at Playhead or at end
        const startTime = this.getCurrentTime();
        this.timelineSystem.addClip(asset.id, videoTrack.id, startTime);

        // 5. Add Cursor/Zoom effect track above it
        // We find or create a custom/effect track
        let effectTrack = this.timelineSystem.getTracks().find(t => t.type === 'custom' || t.name === 'Effects');
        if (!effectTrack) effectTrack = this.timelineSystem.addTrack('custom');

        // Add the CursorZoomPlugin as a clip overlapping the video
        const cursorClipId = uuidv4();
        const cursorClip: Clip = {
            id: cursorClipId,
            assetId: asset.id, // We link to asset for duration reference, though it's technically separate
            trackId: effectTrack.id,
            name: "Cursor & Zoom",
            start: startTime,
            duration: asset.duration || 5,
            offset: 0,
            type: "effects.cursor_zoom",
            speed: 1,
            data: {
                enabled: true,
                cursorScale: 1.0,
                smoothZoom: true,
                zoomIntensity: 0.3,
                zoomDuration: 0.4,
                recordedData: cursorData // Inject the raw recorded points
            }
        };

        this.timelineSystem.addClipsBatch([{
            assetId: asset.id,
            trackId: effectTrack.id,
            start: startTime,
            extraData: cursorClip
        }]);

        globalEventBus.emit({
            type: 'SHOW_FEEDBACK',
            payload: { icon: 'Check', text: 'Recording added to timeline!' }
        });
    }

    // --- Facade Methods (Delegation) ---

    // Timeline
    public getTracks(): Track[] {
        return this.timelineSystem.getTracks();
    }

    public addTrack(
        type: "video" | "audio" | "text" | "image" | "custom",
    ): Track {
        return this.timelineSystem.addTrack(type);
    }

    public addClip(assetId: string, targetTrackId: number, startTime: number) {
        this.timelineSystem.addClip(assetId, targetTrackId, startTime);
    }

    public addClipsBatch(
        items: {
            assetId: string;
            trackId: number;
            start: number;
            extraData?: Partial<Clip>;
        }[],
    ) {
        this.timelineSystem.addClipsBatch(items);
    }

    public updateClip(id: string, updates: Partial<Clip>) {
        this.timelineSystem.updateClip(id, updates);
    }

    public splitClip(clipId: string, time: number) {
        this.timelineSystem.splitClip(clipId, time);
    }

    public updateTrack(trackId: number, updates: Partial<Track>) {
        this.timelineSystem.updateTrack(trackId, updates);
    }

    public removeTrack(trackId: number) {
        this.timelineSystem.removeTrack(trackId);
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
