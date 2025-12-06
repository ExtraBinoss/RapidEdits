<script setup lang="ts">
import type { Track } from "../../../../types/Timeline";
import TimelineClip from "../Track/TimelineClip.vue";
// import { useProjectStore } from "../../stores/projectStore";

const props = defineProps<{
    track: Track;
    zoomLevel: number;
    activeTool?: "select" | "razor";
}>();

const emit = defineEmits<{
    (e: "drop", event: DragEvent, trackId: number): void;
    (e: "contextmenu", event: MouseEvent, clipId: string): void;
    (e: "razor-click", event: MouseEvent, trackId: number, time: number): void;
}>();

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
        class="h-24 border-b border-canvas-border/30 relative bg-canvas/20 transition-colors"
        @dragover.prevent
        @drop="handleDrop"
        @click="handleContainerClick"
    >
        <!-- Clips -->
        <TimelineClip
            v-for="clip in track.clips"
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
