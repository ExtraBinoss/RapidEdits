<template>
    <div class="flex flex-col gap-px">
        <div v-for="(prop, index) in safeProperties" :key="index">
            <template v-if="shouldShow(prop)">
                <!-- Divider -->
                <div v-if="prop.type === 'divider'" class="py-3 px-1">
                    <div class="flex items-center gap-2">
                        <div class="h-px flex-1 bg-canvas-border"></div>
                        <span v-if="prop.label" class="text-[10px] font-bold uppercase tracking-widest text-text-muted/40 whitespace-nowrap">
                            {{ prop.label }}
                        </span>
                        <div class="h-px flex-1 bg-canvas-border"></div>
                    </div>
                </div>

                <!-- Regular Property Wrapper -->
                <div v-else class="group flex items-center gap-2 py-1 px-1 hover:bg-white/[0.02] rounded-sm transition-colors min-h-[32px]">
                    <label
                        :for="getPropId(prop)"
                        class="w-28 shrink-0 text-[11px] font-semibold text-text-muted transition-colors group-hover:text-text-main cursor-default truncate select-none"
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

                        <!-- Vector3 -->
                        <div v-else-if="prop.type === 'vector3'" class="flex gap-1 w-full">
                            <div v-for="axis in ['x', 'y', 'z']" :key="axis" class="relative flex-1 group/axis">
                                <Input
                                    type="number"
                                    class="!pl-4 !pr-1 !py-0 !text-[10px] !font-mono !h-6 !bg-canvas-dark/50"
                                    :model-value="getValue(prop.key)?.[axis]"
                                    @update:model-value="(val) => updateVector(prop.key, axis, Number(val))"
                                >
                                    <template #prepend>
                                        <span class="text-[9px] font-bold text-text-muted/60 uppercase">{{ axis }}</span>
                                    </template>
                                </Input>
                            </div>
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
                    <button
                        class="shrink-0 p-1 text-text-muted/30 hover:text-brand-primary transition-all rounded hover:bg-brand-primary/10"
                        :class="{ 'opacity-0 group-hover:opacity-100': !isModified(prop) }"
                        title="Reset to default"
                        @click="resetProperty(prop)"
                    >
                        <RotateCcw :size="12" />
                    </button>
                </div>
            </template>
        </div>
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
import Divider from "../UI/Divider/Divider.vue";
import TextArea from "../UI/TextArea/TextArea.vue";
import Slider from "../UI/Slider/Slider.vue";
import ColorInput from "../UI/ColorPicker/ColorInput.vue";
import Switch from "../UI/Switch/Switch.vue";
import Select from "../UI/Input/Select.vue";

const props = defineProps<{
    clip: Clip;
    properties: PluginPropertyDefinition[] | undefined;
}>();

const clipData = computed(() => props.clip.data || {});

const safeProperties = computed(() => props.properties ?? []);

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
    const currentVector = clipData.value[key] || { x: 0, y: 0, z: 0 };
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
