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
import { useWhisper } from "../composables/useWhisper";
import { MediaType } from "../types/Media";
import Drawer from "./UI/Overlay/Drawer.vue";

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

const {
    isModelLoading: whisperLoading,
    isModelReady: whisperReady,
    isTranscribing: whisperTranscribing,
    progress: whisperProgress,
    statusMessage: whisperStatus,
    error: whisperError,
    result: whisperResult,
    downloadModel,
    transcribe: transcribeAudio,
    transcriptionProgress,
    tokensPerSecond,
} = useWhisper();

const currentFileName = ref<string>("");
const selectedFile = ref<File | null>(null);

const drawerState = ref({
    voice: true,
    transcribe: false,
});

const toggleDrawer = (key: keyof typeof drawerState.value) => {
    drawerState.value[key] = !drawerState.value[key];
};

const handleFileUpload = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
        selectedFile.value = target.files[0];
        currentFileName.value = target.files[0].name;
    }
};

const startTranscription = async () => {
    if (selectedFile.value) {
        await transcribeAudio(selectedFile.value, detectedLanguage.value);
    }
};

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

const addToTimeline = (source: "speech" | "whisper" = "speech") => {
    const results = source === "speech" ? speechResults.value : [];

    if (source === "whisper" && whisperResult.value) {
        // Convert whisper chunks to format similar to speech results or just add directly
        const track = editorEngine.addTrack("text");
        const startTimeOffset = editorEngine.getCurrentTime();

        whisperResult.value.chunks.forEach((chunk) => {
            const assetId = crypto.randomUUID();
            const start = chunk.timestamp[0];
            const end = chunk.timestamp[1];
            const duration = end - start;

            editorEngine.assetSystem.registerAsset({
                id: assetId,
                name: `Subtitle: ${chunk.text.substring(0, 10)}...`,
                type: MediaType.TEXT,
                url: "",
                size: 0,
                createdAt: Date.now(),
                duration: duration,
            });

            const clipStart = startTimeOffset + start;
            editorEngine.addClip(assetId, track.id, clipStart);

            const addedClip = track.clips.find((c) => c.assetId === assetId);
            if (addedClip) {
                editorEngine.updateClip(addedClip.id, {
                    type: "core.text",
                    name: chunk.text,
                    data: {
                        text: chunk.text,
                        color: "#ffffff",
                        fontSize: 24,
                        position: { x: 0, y: 0, z: 0 },
                        rotation: { x: 0, y: 0, z: 0 },
                        scale: { x: 1, y: 1, z: 1 },
                        is3D: false,
                        depth: 5,
                        autoFit: false,
                    },
                    duration: duration,
                });
            }
        });
        return;
    }

    if (results.length === 0) return;

    // Create a new track for subtitles
    const track = editorEngine.addTrack("text");

    // We need to coordinate the start time.
    // If the user recorded relative to "now" (which is 0 when recording started),
    // we might want to place it at the playhead OR at 0.
    // Let's place it at the current playhead position.
    const startTimeOffset = editorEngine.getCurrentTime();

    results.forEach((result) => {
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
                    position: { x: 0, y: 0, z: 0 },
                    rotation: { x: 0, y: 0, z: 0 },
                    scale: { x: 1, y: 1, z: 1 },
                    is3D: false,
                    depth: 5,
                    autoFit: false,
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
                    <div class="p-4 border-b border-canvas-border">
                        <h2
                            class="font-semibold text-text-main capitalize mb-2"
                        >
                            Speech & Transcription
                        </h2>
                        <div class="text-xs text-text-muted">
                            Create captions from voice or audio files.
                        </div>
                    </div>

                    <div class="flex-1 overflow-y-auto">
                        <!-- Drawer 1: Voiceover -->
                        <Drawer
                            title="Voiceover (Microphone)"
                            :isOpen="drawerState.voice"
                            @toggle="toggleDrawer('voice')"
                            :icon="Mic"
                        >
                            <div class="flex flex-col gap-4">
                                <!-- Language Selector -->
                                <select
                                    :value="detectedLanguage"
                                    @change="
                                        (e: Event) =>
                                            setLanguage(
                                                (e.target as HTMLSelectElement)
                                                    .value,
                                            )
                                    "
                                    class="bg-canvas border border-canvas-border text-xs rounded px-2 py-1 text-text-main focus:outline-none focus:border-brand-primary w-full"
                                >
                                    <option
                                        v-for="lang in languages"
                                        :key="lang.code"
                                        :value="lang.code"
                                    >
                                        {{ lang.name }}
                                    </option>
                                </select>

                                <!-- Controls -->
                                <div class="flex gap-2 justify-center">
                                    <Button
                                        :variant="
                                            isListening ? 'danger' : 'primary'
                                        "
                                        :icon="isListening ? Square : Mic"
                                        @click="
                                            isListening
                                                ? stopSpeech()
                                                : startSpeech()
                                        "
                                        size="sm"
                                        class="w-full"
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
                                    class="bg-canvas border border-canvas-border rounded-lg p-3 overflow-y-auto min-h-[150px] max-h-[200px] text-sm"
                                >
                                    <div
                                        v-if="
                                            speechResults.length === 0 &&
                                            !interimResult
                                        "
                                        class="text-text-muted text-center mt-6 italic text-xs"
                                    >
                                        Click Start and speak...
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
                                            {{
                                                (res.endTimestamp || 0).toFixed(
                                                    1,
                                                )
                                            }}s
                                        </span>
                                        <p
                                            class="text-text-main leading-relaxed text-xs"
                                        >
                                            {{ res.transcript }}
                                        </p>
                                    </div>

                                    <div
                                        v-if="interimResult"
                                        class="p-2 animate-pulse text-text-muted text-xs"
                                    >
                                        {{ interimResult }}
                                    </div>
                                </div>

                                <div class="flex gap-2">
                                    <Button
                                        variant="secondary"
                                        :icon="Trash2"
                                        @click="clearResults"
                                        :disabled="speechResults.length === 0"
                                        size="sm"
                                        class="flex-1"
                                    >
                                        Clear
                                    </Button>
                                    <Button
                                        variant="primary"
                                        :icon="Plus"
                                        @click="() => addToTimeline('speech')"
                                        :disabled="speechResults.length === 0"
                                        size="sm"
                                        class="flex-[2]"
                                    >
                                        Add to Timeline
                                    </Button>
                                </div>
                            </div>
                        </Drawer>

                        <!-- Drawer 2: Transcription -->
                        <Drawer
                            title="Audio Transcription (File)"
                            :isOpen="drawerState.transcribe"
                            @toggle="toggleDrawer('transcribe')"
                            :icon="Files"
                        >
                            <div class="flex flex-col gap-4">
                                <div
                                    v-if="!whisperReady"
                                    class="bg-canvas-darker p-4 rounded-lg border border-canvas-border flex flex-col gap-2 items-center text-center"
                                >
                                    <div class="text-xs text-text-muted mb-2">
                                        Model required (~30MB). Runs locally in
                                        browser.
                                    </div>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        @click="downloadModel"
                                        :loading="
                                            whisperLoading && !whisperReady
                                        "
                                        :disabled="whisperLoading"
                                    >
                                        {{
                                            whisperLoading
                                                ? "Downloading..."
                                                : "Download Model"
                                        }}
                                    </Button>

                                    <div
                                        v-if="whisperLoading"
                                        class="w-full h-1 bg-canvas-border rounded-full mt-2 overflow-hidden"
                                    >
                                        <div
                                            class="h-full bg-brand-primary transition-all duration-300"
                                            :style="{
                                                width: whisperProgress + '%',
                                            }"
                                        ></div>
                                    </div>
                                    <span
                                        v-if="whisperStatus"
                                        class="text-[10px] text-text-muted"
                                        >{{ whisperStatus }}</span
                                    >
                                </div>

                                <div v-else class="flex flex-col gap-4">
                                    <div
                                        class="bg-green-500/10 border border-green-500/20 text-green-500 text-xs p-2 rounded text-center"
                                    >
                                        Model Loaded & Ready
                                    </div>

                                    <div class="flex items-center gap-2">
                                        <!-- Shared Language Selector for File Transcription too -->
                                        <select
                                            :value="detectedLanguage"
                                            @change="
                                                (e: Event) =>
                                                    setLanguage(
                                                        (
                                                            e.target as HTMLSelectElement
                                                        ).value,
                                                    )
                                            "
                                            class="bg-canvas border border-canvas-border text-xs rounded px-2 py-1 text-text-main focus:outline-none focus:border-brand-primary w-full mb-2"
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

                                    <div class="flex flex-col gap-2">
                                        <input
                                            type="file"
                                            accept="audio/*,video/*"
                                            class="block w-full text-xs text-text-muted file:mr-2 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-brand-primary/10 file:text-brand-accent hover:file:bg-brand-primary/20 cursor-pointer"
                                            @change="handleFileUpload"
                                            :disabled="whisperTranscribing"
                                        />
                                        <div
                                            v-if="currentFileName"
                                            class="text-[10px] text-text-muted truncate px-1"
                                        >
                                            Selected: {{ currentFileName }}
                                        </div>
                                    </div>

                                    <Button
                                        v-if="
                                            selectedFile &&
                                            !whisperTranscribing &&
                                            !whisperResult
                                        "
                                        variant="primary"
                                        size="sm"
                                        @click="startTranscription"
                                        class="w-full mt-2"
                                    >
                                        Start Transcription
                                    </Button>

                                    <div
                                        v-if="whisperTranscribing"
                                        class="py-4 flex flex-col items-center gap-2 w-full"
                                    >
                                        <div
                                            class="w-full h-1.5 bg-canvas-border rounded-full overflow-hidden"
                                        >
                                            <div
                                                class="h-full bg-brand-primary transition-all duration-300"
                                                :style="{
                                                    width:
                                                        transcriptionProgress +
                                                        '%',
                                                }"
                                            ></div>
                                        </div>
                                        <div
                                            class="flex justify-between w-full text-[10px] text-text-muted"
                                        >
                                            <span>{{ whisperStatus }}</span>
                                            <span
                                                v-if="tokensPerSecond"
                                                class="text-brand-accent"
                                                >{{ tokensPerSecond }} t/s</span
                                            >
                                        </div>
                                    </div>

                                    <Button
                                        v-if="whisperResult"
                                        variant="primary"
                                        :icon="Plus"
                                        @click="() => addToTimeline('whisper')"
                                        size="sm"
                                        class="w-full mt-2"
                                    >
                                        Add to Timeline
                                    </Button>
                                </div>

                                <div
                                    v-if="whisperResult"
                                    class="bg-canvas border border-canvas-border rounded-lg p-3 overflow-y-auto max-h-[200px] text-sm"
                                >
                                    <!-- Streaming Text Support -->
                                    <div
                                        v-if="
                                            whisperResult.text &&
                                            (!whisperResult.chunks ||
                                                whisperResult.chunks.length ===
                                                    0)
                                        "
                                        class="text-xs text-text-main leading-relaxed whitespace-pre-wrap"
                                    >
                                        {{ whisperResult.text }}
                                        <span
                                            v-if="whisperTranscribing"
                                            class="inline-block w-1.5 h-3 bg-brand-primary animate-pulse ml-0.5"
                                        ></span>
                                    </div>

                                    <!-- Chunks Support (if provided later) -->
                                    <div
                                        v-for="(
                                            chunk, idx
                                        ) in whisperResult.chunks"
                                        :key="idx"
                                        class="mb-2 p-2 bg-canvas-darker rounded hover:bg-canvas-border transition-colors text-xs"
                                    >
                                        <span
                                            class="text-text-muted text-left text-[10px] block mb-1"
                                        >
                                            {{ chunk.timestamp[0].toFixed(1) }}s
                                            -
                                            {{ chunk.timestamp[1].toFixed(1) }}s
                                        </span>
                                        {{ chunk.text }}
                                    </div>
                                </div>

                                <div
                                    v-if="whisperError"
                                    class="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-xs"
                                >
                                    {{ whisperError }}
                                </div>
                            </div>
                        </Drawer>
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
