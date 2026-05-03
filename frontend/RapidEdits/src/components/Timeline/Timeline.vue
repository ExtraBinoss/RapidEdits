<script setup lang="ts">
import { Trash2, Unlink } from "lucide-vue-next";
import { useProjectStore } from "../../stores/projectStore";
import { useDragDrop } from "../../composables/useDragDrop";
import DynamicTrack from "./TimelineComponents/Track/DynamicTrack.vue";
import TimeRuler from "./TimelineComponents/TimeRuler/TimeRuler.vue";
import ContextMenu from "../UI/ContextMenu/ContextMenu.vue";
import type { ContextMenuItem } from "../UI/ContextMenu/ContextMenu.vue";
import { editorEngine } from "../../core/EditorEngine";
import TimelineToolbar from "./TimelineComponents/Toolbar/TimelineToolbar.vue";
import TrackHeader from "./TimelineComponents/Track/TrackHeader.vue";
import { ref, watch, computed } from "vue";
import { storeToRefs } from "pinia";

const store = useProjectStore();
const { tracks, currentTime, isPlaying } = storeToRefs(store);

// ... (other imports)

// Context menu logic (for Clips)
const showContextMenu = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const contextMenuTargets = ref<string[]>([]);

const handleClipContextMenu = (e: MouseEvent, _clipId: string) => {
    showContextMenu.value = true;
    contextMenuX.value = e.clientX;
    contextMenuY.value = e.clientY;
    contextMenuTargets.value = store.getSelectedClipIds();
};

const contextMenuItems = computed<ContextMenuItem[]>(() => [
    {
        label: `Selected: ${contextMenuTargets.value.length} items`,
        disabled: true,
    },
    { divider: true },
    {
        label: "Unlink Clips",
        icon: Unlink,
        action: () => store.unlinkSelectedClips(),
    },
    {
        label: "Delete",
        icon: Trash2,
        danger: true,
        action: () => store.deleteSelectedClips(),
    },
    { divider: true },
    {
        label: "Speed (Coming Soon)",
        disabled: true,
    },
]);

const videoTracks = computed(() => {
    return tracks.value.filter((t) => t.type === "video");
});
const audioTracks = computed(() => {
    return tracks.value.filter((t) => t.type === "audio");
});
const customTracks = computed(() => {
    return tracks.value.filter((t) => t.type !== "video" && t.type !== "audio");
});
import { onMounted, onUnmounted } from "vue";
import { Video, Music, Image as ImageIcon, Box, Plus } from "lucide-vue-next";
import { EditorEventType, MediaType } from "../../types/Media";
import GhostClip from "./TimelineComponents/Track/GhostClip.vue";
import { globalEventBus } from "../../core/events/EventBus";

// Ghost Preview for New Track Zones
const hoverZone = ref<"video" | "audio" | null>(null);
const zoneGhostX = ref(0);

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

const handleZoneDragOver = (e: DragEvent, type: "video" | "audio") => {
    hoverZone.value = type;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawTime = rawX / zoomLevel.value;

    // Snapping
    let finalTime = rawTime;
    if (editorEngine.getIsSnappingEnabled()) {
        const thresholdSeconds = 15 / zoomLevel.value;
        const snapPoint = editorEngine.getClosestSnapPoint(
            rawTime,
            thresholdSeconds,
        );
        if (snapPoint !== null) finalTime = snapPoint;
    }

    zoneGhostX.value = finalTime * zoomLevel.value;
};

const handleZoneDragLeave = () => {
    hoverZone.value = null;
};

// Pixels per second
const zoomLevel = ref(20);

const scrollContainer = ref<HTMLElement | null>(null);
const headersContainer = ref<HTMLElement | null>(null);
const containerWidth = ref(0);

const visibleStart = ref(0);
const visibleEnd = ref(0);

const updateVisibleRange = () => {
    if (!scrollContainer.value) return;
    const el = scrollContainer.value;
    const start = el.scrollLeft / zoomLevel.value;
    const end = (el.scrollLeft + el.clientWidth) / zoomLevel.value;
    
    containerWidth.value = el.clientWidth;

    // Add buffer (e.g. 1 screen width worth of time)
    const buffer = (el.clientWidth / zoomLevel.value) * 0.5;
    visibleStart.value = Math.max(0, start - buffer);
    visibleEnd.value = end + buffer;
};

let scrollUpdatePending = false;
const handleScroll = () => {
    if (scrollContainer.value && headersContainer.value) {
        headersContainer.value.scrollTop = scrollContainer.value.scrollTop;
    }

    // Throttle virtualization updates to avoid excessive re-calculations
    if (!scrollUpdatePending) {
        requestAnimationFrame(() => {
            updateVisibleRange();
            scrollUpdatePending = false;
        });
        scrollUpdatePending = true;
    }
};

// Update on zoom change
watch(zoomLevel, () => {
    updateVisibleRange();
});

// Initial update on mount (use resize observer for robustness)
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
    if (scrollContainer.value) {
        resizeObserver = new ResizeObserver(() => updateVisibleRange());
        resizeObserver.observe(scrollContainer.value);
        updateVisibleRange();
    }
});

onUnmounted(() => {
    resizeObserver?.disconnect();
});

// Auto-scroll logic
watch(currentTime, (time) => {
    if (!scrollContainer.value) return;

    const el = scrollContainer.value;
    const playheadX = time * zoomLevel.value;
    const width = el.clientWidth;
    const scrollLeft = el.scrollLeft;

    // If playhead moves out of view to the right
    if (playheadX > scrollLeft + width - 50) {
        el.scrollLeft = playheadX - 100;
    }
    // If playhead moves out of view to the left (e.g. loop or seek)
    else if (playheadX < scrollLeft) {
        el.scrollLeft = playheadX - 100;
    }
});

const {} = useDragDrop(() => {
    // Handle File Drop directly onto track (upload + add)
    // For now, focus on Internal Asset Drop which is handled differently
});

const handleTrackDrop = (e: DragEvent, trackId: number) => {
    e.preventDefault();
    
    // Calculate drop time
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const rawTime = Math.max(0, offsetX / zoomLevel.value);

    // Snapping Logic
    let finalTime = rawTime;
    if (editorEngine.getIsSnappingEnabled()) {
        const thresholdSeconds = 15 / zoomLevel.value;
        const snapPoint = editorEngine.getClosestSnapPoint(
            rawTime,
            thresholdSeconds,
        );
        if (snapPoint !== null) finalTime = snapPoint;
    }

    // 1. Handle Plugin Drop (Transitions/Effects)
    if (store.draggedPlugin) {
        const meta = store.draggedPlugin.getMetadata();
        
        if (meta.type === 'transition') {
            // Find clip at drop position with small epsilon
            const epsilon = 0.01;
            const track = store.tracks.find(t => t.id === trackId);
            if (track) {
                const clip = track.clips.find(c => 
                    rawTime >= (c.start - epsilon) && rawTime <= (c.start + c.duration + epsilon)
                );
                
                if (clip) {
                    const currentData = { ...(clip.data || {}) };
                    const transitions = { ...(currentData.transitions || {}) };
                    
                    // Create default data for this transition
                    const defaultData = store.draggedPlugin.createData?.() || { duration: 1.0 };
                    transitions[meta.id] = defaultData;
                    
                    store.updateClip(clip.id, {
                        data: { ...currentData, transitions }
                    });

                    // FORCE auto-select the clip to show properties
                    // We deselect then select to ensure a reactive change if it was already selected
                    store.deselectAll();
                    setTimeout(() => {
                        store.selectClip(clip.id, false);
                    }, 50);
                    
                    globalEventBus.emit({
                        type: EditorEventType.SHOW_FEEDBACK,
                        payload: { icon: "Zap", text: `${meta.name} added to clip` }
                    });
                }
            }
        }
        // Handle other plugin types if needed...
        return;
    }

    // 2. Handle Asset Drop
    const data = e.dataTransfer?.getData("application/json");
    if (data) {
        try {
            const assetData = JSON.parse(data);
            store.addClipToTimeline(assetData.id, trackId, finalTime);
        } catch (err) {
            console.error("Invalid drop data", err);
        }
    }
};

const handleNewTrackDrop = (e: DragEvent, type: "video" | "audio") => {
    e.preventDefault();
    const data = e.dataTransfer?.getData("application/json");
    if (data) {
        try {
            const assetData = JSON.parse(data);

            // Auto create track
            const newTrack = store.addTrack(type);

            // Add clip to the new track
            const rect = (
                e.currentTarget as HTMLElement
            ).getBoundingClientRect();
            const offsetX = e.clientX - rect.left;
            const rawTime = Math.max(0, offsetX / zoomLevel.value);

            // Snapping Logic
            let finalTime = rawTime;
            if (editorEngine.getIsSnappingEnabled()) {
                const thresholdSeconds = 15 / zoomLevel.value;
                const snapPoint = editorEngine.getClosestSnapPoint(
                    rawTime,
                    thresholdSeconds,
                );
                if (snapPoint !== null) finalTime = snapPoint;
            }

            // We must add to the SPECIFIC track we just created
            store.addClipToTimeline(assetData.id, newTrack.id, finalTime);
        } catch (err) {
            console.error("Invalid drop data", err);
        }
    }
};

const isScrubbing = ref(false);
let scrubRafId: number | null = null;

// Local reactive state for snapping
const isSnappingEnabled = ref(editorEngine.getIsSnappingEnabled());

const toggleSnapping = () => {
    editorEngine.toggleSnapping();
    // Manually sync local state whenever we toggle
    isSnappingEnabled.value = editorEngine.getIsSnappingEnabled();
    isSnappingEnabled.value = editorEngine.getIsSnappingEnabled();
};

// Tools
const activeTool = ref<"select" | "razor">("select");

const setActiveTool = (tool: "select" | "razor") => {
    activeTool.value = tool;
    editorEngine.setTool(tool);
};

// Split Logic
const handleSplit = () => {
    // Split at playhead
    // We need to find which clip is under the playhead on Selected Tracks
    // For now, let's just split the FIRST clip found under playhead on ANY track for simplicity,
    // or better: split all clips under playhead if no selection, or just selected clip

    // Simple v1: Split selected clip at playhead
    // Simple v1: Split selected clip at playhead
    const selectedIds = store.getSelectedClipIds();
    if (selectedIds.length > 0) {
        selectedIds.forEach((id) => {
            store.splitClip(id, currentTime.value);
        });
        // Clear selection to avoid stale IDs for next split attempt
        store.selectClip("", false);
    } else {
        // Fallback: Split valid clips under playhead on ALL tracks
        // We capture the list of clips to split FIRST to avoid issues if tracks array changes during iteration
        const clipsToSplit: { id: string; time: number }[] = [];

        store.tracks.forEach((track) => {
            const clipUnderPlayhead = track.clips.find(
                (c) =>
                    c.start < currentTime.value &&
                    c.start + c.duration > currentTime.value, // strict inequality to avoid splitting at exact edge
            );
            if (clipUnderPlayhead) {
                clipsToSplit.push({
                    id: clipUnderPlayhead.id,
                    time: currentTime.value,
                });
            }
        });

        clipsToSplit.forEach(({ id, time }) => {
            store.splitClip(id, time);
        });
    }
};

const handleRazorClick = (_e: MouseEvent, trackId: number, time: number) => {
    if (activeTool.value !== "razor") return;

    // Find clip at time
    const track = store.tracks.find((t) => t.id === trackId);
    if (!track) return;

    const clip = track.clips.find(
        (c) => c.start <= time && c.start + c.duration > time,
    );
    if (clip) {
        store.splitClip(clip.id, time);
        // Optional: switch back to select tool after one cut?
        // setActiveTool('select');
    }
};

const startScrubbing = (e: MouseEvent) => {
    // ...
    e.preventDefault();
    isScrubbing.value = true;

    const rulerEl = e.currentTarget as HTMLElement;

    const scrubLoop = () => {
        if (!isScrubbing.value) return;

        const { x } = editorEngine.getMousePosition();
        const rect = rulerEl.getBoundingClientRect();
        const offsetX = x - rect.left;
        const time = Math.max(0, offsetX / zoomLevel.value);

        store.seek(time);

        scrubRafId = requestAnimationFrame(scrubLoop);
    };

    // Initial seek
    scrubLoop();

    const stopScrubbing = () => {
        isScrubbing.value = false;
        if (scrubRafId) {
            cancelAnimationFrame(scrubRafId);
            scrubRafId = null;
        }
        window.removeEventListener("mouseup", stopScrubbing);
    };

    window.addEventListener("mouseup", stopScrubbing);
};

const handleTimelineClick = () => {
    store.selectClip("", false); // Deselect all when clicking empty space
};
</script>

<template>
    <div class="flex flex-col h-full select-none" @click="handleTimelineClick">
        <!-- Clip Context Menu -->
        <Teleport to="body">
            <ContextMenu
                :show="showContextMenu"
                @close="showContextMenu = false"
                :x="contextMenuX"
                :y="contextMenuY"
                :items="contextMenuItems"
            />
        </Teleport>

        <!-- Timeline Toolbar -->
        <TimelineToolbar
            :is-playing="isPlaying"
            :is-snapping="isSnappingEnabled"
            :current-time="currentTime"
            :duration="store.duration"
            :active-tool="activeTool"
            v-model:zoom-level="zoomLevel"
            @seek="store.seek"
            @toggle-playback="store.togglePlayback"
            @toggle-snapping="toggleSnapping"
            @split="handleSplit"
            @update:active-tool="setActiveTool"
        />

        <!-- Timeline Area -->
        <div class="flex-1 flex min-h-0 overflow-hidden bg-canvas relative">
            <!-- Track Headers -->
            <div
                ref="headersContainer"
                class="w-32 flex-shrink-0 border-r border-canvas-border bg-canvas-light z-50 flex flex-col pt-8 shadow-lg overflow-hidden"
            >
                <!-- Section: Overlays & Effects Label -->
                <div v-if="customTracks.length > 0" class="h-10 flex-shrink-0 px-3 flex items-center gap-2 border-b border-canvas-border/30 bg-indigo-500/5">
                    <Box class="w-3 h-3 text-indigo-500 opacity-60" />
                    <span class="text-[9px] font-bold uppercase tracking-widest text-indigo-500 opacity-60">Overlays</span>
                </div>

                <!-- Custom/Overlay Tracks Header -->
                <TrackHeader
                    v-for="track in customTracks"
                    :key="track.id"
                    :track="track"
                />

                <div
                    v-if="customTracks.length > 0"
                    class="h-4 bg-canvas-darker flex items-center justify-center flex-shrink-0"
                ></div>

                <!-- Video Tracks Section Label -->
                <div class="h-10 flex-shrink-0 px-3 flex items-center gap-2 border-b border-canvas-border/30 bg-brand-primary/5">
                    <Video class="w-3 h-3 text-brand-primary opacity-60" />
                    <span class="text-[9px] font-bold uppercase tracking-widest text-brand-primary opacity-60">Video</span>
                </div>

                <!-- Video Tracks Header -->
                <TrackHeader
                    v-for="track in videoTracks"
                    :key="track.id"
                    :track="track"
                />

                <!-- Spacer for Video Drop Zone -->
                <div class="h-24 flex-shrink-0 flex flex-col items-center justify-center border-b border-brand-primary/10 bg-brand-primary/[0.02]">
                    <Plus class="w-4 h-4 text-brand-primary opacity-30" />
                    <span class="text-[8px] font-bold uppercase text-brand-primary opacity-30 mt-1">Add Track</span>
                </div>

                <!-- Divider -->
                <div class="h-8 bg-canvas-darker flex items-center justify-center flex-shrink-0 border-y border-canvas-border/50">
                    <div class="w-full h-[1px] bg-canvas-border opacity-30"></div>
                </div>

                <!-- Audio Tracks Section Label -->
                <div class="h-10 flex-shrink-0 px-3 flex items-center gap-2 border-b border-canvas-border/30 bg-emerald-500/5">
                    <Music class="w-3 h-3 text-emerald-500 opacity-60" />
                    <span class="text-[9px] font-bold uppercase tracking-widest text-emerald-500 opacity-60">Audio</span>
                </div>

                <!-- Audio Tracks Header -->
                <TrackHeader
                    v-for="track in audioTracks"
                    :key="track.id"
                    :track="track"
                />

                <!-- Spacer for Audio Drop Zone -->
                <div class="h-24 flex-shrink-0 flex flex-col items-center justify-center border-b border-emerald-500/10 bg-emerald-500/[0.02]">
                    <Plus class="w-4 h-4 text-emerald-500 opacity-30" />
                    <span class="text-[8px] font-bold uppercase text-emerald-500 opacity-30 mt-1">Add Track</span>
                </div>
            </div>

            <!-- Tracks Scroll Area -->
            <div
                ref="scrollContainer"
                class="flex-1 overflow-auto relative custom-scrollbar"
                @scroll="handleScroll"
            >
                <!-- Ruler -->
                <div
                    class="h-8 sticky top-0 bg-canvas-light border-canvas-border z-40 flex items-end cursor-pointer hover:bg-canvas-lighter shadow-sm"
                    @mousedown="startScrubbing"
                    :style="{
                        minWidth: '100%',
                        width: `${store.duration * zoomLevel}px`,
                    }"
                >
                    <TimeRuler :duration="store.duration" :zoom="zoomLevel" />
                </div>

                <!-- Track Content -->
                <div class="relative min-w-[2000px]">
                    <!-- Playhead Line (Now inside content to span full height) -->
                    <div
                        class="absolute top-0 bottom-0 w-[1px] bg-red-500 z-30 pointer-events-none transition-none"
                        :style="{
                            left: `${currentTime * zoomLevel}px`,
                            height: '100%',
                        }"
                    >
                        <div
                            class="w-3 h-3 -ml-1.5 bg-red-500 rotate-45 -mt-1.5 shadow-sm sticky top-0"
                        ></div>
                    </div>

                    <!-- Section: Overlays & Effects -->
                    <div v-if="customTracks.length > 0" class="h-10 flex items-center px-4 bg-indigo-500/5 border-b border-indigo-500/10">
                        <div class="flex items-center gap-2 opacity-40">
                             <Box class="w-3.5 h-3.5 text-indigo-500" />
                             <span class="text-[9px] font-bold uppercase tracking-widest text-indigo-500">Overlays & Effects</span>
                        </div>
                    </div>

                    <!-- Custom Tracks Loop -->
                    <template v-for="track in customTracks" :key="track.id">
                        <DynamicTrack
                            :track="track"
                            :zoom-level="zoomLevel"
                            :active-tool="activeTool"
                            :visible-start="visibleStart"
                            :visible-end="visibleEnd"
                            :scroll-container="scrollContainer"
                            @drop="handleTrackDrop"
                            @contextmenu="handleClipContextMenu"
                            @razor-click="handleRazorClick"
                        />
                    </template>

                    <!-- Divider -->
                    <div
                        v-if="customTracks.length > 0"
                        class="h-4 bg-canvas-darker"
                    ></div>

                    <!-- Section: Video -->
                    <div class="h-10 flex items-center px-4 bg-brand-primary/5 border-b border-brand-primary/10">
                        <div class="flex items-center gap-2 opacity-40">
                             <Video class="w-3.5 h-3.5 text-brand-primary" />
                             <span class="text-[9px] font-bold uppercase tracking-widest text-brand-primary">Video Tracks</span>
                        </div>
                    </div>

                    <!-- Video Tracks Loop -->
                    <template v-for="track in videoTracks" :key="track.id">
                        <DynamicTrack
                            :track="track"
                            :zoom-level="zoomLevel"
                            :active-tool="activeTool"
                            :visible-start="visibleStart"
                            :visible-end="visibleEnd"
                            :scroll-container="scrollContainer"
                            @drop="handleTrackDrop"
                            @contextmenu="handleClipContextMenu"
                            @razor-click="handleRazorClick"
                        />
                        <!-- Drop between Zone (Mini) -->
                        <div 
                            class="h-4 relative group/gap z-40 -mt-2 -mb-2"
                            @dragover.prevent="handleZoneDragOver($event, 'video')"
                            @dragleave="handleZoneDragLeave"
                            @drop="handleNewTrackDrop($event, 'video')"
                        >
                             <div class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-brand-primary/0 group-hover/gap:bg-brand-primary/40 transition-colors"></div>
                             <GhostClip 
                                v-if="hoverZone === 'video'" 
                                :ghost-data="ghostData" 
                                :x="zoneGhostX" 
                                :zoom-level="zoomLevel" 
                            />
                        </div>
                    </template>

                    <!-- Video Drop Zone (Always Present Bottom) -->
                    <div
                        class="h-24 border-y border-brand-primary/20 relative bg-brand-primary/[0.04] border-dashed border-2 border-brand-primary/20 hover:border-brand-primary/40 hover:bg-brand-primary/10 transition-all flex group"
                        @dragover.prevent="handleZoneDragOver($event, 'video')"
                        @dragleave="handleZoneDragLeave"
                        @drop="handleNewTrackDrop($event, 'video')"
                    >
                        <div class="absolute inset-0 bg-gradient-to-br from-brand-primary/5 to-transparent pointer-events-none"></div>
                        <GhostClip 
                            v-if="hoverZone === 'video'" 
                            :ghost-data="ghostData" 
                            :x="zoneGhostX" 
                            :zoom-level="zoomLevel" 
                        />
                        <div 
                            class="sticky left-0 h-full flex flex-col items-center justify-center gap-2 pointer-events-none transition-all group-hover:scale-105 z-20"
                            :style="{ width: `${containerWidth}px` }"
                        >
                            <div class="w-8 h-8 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center shadow-md backdrop-blur-sm group-hover:bg-brand-primary/20 transition-colors">
                                <Plus class="w-5 h-5 text-brand-primary" />
                            </div>
                            <div class="flex flex-col items-center gap-0.5">
                                <span class="text-[9px] font-bold text-brand-primary uppercase tracking-widest">Add Video Track</span>
                                <span class="text-[7px] text-brand-primary/40 font-medium italic">Drop media here</span>
                            </div>
                        </div>
                    </div>

                    <!-- Divider -->
                    <div class="h-8 bg-canvas-darker border-y border-canvas-border/50 flex items-center px-4">
                        <div class="w-full h-[1px] bg-canvas-border opacity-20"></div>
                    </div>

                    <!-- Section: Audio -->
                    <div class="h-10 flex items-center px-4 bg-emerald-500/5 border-b border-emerald-500/10">
                         <div class="flex items-center gap-2 opacity-40">
                             <Music class="w-3.5 h-3.5 text-emerald-500" />
                             <span class="text-[9px] font-bold uppercase tracking-widest text-emerald-500">Audio Tracks</span>
                        </div>
                    </div>

                    <!-- Audio Tracks Loop -->
                    <template v-for="track in audioTracks" :key="track.id">
                        <DynamicTrack
                            :track="track"
                            :zoom-level="zoomLevel"
                            :active-tool="activeTool"
                            :visible-start="visibleStart"
                            :visible-end="visibleEnd"
                            :scroll-container="scrollContainer"
                            @drop="handleTrackDrop"
                            @contextmenu="handleClipContextMenu"
                            @razor-click="handleRazorClick"
                        />
                        <!-- Drop between Zone (Mini) -->
                        <div 
                            class="h-4 relative group/gap z-40 -mt-2 -mb-2"
                            @dragover.prevent="handleZoneDragOver($event, 'audio')"
                            @dragleave="handleZoneDragLeave"
                            @drop="handleNewTrackDrop($event, 'audio')"
                        >
                             <div class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-emerald-500/0 group-hover/gap:bg-emerald-500/40 transition-colors"></div>
                             <GhostClip 
                                v-if="hoverZone === 'audio'" 
                                :ghost-data="ghostData" 
                                :x="zoneGhostX" 
                                :zoom-level="zoomLevel" 
                            />
                        </div>
                    </template>

                    <!-- Audio Drop Zone (Create new track) -->
                    <div
                        class="h-24 border-y border-emerald-500/20 relative bg-emerald-500/[0.04] border-dashed border-2 border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/10 transition-all flex group"
                        @dragover.prevent="handleZoneDragOver($event, 'audio')"
                        @dragleave="handleZoneDragLeave"
                        @drop="handleNewTrackDrop($event, 'audio')"
                    >
                        <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none"></div>
                        <GhostClip 
                            v-if="hoverZone === 'audio'" 
                            :ghost-data="ghostData" 
                            :x="zoneGhostX" 
                            :zoom-level="zoomLevel" 
                        />
                        <div 
                            class="sticky left-0 h-full flex flex-col items-center justify-center gap-2 pointer-events-none transition-all group-hover:scale-105 z-20"
                            :style="{ width: `${containerWidth}px` }"
                        >
                            <div class="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-md backdrop-blur-sm group-hover:bg-emerald-500/20 transition-colors">
                                <Plus class="w-5 h-5 text-emerald-500" />
                            </div>
                            <div class="flex flex-col items-center gap-0.5">
                                <span class="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Add Audio Track</span>
                                <span class="text-[7px] text-emerald-500/40 font-medium italic">Drop sound here</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
    height: 10px;
    width: 10px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: #0b0e14;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: #2a3445;
    border-radius: 5px;
}
</style>
