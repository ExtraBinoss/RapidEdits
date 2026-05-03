<script setup lang="ts">
import { Sliders, Crop as CropIcon, Move as MoveIcon, RotateCcw, Crop } from "lucide-vue-next";
import { useProjectStore } from "../stores/projectStore";
import { computed, ref, onUnmounted } from "vue";
import { pluginRegistry } from "../core/plugins/PluginRegistry";
import { createPluginId, PluginCategory } from "../core/plugins/PluginTypes";
import type { PluginId } from "../core/plugins/PluginTypes";
import { isMediaClip } from "../types/Timeline";
import { editorEngine } from "../core/EditorEngine";
import PluginPropertiesRenderer from "./Plugins/PluginPropertiesRenderer.vue";
import Switch from "./UI/Switch/Switch.vue";
import Slider from "./UI/Slider/Slider.vue";
import Select from "./UI/Input/Select.vue";
import Input from "./UI/Input/Input.vue";
import Accordion from "./UI/Accordion/Accordion.vue";
import Button from "./UI/Button/Button.vue";

const store = useProjectStore();

// --- Configuration ---
const DEFAULT_PANEL_WIDTH = 340;
const MIN_PANEL_WIDTH = 240;
const MAX_PANEL_WIDTH = 600;

const MEDIA_DEFAULTS: Record<string, any> = {
    position: { x: 0, y: 0 },
    rotation: { z: 0 },
    scale: { x: 1, y: 1 },
    opacity: 1,
    borderRadius: 0,
    edgeSoftness: 0,
    crop: { left: 0, right: 0, top: 0, bottom: 0 }
};

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

const updateProperty = (key: string, value: any) => {
    const currentData = selectedClip.value?.data || {};
    updateClipData({ ...currentData, [key]: value });
};

const isPropertyModified = (key: string) => {
    const current = selectedClip.value?.data?.[key];
    const defaultValue = MEDIA_DEFAULTS[key];
    
    if (current === undefined) return false;
    if (defaultValue === undefined) return false;
    
    if (typeof current === 'object' && current !== null) {
        return JSON.stringify(current) !== JSON.stringify(defaultValue);
    }
    return current !== defaultValue;
};

const resetMediaProperty = (key: string) => {
    const defaultValue = MEDIA_DEFAULTS[key];
    if (defaultValue !== undefined) {
        updateProperty(key, JSON.parse(JSON.stringify(defaultValue)));
    }
};

const isCropModified = (side?: string) => {
    const currentCrop = selectedClip.value?.data?.crop;
    if (!currentCrop) return false;

    const defaults = MEDIA_DEFAULTS.crop;
    if (side) {
        return currentCrop[side] !== defaults[side];
    }

    return JSON.stringify(currentCrop) !== JSON.stringify(defaults);
};

const resetCrop = (side?: string) => {
    const currentData = selectedClip.value?.data || {};
    const defaults = MEDIA_DEFAULTS.crop;

    if (side) {
        const currentCrop = currentData.crop || { ...defaults };
        updateProperty('crop', { ...currentCrop, [side]: defaults[side] });
    } else {
        updateProperty('crop', { ...defaults });
    }
};

const updateCrop = (side: string, value: number) => {
    const currentData = selectedClip.value?.data || {};
    const currentCrop = currentData.crop || { left: 0, right: 0, top: 0, bottom: 0 };
    updateClipData({
        ...currentData,
        crop: { ...currentCrop, [side]: value },
    });
};

const updateVector = (key: string, axis: string, value: number) => {
    const currentData = selectedClip.value?.data || {};
    const currentVector = currentData[key] || { x: 0, y: 0, z: 0 };
    updateClipData({
        ...currentData,
        [key]: { ...currentVector, [axis]: value },
    });
};

const isCropMode = ref(editorEngine.getIsCropMode());
const toggleCropMode = () => {
    editorEngine.toggleCropMode();
    isCropMode.value = editorEngine.getIsCropMode();
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

            <!-- Media Clip Properties -->
            <div v-else-if="isMediaClip(selectedClip)" class="space-y-2">
                <Accordion title="Transform" :defaultOpen="true">
                    <div class="space-y-1 py-1">
                        <!-- Position -->
                        <div class="flex flex-col gap-1.5 py-2 px-1 hover:bg-white/[0.02] rounded-sm transition-colors group/vec">
                            <div class="flex items-center justify-between px-1">
                                <label 
                                    class="text-[11px] font-semibold text-text-muted transition-colors group-hover/vec:text-text-main cursor-default select-none"
                                    @dblclick="resetMediaProperty('position')"
                                >
                                    Position
                                </label>
                                <!-- Reset Button for Position -->
                                <div :class="{ 'opacity-0 group-hover/vec:opacity-100 transition-opacity': !isPropertyModified('position') }" class="shrink-0">
                                    <Button
                                        variant="icon"
                                        size="xs"
                                        :icon="RotateCcw"
                                        title="Reset to default"
                                        @click="resetMediaProperty('position')"
                                    />
                                </div>
                            </div>
                            <div class="flex gap-2 w-full">
                                <div v-for="axis in ['x', 'y']" :key="axis" class="relative flex-1 group/axis">
                                    <div class="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                                        <span class="text-[9px] font-black text-text-muted/40 uppercase">{{ axis }}</span>
                                    </div>
                                    <Input
                                        type="number"
                                        class="!pl-5 !pr-1 !text-[10px] !font-mono !h-7 !bg-canvas-dark/50"
                                        :model-value="selectedClip.data?.position?.[axis] ?? 0"
                                        @update:model-value="(val) => updateVector('position', axis, Number(val))"
                                    />
                                </div>
                            </div>
                        </div>
                        <!-- Rotation -->
                        <div class="flex items-center gap-2 py-1 px-1 hover:bg-white/[0.02] rounded-sm transition-colors min-h-[32px] group">
                            <label 
                                class="w-28 shrink-0 text-[11px] font-semibold text-text-muted group-hover:text-text-main transition-colors cursor-default select-none"
                                @dblclick="resetMediaProperty('rotation')"
                            >
                                Rotation
                            </label>
                            <div class="flex-1">
                                <Slider
                                    :model-value="selectedClip.data?.rotation?.z ?? 0"
                                    :min="-3.14159"
                                    :max="3.14159"
                                    :step="0.01"
                                    class="!gap-2"
                                    @update:model-value="(val) => updateVector('rotation', 'z', val)"
                                />
                            </div>
                            <!-- Reset Button -->
                            <div :class="{ 'opacity-0 group-hover:opacity-100 transition-opacity': !isPropertyModified('rotation') }" class="shrink-0">
                                <Button
                                    variant="icon"
                                    size="xs"
                                    :icon="RotateCcw"
                                    title="Reset to default"
                                    @click="resetMediaProperty('rotation')"
                                />
                            </div>
                        </div>
                        <!-- Scale -->
                        <div class="flex flex-col gap-1.5 py-2 px-1 hover:bg-white/[0.02] rounded-sm transition-colors group/vec">
                            <div class="flex items-center justify-between px-1">
                                <label 
                                    class="text-[11px] font-semibold text-text-muted transition-colors group-hover/vec:text-text-main cursor-default select-none"
                                    @dblclick="resetMediaProperty('scale')"
                                >
                                    Scale
                                </label>
                                <!-- Reset Button for Scale -->
                                <div :class="{ 'opacity-0 group-hover/vec:opacity-100 transition-opacity': !isPropertyModified('scale') }" class="shrink-0">
                                    <Button
                                        variant="icon"
                                        size="xs"
                                        :icon="RotateCcw"
                                        title="Reset to default"
                                        @click="resetMediaProperty('scale')"
                                    />
                                </div>
                            </div>
                            <div class="flex gap-2 w-full">
                                <div v-for="axis in ['x', 'y']" :key="axis" class="relative flex-1 group/axis">
                                    <div class="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                                        <span class="text-[9px] font-black text-text-muted/40 uppercase">{{ axis }}</span>
                                    </div>
                                    <Input
                                        type="number"
                                        class="!pl-5 !pr-1 !text-[10px] !font-mono !h-7 !bg-canvas-dark/50"
                                        :model-value="selectedClip.data?.scale?.[axis] ?? 1"
                                        @update:model-value="(val) => updateVector('scale', axis, Number(val))"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </Accordion>

                <Accordion title="Appearance">
                    <div class="space-y-1 py-1">
                        <!-- Opacity -->
                        <div class="flex items-center gap-2 py-1 px-1 hover:bg-white/[0.02] rounded-sm transition-colors min-h-[32px] group">
                            <label 
                                class="w-28 shrink-0 text-[11px] font-semibold text-text-muted group-hover:text-text-main transition-colors cursor-default select-none"
                                @dblclick="resetMediaProperty('opacity')"
                            >
                                Opacity
                            </label>
                            <div class="flex-1">
                                <Slider
                                    :model-value="selectedClip.data?.opacity ?? 1"
                                    :min="0"
                                    :max="1"
                                    :step="0.01"
                                    class="!gap-2"
                                    @update:model-value="(val) => updateProperty('opacity', val)"
                                />
                            </div>
                            <!-- Reset Button -->
                            <div :class="{ 'opacity-0 group-hover:opacity-100 transition-opacity': !isPropertyModified('opacity') }" class="shrink-0">
                                <Button
                                    variant="icon"
                                    size="xs"
                                    :icon="RotateCcw"
                                    title="Reset to default"
                                    @click="resetMediaProperty('opacity')"
                                />
                            </div>
                        </div>
                        <!-- Border Radius -->
                        <div class="flex items-center gap-2 py-1 px-1 hover:bg-white/[0.02] rounded-sm transition-colors min-h-[32px] group">
                            <label 
                                class="w-28 shrink-0 text-[11px] font-semibold text-text-muted group-hover:text-text-main transition-colors cursor-default select-none"
                                @dblclick="resetMediaProperty('borderRadius')"
                            >
                                Round Edges
                            </label>
                            <div class="flex-1">
                                <Slider
                                    :model-value="selectedClip.data?.borderRadius ?? 0"
                                    :min="0"
                                    :max="1"
                                    :step="0.01"
                                    class="!gap-2"
                                    @update:model-value="(val) => updateProperty('borderRadius', val)"
                                />
                            </div>
                            <!-- Reset Button -->
                            <div :class="{ 'opacity-0 group-hover:opacity-100 transition-opacity': !isPropertyModified('borderRadius') }" class="shrink-0">
                                <Button
                                    variant="icon"
                                    size="xs"
                                    :icon="RotateCcw"
                                    title="Reset to default"
                                    @click="resetMediaProperty('borderRadius')"
                                />
                            </div>
                        </div>
                        <!-- Edge Softness -->
                        <div class="flex items-center gap-2 py-1 px-1 hover:bg-white/[0.02] rounded-sm transition-colors min-h-[32px] group">
                            <label 
                                class="w-28 shrink-0 text-[11px] font-semibold text-text-muted group-hover:text-text-main transition-colors cursor-default select-none"
                                @dblclick="resetMediaProperty('edgeSoftness')"
                            >
                                Edge Softness
                            </label>
                            <div class="flex-1">
                                <Slider
                                    :model-value="selectedClip.data?.edgeSoftness ?? 0"
                                    :min="0"
                                    :max="1"
                                    :step="0.01"
                                    class="!gap-2"
                                    @update:model-value="(val) => updateProperty('edgeSoftness', val)"
                                />
                            </div>
                            <!-- Reset Button -->
                            <div :class="{ 'opacity-0 group-hover:opacity-100 transition-opacity': !isPropertyModified('edgeSoftness') }" class="shrink-0">
                                <Button
                                    variant="icon"
                                    size="xs"
                                    :icon="RotateCcw"
                                    title="Reset to default"
                                    @click="resetMediaProperty('edgeSoftness')"
                                />
                            </div>
                        </div>
                    </div>
                </Accordion>

                <Accordion title="Crop">
                    <template #action>
                        <div class="flex items-center gap-1">
                            <div :class="{ 'opacity-0 hover:opacity-100 transition-opacity': !isCropModified() }" class="shrink-0">
                                <Button
                                    variant="icon"
                                    size="xs"
                                    :icon="RotateCcw"
                                    title="Reset all crop"
                                    @click.stop="resetCrop()"
                                />
                            </div>
                            <Button
                                variant="icon"
                                size="xs"
                                :icon="Crop"
                                :class="{ 'text-brand-primary': isCropMode }"
                                title="Toggle Crop Mode"
                                @click.stop="toggleCropMode"
                            />
                        </div>
                    </template>
                    <div class="space-y-1 py-1">
                        <div v-for="side in ['left', 'right', 'top', 'bottom']" :key="side" class="flex items-center gap-2 py-1 px-1 hover:bg-white/[0.02] rounded-sm transition-colors min-h-[32px] group">
                            <label 
                                class="w-28 shrink-0 text-[11px] font-semibold text-text-muted group-hover:text-text-main transition-colors capitalize cursor-default select-none"
                                @dblclick="resetCrop(side)"
                            >
                                {{ side }}
                            </label>
                            <div class="flex-1">
                                <Slider
                                    :model-value="selectedClip.data?.crop?.[side] ?? 0"
                                    :min="0"
                                    :max="1"
                                    :step="0.01"
                                    class="!gap-2"
                                    @update:model-value="(val) => updateCrop(side, val)"
                                />
                            </div>
                            <!-- Reset Button -->
                            <div :class="{ 'opacity-0 group-hover:opacity-100 transition-opacity': !isCropModified(side) }" class="shrink-0">
                                <Button
                                    variant="icon"
                                    size="xs"
                                    :icon="RotateCcw"
                                    title="Reset to default"
                                    @click="resetCrop(side)"
                                />
                            </div>
                        </div>
                    </div>
                </Accordion>
            </div>

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
                    
                    <div v-if="selectedClip.data?.transitions?.fadeIn" class="space-y-1.5 mt-1 ml-2 pl-2 border-l border-canvas-border pb-2">
                        <!-- Transition Type -->
                        <div class="flex items-center gap-2 py-0.5 min-h-[28px] z-30 relative">
                            <label class="w-24 shrink-0 text-[10px] text-text-muted/80">Type</label>
                            <div class="flex-1">
                                <Select
                                    :model-value="selectedClip.data.transitions.fadeIn.type || 'fade'"
                                    :options="[
                                        { label: 'Fade / Dissolve', value: 'fade' },
                                        { label: 'Motion', value: 'motion' },
                                    ]"
                                    size="tiny"
                                    @update:model-value="(val) => updateTransition('fadeIn', 'type', val)"
                                />
                            </div>
                            <div class="w-6"></div>
                        </div>

                        <!-- Motion Type (if motion) -->
                        <div v-if="selectedClip.data.transitions.fadeIn.type === 'motion'" class="flex items-center gap-2 py-0.5 min-h-[28px] z-20 relative">
                            <label class="w-24 shrink-0 text-[10px] text-text-muted/80">Preset</label>
                            <div class="flex-1">
                                <Select
                                    :model-value="selectedClip.data.transitions.fadeIn.motionType || 'slide-up'"
                                    :options="[
                                        { label: 'Slide Up', value: 'slide-up' },
                                        { label: 'Slide Down', value: 'slide-down' },
                                        { label: 'Slide Left', value: 'slide-left' },
                                        { label: 'Slide Right', value: 'slide-right' },
                                        { label: 'Zoom In', value: 'zoom-in' },
                                        { label: 'Zoom Out', value: 'zoom-out' },
                                        { label: 'Elastic', value: 'elastic-in' },
                                    ]"
                                    size="tiny"
                                    @update:model-value="(val) => updateTransition('fadeIn', 'motionType', val)"
                                />
                            </div>
                            <div class="w-6"></div>
                        </div>

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
                        <div class="flex items-center gap-2 py-0.5 min-h-[28px] z-10 relative">
                            <label class="w-24 shrink-0 text-[10px] text-text-muted/80">Easing</label>
                            <div class="flex-1">
                                <Select
                                    :model-value="selectedClip.data.transitions.fadeIn.easing || 'linear'"
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
                    
                    <div v-if="selectedClip.data?.transitions?.fadeOut" class="space-y-1.5 mt-1 ml-2 pl-2 border-l border-canvas-border pb-2">
                        <!-- Transition Type -->
                        <div class="flex items-center gap-2 py-0.5 min-h-[28px] z-30 relative">
                            <label class="w-24 shrink-0 text-[10px] text-text-muted/80">Type</label>
                            <div class="flex-1">
                                <Select
                                    :model-value="selectedClip.data.transitions.fadeOut.type || 'fade'"
                                    :options="[
                                        { label: 'Fade / Dissolve', value: 'fade' },
                                        { label: 'Motion', value: 'motion' },
                                    ]"
                                    size="tiny"
                                    @update:model-value="(val) => updateTransition('fadeOut', 'type', val)"
                                />
                            </div>
                            <div class="w-6"></div>
                        </div>

                        <!-- Motion Type (if motion) -->
                        <div v-if="selectedClip.data.transitions.fadeOut.type === 'motion'" class="flex items-center gap-2 py-0.5 min-h-[28px] z-20 relative">
                            <label class="w-24 shrink-0 text-[10px] text-text-muted/80">Preset</label>
                            <div class="flex-1">
                                <Select
                                    :model-value="selectedClip.data.transitions.fadeOut.motionType || 'slide-up'"
                                    :options="[
                                        { label: 'Slide Up', value: 'slide-up' },
                                        { label: 'Slide Down', value: 'slide-down' },
                                        { label: 'Slide Left', value: 'slide-left' },
                                        { label: 'Slide Right', value: 'slide-right' },
                                        { label: 'Zoom In', value: 'zoom-in' },
                                        { label: 'Zoom Out', value: 'zoom-out' },
                                        { label: 'Elastic', value: 'elastic-in' },
                                    ]"
                                    size="tiny"
                                    @update:model-value="(val) => updateTransition('fadeOut', 'motionType', val)"
                                />
                            </div>
                            <div class="w-6"></div>
                        </div>

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
                        <div class="flex items-center gap-2 py-0.5 min-h-[28px] z-10 relative">
                            <label class="w-24 shrink-0 text-[10px] text-text-muted/80">Easing</label>
                            <div class="flex-1">
                                <Select
                                    :model-value="selectedClip.data.transitions.fadeOut.easing || 'linear'"
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
