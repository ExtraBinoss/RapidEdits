<script setup lang="ts">
import { ref, computed } from "vue";
import type { Clip, Track } from "../../../../types/Timeline";
import Filmstrip from "../Media/Filmstrip.vue";
import AudioWaveform from "../Media/AudioWaveform.vue";
import { editorEngine } from "../../../../core/EditorEngine";
import { useProjectStore } from "../../../../stores/projectStore";
import { pluginRegistry } from "../../../../core/plugins/PluginRegistry";

const props = defineProps<{
    clip: Clip;
    track: Track; // Needed to know context if we want to move tracks later
    zoomLevel: number;
    activeTool?: "select" | "razor";
}>();

const store = useProjectStore();

const isDragging = ref(false);
// Optimistic UI state during drag
const tempStart = ref(props.clip.start);

// Video/Image clips always get filmstrip. Text/Plugin clips only if long enough (>2s) to avoid lag.
const shouldShowFilmstrip = computed(() => {
    if (props.clip.type === "video" || props.clip.type === "image") return true;
    if (pluginRegistry.get(props.clip.type)) {
        return props.clip.duration > 2.0;
    }
    return false;
});

const clipStyle = computed(() => {
    // If dragging, use the tempStart, otherwise efficient prop
    const start = isDragging.value ? tempStart.value : props.clip.start;
    return {
        left: `${start * props.zoomLevel}px`,
        width: `${props.clip.duration * props.zoomLevel}px`,
        cursor:
            props.activeTool === "razor"
                ? "cell"
                : isDragging.value
                  ? "grabbing"
                  : "grab",
        zIndex: isDragging.value ? 50 : 10,
    };
});

// Sync tempStart when prop updates (e.g. undo/redo or external change)
import { watch } from "vue";
watch(
    () => props.clip.start,
    (newStart) => {
        // console.log("Clip start prop updated:", newStart);
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
    if (props.activeTool === "razor") return;

    e.preventDefault();
    e.stopPropagation(); // prevent triggering parent track drop zones or selections

    isDragging.value = true;
    tempStart.value = props.clip.start;

    // Calculate where we clicked relative to the clip start
    const { x } = editorEngine.getMousePosition();
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

        const newTrackRect = trackEl.getBoundingClientRect();
        const rawNewStartPct =
            (currentMouseX - newTrackRect.left) / props.zoomLevel;
        let newStart = rawNewStartPct - timeOffsetInClip;

        newStart = Math.max(0, newStart);

        const threshold = 15 / props.zoomLevel;

        const snapStart = editorEngine.getClosestSnapPoint(
            newStart,
            threshold,
            props.clip.id,
        );
        if (snapStart !== null) {
            newStart = snapStart;
        } else {
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

    window.addEventListener("mouseup", stopDrag);
};

// emits "contextmenu" event with native event to parent
// We don't handle context menu LOCALLY, we bubble it up or emit logic
const emit = defineEmits<{
    (e: "contextmenu", event: MouseEvent, clipId: string): void;
}>();

const isSelected = computed(() => {
    return store.selectedClipIds.includes(props.clip.id);
});

const handleClick = (e: MouseEvent) => {
    if (props.activeTool === "razor") {
        // Allow propagation so DynamicTrack can handle split
        return;
    }

    e.stopPropagation();
    // Logic moved to mousedown for selection start, but we can refine toggle here
    const toggle = e.ctrlKey || e.metaKey || e.shiftKey;
    if (toggle) {
        store.selectClip(props.clip.id, true);
    } else {
        store.selectClip(props.clip.id, false);
    }
};

const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    // e.stopPropagation(); // Bubbling might be needed if dynamic track wraps it
    // Ensure this clip is selected
    if (!isSelected.value) {
        store.selectClip(props.clip.id, false);
    }
    emit("contextmenu", e, props.clip.id);
};

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

const handleDrop = (e: DragEvent) => {
    // Only accept drops if not actively using tool blocking it?
    // We want to allow dropping effects on clips.
    const dataStr = e.dataTransfer?.getData("application/json");
    if (!dataStr) return;

    try {
        const data = JSON.parse(dataStr);
        if (data.type === "plugin" && data.pluginType === "transition") {
            e.preventDefault();
            e.stopPropagation();

            // Logic: If Fade, determine In or Out based on drop position
            if (data.pluginId.includes("fade")) {
                const rect = (
                    e.currentTarget as HTMLElement
                ).getBoundingClientRect();
                const offsetX = e.clientX - rect.left;
                const percentage = offsetX / rect.width;

                const currentTransitions = props.clip.data?.transitions || {};
                let updates = {};

                if (percentage < 0.5) {
                    // Fade In
                    updates = {
                        ...currentTransitions,
                        fadeIn: { duration: 1.0, easing: "linear" },
                    };
                } else {
                    // Fade Out
                    updates = {
                        ...currentTransitions,
                        fadeOut: { duration: 1.0, easing: "linear" },
                    };
                }

                store.updateClip(props.clip.id, {
                    data: { ...props.clip.data, transitions: updates },
                });
            }
        }
    } catch (e) {
        console.error("Drop error", e);
    }
};

const transitions = computed(() => props.clip.data?.transitions || {});
const hasFadeIn = computed(() => !!transitions.value.fadeIn);
const hasFadeOut = computed(() => !!transitions.value.fadeOut);

const fadeInWidth = computed(() => {
    if (!hasFadeIn.value) return 0;
    return (transitions.value.fadeIn.duration || 0) * props.zoomLevel;
});

const fadeOutWidth = computed(() => {
    if (!hasFadeOut.value) return 0;
    return (transitions.value.fadeOut.duration || 0) * props.zoomLevel;
});
</script>

<template>
    <div
        class="absolute top-2 bottom-2 rounded overflow-hidden border border-opacity-30 group shadow-sm flex items-center px-2 select-none"
        :class="[
            getTrackColor(clip.type),
            { 'ring-2 ring-white': isSelected && !isDragging },
            { 'ring-2 ring-white/50': isDragging },
        ]"
        :style="clipStyle"
        @mousedown="startDrag"
        @click="handleClick"
        @contextmenu="handleContextMenu"
        @dragover.prevent
        @drop="handleDrop"
    >
        <!-- Content -->
        <!-- GPU Preview for Video Clips -->
        <Filmstrip v-if="shouldShowFilmstrip" :clip="clip" />

        <!-- Audio Waveform -->
        <AudioWaveform v-else-if="clip.type === 'audio'" :clip="clip" />

        <!-- Visual Ramps for Transitions -->
        <svg
            v-if="hasFadeIn || hasFadeOut"
            class="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible"
        >
            <!-- Fade In Ramp -->
            <polygon
                v-if="hasFadeIn"
                :points="`0,100 ${fadeInWidth},0 0,0`"
                class="fill-white/30"
                vector-effect="non-scaling-stroke"
            />

            <!-- Fade Out Ramp -->
            <polygon
                v-if="hasFadeOut"
                :points="`${clip.duration * zoomLevel - fadeOutWidth},0 ${clip.duration * zoomLevel},100 ${clip.duration * zoomLevel},0`"
                class="fill-white/30"
            />
        </svg>

        <span
            class="relative z-10 text-[10px] font-medium truncate w-full pointer-events-none mix-blend-difference text-white"
            >{{ clip.name }}</span
        >

        <!-- Drag handles could go here later -->
    </div>
</template>
