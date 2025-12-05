<script setup lang="ts">
import { ref, computed } from "vue";
import type { Clip, Track } from "../../types/Timeline";
import Filmstrip from "./Filmstrip.vue";
import AudioWaveform from "./AudioWaveform.vue";
import { editorEngine } from "../../core/EditorEngine";
import { useProjectStore } from "../../stores/projectStore";

const props = defineProps<{
    clip: Clip;
    track: Track; // Needed to know context if we want to move tracks later
    zoomLevel: number;
}>();

const store = useProjectStore();

const isDragging = ref(false);
const dragOffsetX = ref(0);
// Optimistic UI state during drag
const tempStart = ref(props.clip.start);

const clipStyle = computed(() => {
    // If dragging, use the tempStart, otherwise efficient prop
    const start = isDragging.value ? tempStart.value : props.clip.start;
    return {
        left: `${start * props.zoomLevel}px`,
        width: `${props.clip.duration * props.zoomLevel}px`,
        cursor: isDragging.value ? "grabbing" : "grab",
        zIndex: isDragging.value ? 50 : 10,
    };
});

// Sync tempStart when prop updates (e.g. undo/redo or external change)
import { watch } from "vue";
watch(
    () => props.clip.start,
    (newStart) => {
        console.log("Clip start prop updated:", newStart);
        if (!isDragging.value) {
            tempStart.value = newStart;
        }
    },
);

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

let rafId: number | null = null;

const startDrag = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // prevent triggering parent track drop zones or selections

    isDragging.value = true;
    tempStart.value = props.clip.start;

    // Calculate where we clicked relative to the clip start
    const { x } = editorEngine.getMousePosition();
    const clipStartPx = props.clip.start * props.zoomLevel;
    // We need to account for the container's absolute positioning or just use delta
    // A safer way for absolute positioning:
    // Initial Mouse X - Initial Clip Start Pixel = Offset
    // New Clip Start Pixel = New Mouse X - Offset

    // BUT, since we are inside a relative container (the track div) and we don't easily know its global offset inside this loop without querying DOM which is slow...
    // We can rely on global mouse delta, OR simply query the track rect ONCE at start.
    const trackEl = (e.currentTarget as HTMLElement).parentElement;
    if (!trackEl) return;
    const trackRect = trackEl.getBoundingClientRect();

    // Determine the precise time offset within the clip where the user clicked
    const clickTime = Math.max(0, (x - trackRect.left) / props.zoomLevel);
    const timeOffsetInClip = clickTime - props.clip.start;

    const dragLoop = () => {
        if (!isDragging.value) return;

        const { x: currentMouseX } = editorEngine.getMousePosition();

        // Calculate raw new time based on mouse pos
        // We assume the track hasn't moved (scrolling handled by container, but verify?)
        // If the container scrolls, trackRect.left changes.
        // Ideally we should re-read trackRect if we expect scrolling WHILE dragging without mouse moving?
        // Usually safe enough for now.

        const newTrackRect = trackEl.getBoundingClientRect(); // Re-read for scroll support
        const rawNewStartPct =
            (currentMouseX - newTrackRect.left) / props.zoomLevel;
        let newStart = rawNewStartPct - timeOffsetInClip;

        // Clamp to 0
        newStart = Math.max(0, newStart);

        // SNAP LOGIC
        // We check if the NEW start or NEW end is close to a snap point
        // 10px threshold
        const threshold = 15 / props.zoomLevel;

        // Check Start Snap
        const snapStart = editorEngine.getClosestSnapPoint(
            newStart,
            threshold,
            props.clip.id,
        );
        if (snapStart !== null) {
            newStart = snapStart;
        } else {
            // Check End Snap
            const end = newStart + props.clip.duration;
            const snapEnd = editorEngine.getClosestSnapPoint(
                end,
                threshold,
                props.clip.id,
            );
            if (snapEnd !== null) {
                newStart = snapEnd - props.clip.duration;
            }
        }

        tempStart.value = newStart;

        rafId = requestAnimationFrame(dragLoop);
    };

    dragLoop();

    const stopDrag = () => {
        isDragging.value = false;
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        window.removeEventListener("mouseup", stopDrag);

        // Commit change
        if (Math.abs(tempStart.value - props.clip.start) > 0.001) {
            store.updateClip(props.clip.id, { start: tempStart.value });
        }
    };

    window.addEventListener("mouseup", stopDrag);
};
</script>

<template>
    <div
        class="absolute top-2 bottom-2 rounded overflow-hidden border border-opacity-30 group shadow-sm flex items-center px-2 select-none"
        :class="[
            getTrackColor(clip.type),
            { 'ring-2 ring-white/50': isDragging },
        ]"
        :style="clipStyle"
        @mousedown="startDrag"
    >
        <!-- Content -->
        <!-- GPU Preview for Video Clips -->
        <Filmstrip
            v-if="clip.type === 'video' || clip.type === 'image'"
            :clip="clip"
        />

        <!-- Audio Waveform -->
        <AudioWaveform v-else-if="clip.type === 'audio'" :clip="clip" />

        <span
            class="relative z-10 text-[10px] font-medium truncate w-full pointer-events-none mix-blend-difference text-white"
            >{{ clip.name }}</span
        >

        <!-- Drag handles could go here later -->
    </div>
</template>
