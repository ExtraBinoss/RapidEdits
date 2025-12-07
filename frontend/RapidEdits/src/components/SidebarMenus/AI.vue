<script setup lang="ts">
import { ref } from "vue";
import {
    Files,
    Mic,
    Square,
    Trash2,
    Plus,
    Info,
} from "lucide-vue-next";
import Button from "../UI/Button/Button.vue";
import { useSpeechRecognition } from "../../composables/useSpeechRecognition";
import { useWhisper } from "../../composables/useWhisper";
import { MediaType } from "../../types/Media";
import { editorEngine } from "../../core/EditorEngine";
import Drawer from "../UI/Overlay/Drawer.vue";
import Dialog from "../UI/Overlay/Dialog.vue";
import Select from "../UI/Input/Select.vue";

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
        selectedFile.value = target.files[0];
        currentFileName.value = target.files[0].name;
    }
};

const startTranscription = async () => {
    if (selectedFile.value) {
        // Clear previous results to reset UI
        if (whisperResult.value) {
            clearResults();
            whisperResult.value = null;
        }
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

const addToTimeline = (source: "speech" | "whisper" = "speech") => {
    const results = source === "speech" ? speechResults.value : [];

    if (source === "whisper" && whisperResult.value) {
        const track = editorEngine.addTrack("text");
        const startTimeOffset = editorEngine.getCurrentTime();

        whisperResult.value.chunks.forEach((chunk) => {
            const assetId = crypto.randomUUID();
            const start = chunk.timestamp[0];
            const end = chunk.timestamp[1];
            const duration = Math.max(0.5, end - start); // Ensure minimum duration

            editorEngine.assetSystem.registerAsset({
                id: assetId,
                name: chunk.text,
                type: MediaType.TEXT, // This is virtual type for asset system
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
                    type: "core:text", // MUST match TextPlugin ID
                    name: chunk.text,
                    data: {
                        text: chunk.text,
                        fontSize: 50, // Matches TextPlugin default
                        color: "#ffffff",
                        position: { x: 0, y: 0, z: 0 },
                        rotation: { x: 0, y: 0, z: 0 },
                        scale: { x: 1, y: 1, z: 1 },
                        is3D: true, // User requested 3D text
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

    const track = editorEngine.addTrack("text");
    const startTimeOffset = editorEngine.getCurrentTime();

    results.forEach((result) => {
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
        editorEngine.addClip(assetId, track.id, clipStart);

        const addedClip = track.clips.find((c) => c.assetId === assetId);
        if (addedClip) {
            editorEngine.updateClip(addedClip.id, {
                type: "core:text",
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
                            {{ isListening ? "Stop Recording" : "Start Recording" }}
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
                            <span class="text-text-muted text-[10px] block mb-1">
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
                            Model required (~30MB). Runs locally in browser.
                        </div>
                        <Button
                            variant="primary"
                            size="sm"
                            @click="downloadModel"
                            :loading="whisperLoading && !whisperReady"
                            :disabled="whisperLoading"
                        >
                            {{
                                whisperLoading ? "Downloading..." : "Download Model"
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

                        <div class="flex gap-2 items-end">
                            <div class="flex-1 min-w-0">
                                <Select
                                    label="Device"
                                    v-model="device"
                                    :options="[
                                        {
                                            label: 'WebGPU (Experimental)',
                                            value: 'webgpu',
                                        },
                                        {
                                            label: 'CPU (Stable)',
                                            value: 'cpu',
                                        },
                                    ]"
                                />
                            </div>
                            <Button
                                variant="secondary"
                                class="h-[38px] w-[38px] flex items-center justify-center mb-px shrink-0"
                                @click="isWebGpuInfoOpen = true"
                            >
                                <Info class="w-4 h-4" />
                            </Button>
                        </div>

                        <Select
                            label="Model"
                            v-model="whisperModel"
                            :options="availableModels"
                        />

                        <div class="flex items-center gap-2 mb-2">
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
                                class="w-full"
                            />
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
                                            <Button
                                                v-if="audioDetails"
                                                variant="ghost"
                                                size="sm"
                                                @click="isNerdInfoDialogOpen = true"
                                                class="text-[10px] text-brand-primary p-0 h-auto"
                                            >
                                                Show Audio/Model Details
                                            </Button>
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
                                        width: transcriptionProgress + '%',
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
                                                            <Button
                                                                variant="danger"
                                                                size="sm"
                                                                :icon="Square"
                                                                @click="stopTranscription"
                                                                class="mt-2 w-full"
                                                            >
                                                                Stop
                                                            </Button>
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
                        <div
                            v-if="
                                whisperResult.text &&
                                (!whisperResult.chunks ||
                                    whisperResult.chunks.length === 0)
                            "
                            class="text-xs text-text-main leading-relaxed whitespace-pre-wrap"
                        >
                            {{ whisperResult.text }}
                            <span
                                v-if="whisperTranscribing"
                                class="inline-block w-1.5 h-3 bg-brand-primary animate-pulse ml-0.5"
                            ></span>
                        </div>

                        <div
                            v-for="(chunk, idx) in whisperResult.chunks"
                            :key="idx"
                            class="mb-2 p-2 bg-canvas-darker rounded hover:bg-canvas-border transition-colors text-xs"
                        >
                            <span
                                class="text-text-muted text-left text-[10px] block mb-1"
                            >
                                {{ chunk.timestamp[0].toFixed(1) }}s -
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

        <Dialog
            :isOpen="isWebGpuInfoOpen"
            title="WebGPU Configuration"
            @close="isWebGpuInfoOpen = false"
        >
            <div class="flex flex-col gap-4">
                <p class="text-base text-text-main">
                    WebGPU provides significantly faster transcription but may
                    require configuration on some systems.
                </p>

                <div
                    class="bg-canvas-darker p-4 rounded border border-canvas-border"
                >
                    <h4 class="font-bold text-sm mb-3 text-brand-primary">
                        Chrome / Edge Flags
                    </h4>
                    <p class="text-sm mb-3 text-text-muted">
                        Go to <code class="bg-black/30 px-1 rounded select-all">chrome://flags</code>
                        and enable:
                    </p>
                    <ul class="list-disc pl-5 text-sm space-y-2 text-text-main">
                        <li>
                            <strong>Vulkan</strong>
                            (Linux, Android): Search for
                            <code class="text-brand-accent select-all">#enable-vulkan</code>
                        </li>
                        <li>
                            <strong>Skia Renderer</strong>:
                            Search for
                            <code class="text-brand-accent select-all"
                                >#pdf-use-skia-renderer</code
                            >
                        </li>
                        <li>
                            <strong>Unsafe WebGPU Support</strong>: Search for
                            <code class="text-brand-accent select-all"
                                >#enable-unsafe-webgpu</code
                            >
                        </li>
                    </ul>
                </div>

                <div class="text-sm text-brand-primary bg-brand-primary/10 p-3 rounded border border-brand-primary/20">
                    <strong>Important:</strong> You must relaunch Chrome for these changes to take effect.
                </div>

                <div class="text-sm text-text-muted italic">
                    If you experience issues or crashes, try switching the Device
                    to <strong>CPU</strong>.
                </div>
            </div>
            <template #footer>
                <Button
                    variant="primary"
                    size="md"
                    @click="isWebGpuInfoOpen = false"
                >
                    Got it
                </Button>
            </template>
        </Dialog>

        <Dialog
            :isOpen="isNerdInfoDialogOpen"
            title="Audio & Model Details"
            @close="isNerdInfoDialogOpen = false"
        >
            <div v-if="audioDetails" class="flex flex-col gap-2 text-sm">
                <p class="text-text-main">
                    <strong class="text-text-muted">Channels:</strong>
                    {{ audioDetails.channels }}
                </p>
                <p class="text-text-main">
                    <strong class="text-text-muted">Sample Rate:</strong>
                    {{ audioDetails.sampleRate }} Hz
                </p>
                <p class="text-text-main">
                    <strong class="text-text-muted">Duration:</strong>
                    {{ audioDetails.duration.toFixed(2) }}s
                </p>
                <p class="text-text-main">
                    <strong class="text-text-muted">Length:</strong>
                    {{ audioDetails.length }} samples
                </p>
                <p
                    class="text-text-main mt-2 pt-2 border-t border-canvas-border"
                >
                    <strong class="text-text-muted">Model:</strong>
                    <code class="text-brand-primary">{{ whisperModel }}</code>
                </p>
            </div>
            <div v-else class="text-text-muted text-sm">
                No audio details available yet. Please transcribe an audio file.
            </div>
            <template #footer>
                <Button
                    variant="primary"
                    size="md"
                    @click="isNerdInfoDialogOpen = false"
                >
                    Close
                </Button>
            </template>
        </Dialog>
    </div>
</template>