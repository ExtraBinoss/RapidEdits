<script setup lang="ts">
import { ref } from "vue";
import {
    Files,
    Type,
    Wand2,
    Sticker,
    SplitSquareHorizontal,
    Sun,
    Moon,
} from "lucide-vue-next";
import Button from "./UI/Button/Button.vue";
import Tooltip from "./UI/Overlay/Tooltip.vue";
import MediaLibrary from "./Library/MediaLibrary.vue";
import { useThemeStore } from "../stores/themeStore";

const activeTab = ref("media");
const themeStore = useThemeStore();

const tabs = [
    { id: "media", icon: Files, label: "Media" },
    { id: "text", icon: Type, label: "Text" },
    { id: "stickers", icon: Sticker, label: "Stickers" },
    { id: "effects", icon: Wand2, label: "Effects" },
    { id: "transitions", icon: SplitSquareHorizontal, label: "Transitions" },
];
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

                <div v-else class="flex flex-col h-full">
                    <div
                        class="p-4 border-b border-canvas-border flex justify-between items-center"
                    >
                        <h2 class="font-semibold text-text-main capitalize">
                            {{ activeTab }}
                        </h2>
                    </div>
                    <div
                        class="flex-1 flex items-center justify-center text-text-muted text-sm"
                    >
                        {{ activeTab }} content coming soon
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
