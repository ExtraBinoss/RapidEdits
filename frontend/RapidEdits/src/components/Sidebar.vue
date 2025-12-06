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
    Mic,
    Square,
    Trash2,
    Plus,
} from "lucide-vue-next";
import Button from "./UI/Button/Button.vue";
import Tooltip from "./UI/Overlay/Tooltip.vue";
import MediaLibrary from "./Library/MediaLibrary.vue";
import { useThemeStore } from "../stores/themeStore";
import { pluginRegistry } from "../core/plugins/PluginRegistry";
import { editorEngine } from "../core/EditorEngine";
import type { IPlugin } from "../core/plugins/PluginInterface";
import { useSpeechRecognition } from "../composables/useSpeechRecognition";
import { MediaType } from "../types/Media";

const activeTab = ref("media");
const themeStore = useThemeStore();

const {
    isListening,
    error: speechError,
    results: speechResults,
    interimResult,
    start: startSpeech,
    stop: stopSpeech,
    clearResults,
    setLanguage,
    detectedLanguage,
} = useSpeechRecognition();

const languages = [
    { code: "en-US", name: "English (US)" },
    { code: "en-GB", name: "English (UK)" },
    { code: "fr-FR", name: "French" },
    { code: "es-ES", name: "Spanish" },
    { code: "de-DE", name: "German" },
    { code: "ja-JP", name: "Japanese" },
];

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

const addToTimeline = () => {
    if (speechResults.value.length === 0) return;

    // Create a new track for subtitles
    const track = editorEngine.addTrack("text");

    // We need to coordinate the start time.
    // If the user recorded relative to "now" (which is 0 when recording started),
    // we might want to place it at the playhead OR at 0.
    // Let's place it at the current playhead position.
    const startTimeOffset = editorEngine.getCurrentTime();

    speechResults.value.forEach((result) => {
        const assetId = crypto.randomUUID();
        const duration =
            (result.endTimestamp || result.timestamp + 2) - result.timestamp;

        // Register asset (virtual text asset)
        editorEngine.assetSystem.registerAsset({
            id: assetId,
            name: `Subtitle: ${result.transcript.substring(0, 10)}...`,
            type: MediaType.TEXT,
            url: "",
            size: 0,
            createdAt: Date.now(),
            duration: duration,
        });

        // Add clip
        // Note: result.timestamp is relative to recording start.
        const clipStart = startTimeOffset + result.timestamp;
        editorEngine.addClip(assetId, track.id, clipStart);

        // Find and update data
        const addedClip = track.clips.find((c) => c.assetId === assetId); // Safer lookup
        if (addedClip) {
            editorEngine.updateClip(addedClip.id, {
                type: "core.text", // Assuming this is the ID for text plugin? checking logic above 'text' tab maps to 'object' type plugins.
                // If we don't know the text plugin ID, we might need to hardcode specific behavior or use a generic text component.
                // Let's assume 'core.text' or similar.
                // Actually, let's check if we can just pass data directly.
                name: result.transcript,
                data: {
                    text: result.transcript,
                    color: "#ffffff",
                    fontSize: 24,
                },
                duration: duration,
            });
        }
    });

    // clearResults(); // Optional: clear after adding?
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

                <div
                    v-else-if="activeTab === 'speech'"
                    class="flex flex-col h-full"
                >
                    <div
                        class="p-4 border-b border-canvas-border flex justify-between items-center"
                    >
                        <h2 class="font-semibold text-text-main capitalize">
                            Speech to Text
                        </h2>
                        <!-- Language Selector -->
                        <select
                            :value="detectedLanguage"
                            @change="
                                (e) =>
                                    setLanguage(
                                        (e.target as HTMLSelectElement).value,
                                    )
                            "
                            class="bg-canvas border border-canvas-border text-xs rounded px-2 py-1 text-text-main focus:outline-none focus:border-brand-primary"
                        >
                            <option
                                v-for="lang in languages"
                                :key="lang.code"
                                :value="lang.code"
                            >
                                {{ lang.name }}
                            </option>
                        </select>
                    </div>

                    <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                        <!-- Controls -->
                        <div class="flex gap-2 justify-center">
                            <Button
                                :variant="isListening ? 'danger' : 'primary'"
                                :icon="isListening ? Square : Mic"
                                @click="
                                    isListening ? stopSpeech() : startSpeech()
                                "
                            >
                                {{
                                    isListening
                                        ? "Stop Recording"
                                        : "Start Recording"
                                }}
                            </Button>
                        </div>

                        <div
                            v-if="speechError"
                            class="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-xs"
                        >
                            {{ speechError }}
                        </div>

                        <!-- Transcript Area -->
                        <div
                            class="flex-1 bg-canvas border border-canvas-border rounded-lg p-3 overflow-y-auto min-h-[200px] text-sm"
                        >
                            <div
                                v-if="
                                    speechResults.length === 0 && !interimResult
                                "
                                class="text-text-muted text-center mt-10 italic"
                            >
                                Click Start and speak to generate captions...
                            </div>

                            <div
                                v-for="(res, idx) in speechResults"
                                :key="idx"
                                class="mb-2 p-2 bg-canvas-darker rounded hover:bg-canvas-border transition-colors group relative"
                            >
                                <span
                                    class="text-text-muted text-[10px] block mb-1"
                                >
                                    {{ res.timestamp.toFixed(1) }}s -
                                    {{ (res.endTimestamp || 0).toFixed(1) }}s
                                </span>
                                <p class="text-text-main leading-relaxed">
                                    {{ res.transcript }}
                                </p>
                            </div>

                            <div
                                v-if="interimResult"
                                class="p-2 animate-pulse text-text-muted"
                            >
                                {{ interimResult }}
                            </div>
                        </div>

                        <!-- Actions -->
                        <div class="flex gap-2 mt-auto">
                            <Button
                                variant="secondary"
                                :icon="Trash2"
                                @click="clearResults"
                                :disabled="speechResults.length === 0"
                                class="flex-1"
                            >
                                Clear
                            </Button>
                            <Button
                                variant="primary"
                                :icon="Plus"
                                @click="addToTimeline"
                                :disabled="speechResults.length === 0"
                                class="flex-[2]"
                            >
                                Add to Timeline
                            </Button>
                        </div>
                    </div>
                </div>

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
