<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import type { Asset } from '../../types/Media';
import { thumbnailGenerator } from '../../core/ThumbnailGenerator';

const props = defineProps<{
  asset: Asset;
}>();

const coverUrl = ref<string | null>(null);
const previewUrls = ref<string[]>([]);
const activeIndex = ref(0);
const isHovering = ref(false);
const isLoadingPreviews = ref(false);
const hasGeneratedPreviews = ref(false);

const generateCover = async () => {
    if (coverUrl.value) return; // Already generated
    try {
        const url = await thumbnailGenerator.generate(props.asset.url, 0.5, 320, 180);
        coverUrl.value = url;
    } catch (e) {
        console.error("Cover generation failed", e);
        coverUrl.value = null; // Ensure explicit null on failure
    }
};

const generatePreviews = async () => {
    if (hasGeneratedPreviews.value || isLoadingPreviews.value) return;
    isLoadingPreviews.value = true;
    
    const count = 10;
    const duration = props.asset.duration || 1; // avoid 0 division
    const step = duration / count;

    try {
        const promises = [];
        const tempPreviews: string[] = new Array(count).fill('');
        for (let i = 0; i < count; i++) {
            const time = Math.min(i * step, duration);
            promises.push(
                thumbnailGenerator.generate(props.asset.url, time, 320, 180).then(url => {
                    tempPreviews[i] = url;
                })
            );
        }
        await Promise.all(promises);
        previewUrls.value = tempPreviews; // Assign all at once
        hasGeneratedPreviews.value = true;
    } catch (e) {
        console.error("Preview generation failed", e);
        previewUrls.value = []; // Clear on failure
    } finally {
        isLoadingPreviews.value = false;
    }
};

const onMouseMove = (e: MouseEvent) => {
    isHovering.value = true;
    if (!hasGeneratedPreviews.value && !isLoadingPreviews.value) {
        generatePreviews();
    }
    
    if (hasGeneratedPreviews.value && previewUrls.value.length > 0) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        activeIndex.value = Math.floor(percent * previewUrls.value.length);
    }
};

const onMouseLeave = () => {
    isHovering.value = false;
    activeIndex.value = 0; // Reset to cover (implicitly handled by template)
};

onMounted(() => {
    if (props.asset.type === 'video') {
        generateCover();
    }
});

watch(() => props.asset, () => {
    coverUrl.value = null;
    previewUrls.value = [];
    hasGeneratedPreviews.value = false;
    activeIndex.value = 0;
    if (props.asset.type === 'video') {
        generateCover();
    }
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
            v-if="isHovering && hasGeneratedPreviews && previewUrls.length > 0 && previewUrls[activeIndex]"
            :src="previewUrls[activeIndex]" 
            class="w-full h-full object-cover pointer-events-none transition-opacity duration-100"
        />
        <img 
            v-else-if="coverUrl"
            :src="coverUrl" 
            class="w-full h-full object-cover pointer-events-none"
        />
        <div v-else class="w-full h-full flex items-center justify-center text-white/20 text-xs">
            Loading...
        </div>

        <!-- Progress Bar for Scrubbing -->
        <div v-if="isHovering && hasGeneratedPreviews" class="absolute bottom-0 left-0 h-1 bg-brand-primary transition-all"
            :style="{ width: `${((activeIndex + 1) / previewUrls.length) * 100}%` }"
        ></div>
    </div>
</template>
