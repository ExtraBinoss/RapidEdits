<script setup lang="ts">
import { TrackType, type Track } from "../../../../types/Timeline";
import TimelineClip from "../Track/TimelineClip.vue";
import { ref, computed } from "vue";
import { pluginRegistry } from "../../../../core/plugins/PluginRegistry";
import { Ban, Video, Music, Image as ImageIcon, Box, Trash2 } from "lucide-vue-next";
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
    scrollContainer?: HTMLElement | null;
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

// Gaps logic
const gaps = computed(() => {
    const trackGaps: { start: number; end: number; id: string }[] = [];
    const sortedClips = [...props.track.clips].sort((a, b) => a.start - b.start);
    
    // Gap before first clip
    if (sortedClips.length > 0 && sortedClips[0].start > 0.05) {
        trackGaps.push({
            start: 0,
            end: sortedClips[0].start,
            id: 'gap-start'
        });
    }
    
    // Gaps between clips
    for (let i = 0; i < sortedClips.length - 1; i++) {
        const currentEnd = sortedClips[i].start + sortedClips[i].duration;
        const nextStart = sortedClips[i+1].start;
        if (nextStart > currentEnd + 0.05) {
            trackGaps.push({
                start: currentEnd,
                end: nextStart,
                id: `gap-${sortedClips[i].id}`
            });
        }
    }
    
    return trackGaps;
});

const handleCloseGap = (gapStart: number, gapEnd: number) => {
    const gapDuration = gapEnd - gapStart;
    // Find all clips in this track that are AFTER this gap
    const clipsToShift = props.track.clips.filter(c => c.start >= gapEnd - 0.01);
    
    clipsToShift.forEach(clip => {
        store.updateClip(clip.id, {
            start: clip.start - gapDuration
        });
    });
};

const isDropAllowed = computed(() => {
    const draggedAsset = store.draggedAsset;
    const draggedPlugin = store.draggedPlugin;

    // Plugin restrictions
    if (draggedPlugin) {
        const meta = draggedPlugin.getMetadata();
        // Allow transitions even if isTrackDroppable is false, 
        // because we handle attaching them to clips in the drop handler
        if (meta.type === 'transition') return true;
        
        if (meta.isTrackDroppable === false) return false;
        return true;
    }

    // Asset restrictions based on track type
    if (draggedAsset) {
        const type = props.track.type;
        
        if (type === TrackType.VIDEO) {
            return draggedAsset.type === MediaType.VIDEO || draggedAsset.type === MediaType.IMAGE;
        } else if (type === TrackType.AUDIO) {
            return draggedAsset.type === MediaType.AUDIO;
        } else {
            // For "Overlay & Effects" (text, image, custom), block raw video/audio
            // Only allow images or plugins
            return draggedAsset.type === MediaType.IMAGE;
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
        const isTransition = meta.type === 'transition';
        return {
            duration: 1.0,
            color: isTransition ? "bg-emerald-500" : "bg-indigo-600",
            icon: meta.icon || Box,
            name: meta.name,
            type: meta.type,
            transitionSlot: meta.transitionSlot
        };
    }
    return null;
});

const ghostDuration = ref(5.0);
const ghostTransitionSlot = ref<string | undefined>(undefined);

let dragOverRafPending = false;
let lastDragClientX = 0;
let lastDragTarget: HTMLElement | null = null;
let lastDragDataTransfer: DataTransfer | null = null;

const processDragOver = () => {
    dragOverRafPending = false;
    if (!lastDragTarget) return;

    if (!isDropAllowed.value) {
        if (lastDragDataTransfer) {
            lastDragDataTransfer.dropEffect = "none";
        }
        return;
    }

    const rect = lastDragTarget.getBoundingClientRect();
    const rawX = lastDragClientX - rect.left;
    const rawTime = rawX / props.zoomLevel;

    // Snapping Logic
    let finalTime = rawTime;
    let finalDuration = ghostData.value?.duration || 5.0;
    let showGhost = true;
    let effectiveSlot: string | undefined = undefined;

    const meta = store.draggedPlugin?.getMetadata();
    if (meta?.type === 'transition') {
        // Find clip at drop position with small epsilon
        const epsilon = 0.01;
        const clip = props.track.clips.find(c => 
            rawTime >= (c.start - epsilon) && rawTime <= (c.start + c.duration + epsilon)
        );

        if (clip) {
            const slot = meta.transitionSlot || 'in';
            const duration = meta.defaultData?.duration || 1.0;
            
            const percentage = (rawTime - clip.start) / clip.duration;
            
            // If slot is 'any', decide based on which side of the clip we are closer to
            effectiveSlot = slot;
            if (slot === 'any') {
                effectiveSlot = percentage < 0.5 ? 'in' : 'out';
            }

            // If it's a specific slot ('in' or 'out'), only show it if the mouse is on that side
            // This improves "precision" and prevents jumping to the other side of a long clip
            if (slot === 'in' && percentage > 0.6) {
                showGhost = false;
            } else if (slot === 'out' && percentage < 0.4) {
                showGhost = false;
            }

            if (showGhost) {
                if (effectiveSlot === 'in') {
                    finalTime = clip.start;
                } else if (effectiveSlot === 'out') {
                    finalTime = clip.start + clip.duration - duration;
                }
                finalDuration = duration;
                ghostTransitionSlot.value = effectiveSlot;
            }
        } else {
            // Transition MUST be over a clip
            showGhost = false;
        }
    } else if (editorEngine.getIsSnappingEnabled()) {
        const thresholdSeconds = 15 / props.zoomLevel;
        const snapPoint = editorEngine.getClosestSnapPoint(
            rawTime,
            thresholdSeconds,
        );
        if (snapPoint !== null) finalTime = snapPoint;
    }

    ghostX.value = finalTime * props.zoomLevel;
    ghostDuration.value = finalDuration;
    ghostTransitionSlot.value = effectiveSlot;
    isOver.value = showGhost;

    // Allow drop
    if (lastDragDataTransfer) {
        lastDragDataTransfer.dropEffect = "copy";
    }
};

const handleDragOver = (e: DragEvent) => {
    lastDragClientX = e.clientX;
    lastDragTarget = e.currentTarget as HTMLElement;
    lastDragDataTransfer = e.dataTransfer;
    if (dragOverRafPending) return;
    dragOverRafPending = true;
    requestAnimationFrame(processDragOver);
};

const handleDragLeave = () => {
    isOver.value = false;
    lastDragTarget = null;
    lastDragDataTransfer = null;
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
        <!-- Gap Indicators -->
        <div 
            v-for="gap in gaps" 
            :key="gap.id"
            class="absolute top-0 bottom-0 z-10 group/gap cursor-pointer"
            :style="{
                left: `${gap.start * zoomLevel}px`,
                width: `${(gap.end - gap.start) * zoomLevel}px`
            }"
            @click.stop="handleCloseGap(gap.start, gap.end)"
        >
            <div class="absolute inset-0 bg-white/0 group-hover/gap:bg-white/5 transition-colors flex items-center justify-center gap-2">
                <div class="h-8 px-3 rounded-lg bg-brand-primary/0 group-hover/gap:bg-brand-primary/90 flex items-center justify-center gap-2 scale-75 group-hover/gap:scale-100 transition-all shadow-lg opacity-0 group-hover/gap:opacity-100">
                    <Trash2 class="w-4 h-4 text-white" />
                    <span class="text-[10px] text-white font-bold uppercase tracking-wider whitespace-nowrap">Delete Gap</span>
                </div>
            </div>
            <!-- Ripple Effect Decoration -->
            <div class="absolute left-0 top-0 bottom-0 w-1 bg-brand-primary/0 group-hover/gap:bg-brand-primary/30 transition-colors"></div>
            <div class="absolute right-0 top-0 bottom-0 w-1 bg-brand-primary/0 group-hover/gap:bg-brand-primary/30 transition-colors"></div>
        </div>

        <!-- Ghost Preview Clip -->
        <GhostClip 
            v-if="isOver && isDropAllowed && ghostData"
            :ghost-data="ghostData ? { ...ghostData, duration: ghostDuration, transitionSlot: ghostTransitionSlot } : null" 
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
            :scroll-container="scrollContainer"
            @contextmenu="
                (e: MouseEvent, id: string) => emit('contextmenu', e, id)
            "
        />
    </div>
</template>

<style scoped>
/* Any track-specific styles */
</style>
