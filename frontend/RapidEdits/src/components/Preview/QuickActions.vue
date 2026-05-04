<script setup lang="ts">
import { computed, ref } from 'vue';
import { useProjectStore } from '../../stores/projectStore';
import { pluginRegistry } from '../../core/plugins/PluginRegistry';
import PluginPropertiesRenderer from '../Plugins/PluginPropertiesRenderer.vue';
import type { QuickActionDefinition, PluginId } from '../../core/plugins/PluginTypes';
import Button from '../UI/Button/Button.vue';
import Tooltip from '../UI/Overlay/Tooltip.vue';
import Popover from '../UI/Overlay/Popover.vue';

const props = defineProps<{
    gizmoRect: { x: number; y: number; width: number; height: number; rotation: number };
}>();

const store = useProjectStore();

const selectedClip = computed(() => {
    const ids = store.selectedClipIds;
    if (ids.length === 0) return null;
    for (const track of store.tracks) {
        const clip = track.clips.find(c => c.id === ids[0]);
        if (clip) return clip;
    }
    return null;
});

const activeActions = computed(() => {
    if (!selectedClip.value) return [];
    
    const actions: { pluginId: string; definition: QuickActionDefinition }[] = [];
    const clipType = selectedClip.value.type;
    const isAudio = clipType === 'audio';

    // 1. Specific Plugin Actions (e.g. Text)
    const mainPlugin = pluginRegistry.get(clipType as PluginId);
    if (mainPlugin) {
        const qa = mainPlugin.getQuickActions?.(selectedClip.value);
        if (qa) {
            qa.forEach(def => actions.push({ pluginId: mainPlugin.getMetadata().id, definition: def }));
        }
    }
    
    // 2. Global Inspector Actions (e.g. Rounding from Appearance)
    const allPlugins = pluginRegistry.getAll();
    allPlugins.forEach(p => {
        const meta = p.getMetadata();
        if (meta.isGlobalInspector) {
            const qa = p.getQuickActions?.(selectedClip.value!);
            if (qa) {
                actions.push(...qa.map(def => ({ pluginId: meta.id, definition: def })));
            }
        }
    });
    
    return actions;
});

const activePopoverId = ref<string | null>(null);

</script>

<template>
    <div 
        v-if="activeActions.length > 0"
        class="absolute z-[100] pointer-events-auto flex items-start"
        :style="{
            left: `${props.gizmoRect.width + 16}px`,
            top: `0px`,
            transform: `rotate(${-props.gizmoRect.rotation}rad)`,
            transformOrigin: 'top left'
        }"
    >
        <!-- Action Buttons Sidebar -->
        <div class="flex flex-col gap-1 p-1 bg-canvas-light border border-canvas-border shadow-2xl rounded-md">
            <div v-for="action in activeActions" :key="action.definition.id">
                <Popover 
                    :is-open="activePopoverId === action.definition.id"
                    @update:is-open="(val) => activePopoverId = val ? action.definition.id : null"
                    position="right"
                    :offset="12"
                    :z-index="1000"
                    trigger="manual"
                >
                    <template #trigger>
                        <Tooltip :text="action.definition.label" position="right" :disabled="activePopoverId === action.definition.id">
                            <Button 
                                variant="icon"
                                size="md"
                                :icon="action.definition.icon"
                                :active="activePopoverId === action.definition.id"
                                @click="activePopoverId = (activePopoverId === action.definition.id ? null : action.definition.id)"
                            />
                        </Tooltip>
                    </template>

                    <template #content>
                        <div class="w-72 p-4 bg-canvas-light text-text-main">
                            <div class="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
                                <span class="text-[10px] font-black uppercase tracking-widest text-text-muted">
                                    {{ action.definition.label }}
                                </span>
                            </div>
                            
                            <div class="max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                <PluginPropertiesRenderer
                                    v-if="selectedClip"
                                    :key="`${selectedClip.id}-${action.definition.id}`"
                                    :clip="selectedClip"
                                    :properties="action.definition.properties"
                                />
                            </div>
                        </div>
                    </template>
                </Popover>
            </div>
        </div>
    </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
    width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
}
</style>
