<script setup lang="ts">
import type { Track, Clip } from "../../types/Timeline";
import Filmstrip from "./Filmstrip.vue";
import AudioWaveform from "./AudioWaveform.vue";
// import { useProjectStore } from "../../stores/projectStore";

const props = defineProps<{
    track: Track;
    zoomLevel: number;
}>();

const emit = defineEmits<{
    (e: "drop", event: DragEvent, trackId: number): void;
}>();

// Store not currently needed in this component
// const store = useProjectStore();

const getClipStyle = (clip: Clip) => {
    return {
        left: `${clip.start * props.zoomLevel}px`,
        width: `${clip.duration * props.zoomLevel}px`,
    };
};

const getTrackColor = (type: string) => {
    switch (type) {
        case "video":
            return "bg-brand-primary/20 border-brand-primary/50 text-brand-primary";
        case "audio":
            return "bg-emerald-500/20 border-emerald-500/50 text-emerald-500";
        default:
            return "bg-gray-500/20 border-gray-500/50";
    }
};

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
        <div
            v-for="clip in track.clips"
            :key="clip.id"
            class="absolute top-2 bottom-2 rounded overflow-hidden border border-opacity-30 group cursor-grab shadow-sm flex items-center px-2"
            :class="getTrackColor(track.type)"
            :style="getClipStyle(clip)"
        >
            <!-- GPU Preview for Video Clips -->
            <Filmstrip
                v-if="clip.type === 'video' || clip.type === 'image'"
                :clip="clip"
            />

            <!-- Audio Waveform -->
            <AudioWaveform v-else-if="clip.type === 'audio'" :clip="clip" />

            <span
                class="relative z-10 text-[10px] font-medium truncate w-full select-none"
                >{{ clip.name }}</span
            >
        </div>
    </div>
</template>
