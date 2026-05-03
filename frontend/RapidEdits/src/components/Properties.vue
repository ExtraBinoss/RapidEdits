<script setup lang="ts">
import { Sliders, Trash2 } from "lucide-vue-next";
import { useProjectStore } from "../stores/projectStore";
import { computed, ref, onUnmounted } from "vue";
import { pluginRegistry } from "../core/plugins/PluginRegistry";
import { createPluginId, PluginCategory } from "../core/plugins/PluginTypes";
import type { PluginId } from "../core/plugins/PluginTypes";
import type { Clip } from "../types/Timeline";
import PluginPropertiesRenderer from "./Plugins/PluginPropertiesRenderer.vue";
import Switch from "./UI/Switch/Switch.vue";
import Accordion from "./UI/Accordion/Accordion.vue";
import Button from "./UI/Button/Button.vue";

const store = useProjectStore();

// --- Configuration ---
const DEFAULT_PANEL_WIDTH = 340;
const MIN_PANEL_WIDTH = 240;
const MAX_PANEL_WIDTH = 600;

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

const pluginProperties = computed(() => {
    if (!plugin.value) return undefined;
    return plugin.value.getProperties?.(selectedClip.value?.data);
});

// --- Dynamic Global Inspectors ---

const globalInspectorPlugins = computed(() => {
    return pluginRegistry.getAll()
        .filter(p => p.getMetadata().isGlobalInspector)
        .sort((a, b) => (a.getMetadata().priority || 0) - (b.getMetadata().priority || 0));
});

// --- Dynamic Transitions ---

const transitionPlugins = computed(() => {
    return pluginRegistry.getAll()
        .filter(p => p.getMetadata().isAttachedTransition);
});

const isTransitionActive = (pluginId: string) => {
    const transitions = selectedClip.value?.data?.transitions || {};
    return !!transitions[pluginId];
};

const toggleTransition = (pluginId: string, enabled: boolean) => {
    const currentData = selectedClip.value?.data || {};
    const transitions = { ...(currentData.transitions || {}) };

    if (enabled) {
        const plugin = pluginRegistry.get(pluginId as PluginId);
        transitions[pluginId] = plugin?.createData?.() || { duration: 1.0 };
    } else {
        delete transitions[pluginId];
    }

    updateClipData({ ...currentData, transitions });
};

const getTransitionData = (pluginId: string) => {
    return selectedClip.value?.data?.transitions?.[pluginId] || {};
};

const updateTransitionData = (pluginId: string, newData: any) => {
    const currentData = selectedClip.value?.data || {};
    const transitions = { ...(currentData.transitions || {}) };
    transitions[pluginId] = newData;
    updateClipData({ ...currentData, transitions });
};

const activeTransitions = computed(() => {
    if (!selectedClip.value?.data?.transitions) return [];
    
    return Object.keys(selectedClip.value.data.transitions).map(id => {
        const plugin = pluginRegistry.get(id as PluginId);
        if (!plugin) return null;
        return { id, plugin };
    }).filter((t): t is { id: string, plugin: any } => t !== null);
});

// Create a virtual clip for the transition plugin to render its properties
const getTransitionClip = (pluginId: string): Clip => {
    return {
        ...selectedClip.value!,
        data: getTransitionData(pluginId)
    };
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

        <div v-if="selectedClip" class="p-2 space-y-2">
            <!-- Global Inspector Plugins (Transform, Appearance, Crop, etc.) -->
            <div 
                v-for="inspPlugin in globalInspectorPlugins" 
                :key="inspPlugin.getMetadata().id"
            >
                <Accordion 
                    :title="inspPlugin.getMetadata().name" 
                    :defaultOpen="inspPlugin.getMetadata().id.includes('transform')"
                >
                    <div class="py-1">
                        <PluginPropertiesRenderer
                            :clip="selectedClip"
                            :properties="inspPlugin.getProperties?.(selectedClip.data)"
                            @update:clip-data="(newData: any) => updateClipData(newData)"
                        />
                    </div>
                </Accordion>
            </div>

            <!-- Plugin Specific Properties (Text content, etc.) -->
            <PluginPropertiesRenderer
                v-if="plugin && pluginProperties"
                :key="'plugin-' + selectedClip.id"
                :clip="selectedClip"
                :properties="pluginProperties"
                @update:clip-data="(newData: any) => updateClipData(newData)"
            />

            <!-- Dynamic Transitions Section -->
            <div v-if="activeTransitions.length > 0" class="mt-2">
                <Accordion title="Transitions" defaultOpen>
                    <div class="space-y-2 py-2">
                        <div 
                            v-for="trans in activeTransitions" 
                            :key="trans.id"
                            class="group px-1"
                        >
                            <!-- Transition Header with Remove Button -->
                            <div class="flex items-center gap-2 py-1 min-h-[32px] hover:bg-white/[0.02] rounded-sm transition-colors">
                                <component :is="trans.plugin.getMetadata().icon" v-if="trans.plugin.getMetadata().icon" class="w-3.5 h-3.5 text-brand-primary opacity-70" />
                                <span class="flex-1 text-[11px] font-bold text-text-muted transition-colors group-hover:text-text-main select-none capitalize">
                                    {{ trans.plugin.getMetadata().name }}
                                </span>
                                <Button
                                    variant="icon"
                                    size="xs"
                                    class="opacity-0 group-hover:opacity-100 transition-opacity text-red-500/50 hover:text-red-500"
                                    :icon="Trash2"
                                    title="Remove Transition"
                                    @click="toggleTransition(trans.id, false)"
                                />
                            </div>

                            <!-- Transition Properties -->
                            <div class="mt-1 ml-2 pl-3 border-l-2 border-brand-primary/20 pb-2">
                                <PluginPropertiesRenderer
                                    :clip="getTransitionClip(trans.id)"
                                    :properties="trans.plugin.getProperties?.(getTransitionData(trans.id))"
                                    disable-direct-update
                                    @update:clip-data="(newData: any) => updateTransitionData(trans.id, newData)"
                                />
                            </div>
                        </div>
                    </div>
                </Accordion>
            </div>
        </div>

        <div v-else class="p-10 text-[11px] text-text-muted text-center uppercase tracking-widest opacity-30 mt-auto">
            No Selection
        </div>
    </div>
</template>
