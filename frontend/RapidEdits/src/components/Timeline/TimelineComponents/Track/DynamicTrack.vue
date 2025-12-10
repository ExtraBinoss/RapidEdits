<script setup lang="ts">
import type { Track } from "../../../../types/Timeline";
import TimelineClip from "../Track/TimelineClip.vue";
// import { useProjectStore } from "../../stores/projectStore";

import { computed } from "vue";
import { pluginRegistry } from "../../../../core/plugins/PluginRegistry";
import { Ban } from "lucide-vue-next";

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

// Store not currently needed in this component
// const store = useProjectStore();

const isDropAllowed = computed(() => {
    const dragged = pluginRegistry.state.draggedPlugin;
    if (dragged && dragged.isTrackDroppable === false) {
        return false;
    }
    return true;
});

const handleDragOver = (e: DragEvent) => {
    if (!isDropAllowed.value) {
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "none";
        }
        return;
    }
    // Allow drop
    if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
    }
};

const handleDrop = (e: DragEvent) => {
    if (!isDropAllowed.value) return;
    emit("drop", e, props.track.id);
};

const handleContainerClick = (e: MouseEvent) => {
    // If Razor tool is active (parent handles this check), emit razor click
    // However, if we clicked specifically on a clip, the clip might have handled it.
    // Ideally this only fires for clicking EMPTY space if clips stop propagation.
    // BUT we want to support clicking ON a clip to split it.
    // So TimelineClip must allow bubbling when tool is razor.

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
                !isDropAllowed && pluginRegistry.state.draggedPlugin,
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
        @drop="handleDrop"
        @click="handleContainerClick"
    >
        <!-- Invalid Drop Feedback -->
        <div
            v-if="!isDropAllowed && pluginRegistry.state.draggedPlugin"
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
