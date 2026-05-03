<script setup lang="ts">
import { Sliders } from "lucide-vue-next";
import { useProjectStore } from "../stores/projectStore";
import { computed, ref, onUnmounted } from "vue";
import { pluginRegistry } from "../core/plugins/PluginRegistry";
import { createPluginId, PluginCategory } from "../core/plugins/PluginTypes";
import type { PluginId } from "../core/plugins/PluginTypes";
import PluginPropertiesRenderer from "./Plugins/PluginPropertiesRenderer.vue";
import Switch from "./UI/Switch/Switch.vue";
import Slider from "./UI/Slider/Slider.vue";
import Select from "./UI/Input/Select.vue";

const store = useProjectStore();

// --- Configuration ---
const DEFAULT_PANEL_WIDTH = 340;
const MIN_PANEL_WIDTH = 240;
const MAX_PANEL_WIDTH = 600;

// Resizer logic
const panelWidth = ref(DEFAULT_PANEL_WIDTH);
const isDragging = ref(false);

const startDrag = (_e: MouseEvent) => {
    isDragging.value = true;
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
};

const onDrag = (e: MouseEvent) => {
    if (!isDragging.value) return;
    // The panel is on the right, so the new width is window width minus the mouse X coordinate
    const newWidth = window.innerWidth - e.clientX;
    panelWidth.value = Math.max(MIN_PANEL_WIDTH, Math.min(newWidth, MAX_PANEL_WIDTH));
};

const stopDrag = () => {
    isDragging.value = false;
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
};

onUnmounted(() => {
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
});

// Typed reference to the fade transition plugin
const FADE_TRANSITION_ID = createPluginId(PluginCategory.Transitions, "fade") as PluginId;

const easingOptions = computed(() => {
    const fadePlugin = pluginRegistry.get(FADE_TRANSITION_ID);
    if (fadePlugin) {
        // Find the active transition data if any, or just pass empty
        const properties = fadePlugin.getProperties?.(selectedClip.value?.data);
        if (properties) {
            const easingProp = properties.find(p => p.key === "easing");
            if (easingProp && easingProp.type === "select" && easingProp.options) {
                return easingProp.options;
            }
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
    if (store.selectedClipIds.length === 0) return null;

    const selectedClips = [];
    for (const id of store.selectedClipIds) {
        for (const track of store.tracks) {
            const clip = track.clips.find((c) => c.id === id);
            if (clip) {
                selectedClips.push(clip);
                break;
            }
        }
    }

    if (selectedClips.length === 0) return null;
    if (selectedClips.length === 1) return selectedClips[0];

    const firstGroupId = selectedClips[0].groupId;
    if (firstGroupId && selectedClips.every(c => c.groupId === firstGroupId)) {
        const primaryClip = selectedClips.find(c => c.type === 'video') || selectedClips[0];
        return primaryClip;
    }

    return null;
});

const plugin = computed(() => {
    if (!selectedClip.value) return null;
    return pluginRegistry.get(selectedClip.value.type as PluginId);
});

const updateClipData = (newData: any) => {
    if (selectedClip.value) {
        store.updateClip(selectedClip.value.id, { data: newData });
    }
};

/**
 * Get properties from the plugin.
 * Handles the optional nature of getProperties().
 */
const pluginProperties = computed(() => {
    if (!plugin.value) return undefined;
    return plugin.value.getProperties?.(selectedClip.value?.data);
});

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
        class="bg-canvas-light border-l border-canvas-border flex flex-col shrink-0 z-10 overflow-y-auto relative"
        :style="{ width: panelWidth + 'px' }"
    >
        <!-- Resizer Handle -->
        <div 
            class="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-brand-primary/50 z-50 transition-colors"
            :class="{ 'bg-brand-primary': isDragging }"
            @mousedown="startDrag"
        ></div>

        <div class="px-3 py-2 border-b border-canvas-border flex items-center justify-between bg-canvas-dark/30">
            <h3
                class="text-[11px] font-bold text-text-main flex items-center gap-2 uppercase tracking-widest"
            >
                <Sliders :size="12" class="text-brand-primary" />
                Inspector
            </h3>
            <div v-if="selectedClip" class="text-[10px] text-text-muted font-mono truncate max-w-[120px]">
                {{ selectedClip.name }}
            </div>
        </div>

        <div v-if="selectedClip" class="p-2 space-y-1">
            <!-- Plugin Specific Properties -->
            <PluginPropertiesRenderer
                v-if="plugin && pluginProperties"
                :key="selectedClip.id"
                :clip="selectedClip"
                :properties="pluginProperties"
            />

            <!-- Fallback / Default Properties (for video/images) -->
            <div v-else-if="!pluginProperties" class="py-10 text-center">
                <p class="text-[11px] text-text-muted">No properties available</p>
            </div>

            <!-- Attached Transitions Section -->
            <div class="mt-4 pt-2 border-t border-canvas-border">
                <div class="px-1 py-2">
                    <div class="flex items-center gap-2">
                        <div class="h-px flex-1 bg-canvas-border"></div>
                        <span class="text-[10px] font-bold uppercase tracking-widest text-text-muted/40 whitespace-nowrap">
                            Transitions
                        </span>
                        <div class="h-px flex-1 bg-canvas-border"></div>
                    </div>
                </div>

                <!-- Fade In -->
                <div class="group px-1">
                    <div class="flex items-center gap-2 py-1 min-h-[32px] hover:bg-white/[0.02] rounded-sm transition-colors">
                        <span class="w-28 shrink-0 text-[11px] font-semibold text-text-muted transition-colors group-hover:text-text-main select-none">Fade In</span>
                        <div class="flex-1 flex justify-end">
                            <Switch
                                :model-value="!!selectedClip.data?.transitions?.fadeIn"
                                @update:model-value="(val) => toggleTransition('fadeIn', val)"
                            />
                        </div>
                        <div class="w-6"></div>
                    </div>
                    
                    <div v-if="selectedClip.data?.transitions?.fadeIn" class="space-y-0.5 mt-0.5 ml-2 pl-2 border-l border-canvas-border">
                        <!-- Duration -->
                        <div class="flex items-center gap-2 py-0.5 min-h-[28px]">
                            <label class="w-24 shrink-0 text-[10px] text-text-muted/80">Duration</label>
                            <div class="flex-1">
                                <Slider
                                    :model-value="selectedClip.data.transitions.fadeIn.duration"
                                    :min="0.1"
                                    :max="5.0"
                                    :step="0.1"
                                    class="!gap-2"
                                    @update:model-value="(val) => updateTransition('fadeIn', 'duration', val)"
                                />
                            </div>
                            <div class="w-6"></div>
                        </div>
                        <!-- Easing -->
                        <div class="flex items-center gap-2 py-0.5 min-h-[28px] z-20 relative">
                            <label class="w-24 shrink-0 text-[10px] text-text-muted/80">Easing</label>
                            <div class="flex-1">
                                <Select
                                    :model-value="selectedClip.data.transitions.fadeIn.easing"
                                    :options="easingOptions"
                                    size="tiny"
                                    @update:model-value="(val) => updateTransition('fadeIn', 'easing', val)"
                                />
                            </div>
                            <div class="w-6"></div>
                        </div>
                    </div>
                </div>

                <!-- Fade Out -->
                <div class="group px-1 mt-1">
                    <div class="flex items-center gap-2 py-1 min-h-[32px] hover:bg-white/[0.02] rounded-sm transition-colors">
                        <span class="w-28 shrink-0 text-[11px] font-semibold text-text-muted transition-colors group-hover:text-text-main select-none">Fade Out</span>
                        <div class="flex-1 flex justify-end">
                            <Switch
                                :model-value="!!selectedClip.data?.transitions?.fadeOut"
                                @update:model-value="(val) => toggleTransition('fadeOut', val)"
                            />
                        </div>
                        <div class="w-6"></div>
                    </div>
                    
                    <div v-if="selectedClip.data?.transitions?.fadeOut" class="space-y-0.5 mt-0.5 ml-2 pl-2 border-l border-canvas-border">
                        <!-- Duration -->
                        <div class="flex items-center gap-2 py-0.5 min-h-[28px]">
                            <label class="w-24 shrink-0 text-[10px] text-text-muted/80">Duration</label>
                            <div class="flex-1">
                                <Slider
                                    :model-value="selectedClip.data.transitions.fadeOut.duration"
                                    :min="0.1"
                                    :max="5.0"
                                    :step="0.1"
                                    class="!gap-2"
                                    @update:model-value="(val) => updateTransition('fadeOut', 'duration', val)"
                                />
                            </div>
                            <div class="w-6"></div>
                        </div>
                        <!-- Easing -->
                        <div class="flex items-center gap-2 py-0.5 min-h-[28px] z-20 relative">
                            <label class="w-24 shrink-0 text-[10px] text-text-muted/80">Easing</label>
                            <div class="flex-1">
                                <Select
                                    :model-value="selectedClip.data.transitions.fadeOut.easing"
                                    :options="easingOptions"
                                    size="tiny"
                                    @update:model-value="(val) => updateTransition('fadeOut', 'easing', val)"
                                />
                            </div>
                            <div class="w-6"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div v-else class="p-10 text-[11px] text-text-muted text-center uppercase tracking-widest opacity-30 mt-auto">
            No Selection
        </div>
    </div>
</template>
