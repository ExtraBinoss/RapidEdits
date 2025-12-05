<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { waveformGenerator } from '../../core/WaveformGenerator';
import type { Clip } from '../../types/Timeline';
import { editorEngine } from '../../core/EditorEngine';

const props = defineProps<{
  clip: Clip;
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
const container = ref<HTMLElement | null>(null);
const asset = editorEngine.getAsset(props.clip.assetId);

const draw = async () => {
    if (!canvas.value || !container.value || !asset) return;
    
    const width = container.value.clientWidth;
    const height = container.value.clientHeight;
    
    // Match resolution
    canvas.value.width = width;
    canvas.value.height = height;
    
    const ctx = canvas.value.getContext('2d');
    if (!ctx) return;

    // Generate waveform data with 1 sample per pixel for "REAL" look
    const samples = width; 
    const data = await waveformGenerator.getWaveform(asset.url, samples);
    
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#10b981'; // Emerald-500 to match audio track color
    ctx.beginPath();
    
    const centerY = height / 2;
    const scaleY = height / 2;

    for (let i = 0; i < data.length; i++) {
        const x = i;
        const magnitude = (data[i] || 0) * scaleY;
        // Draw symmetrical bar
        ctx.fillRect(x, centerY - magnitude, 1, magnitude * 2);
    }
};

onMounted(() => {
    draw();
    
    // Re-draw on resize
    const observer = new ResizeObserver(() => {
        draw();
    });
    if (container.value) observer.observe(container.value);
});

watch(() => props.clip.duration, draw);
</script>

<template>
  <div ref="container" class="absolute inset-0 w-full h-full overflow-hidden pointer-events-none opacity-80">
    <canvas ref="canvas"></canvas>
  </div>
</template>
