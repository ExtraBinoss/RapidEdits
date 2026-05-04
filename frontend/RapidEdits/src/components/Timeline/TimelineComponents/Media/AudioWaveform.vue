<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import { waveformGenerator } from "../../../../core/generators/WaveformGenerator";
import { globalEventBus } from "../../../../core/events/EventBus";
import type { Clip } from "../../../../types/Timeline";
import { editorEngine } from "../../../../core/EditorEngine";
import { EditorEventType } from "../../../../types/Media";

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
    const visibleEndPx = Math.min(
        containerRect.width,
        windowWidth - containerRect.left,
    );
    const visibleWidthPx = visibleEndPx - visibleStartPx;

    // Add buffer for smooth scrolling
    const bufferPx = 500;
    const renderStartPx = Math.max(0, visibleStartPx - bufferPx);
    const renderWidthPx = Math.min(
        containerRect.width - renderStartPx,
        visibleWidthPx + bufferPx * 2,
    );

    // Update Canvas Position
    canvasLeft.value = renderStartPx;
    canvasWidth.value = renderWidthPx;

    // Resize Canvas
    const ctx = canvas.value.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    if (
        canvas.value.width !== renderWidthPx * dpr ||
        canvas.value.height !== containerRect.height * dpr
    ) {
        canvas.value.width = renderWidthPx * dpr;
        canvas.value.height = containerRect.height * dpr;
    }

    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, renderWidthPx, containerRect.height);

    // 3. Draw Waveform
    ctx.fillStyle = "#10b981"; // Emerald-500
    ctx.beginPath();

    const height = containerRect.height;
    const centerY = height / 2;
    const scaleY = height / 2;

    const volume = props.clip.data?.volume ?? 1.0;
    const isNormalized = props.clip.data?.normalization ?? false;
    
    let normalizationScale = 1.0;
    if (isNormalized && peaks.value) {
        let maxPeak = 0;
        // Sample some peaks to find max (for performance, don't check every single one if buffer is huge)
        const step = Math.max(1, Math.floor(peaks.value.length / 1000));
        for (let i = 0; i < peaks.value.length; i += step) {
            if (peaks.value[i] > maxPeak) maxPeak = peaks.value[i];
        }
        if (maxPeak > 0) normalizationScale = 1.0 / maxPeak;
    }

    const totalScale = volume * normalizationScale;

    // Map pixels to peaks
    const pixelsPerSecond = containerRect.width / props.clip.duration;

    // Loop through pixels
    for (let x = 0; x < renderWidthPx; x++) {
        const globalX = renderStartPx + x;
        const time = globalX / pixelsPerSecond;
        const peakIndex = Math.floor(time * PEAKS_PER_SECOND);

        if (peakIndex < peaks.value.length) {
            let val = peaks.value[peakIndex] ?? 0;
            val *= totalScale;
            
            if (val > 0.01) {
                const magnitude = Math.min(1.0, val) * scaleY;
                ctx.fillRect(x, centerY - magnitude, 1, magnitude * 2);
            }
        }
    }
};

const loop = () => {
    render();
    animationFrame = requestAnimationFrame(loop);
};

const error = ref<string | null>(null);

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

const handleEnd = (payload: any) => {
    if (payload.assetId === props.clip.assetId && payload.error) {
        error.value = payload.error;
    }
};

onMounted(() => {
    if (!asset) return;

    // Alloc Buffer
    const duration = asset.duration || props.clip.duration || 10;
    const totalSamples = Math.ceil(duration * PEAKS_PER_SECOND);
    peaks.value = new Float32Array(totalSamples);

    // Listen
    globalEventBus.on(EditorEventType.WAVEFORM_CHUNK_GENERATED, handleChunk);
    globalEventBus.on(EditorEventType.WAVEFORM_GENERATION_END, handleEnd);

    // Request Generation
    waveformGenerator.requestWaveform(asset.url, asset.id, totalSamples);

    loop();
});

onBeforeUnmount(() => {
    cancelAnimationFrame(animationFrame);
    globalEventBus.off(EditorEventType.WAVEFORM_CHUNK_GENERATED, handleChunk);
    globalEventBus.off(EditorEventType.WAVEFORM_GENERATION_END, handleEnd);
});

watch(
    () => props.clip.assetId,
    () => {
        peaks.value = null;
        error.value = null;
        // Logic to re-request would go here
    },
);
</script>

<template>
    <div
        ref="container"
        class="absolute inset-0 w-full h-full overflow-hidden pointer-events-none opacity-80"
    >
        <div v-if="error" class="absolute inset-0 flex items-center justify-center bg-red-500/5">
            <span class="text-[9px] font-bold text-red-500/60 uppercase tracking-wider">
                No Audio Data Found
            </span>
        </div>
        <canvas
            v-else
            ref="canvas"
            class="absolute top-0 h-full"
            :style="{ left: `${canvasLeft}px`, width: `${canvasWidth}px` }"
        ></canvas>
    </div>
</template>
