<template>
    <div class="flex flex-col gap-1 pb-2">
        <template v-for="(group, groupIndex) in groupedProperties" :key="groupIndex">
            <component 
                :is="group.name ? Accordion : 'div'" 
                v-bind="group.name ? { title: group.name, defaultOpen: groupIndex === firstCategoryIndex } : { class: 'flex flex-col gap-px mb-2' }"
            >
                <template v-for="(prop, _) in group.props" :key="prop.key">
                    <template v-if="shouldShow(prop)">
                        <!-- Vector (Dedicated multi-row layout for 2, 3, or 4 components) -->
                        <div v-if="prop.type === 'vector2' || prop.type === 'vector3' || prop.type === 'vector4'" class="flex flex-col gap-1.5 py-2 px-1 hover:bg-white/[0.02] rounded-sm transition-colors group/vec">
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
                                        @update:model-value="(val) => updateVector(prop.key, axis, Number(val))"
                                    />
                                </div>
                            </div>
                        </div>

                        <!-- Regular Property Wrapper -->
                        <div v-else class="group flex items-center gap-2 py-1 px-1 hover:bg-white/[0.02] rounded-sm transition-colors min-h-[32px]">
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
                                <ColorInput
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
import { computed } from "vue";
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
import ColorInput from "../UI/ColorPicker/ColorInput.vue";
import Switch from "../UI/Switch/Switch.vue";
import Select from "../UI/Input/Select.vue";
import Accordion from "../UI/Accordion/Accordion.vue";
import Button from "../UI/Button/Button.vue";

const props = defineProps<{
    clip: Clip;
    properties: PluginPropertyDefinition[] | undefined;
}>();

const clipData = computed(() => props.clip.data || {});

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
    return groupedProperties.value.findIndex(g => g.name !== '');
});

const plugin = computed(() => {
    return pluginRegistry.get(props.clip.type as PluginId);
});

const getValue = (key: string) => {
    return clipData.value[key];
};

const getPropId = (prop: PluginPropertyDefinition) => {
    return `${props.clip.id}-${prop.key}`;
};

const shouldShow = (prop: PluginPropertyDefinition) => {
    if (prop.showIf) {
        return prop.showIf(clipData.value);
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
    const newData = { ...clipData.value, [key]: value };
    applyUpdate(newData);
};

const updateVector = (key: string, axis: string, value: number) => {
    const prop = safeProperties.value.find(p => p.key === key);
    let defaultVector: any = { x: 0, y: 0 };
    if (prop?.type === 'vector3') defaultVector = { x: 0, y: 0, z: 0 };
    if (prop?.type === 'vector4') defaultVector = { x: 0, y: 0, z: 0, w: 0 };

    const currentVector = clipData.value[key] || defaultVector;
    const newVector = { ...currentVector, [axis]: value };
    updateProperty(key, newVector);
};

const applyUpdate = (newData: any) => {
    editorEngine.updateClip(props.clip.id, { data: newData });

    globalEventBus.emit({
        type: EditorEventType.PLUGIN_PROPERTY_CHANGED,
        payload: { clipId: props.clip.id },
    });
};
</script>
