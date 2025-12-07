<script setup lang="ts">
import { Sliders } from "lucide-vue-next";
import { useProjectStore } from "../stores/projectStore";
import { storeToRefs } from "pinia";
import { computed } from "vue";
import { pluginRegistry } from "../core/plugins/PluginRegistry";
import PluginPropertiesRenderer from "./Plugins/PluginPropertiesRenderer.vue";
import Switch from "./UI/Switch/Switch.vue";
import Slider from "./UI/Slider/Slider.vue";
import Select from "./UI/Input/Select.vue";

const store = useProjectStore();
const { selectedClipIds, tracks } = storeToRefs(store);

const easingOptions = computed(() => {
    const fadePlugin = pluginRegistry.get("transitions.fade");
    if (fadePlugin && fadePlugin.properties) {
        const easingProp = fadePlugin.properties.find(p => p.key === "easing");
        if (easingProp && easingProp.type === "select" && easingProp.options) {
            return easingProp.options;
        }
    }
    // Fallback if plugin/prop not found
    return [
        { label: "Linear", value: "linear" },
        { label: "Ease In", value: "easeIn" },
        { label: "Ease Out", value: "easeOut" },
        { label: "Ease In Out", value: "easeInOut" },
    ];
});

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

const updateClipData = (newData: any) => {
    if (selectedClip.value) {
        store.updateClip(selectedClip.value.id, { data: newData });
    }
};

const toggleTransition = (type: "fadeIn" | "fadeOut", enabled: boolean) => {
    const currentData = selectedClip.value?.data || {};
    const transitions = currentData.transitions || {};

    if (enabled) {
        // Add default
        const newTransitions = {
            ...transitions,
            [type]: { duration: 1.0, easing: "linear" },
        };
        updateClipData({ ...currentData, transitions: newTransitions });
    } else {
        // Remove
        const newTransitions = { ...transitions };
        delete newTransitions[type];
        updateClipData({ ...currentData, transitions: newTransitions });
    }
};

const updateTransition = (
    type: "fadeIn" | "fadeOut",
    key: "duration" | "easing",
    value: any,
) => {
    const currentData = selectedClip.value?.data || {};
    const transitions = currentData.transitions || {};
    const transition = transitions[type];

    if (transition) {
        const newTransitions = {
            ...transitions,
            [type]: { ...transition, [key]: value },
        };
        updateClipData({ ...currentData, transitions: newTransitions });
    }
};
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
                <!-- No specific plugin properties -->
            </div>

            <!-- Attached Transitions Section -->
            <div class="border-t border-canvas-border pt-4 mt-4">
                <h4
                    class="text-xs font-semibold text-text-main mb-3 uppercase tracking-wider"
                >
                    Transitions
                </h4>

                <!-- Fade In -->
                <div class="mb-4">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-xs text-text-muted">Fade In</span>
                        <Switch
                            :model-value="
                                !!selectedClip.data?.transitions?.fadeIn
                            "
                            @update:model-value="
                                (val) => toggleTransition('fadeIn', val)
                            "
                        />
                    </div>
                    <div
                        v-if="selectedClip.data?.transitions?.fadeIn"
                        class="space-y-2 pl-2 border-l-2 border-canvas-border"
                    >
                        <!-- Duration -->
                        <div>
                            <label
                                class="block text-[10px] text-text-muted mb-1"
                                >Duration (s)</label
                            >
                            <Slider
                                :model-value="
                                    selectedClip.data.transitions.fadeIn
                                        .duration
                                "
                                :min="0.1"
                                :max="5.0"
                                :step="0.1"
                                @update:model-value="
                                    (val) =>
                                        updateTransition(
                                            'fadeIn',
                                            'duration',
                                            val,
                                        )
                                "
                            />
                        </div>
                        <!-- Easing -->
                        <div>
                            <label
                                class="block text-[10px] text-text-muted mb-1"
                                >Easing</label
                         <div class="z-20 relative">
                            <label class="block text-[10px] text-text-muted mb-1">Easing</label>
                            <Select
                                :model-value="selectedClip.data.transitions.fadeIn.easing"
                                :options="easingOptions"
                                @update:model-value="(val) => updateTransition('fadeIn', 'easing', val)"
                            />
                         </div>
                    </div>
                </div>

                <!-- Fade Out -->
                <div class="mb-4">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-xs text-text-muted">Fade Out</span>
                        <Switch
                            :model-value="
                                !!selectedClip.data?.transitions?.fadeOut
                            "
                            @update:model-value="
                                (val) => toggleTransition('fadeOut', val)
                            "
                        />
                    </div>
                    <div
                        v-if="selectedClip.data?.transitions?.fadeOut"
                        class="space-y-2 pl-2 border-l-2 border-canvas-border"
                    >
                        <!-- Duration -->
                        <div>
                            <label
                                class="block text-[10px] text-text-muted mb-1"
                                >Duration (s)</label
                            >
                            <Slider
                                :model-value="
                                    selectedClip.data.transitions.fadeOut
                                        .duration
                                "
                                :min="0.1"
                                :max="5.0"
                                :step="0.1"
                                @update:model-value="
                                    (val) =>
                                        updateTransition(
                                            'fadeOut',
                                            'duration',
                                            val,
                                        )
                                "
                            />
                        </div>
                        <!-- Easing -->
                        <div>
                            <label
                                class="block text-[10px] text-text-muted mb-1"
                                >Easing</label
                            >
                            <select
                                :value="
                                    selectedClip.data.transitions.fadeOut.easing
                                "
                                class="w-full bg-canvas-dark border border-canvas-border rounded text-xs px-2 py-1 text-text-main"
                                @change="
                                    (e) =>
                                        updateTransition(
                                            'fadeOut',
                                            'easing',
                                            (e.target as HTMLSelectElement)
                                                .value,
                                        )
                                "
                            >
                                <option value="linear">Linear</option>
                                <option value="easeIn">Ease In</option>
                                <option value="easeOut">Ease Out</option>
                                <option value="easeInOut">Ease In Out</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div v-else class="p-4 text-xs text-text-muted text-center mt-auto">
            Select a clip to edit properties
        </div>
    </div>
</template>
