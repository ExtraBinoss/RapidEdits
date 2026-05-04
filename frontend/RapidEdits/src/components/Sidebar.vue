<script setup lang="ts">
import { ref, computed } from "vue";
import {
    Files,
    Type,
    Wand2,
    Sticker,
    SplitSquareHorizontal,
    Sun,
    Moon,
    Sparkles,
    Box as DefaultPluginIcon,
} from "lucide-vue-next";
import Button from "./UI/Button/Button.vue";
import Tooltip from "./UI/Overlay/Tooltip.vue";
import MediaLibrary from "./Library/MediaLibrary.vue";
import { useThemeStore } from "../stores/themeStore";
import { pluginRegistry } from "../core/plugins/PluginRegistry";
import { editorEngine } from "../core/EditorEngine";
import type { IPlugin } from "../core/plugins/PluginInterface";
import AI from "./SidebarMenus/AI.vue";
import { useProjectStore } from "../stores/projectStore";
import { markRaw } from "vue";

import TransitionLibrary from "./Plugins/TransitionLibrary.vue";

const activeTab = ref("media");
const themeStore = useThemeStore();
const projectStore = useProjectStore();

const tabs = [
    { id: "media", icon: Files, label: "Media" },
    { id: "text", icon: Type, label: "Text" },
    { id: "stickers", icon: Sticker, label: "Stickers" },
    { id: "effects", icon: Wand2, label: "Effects" },
    { id: "transitions", icon: SplitSquareHorizontal, label: "Transitions" },
    { id: "speech", icon: Sparkles, label: "AI" },
];

const activePlugins = computed(() => {
    let type: "object" | "effect" | "transition" | null = null;
    if (activeTab.value === "text") type = "object";
    // TODO: Distinguish between Text objects and other 3D objects if needed
    if (activeTab.value === "effects") type = "effect";
    if (activeTab.value === "transitions") type = "transition";

    if (!type) return [];
    return pluginRegistry.state.availablePlugins.filter((p) => {
        const meta = p.getMetadata();
        return meta.type === type && !meta.isGlobalInspector;
    });
});

const addPlugin = (plugin: IPlugin) => {
    const meta = plugin.getMetadata();
    if (meta.isTrackDroppable === false) {
        // Option: we could show a toast "Drag this onto a clip"
        // For now, just silently prevent adding to a new track
        return;
    }

    const track = editorEngine.addTrack("custom");

    // Generate a unique ID for the asset
    const assetId = crypto.randomUUID();

    // Register Virtual Asset
    editorEngine.assetSystem.registerAsset({
        id: assetId,
        name: meta.name,
        type: "text", // Use text type to avoid texture allocation attempts
        url: "",
        size: 0,
        createdAt: Date.now(),
        duration: 5,
    });

    // Add to timeline using Batch to ensure atomic creation with correct Kind/Type
    // This prevents the renderer from trying to treat it as a Media clip for even a single frame
    editorEngine.addClipsBatch([
        {
            assetId: assetId,
            trackId: track.id,
            start: editorEngine.getCurrentTime(),
            extraData: {
                kind: "plugin",
                type: meta.id,
                name: meta.name,
                data: plugin.createData(),
                duration: 5,
            },
        },
    ]);
};

const handlePluginDragStart = (e: DragEvent, plugin: IPlugin) => {
    projectStore.draggedPlugin = markRaw(plugin);
    if (e.dataTransfer) {
        // Track the dragged plugin globally for drop validation
        pluginRegistry.setDraggedPlugin(plugin);

        const meta = plugin.getMetadata();
        const payload = {
            type: "plugin",
            pluginId: meta.id,
            pluginType: meta.type,
            name: meta.name,
        };
        e.dataTransfer.setData("application/json", JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "copy";
    }
};

const handlePluginDragEnd = () => {
    projectStore.draggedPlugin = null;
    pluginRegistry.clearDraggedPlugin();
};
</script>

<template>
    <div
        class="w-80 bg-canvas-light border-r border-canvas-border flex flex-col shrink-0 z-10"
    >
        <div class="flex flex-1 min-h-0">
            <!-- Icon Rail -->
            <div
                class="w-16 flex flex-col items-center py-4 gap-3 border-r border-canvas-border bg-canvas"
            >
                <Tooltip
                    v-for="tab in tabs"
                    :key="tab.id"
                    :text="tab.label"
                    position="right"
                >
                    <Button
                        variant="icon"
                        :icon="tab.icon"
                        :active="activeTab === tab.id"
                        size="lg"
                        @click="activeTab = tab.id"
                    />
                </Tooltip>

                <div class="mt-auto flex flex-col items-center gap-3">
                    <Tooltip
                        :text="themeStore.isDark ? 'Light Mode' : 'Dark Mode'"
                        position="right"
                    >
                        <Button
                            variant="icon"
                            :icon="themeStore.isDark ? Sun : Moon"
                            size="lg"
                            @click="themeStore.toggleTheme"
                        />
                    </Tooltip>
                </div>
            </div>

            <!-- Content Panel -->
            <div class="flex-1 flex flex-col min-w-0 bg-canvas-light">
                <MediaLibrary v-if="activeTab === 'media'" />

                <AI v-else-if="activeTab === 'speech'" />

                <TransitionLibrary 
                    v-else-if="activeTab === 'transitions'" 
                    @add="addPlugin"
                />

                <div v-else class="flex flex-col h-full">
                    <div
                        class="p-4 border-b border-canvas-border flex justify-between items-center"
                    >
                        <h2 class="font-semibold text-text-main capitalize">
                            {{ activeTab }}
                        </h2>
                    </div>

                    <!-- Plugin List -->
                    <div
                        class="p-4 grid grid-cols-2 gap-3 overflow-y-auto custom-scrollbar"
                    >
                        <div
                            v-for="plugin in activePlugins"
                            :key="plugin.getMetadata().id"
                            class="aspect-square bg-canvas border border-canvas-border rounded-lg hover:border-brand-primary hover:bg-canvas-darker flex flex-col items-center justify-center gap-2 transition-all group select-none"
                            :class="
                                plugin.getMetadata().isTrackDroppable !== false
                                    ? 'cursor-pointer'
                                    : 'cursor-grab'
                            "
                            @click="addPlugin(plugin)"
                            draggable="true"
                            @dragstart="
                                handlePluginDragStart(
                                    $event as DragEvent,
                                    plugin,
                                )
                            "
                            @dragend="handlePluginDragEnd"
                        >
                            <component
                                :is="plugin.getMetadata().icon || DefaultPluginIcon"
                                class="w-8 h-8 text-text-muted group-hover:text-brand-primary"
                            />
                            <span
                                class="text-xs text-text-muted font-medium group-hover:text-text-main"
                                >{{ plugin.getMetadata().name }}</span
                            >
                        </div>

                        <div
                            v-if="activePlugins.length === 0"
                            class="col-span-2 py-8 text-center text-text-muted text-xs"
                        >
                            No {{ activeTab }} plugins found.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
