<script setup lang="ts">
import { onMounted, ref, onBeforeUnmount } from 'vue';
import { Application, Graphics, Text } from 'pixi.js';

const canvasContainer = ref<HTMLElement | null>(null);
let app: Application | null = null;

onMounted(async () => {
  if (!canvasContainer.value) return;

  // Initialize PixiJS Application
  app = new Application();
  await app.init({
    background: '#000000',
    resizeTo: canvasContainer.value,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });

  canvasContainer.value.appendChild(app.canvas);

  // Create a placeholder "Video" Screen
  // In a real app, this would be a video sprite or complex container
  const screenWidth = app.screen.width;
  const screenHeight = app.screen.height;

  // Create a background rect to represent the 16:9 canvas area
  const viewportRatio = 16 / 9;
  let viewWidth = screenWidth * 0.8;
  let viewHeight = viewWidth / viewportRatio;

  if (viewHeight > screenHeight * 0.8) {
    viewHeight = screenHeight * 0.8;
    viewWidth = viewHeight * viewportRatio;
  }

  const videoArea = new Graphics();
  videoArea.rect(-viewWidth / 2, -viewHeight / 2, viewWidth, viewHeight);
  videoArea.fill({ color: 0x1a1a24 }); // Dark gray placeholder
  videoArea.stroke({ width: 2, color: 0x333333 });

  // Center it
  videoArea.x = screenWidth / 2;
  videoArea.y = screenHeight / 2;

  app.stage.addChild(videoArea);

  // Add some "content" to show it's rendering
  const welcomeText = new Text({
    text: 'PixiJS Preview\n1920x1080',
    style: {
      fontFamily: 'Inter, sans-serif',
      fontSize: 24,
      fill: 0x4E75FF, // Gemini Blue
      align: 'center',
    }
  });

  welcomeText.anchor.set(0.5);
  videoArea.addChild(welcomeText);

  // Animation loop (just to show life)
  let elapsed = 0.0;
  app.ticker.add((ticker) => {
    elapsed += ticker.deltaTime;
    // Subtle pulse effect
    videoArea.alpha = 0.9 + Math.cos(elapsed / 50) * 0.1;
  });
});

onBeforeUnmount(() => {
  if (app) {
    app.destroy({ removeView: true });
    app = null;
  }
});
</script>

<template>
  <div ref="canvasContainer" class="w-full h-full overflow-hidden rounded-lg shadow-2xl shadow-black/50 border border-gray-800 relative">
    <!-- Overlay Controls (Play/Pause could go here) -->
    <div class="absolute top-4 left-4 text-xs text-gray-500 font-mono pointer-events-none">
      Preview Mode (GPU Accelerated)
    </div>
  </div>
</template>
