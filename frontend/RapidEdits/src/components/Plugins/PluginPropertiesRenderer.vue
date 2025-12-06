<template>
    <div class="space-y-4">
        <div v-for="prop in properties" :key="prop.key">
            <div v-if="shouldShow(prop)">
                <label class="block text-xs font-medium text-gray-400 mb-1">
                    {{ prop.label }}
                </label>

                <!-- Text -->
                <textarea
                    v-if="prop.type === 'long-text'"
                    :value="getValue(prop.key)"
                    class="w-full bg-canvas-dark border border-canvas-border rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder-text-muted/50"
                    v-bind="prop.props"
                    @input="
                        (e) =>
                            updateProperty(
                                prop.key,
                                (e.target as HTMLTextAreaElement).value,
                            )
                    "
                ></textarea>

                <Input
                    v-else-if="prop.type === 'text'"
                    type="text"
                    :model-value="getValue(prop.key)"
                    v-bind="prop.props"
                    @update:model-value="(val) => updateProperty(prop.key, val)"
                />

                <!-- Number -->
                <Input
                    v-else-if="prop.type === 'number'"
                    type="number"
                    :model-value="getValue(prop.key)"
                    v-bind="prop.props"
                    @update:model-value="
                        (val) => updateProperty(prop.key, Number(val))
                    "
                />

                <!-- Color -->
                <div
                    v-else-if="prop.type === 'color'"
                    class="flex items-center space-x-2"
                >
                    <div
                        class="relative w-8 h-8 rounded overflow-hidden border border-gray-700"
                    >
                        <input
                            type="color"
                            :value="getValue(prop.key)"
                            class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 m-0 border-0 cursor-pointer"
                            @input="
                                (e) =>
                                    updateProperty(
                                        prop.key,
                                        (e.target as HTMLInputElement).value,
                                    )
                            "
                        />
                    </div>
                    <span class="text-xs text-gray-500 font-mono">
                        {{ getValue(prop.key) }}
                    </span>
                </div>

                <!-- Boolean -->
                <div
                    v-else-if="prop.type === 'boolean'"
                    class="flex items-center mt-1"
                >
                    <input
                        type="checkbox"
                        :checked="getValue(prop.key)"
                        class="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                        @change="
                            (e) =>
                                updateProperty(
                                    prop.key,
                                    (e.target as HTMLInputElement).checked,
                                )
                        "
                    />
                </div>

                <!-- Vector3 -->
                <div
                    v-else-if="prop.type === 'vector3'"
                    class="grid grid-cols-3 gap-2"
                >
                    <div v-for="axis in ['x', 'y', 'z']" :key="axis">
                        <span
                            class="text-[10px] text-gray-500 uppercase block mb-1"
                            >{{ axis }}</span
                        >
                        <Input
                            type="number"
                            :model-value="getValue(prop.key)?.[axis]"
                            @update:model-value="
                                (val) =>
                                    updateVector(prop.key, axis, Number(val))
                            "
                        />
                    </div>
                </div>

                <!-- Select -->
                <select
                    v-else-if="prop.type === 'select'"
                    :value="getValue(prop.key)"
                    class="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
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
            </div>
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

const props = defineProps<{
    clip: Clip;
    properties: PluginPropertyDefinition[];
}>();

const clipData = computed(() => props.clip.data || {});

const getValue = (key: string) => {
    return clipData.value[key];
};

const shouldShow = (prop: PluginPropertyDefinition) => {
    if (prop.showIf) {
        return prop.showIf(clipData.value);
    }
    return true;
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

    // Check if any property changed that affects filmstrip or other plugins
    globalEventBus.emit({
        type: "PLUGIN_PROPERTY_CHANGED",
        payload: { clipId: props.clip.id },
    });
};
</script>
