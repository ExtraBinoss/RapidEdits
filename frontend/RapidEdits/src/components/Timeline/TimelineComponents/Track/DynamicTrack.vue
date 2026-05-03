<script setup lang="ts">
import type { Track } from "../../../../types/Timeline";
import TimelineClip from "../Track/TimelineClip.vue";
import { ref, computed } from "vue";
import { pluginRegistry } from "../../../../core/plugins/PluginRegistry";
import { Ban, Video, Music, Image as ImageIcon, Box } from "lucide-vue-next";
import { useProjectStore } from "../../../../stores/projectStore";
import { MediaType } from "../../../../types/Media";
import { editorEngine } from "../../../../core/EditorEngine";
import GhostClip from "./GhostClip.vue";

const props = defineProps<{
    track: Track;
    zoomLevel: number;
    activeTool?: "select" | "razor";
    visibleStart?: number;
    visibleEnd?: number;
}>();

const emit = defineEmits<{
    (e: "drop", event: DragEvent, trackId: number): void;
    (e: "contextmenu", event: MouseEvent, clipId: string): void;
    (e: "razor-click", event: MouseEvent, trackId: number, time: number): void;
}>();

const store = useProjectStore();

// Ghost Clip State
const ghostX = ref(0);
const isOver = ref(false);

// Virtualization: Only render clips that intersect with the visible range
const visibleClips = computed(() => {
    // If no range provided (e.g. init), show all or efficient default
    if (props.visibleStart === undefined || props.visibleEnd === undefined) {
        return props.track.clips;
    }

    return props.track.clips.filter((clip) => {
        const start = clip.start;
        const end = clip.start + clip.duration;
        // Check overlap: Start of clip < End of View AND End of Clip > Start of View
        return start < props.visibleEnd! && end > props.visibleStart!;
    });
});
// ... (rest of filtering logic implemented implicitly via computed above)

const isDropAllowed = computed(() => {
    const dragged = pluginRegistry.state.draggedPlugin;
    if (dragged) {
        const meta = dragged.getMetadata();
        if (meta.isTrackDroppable === false) {
            return false;
        }
    }
    return true;
});

const ghostData = computed(() => {
    if (store.draggedAsset) {
        let color = "bg-brand-primary";
        let icon = Video;
        if (store.draggedAsset.type === MediaType.AUDIO) {
            color = "bg-green-600";
            icon = Music;
        } else if (store.draggedAsset.type === MediaType.IMAGE) {
            color = "bg-purple-600";
            icon = ImageIcon;
        }
        return {
            duration: store.draggedAsset.duration || 5,
            color,
            icon,
            name: store.draggedAsset.name,
        };
    }
    if (store.draggedPlugin) {
        const meta = store.draggedPlugin.getMetadata();
        return {
            duration: 5,
            color: "bg-indigo-600",
            icon: meta.icon || Box,
            name: meta.name,
        };
    }
    return null;
});

const handleDragOver = (e: DragEvent) => {
    if (!isDropAllowed.value) {
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "none";
        }
        return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawTime = rawX / props.zoomLevel;

    // Snapping Logic
    let finalTime = rawTime;
    if (editorEngine.getIsSnappingEnabled()) {
        const thresholdSeconds = 15 / props.zoomLevel; // 15px threshold
        const snapPoint = editorEngine.getClosestSnapPoint(
            rawTime,
            thresholdSeconds,
        );
        if (snapPoint !== null) {
            finalTime = snapPoint;
        }
    }

    ghostX.value = finalTime * props.zoomLevel;
    isOver.value = true;

    // Allow drop
    if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
    }
};

const handleDragLeave = () => {
    isOver.value = false;
};

const handleDrop = (e: DragEvent) => {
    isOver.value = false;
    if (!isDropAllowed.value) return;
    emit("drop", e, props.track.id);
};

const handleContainerClick = (e: MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const time = Math.max(0, offsetX / props.zoomLevel);

    emit("razor-click", e, props.track.id, time);
};
</script>

<template>
    <div
        class="h-24 border-canvas-border/30 relative bg-canvas/20 transition-colors"
        :class="{
            'bg-red-500/10 border-red-500/30':
                !isDropAllowed && (store.draggedPlugin || store.draggedAsset),
        }"
        :style="
            track.color
                ? {
                      backgroundColor: `${track.color}10`,
                      borderColor: `${track.color}30`,
                  }
                : {}
        "
        @dragover.prevent="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
        @click="handleContainerClick"
    >
        <!-- Ghost Preview Clip -->
        <GhostClip 
            v-if="isOver"
            :ghost-data="ghostData" 
            :x="ghostX" 
            :zoom-level="zoomLevel" 
        />

        <!-- Invalid Drop Feedback -->
        <div
            v-if="!isDropAllowed && (store.draggedPlugin || store.draggedAsset)"
            class="absolute inset-0 flex items-center justify-center pointer-events-none z-50 bg-black/20"
        >
            <Ban class="text-red-500 w-8 h-8 opacity-80" />
        </div>
        <!-- Clips -->
        <TimelineClip
            v-for="clip in visibleClips"
            :key="clip.id"
            :clip="clip"
            :track="track"
            :zoomLevel="zoomLevel"
            :active-tool="activeTool"
            @contextmenu="
                (e: MouseEvent, id: string) => emit('contextmenu', e, id)
            "
        />
    </div>
</template>
