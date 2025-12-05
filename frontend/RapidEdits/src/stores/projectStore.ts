import { defineStore } from "pinia";
import { ref } from "vue";
import { editorEngine } from "../core/EditorEngine";
import { globalEventBus } from "../core/EventBus";
import type { Asset } from "../types/Media";
import type { Track } from "../types/Timeline";

export const useProjectStore = defineStore("project", () => {
    const assets = ref<Asset[]>([]);
    const tracks = ref<Track[]>(editorEngine.getTracks());
    const currentTime = ref(0);
    const isPlaying = ref(false);

    // Sync state with Engine events
    globalEventBus.on("ASSET_ADDED", (asset: any) => {
        assets.value.push(asset);
    });

    globalEventBus.on("ASSET_REMOVED", (id: any) => {
        assets.value = assets.value.filter((a) => a.id !== id);
    });

    globalEventBus.on("TIMELINE_UPDATED", () => {
        // Reactivity trigger
        tracks.value = [...editorEngine.getTracks()];
    });

    globalEventBus.on("PLAYBACK_TIME_UPDATED", (time: any) => {
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

    return {
        assets,
        tracks,
        currentTime,
        isPlaying,
        uploadFiles,
        deleteAsset,
        addClipToTimeline,
        togglePlayback,
        seek,
    };
});
