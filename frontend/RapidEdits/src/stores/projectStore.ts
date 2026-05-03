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

    // Project Metadata
    const projectName = ref("Untitled Project");
    const resolution = ref({ width: 1920, height: 1080 });
    const fps = ref(30);

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

    globalEventBus.on(EditorEventType.PLAYBACK_TOGGLED, (playing: boolean) => {
        isPlaying.value = playing;
    });

    globalEventBus.on(EditorEventType.PROJECT_LOADED, () => {
        assets.value = editorEngine.assetSystem.getAllAssets();
        tracks.value = editorEngine.getTracks();
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

    const saveProject = () => {
        const projectData = {
            metadata: {
                name: projectName.value,
                resolution: resolution.value,
                fps: fps.value,
            },
            ...editorEngine.serialize(),
        };
        const json = JSON.stringify(projectData);
        localStorage.setItem("rapid-edits-project", json);
        console.log("[ProjectStore] Project saved to localStorage");
        
        globalEventBus.emit({
            type: EditorEventType.SHOW_FEEDBACK,
            payload: { icon: "Save", text: "Project Saved" }
        });
    };

    const loadProject = async (data?: any) => {
        const json = data || localStorage.getItem("rapid-edits-project");
        if (!json) return false;

        try {
            const projectData = typeof json === "string" ? JSON.parse(json) : json;
            projectName.value = projectData.metadata.name;
            resolution.value = projectData.metadata.resolution;
            fps.value = projectData.metadata.fps;

            await editorEngine.deserialize(projectData);
            return true;
        } catch (e) {
            console.error("[ProjectStore] Failed to load project", e);
            return false;
        }
    };

    // Auto-save every minute
    setInterval(() => {
        saveProject();
    }, 60000);

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
        projectName,
        resolution,
        fps,
        uploadFiles,
        deleteAsset,
        saveProject,
        loadProject,
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
        deselectAll: () => editorEngine.deselectAll(),
        getSelectedClipIds: () => editorEngine.getSelectedClipIds(),
        deleteSelectedClips: () => editorEngine.deleteSelectedClips(),
        unlinkSelectedClips: () => editorEngine.unlinkSelectedClips(),
        splitClip,
        selectedClipIds,
    };
});
