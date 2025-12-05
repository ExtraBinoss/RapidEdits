<script setup lang="ts">
import { ref, watch, onMounted } from "vue";

const props = defineProps<{
    duration: number; // Total duration in seconds to draw
    zoom: number; // Pixels per second
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);

const drawRuler = () => {
    const canvas = canvasRef.value;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // We rely on the parent container width or the calculated width based on duration * zoom
    // Actually, for a scrolling timeline: width = duration * zoom
    const logicalWidth = props.duration * props.zoom;
    const logicalHeight = 32; // Fixed height as per CSS

    // Get device pixel ratio for sharp text on Retina displays
    const dpr = window.devicePixelRatio || 1;

    // Set internal resolution (physical pixels)
    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;

    // Set display size (CSS pixels)
    canvas.style.width = `${logicalWidth}px`;
    canvas.style.height = `${logicalHeight}px`;

    // Scale context to match logical coordinate system
    ctx.scale(dpr, dpr);

    // Clear using logical coordinates
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    // Styling
    ctx.fillStyle = "#e2e8f0"; // text-main
    ctx.font = "10px sans-serif"; // Slightly smaller standard font
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom"; // Align to bottom for easier placement relative to ticks

    const pixelsPerSecond = props.zoom;

    // Determine tick interval
    // Increase minimum spacing to accommodate larger text
    let tickInterval = 1;
    const minTickSpacing = 60; // 60px minimum between major ticks

    // Dynamic interval logic
    if (pixelsPerSecond * 1 < minTickSpacing) tickInterval = 5;
    if (pixelsPerSecond * 5 < minTickSpacing) tickInterval = 10;
    if (pixelsPerSecond * 10 < minTickSpacing) tickInterval = 30;
    if (pixelsPerSecond * 30 < minTickSpacing) tickInterval = 60;
    if (pixelsPerSecond * 60 < minTickSpacing) tickInterval = 300; // 5 mins

    // High zoom check
    if (pixelsPerSecond * 0.5 >= minTickSpacing) tickInterval = 0.5;
    if (pixelsPerSecond * 0.1 >= minTickSpacing) tickInterval = 0.1;

    const totalTicks = Math.ceil(props.duration / tickInterval);

    for (let i = 0; i <= totalTicks; i++) {
        const time = i * tickInterval;
        const x = time * pixelsPerSecond;

        if (x > logicalWidth) break;

        // Draw tick
        ctx.beginPath();
        // Major tick
        ctx.moveTo(x, logicalHeight);
        ctx.lineTo(x, logicalHeight - 10);
        ctx.strokeStyle = "#2a3445"; // border color
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw label
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        const ms = Math.floor((time % 1) * 10);

        let label = `${minutes}:${seconds.toString().padStart(2, "0")}`;
        if (tickInterval < 1) {
            label += `.${ms}`;
        }

        // Draw text slightly offset from tick
        // x + 4 for padding
        // y is logicalHeight - 2 (bottom aligned with small gap)
        ctx.fillText(label, x + 4, logicalHeight - 2);
    }
};

watch(
    () => [props.duration, props.zoom],
    () => {
        // Request animation frame to avoid hammering if zoom changes fast
        requestAnimationFrame(drawRuler);
    },
);

onMounted(() => {
    drawRuler();
    // Re-draw on resize in case dpr changes (e.g. moving windows between screens)
    window.addEventListener("resize", drawRuler);
});
</script>

<template>
    <div class="w-full h-full relative overflow-hidden bg-canvas-light">
        <!-- Height 32 to match h-8 container -->
        <canvas ref="canvasRef" class="block"></canvas>
    </div>
</template>
