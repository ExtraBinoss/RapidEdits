<script setup lang="ts">
import { ref, computed } from "vue";
import { Trash2 } from "lucide-vue-next";
import type { Track } from "../../../../types/Timeline";
import ContextMenu from "../../../UI/ContextMenu/ContextMenu.vue";
import type { ContextMenuItem } from "../../../UI/ContextMenu/ContextMenu.vue";
import Popover from "../../../UI/Overlay/Popover.vue";
import ColorInput from "../../../UI/ColorPicker/ColorInput.vue";
import { useProjectStore } from "../../../../stores/projectStore";

const props = defineProps<{
    track: Track;
}>();

const store = useProjectStore();

// --- Context Menu State ---
const showContextMenu = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);

// --- Popover State ---
// We will toggle this programmatically from the Context Menu
const colorPickerPopover = ref<InstanceType<typeof Popover> | null>(null);

// --- Available Colors ---
const trackColors = [
    "#EF4444", // Red
    "#F97316", // Orange
    "#F59E0B", // Amber
    "#84CC16", // Lime
    "#10B981", // Emerald
    "#06B6D4", // Cyan
    "#3B82F6", // Blue
    "#6366F1", // Indigo
    "#8B5CF6", // Violet
    "#EC4899", // Pink
    "#64748B", // Slate
];

const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    contextMenuX.value = e.clientX;
    contextMenuY.value = e.clientY;
    showContextMenu.value = true;
};

const handleOpenColorPicker = () => {
    // Open the color picker popover
    colorPickerPopover.value?.open();
};

const handleColorUpdate = (color: string) => {
    store.updateTrack(props.track.id, { color });
    // Keep popover open or close? Usually good to keep open for quick changes
    // colorPickerPopover.value?.close();
};

const handleDeleteTrack = () => {
    store.removeTrack(props.track.id);
};

const menuItems = computed<ContextMenuItem[]>(() => [
    {
        label: "Change Color",
        action: handleOpenColorPicker,
    },
    { divider: true },
    {
        label: "Delete Track",
        icon: Trash2,
        danger: true,
        action: handleDeleteTrack,
    },
]);
</script>

<template>
    <!-- Use Popover as the root wrapper for the header functionality -->
    <!-- Position it nicely, e.g., bottom-left or bottom-right relative to header -->
    <Popover ref="colorPickerPopover" position="bottom-left" class="block">
        <template #trigger>
            <!-- The Actual Track Header Visual -->
            <div
                class="h-24 border-canvas-border flex flex-col justify-center px-3 text-xs hover:bg-canvas-lighter transition-colors group flex-shrink-0 relative cursor-default select-none"
                :style="
                    track.color
                        ? {
                              borderLeft: `4px solid ${track.color}`,
                              backgroundColor: `${track.color}10`,
                          }
                        : {}
                "
                @contextmenu="handleContextMenu"
            >
                <span class="font-medium text-text-main mb-1 truncate">{{
                    track.name
                }}</span>

                <!-- Tint Background overlay -->
                <div
                    v-if="track.color"
                    class="absolute inset-0 opacity-10 pointer-events-none"
                    :style="{ backgroundColor: track.color }"
                ></div>

                <div
                    class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                    <!-- Placeholder controls -->
                </div>
            </div>
        </template>

        <template #content="{ close }">
            <div class="p-3 w-64 bg-canvas-dark rounded-lg">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-xs font-bold text-text-muted uppercase"
                        >Track Color</span
                    >
                    <button
                        @click="close"
                        class="text-text-muted hover:text-text-main"
                    >
                        <!-- X Icon -->
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <ColorInput
                    :model-value="track.color || '#3B82F6'"
                    @update:model-value="handleColorUpdate"
                />

                <div
                    class="grid grid-cols-6 gap-2 mt-3 pt-3 border-t border-canvas-border"
                >
                    <button
                        v-for="color in trackColors"
                        :key="color"
                        class="w-6 h-6 rounded-full hover:scale-110 transition-transform ring-1 ring-white/10"
                        :style="{ backgroundColor: color }"
                        @click="
                            handleColorUpdate(color);
                            close();
                        "
                    ></button>
                </div>
            </div>
        </template>
    </Popover>

    <!-- Global Context Menu (Teleported) -->
    <Teleport to="body">
        <ContextMenu
            :show="showContextMenu"
            @close="showContextMenu = false"
            :x="contextMenuX"
            :y="contextMenuY"
            :items="menuItems"
        />
    </Teleport>
</template>
