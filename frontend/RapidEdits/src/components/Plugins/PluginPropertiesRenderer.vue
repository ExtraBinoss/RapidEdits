<template>
    <div class="flex flex-col gap-1 pb-2">
        <template v-for="(group, groupIndex) in groupedProperties" :key="groupIndex">
            <component 
                v-if="hasVisibleProps(group)"
                :is="group.name ? Accordion : 'div'" 
                v-bind="group.name ? { title: group.name, defaultOpen: groupIndex === firstCategoryIndex } : { class: 'flex flex-col gap-px mb-2' }"
            >
                <template v-for="(prop, _) in group.props" :key="prop.key">
                    <template v-if="shouldShow(prop)">
                        <!-- Vector (Dedicated multi-row layout for 2, 3, or 4 components) -->
                        <div 
                            v-if="prop.type === 'vector2' || prop.type === 'vector3' || prop.type === 'vector4'" 
                            v-memo="[getValue(prop.key), prop.key, isModified(prop)]"
                            class="flex flex-col gap-1.5 py-2 px-1 hover:bg-white/[0.02] rounded-sm transition-colors group/vec"
                        >
                            <div class="flex items-center justify-between px-1">
                                <label
                                    class="text-[12px] font-semibold text-text-muted transition-colors group-hover/vec:text-text-main cursor-default select-none"
                                    @dblclick="resetProperty(prop)"
                                >
                                    {{ prop.label }}
                                </label>
                                <!-- Reset Button for Vector -->
                                <div :class="{ 'opacity-0 group-hover/vec:opacity-100 transition-opacity': !isModified(prop) }" class="shrink-0">
                                    <Button
                                        variant="icon"
                                        size="xs"
                                        :icon="RotateCcw"
                                        title="Reset to default"
                                        @click="resetProperty(prop)"
                                    />
                                </div>
                            </div>
                            
                            <div class="flex gap-2 w-full">
                                <div 
                                    v-for="axis in (prop.type === 'vector2' ? ['x', 'y'] : prop.type === 'vector3' ? ['x', 'y', 'z'] : ['x', 'y', 'z', 'w'])" 
                                    :key="axis" 
                                    class="relative flex-1 group/axis"
                                >
                                    <div class="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                                        <span class="text-[9px] font-black text-text-muted/40 uppercase">{{ axis }}</span>
                                    </div>
                                    <Input
                                        type="number"
                                        class="!pl-5 !pr-1 !text-[12px] !font-mono !h-8 !bg-canvas-dark/50"
                                        :model-value="getValue(prop.key)?.[axis]"
                                        v-bind="prop.props"
                                        @update:model-value="(val) => updateVector(prop.key, axis, Number(val))"
                                    />
                                </div>
                            </div>
                        </div>

                        <!-- Gradient (Full Width Block) -->
                        <div 
                            v-else-if="prop.type === 'gradient'"
                            v-memo="[getValue(prop.key), prop.key, isModified(prop)]"
                            class="flex flex-col gap-1.5 py-2 px-1 hover:bg-white/[0.02] rounded-sm transition-colors group/grad"
                        >
                            <div class="flex items-center justify-between px-1">
                                <label
                                    class="text-[12px] font-semibold text-text-muted transition-colors group-hover/grad:text-text-main cursor-default select-none"
                                >
                                    {{ prop.label }}
                                </label>
                                <div :class="{ 'opacity-0 group-hover/grad:opacity-100 transition-opacity': !isModified(prop) }" class="shrink-0">
                                    <Button
                                        variant="icon"
                                        size="xs"
                                        :icon="RotateCcw"
                                        @click="resetProperty(prop)"
                                    />
                                </div>
                            </div>
                            <div class="w-full">
                                <Gradient
                                    :model-value="getValue(prop.key)"
                                    @update:model-value="(val) => updateProperty(prop.key, val)"
                                />
                            </div>
                        </div>

                        <!-- Regular Property Wrapper -->
                        <div 
                            v-else 
                            v-memo="[getValue(prop.key), prop.key, isModified(prop)]"
                            class="group flex items-center gap-2 py-1 px-1 hover:bg-white/[0.02] rounded-sm transition-colors min-h-[32px]"
                        >
                            <label
                                :for="getPropId(prop)"
                                class="w-28 shrink-0 text-[12px] font-semibold text-text-muted transition-colors group-hover:text-text-main cursor-default truncate select-none"
                                :title="prop.label"
                                @dblclick="resetProperty(prop)"
                            >
                                {{ prop.label }}
                            </label>

                            <div class="flex-1 min-w-0 flex items-center">
                                <!-- Text / Long Text -->
                                <div v-if="prop.type === 'text' || prop.type === 'long-text'" class="w-full">
                                    <TextArea
                                        v-if="prop.type === 'long-text'"
                                        :id="getPropId(prop)"
                                        :name="prop.key"
                                        :model-value="getValue(prop.key)"
                                        class="!py-1 !px-2 !text-xs"
                                        v-bind="prop.props"
                                        @update:model-value="(val) => updateProperty(prop.key, val)"
                                    />
                                    <Input
                                        v-else
                                        type="text"
                                        :model-value="getValue(prop.key)"
                                        class="!py-1 !px-2 !text-xs !h-7"
                                        v-bind="prop.props"
                                        @update:model-value="(val) => updateProperty(prop.key, val)"
                                    />
                                </div>

                                <!-- Number / Slider -->
                                <div v-else-if="prop.type === 'number' || prop.type === 'slider'" class="w-full">
                                    <Slider
                                        v-if="prop.type === 'slider'"
                                        :model-value="getValue(prop.key)"
                                        v-bind="prop.props"
                                        class="!gap-2"
                                        @update:model-value="(val) => updateProperty(prop.key, val)"
                                    />
                                    <Input
                                        v-else
                                        type="number"
                                        :model-value="getValue(prop.key)"
                                        class="!py-1 !px-2 !text-xs !h-7"
                                        v-bind="prop.props"
                                        @update:model-value="(val) => updateProperty(prop.key, Number(val))"
                                    />
                                </div>

                                <!-- Color -->
                                <ColorPicker
                                    v-else-if="prop.type === 'color'"
                                    :model-value="getValue(prop.key)"
                                    @update:model-value="(val) => updateProperty(prop.key, val)"
                                />

                                <!-- Boolean (Switch) -->
                                <div v-else-if="prop.type === 'boolean'" class="flex justify-end w-full">
                                    <Switch
                                        :model-value="getValue(prop.key)"
                                        @update:model-value="(val) => updateProperty(prop.key, val)"
                                    />
                                </div>

                                 <!-- Select -->
                                <div v-else-if="prop.type === 'select'" class="w-full">
                                    <Select
                                        :model-value="getValue(prop.key)"
                                        :options="prop.options || []"
                                        size="small"
                                        @update:model-value="(val) => updateProperty(prop.key, val)"
                                    />
                                </div>
                            </div>

                            <!-- Reset Button -->
                            <div :class="{ 'opacity-0 group-hover:opacity-100 transition-opacity': !isModified(prop) }" class="shrink-0">
                                <Button
                                    variant="icon"
                                    size="xs"
                                    :icon="RotateCcw"
                                    title="Reset to default"
                                    @click="resetProperty(prop)"
                                />
                            </div>
                        </div>
                    </template>
                </template>
            </component>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import type { Clip } from "../../types/Timeline";
import type { PluginPropertyDefinition } from "../../core/plugins/PluginTypes";
import { editorEngine } from "../../core/EditorEngine";
import { globalEventBus } from "../../core/events/EventBus";
import { EditorEventType } from "../../types/Media";
import { RotateCcw } from "lucide-vue-next";
import { pluginRegistry } from "../../core/plugins/PluginRegistry";
import type { PluginId } from "../../core/plugins/PluginTypes";
import Input from "../UI/Input/Input.vue";
import TextArea from "../UI/TextArea/TextArea.vue";
import Slider from "../UI/Slider/Slider.vue";
import ColorPicker from "../UI/ColorPicker/ColorPicker.vue";
import Switch from "../UI/Switch/Switch.vue";
import Select from "../UI/Input/Select.vue";
import Accordion from "../UI/Accordion/Accordion.vue";
import Button from "../UI/Button/Button.vue";
import Gradient from "../UI/Gradient/Gradient.vue";

const props = defineProps<{
    clip: Clip;
    properties: PluginPropertyDefinition[] | undefined;
    disableDirectUpdate?: boolean;
}>();

const clipData = computed(() => props.clip.data || {});

// --- 20 FPS Throttled UI State ---
// We maintain a local copy of the clip data that updates at a lower frequency (20fps)
// to avoid overloading Vue's reactivity system during fast movements (gizmo dragging).
const throttledClipData = ref({ ...clipData.value });
let lastUpdate = 0;
let rafId: number | null = null;
const THROTTLE_MS = 50; // 20 FPS

const syncThrottledData = (timestamp: number) => {
    if (timestamp - lastUpdate >= THROTTLE_MS) {
        // Deep copy not strictly needed as we only read from it, but shallow spread to trigger reactivity
        throttledClipData.value = { ...props.clip.data };
        lastUpdate = timestamp;
    }
    rafId = requestAnimationFrame(syncThrottledData);
};

onMounted(() => {
    rafId = requestAnimationFrame(syncThrottledData);
});

onUnmounted(() => {
    if (rafId) cancelAnimationFrame(rafId);
});

const safeProperties = computed(() => props.properties ?? []);

const groupedProperties = computed(() => {
    const groups: { name: string, props: PluginPropertyDefinition[] }[] = [];
    let currentGroup = { name: '', props: [] as PluginPropertyDefinition[] };
    
    for (const prop of safeProperties.value) {
        if (prop.type === 'divider') {
            if (currentGroup.props.length > 0 || currentGroup.name !== '') {
                groups.push(currentGroup);
            }
            currentGroup = { name: prop.label, props: [] };
        } else {
            currentGroup.props.push(prop);
        }
    }
    if (currentGroup.props.length > 0 || currentGroup.name !== '') {
        groups.push(currentGroup);
    }
    return groups;
});

const firstCategoryIndex = computed(() => {
    return groupedProperties.value.findIndex(g => g.name !== '' && g.props.some(p => shouldShow(p)));
});

const hasVisibleProps = (group: { props: PluginPropertyDefinition[] }) => {
    return group.props.some(p => shouldShow(p));
};

const plugin = computed(() => {
    return pluginRegistry.get(props.clip.type as PluginId);
});

// Cache split keys to avoid string operations on every render
const keyCache = new Map<string, string[]>();
const getSplitKey = (key: string) => {
    if (!keyCache.has(key)) {
        keyCache.set(key, key.split('.'));
    }
    return keyCache.get(key)!;
};

const getValue = (key: string) => {
    const parts = getSplitKey(key);
    // Use the throttled data for display
    let value: any = throttledClipData.value;
    
    // Unrolled loop for common depths (1 or 2) is faster
    if (parts.length === 1) {
        value = value[parts[0]];
    } else {
        for (const part of parts) {
            if (value === undefined || value === null) break;
            value = value[part];
        }
    }
    
    if (value !== undefined) return value;
    
    // Fallback to prop default if missing in data
    const prop = safeProperties.value.find(p => p.key === key);
    if (prop && prop.defaultValue !== undefined) return prop.defaultValue;

    // Fallback to plugin default data
    const pluginDefault = getDefaultFromPlugin(parts[0]);
    if (parts.length > 1 && pluginDefault !== undefined) {
        let nested = pluginDefault;
        for (let i = 1; i < parts.length; i++) {
            if (nested === undefined || nested === null) break;
            nested = nested[parts[i]];
        }
        return nested;
    }
    return pluginDefault;
};

const getPropId = (prop: PluginPropertyDefinition) => {
    return `${props.clip.id}-${prop.key.replace(/\./g, '-')}`;
};

const shouldShow = (prop: PluginPropertyDefinition) => {
    if (prop.showIf) {
        return prop.showIf(throttledClipData.value);
    }
    return true;
};

const isModified = (prop: PluginPropertyDefinition) => {
    const current = getValue(prop.key);
    const defaultValue = prop.defaultValue ?? getDefaultFromPlugin(prop.key);
    
    if (current === undefined || defaultValue === undefined) return false;
    
    if (typeof current === 'object' && current !== null) {
        return JSON.stringify(current) !== JSON.stringify(defaultValue);
    }
    return current !== defaultValue;
};

const getDefaultFromPlugin = (key: string) => {
    if (!plugin.value) return undefined;
    const defaultData = plugin.value.createData?.();
    return defaultData ? defaultData[key] : undefined;
};

const resetProperty = (prop: PluginPropertyDefinition) => {
    const defaultValue = prop.defaultValue ?? getDefaultFromPlugin(prop.key);
    if (defaultValue !== undefined) {
        updateProperty(prop.key, JSON.parse(JSON.stringify(defaultValue)));
    }
};

const updateProperty = (key: string, value: any) => {
    const parts = getSplitKey(key);
    const newData = { ...clipData.value };
    
    if (parts.length === 1) {
        newData[key] = value;
    } else {
        // Nested update
        let current = newData;
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            current[part] = { ...(current[part] || {}) };
            current = current[part];
        }
        current[parts[parts.length - 1]] = value;
    }
    
    applyUpdate(newData);
};

const updateVector = (key: string, axis: string, value: number) => {
    const prop = safeProperties.value.find(p => p.key === key);
    let defaultVector: any = { x: 0, y: 0 };
    if (prop?.type === 'vector3') defaultVector = { x: 0, y: 0, z: 0 };
    if (prop?.type === 'vector4') defaultVector = { x: 0, y: 0, z: 0, w: 0 };

    const currentVector = getValue(key) || defaultVector;
    const newVector = { ...currentVector, [axis]: value };
    updateProperty(key, newVector);
};

const emit = defineEmits<{
    (e: "update:clip-data", newData: any): void;
}>();

const applyUpdate = (newData: any) => {
    // Immediate UI update for direct user interaction
    throttledClipData.value = newData;

    // Emit for parent handling (e.g. for transitions)
    emit("update:clip-data", newData);

    // Only update engine directly if not disabled
    if (!props.disableDirectUpdate) {
        editorEngine.updateClip(props.clip.id, { data: newData });
    }

    globalEventBus.emit({
        type: EditorEventType.PLUGIN_PROPERTY_CHANGED,
        payload: { clipId: props.clip.id },
    });
};
</script>
