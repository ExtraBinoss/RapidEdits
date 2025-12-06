import { globalEventBus } from "../events/EventBus";
import { TimelineSystem } from "./TimelineSystem";
import type { Clip } from "../../types/Timeline";

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
                type: "SELECTION_CHANGED",
                payload: Array.from(this.selectedClipIds),
            });
            return;
        }

        const tracks = this.timelineSystem.getTracks();

        // Find if this clip has a group
        let groupId: string | undefined;
        for (const track of tracks) {
            const c = track.clips.find((clip) => clip.id === id);
            if (c) {
                groupId = c.groupId;
                break;
            }
        }

        if (groupId) {
            // Select all in group
            tracks.forEach((track) => {
                track.clips.forEach((c) => {
                    if (c.groupId === groupId) {
                        if (this.selectedClipIds.has(c.id) && toggle) {
                            this.selectedClipIds.delete(c.id);
                        } else {
                            this.selectedClipIds.add(c.id);
                        }
                    }
                });
            });
        } else {
            // Single
            if (this.selectedClipIds.has(id) && toggle) {
                this.selectedClipIds.delete(id);
            } else {
                this.selectedClipIds.add(id);
            }
        }

        globalEventBus.emit({
            type: "SELECTION_CHANGED",
            payload: Array.from(this.selectedClipIds),
        });
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
                type: "TIMELINE_UPDATED",
                payload: undefined,
            });
        }
        globalEventBus.emit({ type: "SELECTION_CHANGED", payload: [] });
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
                type: "TIMELINE_UPDATED",
                payload: undefined,
            });
        }
    }
}
