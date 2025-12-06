<script setup lang="ts">
import { ref, computed, h } from "vue";
import { Trash2 } from "lucide-vue-next";
import type { Track } from "../../../../types/Timeline";
import ContextMenu from "../../../UI/ContextMenu/ContextMenu.vue";
import type { ContextMenuItem } from "../../../UI/ContextMenu/ContextMenu.vue";
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

const handleColorUpdate = (color: string) => {
    store.updateTrack(props.track.id, { color });
};

const handleDeleteTrack = () => {
    store.removeTrack(props.track.id);
};

// Submenu Component using Render Function or simple wrapper
const ColorPickerSubmenu = {
    props: ["close"],
    setup(props: any) {
        return () =>
            h("div", { class: "p-3 w-64 bg-canvas-dark" }, [
                h(ColorInput, {
                    modelValue:
                        store.tracks.find((t) => t.id === props.track?.id)
                            ?.color || "#3B82F6",
                    "onUpdate:modelValue": (color: string) =>
                        handleColorUpdate(color),
                }),
                h(
                    "div",
                    {
                        class: "grid grid-cols-6 gap-2 mt-3 pt-3 border-t border-canvas-border",
                    },
                    trackColors.map((color) =>
                        h("button", {
                            class: "w-6 h-6 rounded-full hover:scale-110 transition-transform ring-1 ring-white/10",
                            style: { backgroundColor: color },
                            onClick: () => {
                                handleColorUpdate(color);
                                if (props.close) props.close();
                            },
                        }),
                    ),
                ),
            ]);
    },
};

const menuItems = computed<ContextMenuItem[]>(() => [
    {
        label: "Change Color",
        slots: {
            submenu: ColorPickerSubmenu,
        },
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
