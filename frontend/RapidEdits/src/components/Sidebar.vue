<script setup lang="ts">
import { ref } from "vue";
import {
    Files,
    Type,
    Wand2,
    Music,
    Sticker,
    SplitSquareHorizontal,
} from "lucide-vue-next";
import Button from "./UI/Button.vue";
import Tooltip from "./UI/Tooltip.vue";

const activeTab = ref("media");

const tabs = [
    { id: "media", icon: Files, label: "Media" },
    { id: "audio", icon: Music, label: "Audio" },
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
            </div>

            <!-- Content Panel -->
            <div class="flex-1 flex flex-col min-w-0 bg-canvas-light">
                <div class="p-4 border-b border-canvas-border">
                    <h2 class="font-semibold text-text-main capitalize">
                        {{ activeTab }}
                    </h2>
                </div>

                <!-- Media Import Area (Placeholder) -->
                <div
                    v-if="activeTab === 'media'"
                    class="p-4 flex flex-col gap-4 overflow-y-auto"
                >
                    <button
                        class="w-full py-8 border-2 border-dashed border-canvas-border hover:border-brand-primary hover:bg-brand-primary/5 rounded-lg flex flex-col items-center justify-center gap-2 transition-all group text-text-muted hover:text-brand-primary"
                    >
                        <div
                            class="p-3 bg-canvas rounded-full group-hover:bg-brand-primary/10 transition-colors"
                        >
                            <Files :size="24" />
                        </div>
                        <span class="text-sm font-medium">Import Media</span>
                    </button>

                    <div class="grid grid-cols-2 gap-2">
                        <div
                            class="aspect-video bg-canvas rounded-md overflow-hidden relative group cursor-pointer border border-transparent hover:border-brand-primary"
                        >
                            <img
                                src="https://picsum.photos/200/300"
                                class="w-full h-full object-cover opacity-50 group-hover:opacity-80 transition-opacity"
                            />
                            <span
                                class="absolute bottom-1 right-1 text-[10px] text-white bg-black/70 px-1 rounded"
                                >00:15</span
                            >
                        </div>
                        <div
                            class="aspect-video bg-canvas rounded-md overflow-hidden relative group cursor-pointer border border-transparent hover:border-brand-primary"
                        >
                            <div
                                class="w-full h-full bg-gradient-to-br from-canvas-lighter to-canvas-border"
                            ></div>
                            <span
                                class="absolute bottom-1 right-1 text-[10px] text-white bg-black/70 px-1 rounded"
                                >00:05</span
                            >
                        </div>
                    </div>
                </div>

                <div
                    v-else
                    class="flex-1 flex items-center justify-center text-text-muted text-sm"
                >
                    {{ activeTab }} content coming soon
                </div>
            </div>
        </div>
    </div>
</template>
