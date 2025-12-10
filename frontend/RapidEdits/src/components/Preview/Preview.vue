<script setup lang="ts">
import { onMounted, ref, onBeforeUnmount } from "vue";
import { ThreeRenderer } from "../../core/renderer/ThreeRenderer";
import { useProjectStore } from "../../stores/projectStore";
import { editorEngine } from "../../core/EditorEngine";
import OSD from "../UI/Overlay/OSD.vue";
import AmbientLight from "../UI/AmbientLight.vue";
import Select from "../UI/Input/Select.vue";
import { watch } from "vue";

const canvasContainer = ref<HTMLElement | null>(null);
const store = useProjectStore();

let renderer: ThreeRenderer | null = null;
const currentScaleMode = ref<"fit" | "fill" | number>("fit");

const zoomOptions = [
    { label: "Fit", value: "fit" },
    { label: "Fill", value: "fill" },
    { label: "100%", value: 1.0 },
    { label: "125%", value: 1.25 },
    { label: "150%", value: 1.5 },
    { label: "200%", value: 2.0 },
];

watch(currentScaleMode, (newMode) => {
    if (renderer) {
        renderer.setScaleMode(newMode);
    }
});

onMounted(async () => {
    if (!canvasContainer.value) return;

    // Initialize Custom Renderer
    renderer = new ThreeRenderer({ container: canvasContainer.value });
    await renderer.init();
    editorEngine.registerRenderer(renderer);
});

onBeforeUnmount(() => {
    if (renderer) renderer.destroy();
    editorEngine.registerRenderer(null);
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
            class="w-full h-full overflow-hidden flex items-center justify-center rounded-lg border border-canvas-border relative z-10 bg-transparent"
            @dragover.prevent
            @drop="handleDrop"
        >
            <OSD />

            <!-- Zoom Controls -->
            <div class="absolute top-4 left-4 z-20 w-[50px]">
                <Select
                    v-model="currentScaleMode"
                    :options="zoomOptions"
                    class="text-xs"
                />
            </div>

            <div
                class="absolute bottom-4 left-4 text-xs text-brand-primary/30 font-mono pointer-events-none z-10"
            >
                GPU
            </div>
        </div>
    </div>
</template>
