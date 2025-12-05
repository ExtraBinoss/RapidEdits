<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import type { Asset } from '../../types/Media';
import { thumbnailGenerator } from '../../core/ThumbnailGenerator';

const props = defineProps<{
  asset: Asset;
}>();

const thumbnails = ref<string[]>([]);
const activeIndex = ref(0);
const isHovering = ref(false);
const isLoading = ref(false);
const hasGenerated = ref(false);

// Generate 10 thumbnails on first hover or mount?
// User said "shows a single frame, but when hovering it it shows like 10 frames"
// Better to generate the single frame (index 0 or 0.1s) immediately for the cover.
// Then generate the rest on idle or first hover.
// For performance, let's generate the cover immediately, and the rest on hover.

const generateCover = async () => {
    if (thumbnails.value.length > 0) return;
    try {
        // Generate frame at 0.5s or 0%
        const url = await thumbnailGenerator.generate(props.asset.url, 0.5, 320, 180);
        thumbnails.value[0] = url;
    } catch (e) {
        console.error("Cover gen failed", e);
    }
};

const generatePreviews = async () => {
    if (hasGenerated.value || isLoading.value) return;
    isLoading.value = true;
    
    const count = 10;
    const duration = props.asset.duration || 1; // avoid 0 division
    const step = duration / count;

    try {
        const promises = [];
        for (let i = 0; i < count; i++) {
            const time = Math.min(i * step, duration);
            // We skip 0 (cover) if we want, but let's just regenerate/overwrite for consistency
            promises.push(
                thumbnailGenerator.generate(props.asset.url, time, 320, 180).then(url => {
                    thumbnails.value[i] = url;
                })
            );
        }
        // Wait for all? or just let them fill in.
        // Let's wait to mark hasGenerated
        await Promise.all(promises);
        hasGenerated.value = true;
    } catch (e) {
        console.error("Preview gen failed", e);
    } finally {
        isLoading.value = false;
    }
};

const onMouseMove = (e: MouseEvent) => {
    if (!hasGenerated.value) {
        generatePreviews();
    }
    isHovering.value = true;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const count = thumbnails.value.length || 1;
    activeIndex.value = Math.floor(percent * count);
};

const onMouseLeave = () => {
    isHovering.value = false;
    activeIndex.value = 0;
};

onMounted(() => {
    if (props.asset.type === 'video') {
        generateCover();
    }
});

watch(() => props.asset, () => {
    thumbnails.value = [];
    hasGenerated.value = false;
    generateCover();
});
</script>

<template>
    <div 
        class="w-full h-full relative overflow-hidden bg-black"
        @mousemove="onMouseMove"
        @mouseleave="onMouseLeave"
        @mouseenter="generatePreviews"
    >
        <img 
            v-if="thumbnails[activeIndex] || thumbnails[0]"
            :src="thumbnails[activeIndex] || thumbnails[0]" 
            class="w-full h-full object-cover pointer-events-none"
        />
        <div v-else class="w-full h-full flex items-center justify-center text-white/20 text-xs">
            Loading...
        </div>

        <!-- Progress Bar for Scrubbing -->
        <div v-if="isHovering && hasGenerated" class="absolute bottom-0 left-0 h-1 bg-brand-primary transition-all"
            :style="{ width: `${((activeIndex + 1) / 10) * 100}%` }"
        ></div>
    </div>
</template>
