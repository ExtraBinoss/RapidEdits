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
import { ref, watch, computed } from "vue";
import { storeToRefs } from "pinia";

const store = useProjectStore();
const { tracks, currentTime, isPlaying } = storeToRefs(store);

const videoTracks = computed(() => {
    return tracks.value.filter(
        (t) => t.type === "video" || t.type === "image" || t.type === "text",
    );
});
const audioTracks = computed(() => {
    return tracks.value.filter((t) => t.type === "audio");
});

// Pixels per second
const zoomLevel = ref(20);

const scrollContainer = ref<HTMLElement | null>(null);
const headersContainer = ref<HTMLElement | null>(null);

const handleScroll = () => {
    if (scrollContainer.value && headersContainer.value) {
        headersContainer.value.scrollTop = scrollContainer.value.scrollTop;
    }
};

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
    const data = e.dataTransfer?.getData("application/json");
    if (data) {
        try {
            const assetData = JSON.parse(data);
            const rect = (
                e.currentTarget as HTMLElement
            ).getBoundingClientRect();
            const offsetX = e.clientX - rect.left;
            const startTime = Math.max(0, offsetX / zoomLevel.value);

            store.addClipToTimeline(assetData.id, trackId, startTime);
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
            const startTime = Math.max(0, offsetX / zoomLevel.value);

            // We must add to the SPECIFIC track we just created
            store.addClipToTimeline(assetData.id, newTrack.id, startTime);
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

const handleRazorClick = (e: MouseEvent, trackId: number, time: number) => {
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

// Context menu logic
const showContextMenu = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const contextMenuTargets = ref<string[]>([]);

const handleClipContextMenu = (e: MouseEvent, clipId: string) => {
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

const handleTimelineClick = () => {
    store.selectClip("", false); // Deselect all when clicking empty space
};
</script>

<template>
    <div class="flex flex-col h-full select-none" @click="handleTimelineClick">
        <!-- Context Menu -->
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
                class="w-32 flex-shrink-0 border-r border-canvas-border bg-canvas-light z-20 flex flex-col pt-8 shadow-lg overflow-hidden"
            >
                <!-- Video Tracks Header -->
                <div
                    v-for="track in videoTracks"
                    :key="track.id"
                    class="h-24 border-b border-canvas-border flex flex-col justify-center px-3 text-xs hover:bg-canvas-lighter transition-colors group flex-shrink-0"
                >
                    <span class="font-medium text-text-main mb-1">{{
                        track.name
                    }}</span>
                    <div
                        class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <!-- Track controls placeholder -->
                    </div>
                </div>

                <!-- Spacer for Video Drop Zone -->
                <div class="h-24 flex-shrink-0"></div>

                <!-- Divider -->
                <div
                    class="h-4 bg-canvas-darker border-y border-canvas-border flex items-center justify-center flex-shrink-0"
                >
                    <!-- Optional: Icon or Label -->
                </div>

                <!-- Audio Tracks Header -->
                <div
                    v-for="track in audioTracks"
                    :key="track.id"
                    class="h-24 border-b border-canvas-border flex flex-col justify-center px-3 text-xs hover:bg-canvas-lighter transition-colors group flex-shrink-0"
                >
                    <span class="font-medium text-text-main mb-1">{{
                        track.name
                    }}</span>
                    <div
                        class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <!-- Track controls placeholder -->
                    </div>
                </div>

                <!-- Spacer for Audio Drop Zone -->
                <div class="h-24 flex-shrink-0"></div>
            </div>

            <!-- Tracks Scroll Area -->
            <div
                ref="scrollContainer"
                class="flex-1 overflow-auto relative custom-scrollbar"
                @scroll="handleScroll"
            >
                <!-- Ruler -->
                <div
                    class="h-8 sticky top-0 bg-canvas-light border-b border-canvas-border z-10 flex items-end cursor-pointer hover:bg-canvas-lighter"
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

                    <!-- Video Tracks Loop -->
                    <DynamicTrack
                        v-for="track in videoTracks"
                        :key="track.id"
                        :track="track"
                        :zoom-level="zoomLevel"
                        :active-tool="activeTool"
                        @contextmenu="handleClipContextMenu"
                        @razor-click="handleRazorClick"
                    />

                    <!-- Video Drop Zone (Create new track) -->
                    <div
                        class="h-24 border-b border-canvas-border/30 relative bg-canvas/10 border-dashed border-2 border-transparent hover:border-brand-primary/30 transition-colors flex items-center justify-center text-text-muted/50 hover:text-brand-primary/80"
                        @dragover.prevent
                        @drop="handleNewTrackDrop($event, 'video')"
                    >
                        <span>Drop here to add Video Track</span>
                    </div>

                    <!-- Divider -->
                    <div
                        class="h-4 bg-canvas-darker border-y border-canvas-border/30"
                    ></div>

                    <!-- Audio Tracks Loop -->
                    <DynamicTrack
                        v-for="track in audioTracks"
                        :key="track.id"
                        :track="track"
                        :zoom-level="zoomLevel"
                        :active-tool="activeTool"
                        @drop="handleTrackDrop"
                        @contextmenu="handleClipContextMenu"
                        @razor-click="handleRazorClick"
                    />

                    <!-- Audio Drop Zone (Create new track) -->
                    <div
                        class="h-24 border-b border-canvas-border/30 relative bg-canvas/10 border-dashed border-2 border-transparent hover:border-emerald-500/30 transition-colors flex items-center justify-center text-text-muted/50 hover:text-emerald-500/80"
                        @dragover.prevent
                        @drop="handleNewTrackDrop($event, 'audio')"
                    >
                        <span>Drop here to add Audio Track</span>
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
