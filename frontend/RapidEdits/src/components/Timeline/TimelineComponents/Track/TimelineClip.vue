<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { Clip, Track } from "../../../../types/Timeline";
import { isPluginClip } from "../../../../types/Timeline";
import type { PluginId } from "../../../../core/plugins/PluginTypes";
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
    scrollContainer?: HTMLElement | null;
}>();

const store = useProjectStore();

const isDragging = ref(false);
// Optimistic UI state during drag
const tempStart = ref(props.clip.start);
const tempTrackId = ref(props.clip.trackId);
const tempTranslateY = ref(0);
const targetTranslateY = ref(0);

// Video/Image clips always get filmstrip. Plugin clips only if long enough (>2s) to avoid lag.
const shouldShowFilmstrip = computed(() => {
    if (props.clip.type === "video" || props.clip.type === "image") return true;
    if (isPluginClip(props.clip)) {
        const pluginId = props.clip.type as PluginId;
        if (pluginRegistry.has(pluginId)) {
            return props.clip.duration > 2.0;
        }
    }
    return false;
});

const clipStyle = computed(() => {
    // If dragging, use the tempStart, otherwise efficient prop
    const start = isDragging.value ? tempStart.value : props.clip.start;
    return {
        left: "0px",
        transform: `translate3d(${start * props.zoomLevel}px, ${tempTranslateY.value}px, 0) scale(${isDragging.value ? 1.01 : 1})`,
        width: `${props.clip.duration * props.zoomLevel}px`,
        willChange: isDragging.value ? "transform" : "auto",
        transition: isDragging.value ? "none" : "transform 120ms ease-out",
        cursor:
            props.activeTool === "razor"
                ? "cell"
                : isDragging.value
                  ? "grabbing"
                  : "grab",
        zIndex: isDragging.value ? 50 : 10,
        pointerEvents: isDragging.value ? "none" : "auto",
        opacity: isDragging.value && tempTrackId.value !== props.track.id ? 0.75 : 1,
        boxShadow: isDragging.value
            ? "0 12px 28px rgba(0,0,0,0.35)"
            : "none",
    };
});

// Sync tempStart when prop updates (e.g. undo/redo or external change)
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
let dragMouseX = 0;
let dragMouseY = 0;

const handleGlobalMouseMove = (e: MouseEvent) => {
    dragMouseX = e.clientX;
    dragMouseY = e.clientY;
};

const updateTargetTrackFromPointer = () => {
    const stack = document.elementsFromPoint(dragMouseX, dragMouseY) as HTMLElement[];
    for (const el of stack) {
        const trackEl = el.closest?.("[data-track-id]") as HTMLElement | null;
        if (!trackEl) continue;
        const id = Number(trackEl.dataset.trackId);
        if (!Number.isNaN(id)) {
            tempTrackId.value = id;
            return trackEl;
        }
    }
    return null;
};

const updateVerticalDragOffset = (sourceTrackTop: number) => {
    const trackEl = updateTargetTrackFromPointer();
    if (!trackEl) return;
    const targetTop = trackEl.getBoundingClientRect().top;
    targetTranslateY.value = targetTop - sourceTrackTop;

    // Smooth interpolation for a softer / juicier feel
    tempTranslateY.value += (targetTranslateY.value - tempTranslateY.value) * 0.35;
};

const resetDragVisualState = () => {
    tempTranslateY.value = 0;
    targetTranslateY.value = 0;
};

const updateTargetTrackOnly = () => {
    const stack = document.elementsFromPoint(dragMouseX, dragMouseY) as HTMLElement[];
    for (const el of stack) {
        const trackEl = el.closest?.("[data-track-id]") as HTMLElement | null;
        if (!trackEl) continue;
        const id = Number(trackEl.dataset.trackId);
        if (!Number.isNaN(id)) {
            tempTrackId.value = id;
            return;
        }
    }
};

const startDrag = (e: MouseEvent) => {
    if (props.activeTool === "razor") return;

    e.preventDefault();
    e.stopPropagation(); // prevent triggering parent track drop zones or selections

    isDragging.value = true;
    tempStart.value = props.clip.start;
    tempTrackId.value = props.clip.trackId;
    resetDragVisualState();
    dragMouseX = e.clientX;
    dragMouseY = e.clientY;

    // Calculate where we clicked relative to the clip start
    const x = e.clientX;
    // We need to account for the container's absolute positioning or just use delta
    // A safer way for absolute positioning:
    // Initial Mouse X - Initial Clip Start Pixel = Offset
    // New Clip Start Pixel = New Mouse X - Offset

    // BUT, since we are inside a relative container (the track div) and we don't easily know its global offset inside this loop without querying DOM which is slow...
    // We can rely on global mouse delta, OR simply query the track rect ONCE at start.
    const trackEl = (e.currentTarget as HTMLElement).parentElement;
    if (!trackEl) return;
    const trackRect = trackEl.getBoundingClientRect();
    const sourceTrackTop = trackRect.top;

    // Determine the precise time offset within the clip where the user clicked
    const clickTime = Math.max(0, (x - trackRect.left) / props.zoomLevel);
    const timeOffsetInClip = clickTime - props.clip.start;

    const dragLoop = () => {
        if (!isDragging.value) return;

        const currentMouseX = dragMouseX;

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
        updateVerticalDragOffset(sourceTrackTop);

        rafId = requestAnimationFrame(dragLoop);
    };

    dragLoop();

    window.addEventListener("mousemove", handleGlobalMouseMove, {
        passive: true,
    });
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
    window.removeEventListener("mousemove", handleGlobalMouseMove);
    window.removeEventListener("mouseup", stopDrag);

    // Commit change
    updateTargetTrackOnly();

    const trackChanged = tempTrackId.value !== props.clip.trackId;
    const startChanged = Math.abs(tempStart.value - props.clip.start) > 0.001;

    if (trackChanged) {
        store.moveClipToTrack(props.clip.id, tempTrackId.value, tempStart.value);
    } else if (startChanged) {
        store.updateClip(props.clip.id, { start: tempStart.value });
    }

    resetDragVisualState();
};

const handleClipDragOver = (e: DragEvent) => {
    // Check if we are dragging a plugin that is allowed on clips (e.g. Transitions)
    const dragged = pluginRegistry.state.draggedPlugin;

    // If it's a transition, or generally any plugin we want to allow ON clips:
    if (dragged) {
        // We override the parent Track's restriction
        e.preventDefault();
        // Allow propagation so DynamicTrack can show the ghost preview
        // e.stopImmediatePropagation(); 

        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "copy";
        }
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

            const rect = (
                e.currentTarget as HTMLElement
            ).getBoundingClientRect();
            const offsetX = e.clientX - rect.left;
            const percentage = offsetX / rect.width;

            const pluginId = data.pluginId as PluginId;
            const plugin = pluginRegistry.get(pluginId);
            const meta = plugin?.getMetadata();
            const slot = meta?.transitionSlot || "in";

            // Determine effective slot if 'any'
            let effectiveSlot = slot;
            if (slot === 'any') {
                effectiveSlot = percentage < 0.5 ? 'in' : 'out';
            }

            const currentTransitions = { ...(props.clip.data?.transitions || {}) };
            
            // Enforce "one transition per slot": remove any existing transition that shares the same slot
            if (effectiveSlot !== "any") {
                Object.keys(currentTransitions).forEach(id => {
                    const existingPlugin = pluginRegistry.get(id as PluginId);
                    if (existingPlugin?.getMetadata().transitionSlot === effectiveSlot) {
                        delete currentTransitions[id];
                    }
                });
            }

            // Use the actual plugin ID as the key for the transition config
            currentTransitions[pluginId] = {
                ...plugin?.createData(),
                ...(slot === "any" ? { slot: effectiveSlot } : {})
            };

            store.updateClip(props.clip.id, {
                data: { ...props.clip.data, transitions: currentTransitions },
            });

            // Auto-select the clip to show properties
            store.selectClip(props.clip.id, false);
        }
    } catch (e) {
        console.error("Drop error", e);
    }
};

const activeTransitions = computed(() => {
    const data = props.clip.data?.transitions || {};
    return Object.entries(data).map(([id, config]) => {
        const plugin = pluginRegistry.get(id as PluginId);
        return {
            id,
            config: config as any,
            metadata: plugin?.getMetadata()
        };
    });
});

const fadeInTransition = computed(() => {
    return activeTransitions.value.find(t => t.metadata?.transitionSlot === 'in' || (t.metadata?.transitionSlot === 'any' && t.config.slot === 'in'));
});

const fadeOutTransition = computed(() => {
    return activeTransitions.value.find(t => t.metadata?.transitionSlot === 'out' || (t.metadata?.transitionSlot === 'any' && t.config.slot === 'out'));
});

const fadeInWidth = computed(() => {
    if (!fadeInTransition.value) return 0;
    return (fadeInTransition.value.config.duration || 1.0) * props.zoomLevel;
});

const fadeOutWidth = computed(() => {
    if (!fadeOutTransition.value) return 0;
    return (fadeOutTransition.value.config.duration || 1.0) * props.zoomLevel;
});
</script>

<template>
    <div
        class="absolute top-1 bottom-1 rounded overflow-hidden border border-opacity-30 group shadow-sm flex items-center px-2 select-none"
        :class="[
            getTrackColor(clip.type),
            { 'ring-2 ring-white': isSelected && !isDragging },
            { 'ring-2 ring-white/50': isDragging },
        ]"
        :style="clipStyle"
        @mousedown="startDrag"
        @click="handleClick"
        @contextmenu="handleContextMenu"
        @dragover.prevent="handleClipDragOver"
        @drop="handleDrop"
    >
        <!-- Content -->
        <!-- GPU Preview for Video Clips -->
        <Filmstrip v-if="shouldShowFilmstrip" :clip="clip" />

        <!-- Audio Waveform -->
        <AudioWaveform v-else-if="clip.type === 'audio'" :clip="clip" />

        <!-- Visual Ramps for Transitions -->
        <svg
            v-if="fadeInTransition || fadeOutTransition"
            class="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible"
        >
            <!-- Fade In Ramp -->
            <polygon
                v-if="fadeInTransition"
                :points="`0,100 ${fadeInWidth},0 0,0`"
                class="fill-white/30"
                vector-effect="non-scaling-stroke"
            />

            <!-- Fade Out Ramp -->
            <polygon
                v-if="fadeOutTransition"
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
