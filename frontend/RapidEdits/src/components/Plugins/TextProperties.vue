<template>
    <div class="space-y-4">
        <!-- Text Content -->
        <div>
            <label class="block text-xs font-medium text-gray-400 mb-1"
                >Content</label
            >
            <textarea
                v-model="clipData.text"
                rows="2"
                class="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                @input="update"
            ></textarea>
        </div>

        <!-- Font Size & Color -->
        <div class="grid grid-cols-2 gap-2">
            <div>
                <label class="block text-xs font-medium text-gray-400 mb-1"
                    >Size</label
                >
                <input
                    type="number"
                    v-model.number="clipData.fontSize"
                    step="0.1"
                    class="w-full bg-gray-800 border border-gray-700 rounded p-1 text-sm text-white"
                    @input="update"
                />
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-400 mb-1"
                    >Color</label
                >
                <div class="flex items-center space-x-2">
                    <input
                        type="color"
                        v-model="clipData.color"
                        class="w-8 h-8 bg-transparent border-none cursor-pointer"
                        @input="update"
                    />
                    <span class="text-xs text-gray-500 font-mono">{{
                        clipData.color
                    }}</span>
                </div>
            </div>
        </div>

        <!-- Position -->
        <div class="space-y-2 border-t border-gray-700 pt-2">
            <label class="block text-xs font-medium text-gray-400"
                >Position</label
            >
            <div class="grid grid-cols-3 gap-2">
                <div>
                    <span class="text-[10px] text-gray-500 uppercase">X</span>
                    <input
                        type="number"
                        v-model.number="clipData.position.x"
                        step="10"
                        class="w-full bg-gray-800 border border-gray-700 rounded p-1 text-xs text-white"
                        @input="update"
                    />
                </div>
                <div>
                    <span class="text-[10px] text-gray-500 uppercase">Y</span>
                    <input
                        type="number"
                        v-model.number="clipData.position.y"
                        step="10"
                        class="w-full bg-gray-800 border border-gray-700 rounded p-1 text-xs text-white"
                        @input="update"
                    />
                </div>
                <div>
                    <span class="text-[10px] text-gray-500 uppercase">Z</span>
                    <input
                        type="number"
                        v-model.number="clipData.position.z"
                        step="10"
                        class="w-full bg-gray-800 border border-gray-700 rounded p-1 text-xs text-white"
                        @input="update"
                    />
                </div>
            </div>
        </div>

        <!-- Extrusion (3D) -->
        <div
            class="flex items-center justify-between pt-2 border-t border-gray-700"
        >
            <label class="text-xs font-medium text-gray-400"
                >3D Extrusion</label
            >
            <input
                type="checkbox"
                v-model="clipData.is3D"
                class="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                @change="update"
            />
        </div>
        <div v-if="clipData.is3D" class="space-y-2">
            <div>
                <label class="block text-xs font-medium text-gray-400 mb-1"
                    >Depth</label
                >
                <input
                    type="number"
                    v-model.number="clipData.depth"
                    step="1"
                    class="w-full bg-gray-800 border border-gray-700 rounded p-1 text-sm text-white"
                    @input="update"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Clip } from "../../types/Timeline";
import { editorEngine } from "../../core/EditorEngine";

const props = defineProps<{
    clip: Clip;
}>();

// Create a reactive reference to the clip's data
// We assume props.clip.data is already initialized by the plugin
const clipData = computed(() => props.clip.data!);

const update = () => {
    // Trigger an update in the engine to refresh the renderer
    // We can do a shallow update or just emit an event
    // For now, let's force a property update notification
    editorEngine.updateClip(props.clip.id, { data: { ...clipData.value } });
};
</script>
