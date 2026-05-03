import { globalEventBus } from "../events/EventBus";
import { TimelineSystem } from "./TimelineSystem";
import type { Clip } from "../../types/Timeline";
import { EditorEventType } from "../../types/Media";

export class SelectionSystem {
    private selectedClipIds: Set<string> = new Set();
    private timelineSystem: TimelineSystem;

    constructor(timelineSystem: TimelineSystem) {
        this.timelineSystem = timelineSystem;
    }

    public selectClip(id: string, toggle: boolean = false) {
        if (!toggle) {
            this.selectedClipIds.clear();
        }

        if (!id) {
            globalEventBus.emit({
                type: EditorEventType.SELECTION_CHANGED,
                payload: Array.from(this.selectedClipIds),
            });
            return;
        }

        const tracks = this.timelineSystem.getTracks();
        const allClips = tracks.flatMap((t) => t.clips);
        const targetClip = allClips.find((c) => c.id === id);

        if (targetClip?.groupId) {
            const groupId = targetClip.groupId;
            const groupClips = allClips.filter((c) => c.groupId === groupId);

            groupClips.forEach((c) => {
                if (this.selectedClipIds.has(c.id) && toggle) {
                    this.selectedClipIds.delete(c.id);
                } else {
                    this.selectedClipIds.add(c.id);
                }
            });
        } else if (targetClip) {
            // Single
            if (this.selectedClipIds.has(targetClip.id) && toggle) {
                this.selectedClipIds.delete(targetClip.id);
            } else {
                this.selectedClipIds.add(targetClip.id);
            }
        }

        globalEventBus.emit({
            type: EditorEventType.SELECTION_CHANGED,
            payload: Array.from(this.selectedClipIds),
        });
    }

    public deselectAll() {
        if (this.selectedClipIds.size > 0) {
            this.selectedClipIds.clear();
            globalEventBus.emit({
                type: EditorEventType.SELECTION_CHANGED,
                payload: [],
            });
        }
    }

    public getSelectedClipIds() {
        return Array.from(this.selectedClipIds);
    }

    public deleteSelectedClips() {
        const selected = this.selectedClipIds;
        const tracks = this.timelineSystem.getTracks();

        let anythingChanged = false;

        tracks.forEach((track) => {
            const initialLen = track.clips.length;
            const newClips = track.clips.filter((c) => !selected.has(c.id));

            if (newClips.length !== initialLen) {
                this.timelineSystem.updateTrackClips(track.id, newClips);
                anythingChanged = true;
            }
        });

        this.selectedClipIds.clear();

        if (anythingChanged) {
            // Cleanup empty custom tracks
            this.timelineSystem.cleanupEmptyTracks();

            globalEventBus.emit({
                type: EditorEventType.TIMELINE_UPDATED,
                payload: undefined,
            });
        }
        globalEventBus.emit({ type: EditorEventType.SELECTION_CHANGED, payload: [] });
    }

    public unlinkSelectedClips() {
        const selected = this.selectedClipIds;
        const tracks = this.timelineSystem.getTracks();
        let anythingChanged = false;

        tracks.forEach((track) => {
            if (!track) return;
            let trackChanged = false;
            const newClips = track.clips.map((c) => {
                if (selected.has(c.id)) {
                    if (c.groupId) {
                        trackChanged = true;
                        // Return copy without groupId
                        const { groupId, ...rest } = c;
                        return rest as Clip;
                    }
                }
                return c;
            });
            if (trackChanged) {
                this.timelineSystem.updateTrackClips(track.id, newClips);
                anythingChanged = true;
            }
        });

        if (anythingChanged) {
            globalEventBus.emit({
                type: EditorEventType.TIMELINE_UPDATED,
                payload: undefined,
            });
        }
    }
}
