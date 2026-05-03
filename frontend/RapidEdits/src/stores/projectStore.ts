import { defineStore } from "pinia";
import { ref, computed, shallowRef } from "vue";
import { editorEngine } from "../core/EditorEngine";
import { globalEventBus } from "../core/events/EventBus";
import { EditorEventType, type Asset } from "../types/Media";
import type { Track, Clip } from "../types/Timeline";

export const useProjectStore = defineStore("project", () => {
    const assets = ref<Asset[]>([]);
    const tracks = ref<Track[]>(editorEngine.getTracks());
    const currentTime = ref(0);
    const isPlaying = ref(false);
    const draggedAsset = shallowRef<Asset | null>(null);
    const draggedPlugin = shallowRef<any | null>(null);

    // Dynamic duration based on content
    const duration = computed(() => {
        let maxTime = 0;
        tracks.value.forEach((track) => {
            track.clips.forEach((clip) => {
                const end = clip.start + clip.duration;
                if (end > maxTime) maxTime = end;
            });
        });
        return Math.max(60, maxTime + 10);
    });

    // Sync state with Engine events
    globalEventBus.on(EditorEventType.ASSET_ADDED, (asset: any) => {
        assets.value.push(asset);
    });

    globalEventBus.on(EditorEventType.ASSET_REMOVED, (id: any) => {
        assets.value = assets.value.filter((a) => a.id !== id);
    });

    globalEventBus.on(EditorEventType.TIMELINE_UPDATED, () => {
        tracks.value = [...editorEngine.getTracks()];
    });

    globalEventBus.on(EditorEventType.PLAYBACK_TIME_UPDATED, (time: any) => {
        currentTime.value = time;
    });

    // Actions
    const uploadFiles = async (files: FileList | File[]) => {
        const fileArray = Array.from(files);
        for (const file of fileArray) {
            await editorEngine.addAsset(file);
        }
    };

    const deleteAsset = (id: string) => {
        editorEngine.removeAsset(id);
    };

    const addClipToTimeline = (
        assetId: string,
        trackId: number,
        time: number,
    ) => {
        editorEngine.addClip(assetId, trackId, time);
    };

    const togglePlayback = () => {
        editorEngine.togglePlayback();
        isPlaying.value = editorEngine.getIsPlaying();
    };

    const seek = (time: number) => {
        editorEngine.seek(time);
    };

    const addTrack = (type: "video" | "audio") => {
        return editorEngine.addTrack(type);
    };

    function splitClip(clipId: string, time: number) {
        editorEngine.splitClip(clipId, time);
    }

    const selectedClipIds = ref<string[]>([]);

    globalEventBus.on(EditorEventType.SELECTION_CHANGED, (ids: string[]) => {
        selectedClipIds.value = ids;
    });

    return {
        assets,
        tracks,
        currentTime,
        duration,
        isPlaying,
        draggedAsset,
        draggedPlugin,
        uploadFiles,
        deleteAsset,
        addClipToTimeline,
        togglePlayback,
        seek,
        addTrack,
        updateClip: (id: string, updates: Partial<Clip>) =>
            editorEngine.updateClip(id, updates),
        updateTrack: (id: number, updates: Partial<Track>) =>
            editorEngine.updateTrack(id, updates),
        removeTrack: (id: number) => editorEngine.removeTrack(id),
        // Selection Actions
        selectClip: (id: string, toggle: boolean) =>
            editorEngine.selectClip(id, toggle),
        getSelectedClipIds: () => editorEngine.getSelectedClipIds(),
        deleteSelectedClips: () => editorEngine.deleteSelectedClips(),
        unlinkSelectedClips: () => editorEngine.unlinkSelectedClips(),
        splitClip,
        selectedClipIds,
    };
});
