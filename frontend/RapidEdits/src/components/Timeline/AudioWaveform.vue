<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { waveformGenerator } from '../../core/WaveformGenerator';
import { globalEventBus } from '../../core/EventBus';
import type { Clip } from '../../types/Timeline';
import { editorEngine } from '../../core/EditorEngine';

const props = defineProps<{
  clip: Clip;
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
const container = ref<HTMLElement | null>(null);
const asset = editorEngine.getAsset(props.clip.assetId);
const peaks = ref<Float32Array | null>(null);

// Fixed resolution for caching (100 peaks per second)
// This offers good detail even at high zoom, while keeping memory low (40min = ~1MB)
const PEAKS_PER_SECOND = 100; 

// Virtualization State
const canvasLeft = ref(0);
const canvasWidth = ref(0);
let animationFrame: number;

const render = () => {
    if (!canvas.value || !container.value || !peaks.value) return;
    
    const containerRect = container.value.getBoundingClientRect();
    const windowWidth = window.innerWidth;

    // 1. Visibility Check
    if (containerRect.right < 0 || containerRect.left > windowWidth) {
        return; // Offscreen
    }

    // 2. Virtualization Calculations
    // Determine visible part of the clip container
    const visibleStartPx = Math.max(0, -containerRect.left);
    const visibleEndPx = Math.min(containerRect.width, windowWidth - containerRect.left);
    const visibleWidthPx = visibleEndPx - visibleStartPx;

    // Add buffer for smooth scrolling
    const bufferPx = 500;
    const renderStartPx = Math.max(0, visibleStartPx - bufferPx);
    const renderWidthPx = Math.min(
        containerRect.width - renderStartPx,
        visibleWidthPx + bufferPx * 2
    );

    // Update Canvas Position
    canvasLeft.value = renderStartPx;
    canvasWidth.value = renderWidthPx;

    // Resize Canvas
    const ctx = canvas.value.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.value.width !== renderWidthPx * dpr || canvas.value.height !== containerRect.height * dpr) {
        canvas.value.width = renderWidthPx * dpr;
        canvas.value.height = containerRect.height * dpr;
    }
    
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, renderWidthPx, containerRect.height);

    // 3. Draw Waveform
    ctx.fillStyle = '#10b981'; // Emerald-500
    ctx.beginPath();
    
    const height = containerRect.height;
    const centerY = height / 2;
    const scaleY = height / 2;
    
    // Map pixels to peaks
    // Clip Duration (s) -> Container Width (px) -> Peaks (index)
    // Pixels Per Second = containerRect.width / props.clip.duration
    const pixelsPerSecond = containerRect.width / props.clip.duration;
    
    // We want to draw `renderWidthPx` pixels starting at `renderStartPx`
    // Start Time = renderStartPx / pixelsPerSecond
    // const startTime = renderStartPx / pixelsPerSecond; // unused
    // const endTime = (renderStartPx + renderWidthPx) / pixelsPerSecond; // unused

    // Loop through pixels (optimization: one line per pixel column)
    for (let x = 0; x < renderWidthPx; x++) {
        // Pixel global position
        const globalX = renderStartPx + x;
        const time = globalX / pixelsPerSecond;
        
        // Find corresponding peak
        const peakIndex = Math.floor(time * PEAKS_PER_SECOND);
        
        if (peakIndex < peaks.value.length) {
            const val = peaks.value[peakIndex] ?? 0;
            if (val > 0.01) {
                 const magnitude = val * scaleY;
                 ctx.fillRect(x, centerY - magnitude, 1, magnitude * 2);
            }
        }
    }
};

const loop = () => {
    render();
    animationFrame = requestAnimationFrame(loop);
};

const handleChunk = (payload: any) => {
    if (payload.assetId !== props.clip.assetId || !peaks.value) return;

    const { start, data } = payload;
    // Map chunk time range to peaks index range
    const startIndex = Math.floor(start * PEAKS_PER_SECOND);
    
    // Copy data
    const len = Math.min(data.length, peaks.value.length - startIndex);
    for (let i = 0; i < len; i++) {
        peaks.value[startIndex + i] = data[i];
    }
};

onMounted(() => {
    if (!asset) return;

    // Alloc Buffer
    const duration = asset.duration || props.clip.duration || 10;
    const totalSamples = Math.ceil(duration * PEAKS_PER_SECOND);
    peaks.value = new Float32Array(totalSamples);

    // Listen
    globalEventBus.on('WAVEFORM_CHUNK_GENERATED', handleChunk);

    // Request Generation
    waveformGenerator.requestWaveform(asset.url, asset.id, totalSamples);

    loop();
});

onBeforeUnmount(() => {
    cancelAnimationFrame(animationFrame);
    globalEventBus.off('WAVEFORM_CHUNK_GENERATED', handleChunk);
});

watch(() => props.clip.assetId, () => {
    peaks.value = null;
    // Logic to re-request would go here
});
</script>

<template>
  <div ref="container" class="absolute inset-0 w-full h-full overflow-hidden pointer-events-none opacity-80">
    <canvas 
        ref="canvas" 
        class="absolute top-0 h-full"
        :style="{ left: `${canvasLeft}px`, width: `${canvasWidth}px` }"
    ></canvas>
  </div>
</template>