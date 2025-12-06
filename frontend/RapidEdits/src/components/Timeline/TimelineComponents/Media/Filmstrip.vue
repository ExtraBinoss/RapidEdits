<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useFilmstrip } from "../../hooks/useFilmstrip";
import { usePluginFilmstrip } from "../../hooks/usePluginFilmstrip";
import type { Clip } from "../../../../types/Timeline";
import { editorEngine } from "../../../../core/EditorEngine";
import { pluginRegistry } from "../../../../core/plugins/PluginRegistry";

const props = defineProps<{
    clip: Clip;
}>();

const container = ref<HTMLElement | null>(null);
const width = ref(0);
const asset = editorEngine.getAsset(props.clip.assetId);

// Check if this is a plugin clip
const isPlugin = computed(() => {
    return pluginRegistry.get(props.clip.type) !== undefined;
});

// Only run filmstrip logic if NOT a plugin and has valid asset
const shouldLoadFilmstrip = computed(() => !isPlugin.value && asset?.url && asset.type === 'video');

const { thumbnails: videoThumbnails } = useFilmstrip(
    shouldLoadFilmstrip.value ? (asset?.url || "") : "",
    asset?.type || "video",
    props.clip.offset,
    props.clip.duration,
    width,
);

const { thumbnails: pluginThumbnails } = usePluginFilmstrip(
    props.clip,
    width
);

const displayThumbnails = computed(() => isPlugin.value ? pluginThumbnails.value : videoThumbnails.value);

// Update width on mount and resize
onMounted(() => {
    if (container.value) {
        const rect = container.value.getBoundingClientRect();
        width.value = rect.width;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                width.value = entry.contentRect.width;
            }
        });
        observer.observe(container.value);
    }
});
</script>

<template>
    <div
        ref="container"
        class="absolute inset-0 w-full h-full overflow-hidden pointer-events-none flex flex-row bg-black"
    >
        <div
            v-for="thumb in displayThumbnails"
            :key="thumb.id"
            class="h-full shrink-0 border-r border-white/10 bg-black relative overflow-hidden"
            :style="{ width: `${96 * 1.77}px` }"
        >
            <img
                v-if="thumb.url"
                :src="thumb.url"
                class="w-full h-full object-cover transition-opacity duration-500 ease-in-out"
                :class="thumb.loaded ? 'opacity-80' : 'opacity-0'"
                loading="lazy"
            />
        </div>
    </div>
</template>
