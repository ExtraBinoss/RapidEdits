<script setup lang="ts">
import type { Track } from "../../../../types/Timeline";
import TimelineClip from "../Track/TimelineClip.vue";
// import { useProjectStore } from "../../stores/projectStore";

import { computed } from "vue";

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

const handleDrop = (e: DragEvent) => {
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
        :style="
            track.color
                ? {
                      backgroundColor: `${track.color}10`,
                      borderColor: `${track.color}30`,
                  }
                : {}
        "
        @dragover.prevent
        @drop="handleDrop"
        @click="handleContainerClick"
    >
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
