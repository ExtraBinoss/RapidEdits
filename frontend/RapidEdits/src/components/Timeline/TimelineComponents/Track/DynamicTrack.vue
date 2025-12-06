<script setup lang="ts">
import type { Track } from "../../../../types/Timeline";
import TimelineClip from "../Track/TimelineClip.vue";
// import { useProjectStore } from "../../stores/projectStore";

const props = defineProps<{
    track: Track;
    zoomLevel: number;
}>();

const emit = defineEmits<{
    (e: "drop", event: DragEvent, trackId: number): void;
    (e: "contextmenu", event: MouseEvent, clipId: string): void;
}>();

// Store not currently needed in this component
// const store = useProjectStore();

const handleDrop = (e: DragEvent) => {
    emit("drop", e, props.track.id);
};
</script>

<template>
    <div
        class="h-24 border-b border-canvas-border/30 relative bg-canvas/20 transition-colors"
        @dragover.prevent
        @drop="handleDrop"
    >
        <!-- Clips -->
        <TimelineClip
            v-for="clip in track.clips"
            :key="clip.id"
            :clip="clip"
            :track="track"
            :zoomLevel="zoomLevel"
            @contextmenu="
                (e: MouseEvent, id: string) => emit('contextmenu', e, id)
            "
        />
    </div>
</template>
