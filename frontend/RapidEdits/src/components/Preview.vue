<script setup lang="ts">
import { onMounted, ref, onBeforeUnmount } from "vue";
import { ThreeRenderer } from "../core/ThreeRenderer";
import { useProjectStore } from "../stores/projectStore";
import { globalEventBus } from "../core/EventBus";
import OSD from "./UI/OSD.vue";

const canvasContainer = ref<HTMLElement | null>(null);
const store = useProjectStore();
const ambientShadow = ref<string>("transparent");

let renderer: ThreeRenderer | null = null;

const handleAmbientUpdate = (color: any) => {
    ambientShadow.value = color;
};

onMounted(async () => {
    globalEventBus.on("AMBIENT_COLOR_UPDATE", handleAmbientUpdate);

    if (!canvasContainer.value) return;

    // Initialize Custom Renderer
    renderer = new ThreeRenderer(canvasContainer.value);
    await renderer.init();
});

onBeforeUnmount(() => {
    globalEventBus.off("AMBIENT_COLOR_UPDATE", handleAmbientUpdate);
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
            // Drop into preview = Add to first available video track at current time
            store.addClipToTimeline(assetData.id, 1, store.currentTime);
        } catch (err) {
            console.error(err);
        }
    }
};

const currentScaleMode = ref<"fit" | "fill">("fit");

const toggleScaleMode = () => {
    if (!renderer) return;
    currentScaleMode.value = currentScaleMode.value === "fit" ? "fill" : "fit";
    renderer.setScaleMode(currentScaleMode.value);
};
</script>

<template>
    <div
        ref="canvasContainer"
        class="w-full h-full overflow-hidden rounded-lg border border-canvas-border relative bg-black transition-shadow duration-700 ease-out"
        :style="{ boxShadow: `0 0 100px ${ambientShadow}` }"
        @dragover.prevent
        @drop="handleDrop"
        @dblclick="toggleScaleMode"
    >
        <OSD />
        <!-- Overlay Controls (Play/Pause could go here) -->
        <div
            class="absolute top-4 left-4 text-xs text-brand-primary/50 font-mono pointer-events-none z-10"
        >
            GPU Renderer Active | Dbl-Click to
            {{ currentScaleMode === "fit" ? "Fill" : "Fit" }}
        </div>
    </div>
</template>
