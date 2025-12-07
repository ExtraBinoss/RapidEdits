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

const activeTab = ref("media");
const themeStore = useThemeStore();

const tabs = [
    { id: "media", icon: Files, label: "Media" },
    { id: "text", icon: Type, label: "Text" },
    { id: "stickers", icon: Sticker, label: "Stickers" },
    { id: "effects", icon: Wand2, label: "Effects" },
    { id: "transitions", icon: SplitSquareHorizontal, label: "Transitions" },
    { id: "speech", icon: Sparkles, label: "Speech to Text" },
];

const activePlugins = computed(() => {
    let type: "object" | "effect" | "transition" | null = null;
    if (activeTab.value === "text") type = "object";
    // TODO: Distinguish between Text objects and other 3D objects if needed
    if (activeTab.value === "effects") type = "effect";
    if (activeTab.value === "transitions") type = "transition";

    if (!type) return [];
    return pluginRegistry.state.availablePlugins.filter((p) => p.type === type);
});

const addPlugin = (plugin: IPlugin) => {
    const track = editorEngine.addTrack("custom");

    // Generate a unique ID for the asset
    const assetId = crypto.randomUUID();

    // Register Virtual Asset
    editorEngine.assetSystem.registerAsset({
        id: assetId,
        name: plugin.name,
        type: "image",
        url: "",
        size: 0,
        createdAt: Date.now(),
        duration: 5,
    });

    // Add to timeline
    editorEngine.addClip(assetId, track.id, editorEngine.getCurrentTime());

    // Find the newly added clip
    const addedClip = track.clips[track.clips.length - 1];

    if (addedClip) {
        editorEngine.updateClip(addedClip.id, {
            type: plugin.id,
            name: plugin.name,
            data: plugin.createData(),
            duration: 5,
        });
    }
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
                            :key="plugin.id"
                            class="aspect-square bg-canvas border border-canvas-border rounded-lg hover:border-brand-primary hover:bg-canvas-darker cursor-pointer flex flex-col items-center justify-center gap-2 transition-all group"
                            @click="addPlugin(plugin)"
                        >
                            <component
                                :is="plugin.icon || DefaultPluginIcon"
                                class="w-8 h-8 text-text-muted group-hover:text-brand-primary"
                            />
                            <span
                                class="text-xs text-text-muted font-medium group-hover:text-text-main"
                                >{{ plugin.name }}</span
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
