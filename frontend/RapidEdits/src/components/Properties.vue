<script setup lang="ts">
import { Sliders } from "lucide-vue-next";
import { useProjectStore } from "../stores/projectStore";
import { storeToRefs } from "pinia";
import { computed } from "vue";
import { pluginRegistry } from "../core/plugins/PluginRegistry";
import PluginPropertiesRenderer from "./Plugins/PluginPropertiesRenderer.vue";

const store = useProjectStore();
const { selectedClipIds, tracks } = storeToRefs(store);

const selectedClip = computed(() => {
    if (selectedClipIds.value.length !== 1) return null;
    const id = selectedClipIds.value[0];
    for (const track of tracks.value) {
        const clip = track.clips.find((c) => c.id === id);
        if (clip) return clip;
    }
    return null;
});

const plugin = computed(() => {
    if (!selectedClip.value) return null;
    return pluginRegistry.get(selectedClip.value.type);
});
</script>

<template>
    <div
        class="w-72 bg-canvas-light border-l border-canvas-border flex flex-col shrink-0 z-10 overflow-y-auto"
    >
        <div class="p-4 border-b border-canvas-border">
            <h3
                class="text-sm font-semibold text-text-main flex items-center gap-2"
            >
                <Sliders :size="16" class="text-brand-primary" />
                Properties
            </h3>
        </div>

        <div v-if="selectedClip" class="p-4 space-y-4">
            <div class="text-xs text-gray-500 font-mono mb-2">
                {{ selectedClip.name }}
            </div>

            <!-- Plugin Specific Properties -->
            <!-- Plugin Specific Properties -->
            <PluginPropertiesRenderer
                v-if="plugin && plugin.properties"
                :clip="selectedClip"
                :properties="plugin.properties"
            />

            <component
                v-else-if="plugin && plugin.propertiesComponent"
                :is="plugin.propertiesComponent"
                :clip="selectedClip"
            />

            <!-- Fallback / Default Properties (for video/images) -->
            <div v-else class="text-sm text-gray-400">
                No specific properties for this clip type.
            </div>
        </div>

        <div v-else class="p-4 text-xs text-text-muted text-center mt-auto">
            Select a clip to edit properties
        </div>
    </div>
</template>
