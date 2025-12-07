<script setup lang="ts">
import { ref, watch } from "vue";
import {
    Files,
    Mic,
    Square,
    Trash2,
    Plus,
    Info,
    Settings,
} from "lucide-vue-next";
import Button from "../UI/Button/Button.vue";
import { useSpeechRecognition } from "../../composables/useSpeechRecognition";
import { useWhisper } from "../../composables/useWhisper";
import { MediaType } from "../../types/Media";
import { editorEngine } from "../../core/EditorEngine";
import { createPluginId, PluginCategory } from "../../core/plugins/PluginTypes";
import Drawer from "../UI/Overlay/Drawer.vue";
import Dialog from "../UI/Overlay/Dialog.vue";
import Select from "../UI/Input/Select.vue";
import RangeSlider from "../UI/Slider/RangeSlider.vue";

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
    stop: stopTranscription,
    transcriptionProgress,
    tokensPerSecond,
    device,
    model: whisperModel,
    audioDetails,
} = useWhisper();

const currentFileName = ref<string>("");
const selectedFile = ref<File | null>(null);
const fileDuration = ref(0);
const timeRange = ref<[number, number]>([0, 0]);

const drawerState = ref({
    voice: false,
    transcribe: true,
});

const isWebGpuInfoOpen = ref(false);
const isNerdInfoDialogOpen = ref(false);

const availableModels = [
    { label: "Whisper Tiny (Fastest)", value: "Xenova/whisper-tiny" },
    { label: "Whisper Base (Balanced)", value: "Xenova/whisper-base" },
    { label: "Whisper Small (Better)", value: "Xenova/whisper-small" },
    {
        label: "Whisper Large V3 (Best/Slow)",
        value: "Xenova/whisper-large-v3",
    },
];

const toggleDrawer = (key: keyof typeof drawerState.value) => {
    drawerState.value[key] = !drawerState.value[key];
};

const handleFileUpload = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
        const file = target.files[0];
        selectedFile.value = file;
        currentFileName.value = file.name;

        // Get duration for slider
        const audio = new Audio(URL.createObjectURL(file));
        audio.onloadedmetadata = () => {
            fileDuration.value = audio.duration;
            timeRange.value = [0, audio.duration];
        };
    }
};

const startTranscription = async () => {
    if (selectedFile.value) {
        // Clear previous results to reset UI internal state if needed
        if (whisperResult.value) {
            whisperResult.value = null;
        }

        await transcribeAudio(
            selectedFile.value,
            detectedLanguage.value,
            timeRange.value[0],
            timeRange.value[1],
        );
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

const addToTimeline = (source: "speech" | "whisper" = "speech") => {
    const results = source === "speech" ? speechResults.value : [];

    if (source === "whisper" && whisperResult.value) {
        const track = editorEngine.addTrack("text");
        const startTimeOffset = editorEngine.getCurrentTime();
        const batchItems = [];

        for (const chunk of whisperResult.value.chunks) {
            const assetId = crypto.randomUUID();
            const start = chunk.timestamp[0];
            const end = chunk.timestamp[1];
            const duration = Math.max(0.5, end - start);

            editorEngine.assetSystem.registerAsset({
                id: assetId,
                name: chunk.text,
                type: MediaType.TEXT,
                url: "",
                size: 0,
                createdAt: Date.now(),
                duration: duration,
            });

            const clipStart = startTimeOffset + start;

            batchItems.push({
                assetId: assetId,
                trackId: track.id,
                start: clipStart,
                typeOverride: createPluginId(PluginCategory.Core, "text"),
                extraData: {
                    name: chunk.text,
                    duration: duration,
                    data: {
                        text: chunk.text,
                        fontSize: 50,
                        color: "#ffffff",
                        position: { x: 0, y: 0, z: 0 },
                        rotation: { x: 0, y: 0, z: 0 },
                        scale: { x: 1, y: 1, z: 1 },
                        is3D: true,
                        depth: 5,
                        autoFit: false,
                    },
                },
            });
        }

        if (batchItems.length > 0) {
            editorEngine.addClipsBatch(batchItems);
        }
        return;
    }

    if (results.length === 0) return;

    const track = editorEngine.addTrack("text");
    const startTimeOffset = editorEngine.getCurrentTime();
    const batchItems = [];

    for (const result of results) {
        const assetId = crypto.randomUUID();
        const duration =
            (result.endTimestamp || result.timestamp + 2) - result.timestamp;

        editorEngine.assetSystem.registerAsset({
            id: assetId,
            name: `Subtitle: ${result.transcript.substring(0, 10)}...`,
            type: MediaType.TEXT,
            url: "",
            size: 0,
            createdAt: Date.now(),
            duration: duration,
        });

        const clipStart = startTimeOffset + result.timestamp;

        batchItems.push({
            assetId: assetId,
            trackId: track.id,
            start: clipStart,
            typeOverride: createPluginId(PluginCategory.Core, "text"),
            extraData: {
                name: result.transcript,
                duration: duration,
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
            },
        });
    }

    if (batchItems.length > 0) {
        editorEngine.addClipsBatch(batchItems);
    }
};
</script>

<template>
    <div class="flex flex-col h-full">
        <div class="p-4 border-b border-canvas-border">
            <h2 class="font-semibold text-text-main capitalize mb-2">
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
                    <Select
                        label="Language"
                        :modelValue="detectedLanguage"
                        @update:modelValue="setLanguage"
                        :options="
                            languages.map((l) => ({
                                label: l.name,
                                value: l.code,
                            }))
                        "
                    />

                    <div class="flex gap-2 justify-center">
                        <Button
                            :variant="isListening ? 'danger' : 'primary'"
                            :icon="isListening ? Square : Mic"
                            @click="isListening ? stopSpeech() : startSpeech()"
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

                    <div
                        class="bg-canvas border border-canvas-border rounded-lg p-3 overflow-y-auto min-h-[150px] max-h-[200px] text-sm"
                    >
                        <div
                            v-if="speechResults.length === 0 && !interimResult"
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
                                {{ (res.endTimestamp || 0).toFixed(1) }}s
                            </span>
                            <p class="text-text-main leading-relaxed text-xs">
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

            <!-- Drawer 2: Transcription (Configuration) -->
            <Drawer
                title="Audio Transcription (Config)"
                :isOpen="drawerState.transcribe"
                @toggle="toggleDrawer('transcribe')"
                :icon="Settings"
            >
                <div class="flex flex-col gap-4">
                    <div
                        v-if="!whisperReady"
                        class="bg-canvas-darker p-4 rounded-lg border border-canvas-border flex flex-col gap-2 items-center text-center"
                    >
                        <div class="text-xs text-text-muted mb-2">
                            Model required (~200MB).
                        </div>
                        <Button
                            variant="primary"
                            size="sm"
                            @click="downloadModel"
                            :loading="whisperLoading && !whisperReady"
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
                                :style="{ width: whisperProgress + '%' }"
                            ></div>
                        </div>
                    </div>

                    <div v-else class="flex flex-col gap-4">
                        <!-- Config Section -->
                        <div class="flex gap-2">
                            <Select
                                label="Device"
                                v-model="device"
                                :options="[
                                    { label: 'WebGPU (Fast)', value: 'webgpu' },
                                    { label: 'CPU (Stable)', value: 'cpu' },
                                ]"
                                class="flex-1"
                            />
                            <div class="flex items-end mb-px">
                                <Button
                                    variant="secondary"
                                    class="h-[38px] w-[38px] p-0"
                                    @click="isWebGpuInfoOpen = true"
                                    title="WebGPU Info"
                                >
                                    <Info class="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        <Select
                            label="Model"
                            v-model="whisperModel"
                            :options="availableModels"
                        />

                        <Select
                            label="Language"
                            :modelValue="detectedLanguage"
                            @update:modelValue="setLanguage"
                            :options="
                                languages.map((l) => ({
                                    label: l.name,
                                    value: l.code,
                                }))
                            "
                        />

                        <div
                            class="flex flex-col gap-2 border-t border-canvas-border pt-4"
                        >
                            <label class="text-sm font-medium text-gray-400"
                                >Audio Source</label
                            >
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

                        <div v-if="selectedFile" class="flex flex-col gap-2">
                            <label class="text-sm font-medium text-gray-400"
                                >Time Range (sec)</label
                            >
                            <RangeSlider
                                v-model="timeRange"
                                :min="0"
                                :max="Math.ceil(fileDuration)"
                                :step="0.1"
                            />
                        </div>

                        <Button
                            v-if="selectedFile"
                            variant="primary"
                            size="sm"
                            @click="startTranscription"
                            :disabled="whisperTranscribing"
                            class="w-full mt-2"
                        >
                            {{
                                whisperTranscribing
                                    ? "Transcribing (See Status Bar)..."
                                    : "Start Transcription Job"
                            }}
                        </Button>

                        <!-- Result Actions (Only if result exists) -->
                        <div
                            v-if="whisperResult && !whisperTranscribing"
                            class="mt-4 p-3 bg-canvas-darker rounded border border-canvas-border"
                        >
                            <div
                                class="text-xs text-text-muted mb-2 flex justify-between"
                            >
                                <span>Transcription Ready</span>
                                <span class="text-brand-accent"
                                    >{{
                                        whisperResult.chunks.length
                                    }}
                                    segments</span
                                >
                            </div>
                            <Button
                                variant="primary"
                                :icon="Plus"
                                @click="() => addToTimeline('whisper')"
                                size="sm"
                                class="w-full"
                            >
                                Add {{ whisperResult.chunks.length }} Subs to
                                Timeline
                            </Button>
                            <div
                                class="max-h-20 overflow-y-auto text-[10px] text-text-muted mt-2 border-t border-canvas-border pt-2 italic"
                            >
                                Preview:
                                {{ whisperResult.text.substring(0, 100) }}...
                            </div>
                        </div>
                    </div>
                </div>
            </Drawer>
        </div>

        <Dialog
            :isOpen="isWebGpuInfoOpen"
            title="WebGPU Configuration"
            @close="isWebGpuInfoOpen = false"
        >
            <!-- Simplified content for brevity as request was to clean up sidebar -->
            <p class="text-text-main text-sm">
                WebGPU uses your graphics card for 10x faster transcription.
                Enable <strong>#enable-unsafe-webgpu</strong> in
                <code>chrome://flags</code> if needed.
            </p>
            <template #footer>
                <Button
                    variant="primary"
                    size="md"
                    @click="isWebGpuInfoOpen = false"
                    >Close</Button
                >
            </template>
        </Dialog>
    </div>
</template>
