```
<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, computed } from "vue";
import { waveformGenerator } from "../../core/WaveformGenerator";
import type { Clip } from "../../types/Timeline";
import { editorEngine } from "../../core/EditorEngine";
import { globalEventBus } from "../../core/EventBus";

const props = defineProps<{
    clip: Clip;
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
const container = ref<HTMLElement | null>(null);
const asset = editorEngine.getAsset(props.clip.assetId);
const isProcessing = ref(false);

// Track visible window
const canvasLeft = ref(0);
const canvasWidth = ref(0);

// We need to know pixelsPerSecond to calculate time ranges
// Since we don't have it explicitly as a prop, we can derive it?
// Or we can just calculate based on container width vs clip duration.
// If the parent is the "clip" element, then container.width = clip.duration * zoom
// So zoom = container.width / clip.duration
const zoom = computed(() => {
    if (!container.value || props.clip.duration === 0) return 10; // default
    // This is valid if the container is the full clip width
    return container.value.clientWidth / props.clip.duration;
});

let animationFrame: number;

const visibleWindow = ref({ start: 0, end: 0, width: 0 });
// Cache for the last used parameters to prevent duplicate requests
const lastFetchParams = ref({ start: 0, end: 0, samples: 0 });
const waveformData = ref<Float32Array | number[]>([]);
const isFetching = ref(false);

const render = (timestamp: number = 0) => {
    if (!canvas.value || !container.value) return;
    const ctx = canvas.value.getContext("2d");
    if (!ctx) return;

    const { width: renderWidthPx } = visibleWindow.value;
    const dpr = window.devicePixelRatio || 1;

    // Ensure canvas size matches
    if (canvas.value.width !== renderWidthPx * dpr) {
        canvas.value.width = renderWidthPx * dpr;
        canvas.value.height = container.value.clientHeight * dpr;
    }

    // Clear
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, renderWidthPx, container.value.clientHeight);

    // Draw Skeleton if fetching/processing
    if (isProcessing.value || isFetching.value) {
        // Animated Green Gradient Shimmer
        const offset = (timestamp * 0.5) % (renderWidthPx * 2);
        const gradient = ctx.createLinearGradient(
            offset - renderWidthPx,
            0,
            offset,
            0,
        );
        gradient.addColorStop(0, "rgba(16, 185, 129, 0.1)");
        gradient.addColorStop(0.5, "rgba(16, 185, 129, 0.5)");
        gradient.addColorStop(1, "rgba(16, 185, 129, 0.1)");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, renderWidthPx, container.value.clientHeight);
    }

    // Always draw existing data if available (even while fetching new data for smoother UX)
    if (waveformData.value.length > 0) {
        ctx.fillStyle = "#10b981";
        const height = container.value.clientHeight;
        const centerY = height / 2;
        const scaleY = height / 2;
        const samples = waveformData.value.length;

        ctx.beginPath();
        for (let i = 0; i < samples; i++) {
            const x = i * (renderWidthPx / samples);
            const magnitude = (waveformData.value[i] || 0) * scaleY;
            ctx.fillRect(x, centerY - magnitude, 1, magnitude * 2);
        }
    }
};

const fetchWaveformData = async (
    start: number,
    end: number,
    samples: number,
) => {
    if (isFetching.value || !asset) return;

    // Check if params changed significantly (epsilon check could be added here)
    if (
        start === lastFetchParams.value.start &&
        end === lastFetchParams.value.end &&
        samples === lastFetchParams.value.samples
    ) {
        return;
    }

    isFetching.value = true;
    try {
        const data = await waveformGenerator.getWaveformSubset(
            asset.url,
            start,
            end,
            samples,
            asset.id,
        );
        waveformData.value = data as Float32Array | number[];

        // Update cache
        lastFetchParams.value = { start, end, samples };
    } catch (error) {
        console.error("Failed to fetch waveform subset", error);
    } finally {
        isFetching.value = false;
    }
};

const updateLayout = () => {
    if (!container.value || !asset) return;

    const containerRect = container.value.getBoundingClientRect();
    const windowWidth = window.innerWidth;

    // Check visibility
    if (containerRect.right < 0 || containerRect.left > windowWidth) {
        return;
    }

    const visibleStartPx = Math.max(0, -containerRect.left);
    const visibleEndPx = Math.min(
        containerRect.width,
        windowWidth - containerRect.left,
    );
    const visibleWidthPx = visibleEndPx - visibleStartPx;

    const bufferPx = 200;
    const renderStartPx = Math.max(0, visibleStartPx - bufferPx);
    const renderWidthPx = Math.min(
        containerRect.width - renderStartPx,
        visibleWidthPx + bufferPx * 2,
    );

    // Update Virtualization State
    canvasLeft.value = renderStartPx;
    canvasWidth.value = renderWidthPx;
    visibleWindow.value = {
        start: renderStartPx,
        end: renderStartPx + renderWidthPx,
        width: renderWidthPx,
    };

    // Calculate time range for fetching
    const pixelsPerSecond = zoom.value;
    const startTime = renderStartPx / pixelsPerSecond;
    const endTime = (renderStartPx + renderWidthPx) / pixelsPerSecond;
    const samples = Math.floor(renderWidthPx);

    // Trigger fetch (it handles its own throttling via isFetching)
    fetchWaveformData(startTime, endTime, samples);
};

const loop = (timestamp: number) => {
    // Only update layout/fetch if needed?
    // Actually, for smooth scrolling, we need to check layout on loop
    // BUT we shouldn't spam the worker. fetchWaveformData handles that.
    updateLayout();
    render(timestamp);
    animationFrame = requestAnimationFrame(loop);
};

const handleWindowEvents = () => {
    // We can rely on loop, or trigger an immediate update.
    // relying on loop is safer for performace.
};

// Event Handlers
const onWaveformStart = (payload: any) => {
    if (payload.assetId === asset?.id) {
        isProcessing.value = true;
    }
};

const onWaveformEnd = (payload: any) => {
    if (payload.assetId === asset?.id) {
        isProcessing.value = false;
        // Trigger a re-draw immediately
        // updateWaveform(); -> render is inside loop
    }
};

onMounted(() => {
    loop(performance.now());
    // Also trigger on generic events just in case
    window.addEventListener("resize", handleWindowEvents);
    window.addEventListener("scroll", handleWindowEvents, true);

    globalEventBus.on("WAVEFORM_GENERATION_START", onWaveformStart);
    globalEventBus.on("WAVEFORM_GENERATION_END", onWaveformEnd);
});

onUnmounted(() => {
    cancelAnimationFrame(animationFrame);
    window.removeEventListener("resize", handleWindowEvents);
    window.removeEventListener("scroll", handleWindowEvents, true);

    globalEventBus.off("WAVEFORM_GENERATION_START", onWaveformStart);
    globalEventBus.off("WAVEFORM_GENERATION_END", onWaveformEnd);
});

watch(() => props.clip.duration, updateLayout);
</script>

<template>
    <div
        ref="container"
        class="absolute inset-0 w-full h-full overflow-hidden pointer-events-none opacity-80"
    >
        <!-- Add an animated overlay if desired, but canvas drawing handles it -->
        <canvas
            ref="canvas"
            class="absolute top-0 h-full"
            :style="{ left: `${canvasLeft}px`, width: `${canvasWidth}px` }"
        ></canvas>
    </div>
</template>
```
