<script setup lang="ts">
import { onMounted, ref, onBeforeUnmount } from "vue";
import { ThreeRenderer } from "../core/ThreeRenderer";
import { useProjectStore } from "../stores/projectStore";
import OSD from "./UI/OSD.vue";
import Popover from "./UI/Popover.vue";
import AmbientLight from "./UI/AmbientLight.vue";

const canvasContainer = ref<HTMLElement | null>(null);
const store = useProjectStore();

let renderer: ThreeRenderer | null = null;
const currentScaleMode = ref<"fit" | "fill" | number>("fit");
const currentLabel = ref("Fit");

const zoomOptions = [
    { label: "Fit", value: "fit" },
    { label: "Fill", value: "fill" },
    { label: "100%", value: 1.0 },
    { label: "125%", value: 1.25 },
    { label: "150%", value: 1.5 },
    { label: "200%", value: 2.0 },
];

const setZoom = (
    option: { label: string; value: string | number },
    close: () => void,
) => {
    if (!renderer) return;
    currentScaleMode.value = option.value as any;
    currentLabel.value = option.label;
    renderer.setScaleMode(currentScaleMode.value);
    close();
};

onMounted(async () => {
    if (!canvasContainer.value) return;

    // Initialize Custom Renderer
    renderer = new ThreeRenderer(canvasContainer.value);
    await renderer.init();
});

onBeforeUnmount(() => {
    if (renderer) renderer.destroy();
    renderer = null;
});

// Drag & Drop to Preview (Adds to start of timeline or specific logic)
const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer?.getData("application/json");
    if (data) {
        try {
            const assetData = JSON.parse(data);

            // Determine track type
            let trackType: "video" | "audio" = "video";
            if (assetData.type === "audio") trackType = "audio";

            // Try to find an existing empty track of the correct type
            let targetTrack = store.tracks.find(
                (t) => t.type === trackType && t.clips.length === 0,
            );

            // If no empty track, create one
            if (!targetTrack) {
                targetTrack = store.addTrack(trackType);
            }

            // Add to the track at current time
            store.addClipToTimeline(
                assetData.id,
                targetTrack.id,
                store.currentTime,
            );
        } catch (err) {
            console.error(err);
        }
    }
};
</script>

<template>
    <div class="w-full h-full relative isolate">
        <!-- Background Ambient Light -->
        <AmbientLight />

        <!-- Main Canvas Container -->
        <div
            ref="canvasContainer"
            class="w-full h-full overflow-hidden rounded-lg border border-canvas-border relative bg-black z-10"
            @dragover.prevent
            @drop="handleDrop"
        >
            <OSD />

            <!-- Zoom Controls -->
            <div class="absolute top-4 left-4 z-20">
                <Popover position="bottom-left">
                    <template #trigger="{ isOpen }">
                        <button
                            class="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 border border-white/10 bg-black/40 backdrop-blur-md shadow-lg hover:bg-black/60 hover:border-white/20"
                            :class="
                                isOpen
                                    ? 'text-brand-primary border-brand-primary/30'
                                    : 'text-gray-200'
                            "
                        >
                            <span>{{ currentLabel }}</span>
                            <svg
                                class="w-3 h-3 opacity-50"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M19 9l-7 7-7-7"
                                />
                            </svg>
                        </button>
                    </template>
                    <template #content="{ close }">
                        <div
                            class="py-1 min-w-[120px] bg-canvas-light border border-canvas-border rounded-lg shadow-xl overflow-hidden"
                        >
                            <div
                                class="px-3 py-2 text-[10px] uppercase font-bold text-text-dim tracking-wider select-none"
                            >
                                Zoom Level
                            </div>
                            <button
                                v-for="opt in zoomOptions"
                                :key="opt.label"
                                @click="setZoom(opt, close)"
                                class="w-full text-left px-4 py-2 text-xs text-text-primary hover:bg-brand-primary/10 hover:text-brand-primary transition-colors flex items-center justify-between group"
                            >
                                {{ opt.label }}
                                <span
                                    v-if="currentLabel === opt.label"
                                    class="text-brand-primary"
                                >
                                    <svg
                                        class="w-3 h-3"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="2"
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                </span>
                            </button>
                        </div>
                    </template>
                </Popover>
            </div>

            <div
                class="absolute bottom-4 left-4 text-xs text-brand-primary/30 font-mono pointer-events-none z-10"
            >
                GPU
            </div>
        </div>
    </div>
</template>
