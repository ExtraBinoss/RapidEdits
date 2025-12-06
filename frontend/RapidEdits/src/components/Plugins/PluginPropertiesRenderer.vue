<template>
    <div class="space-y-5">
        <div v-for="(prop, index) in properties" :key="index">
            <template v-if="shouldShow(prop)">
                <!-- Divider -->
                <div v-if="prop.type === 'divider'" class="py-2">
                    <Divider orientation="horizontal" />
                </div>

                <!-- Regular Property Wrapper -->
                <div v-else class="group">
                    <label
                        class="block text-xs font-medium text-text-muted mb-1.5 transition-colors group-hover:text-text-main"
                    >
                        {{ prop.label }}
                    </label>

                    <!-- Text / Long Text -->
                    <div
                        v-if="prop.type === 'text' || prop.type === 'long-text'"
                    >
                        <TextArea
                            v-if="prop.type === 'long-text'"
                            :model-value="getValue(prop.key)"
                            v-bind="prop.props"
                            @update:model-value="
                                (val) => updateProperty(prop.key, val)
                            "
                        />
                        <Input
                            v-else
                            type="text"
                            :model-value="getValue(prop.key)"
                            v-bind="prop.props"
                            @update:model-value="
                                (val) => updateProperty(prop.key, val)
                            "
                        />
                    </div>

                    <!-- Number / Slider -->
                    <div
                        v-else-if="
                            prop.type === 'number' || prop.type === 'slider'
                        "
                    >
                        <Slider
                            v-if="prop.type === 'slider'"
                            :model-value="getValue(prop.key)"
                            v-bind="prop.props"
                            @update:model-value="
                                (val) => updateProperty(prop.key, val)
                            "
                        />
                        <Input
                            v-else
                            type="number"
                            :model-value="getValue(prop.key)"
                            v-bind="prop.props"
                            @update:model-value="
                                (val) => updateProperty(prop.key, Number(val))
                            "
                        />
                    </div>

                    <!-- Color -->
                    <ColorInput
                        v-else-if="prop.type === 'color'"
                        :model-value="getValue(prop.key)"
                        @update:model-value="
                            (val) => updateProperty(prop.key, val)
                        "
                    />

                    <!-- Boolean (Switch) -->
                    <Switch
                        v-else-if="prop.type === 'boolean'"
                        :model-value="getValue(prop.key)"
                        @update:model-value="
                            (val) => updateProperty(prop.key, val)
                        "
                    />

                    <!-- Vector3 -->
                    <div
                        v-else-if="prop.type === 'vector3'"
                        class="grid grid-cols-3 gap-2"
                    >
                        <div
                            v-for="axis in ['x', 'y', 'z']"
                            :key="axis"
                            class="relative group/axis"
                        >
                            <span
                                class="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-text-muted uppercase transition-colors group-focus-within/axis:text-brand-primary"
                                >{{ axis }}</span
                            >
                            <Input
                                type="number"
                                class="pl-4 text-xs font-mono"
                                :model-value="getValue(prop.key)?.[axis]"
                                @update:model-value="
                                    (val) =>
                                        updateVector(
                                            prop.key,
                                            axis,
                                            Number(val),
                                        )
                                "
                            />
                        </div>
                    </div>

                    <!-- Select -->
                    <div v-else-if="prop.type === 'select'" class="relative">
                        <select
                            :value="getValue(prop.key)"
                            class="w-full appearance-none bg-canvas-dark border border-canvas-border rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-transparent transition-all cursor-pointer"
                            @change="
                                (e) =>
                                    updateProperty(
                                        prop.key,
                                        (e.target as HTMLSelectElement).value,
                                    )
                            "
                        >
                            <option
                                v-for="opt in prop.options"
                                :key="opt.value"
                                :value="opt.value"
                            >
                                {{ opt.label }}
                            </option>
                        </select>
                        <div
                            class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-text-muted"
                        >
                            <svg
                                class="fill-current h-4 w-4"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                            >
                                <path
                                    d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"
                                />
                            </svg>
                        </div>
                    </div>
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
import Input from "../UI/Input/Input.vue";
import Divider from "../UI/Divider/Divider.vue";
import TextArea from "../UI/TextArea/TextArea.vue";
import Slider from "../UI/Slider/Slider.vue";
import ColorInput from "../UI/ColorPicker/ColorInput.vue";
import Switch from "../UI/Switch/Switch.vue";

const props = defineProps<{
    clip: Clip;
    properties: PluginPropertyDefinition[];
}>();

const clipData = computed(() => props.clip.data || {});

const getValue = (key: string) => {
    // Should probably support nested keys eventually, but for now flat
    return clipData.value[key];
};

const shouldShow = (prop: PluginPropertyDefinition) => {
    if (prop.showIf) {
        return prop.showIf(clipData.value);
    }
    return true;
};

const updateProperty = (key: string, value: any) => {
    // If it's a color input text, ensure we handle the # prefix
    if (
        typeof value === "string" &&
        value.length === 7 &&
        value.startsWith("#")
    ) {
        // already good
    } else if (
        typeof value === "string" &&
        value.length === 6 &&
        !value.startsWith("#")
    ) {
        // handle case where user deletes # in input
        // Assuming this logic is inside specific component usually, but here we can be safe
    }

    // For now simple update
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
        type: "PLUGIN_PROPERTY_CHANGED",
        payload: { clipId: props.clip.id },
    });
};
</script>
