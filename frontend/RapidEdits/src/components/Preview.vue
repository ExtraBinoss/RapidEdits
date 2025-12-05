<script setup lang="ts">
import { onMounted, ref, onBeforeUnmount } from 'vue';
import { Application } from 'pixi.js';
import { PixiRenderer } from '../core/PixiRenderer';
import { useProjectStore } from '../stores/projectStore';
import OSD from './UI/OSD.vue';

const canvasContainer = ref<HTMLElement | null>(null);
const store = useProjectStore();

let app: Application | null = null;
let renderer: PixiRenderer | null = null;

onMounted(async () => {
  if (!canvasContainer.value) return;

  // Initialize PixiJS Application
  app = new Application();
  await app.init({
    background: '#0b0e14', // Canvas BG
    resizeTo: canvasContainer.value,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });

  canvasContainer.value.appendChild(app.canvas);

  // Initialize Custom Renderer
  // We pass the container explicitly now for robust resizing
  renderer = new PixiRenderer(app, canvasContainer.value);
  await renderer.init();
});

onBeforeUnmount(() => {
  if (renderer) renderer.destroy();
  if (app) {
    app.destroy({ removeView: true });
    app = null;
  }
});

// Drag & Drop to Preview (Adds to start of timeline or specific logic)
const handleDrop = (e: DragEvent) => {
   e.preventDefault();
   const data = e.dataTransfer?.getData('application/json');
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
</script>

<template>
  <div 
    ref="canvasContainer" 
    class="w-full h-full overflow-hidden rounded-lg shadow-2xl shadow-black/50 border border-canvas-border relative bg-black"
    @dragover.prevent
    @drop="handleDrop"
  >
    <OSD />
    <!-- Overlay Controls (Play/Pause could go here) -->
    <div class="absolute top-4 left-4 text-xs text-brand-primary/50 font-mono pointer-events-none z-10">
      GPU Renderer Active
    </div>
  </div>
</template>