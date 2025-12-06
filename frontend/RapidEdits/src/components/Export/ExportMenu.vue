<template>
    <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
        <div
            class="bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
        >
            <!-- Header -->
            <div
                class="px-6 py-4 border-b border-gray-700 flex justify-between items-center shrink-0"
            >
                <h3 class="text-lg font-medium text-white">Export Video</h3>
                <button
                    @click="close"
                    class="text-gray-400 hover:text-white"
                    :disabled="isExporting"
                >
                    <component :is="XIcon" class="w-5 h-5" />
                </button>
            </div>

            <!-- Content -->
            <div class="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                <!-- Config Form -->
                <div v-if="!isExporting && !isDone" class="space-y-4">
                    <!-- Resolution -->
                    <Select
                        v-model="config.resolution"
                        label="Resolution"
                        :options="resolutionOptions"
                    />

                    <!-- FPS -->
                    <Select
                        v-model="config.fps"
                        label="Frame Rate"
                        :options="fpsOptions"
                    />

                    <!-- Codec / Format -->
                    <Select
                        v-model="config.format"
                        label="Format / Codec"
                        :options="formatOptions"
                    />

                    <!-- Bitrate -->
                    <div>
                        <div class="flex justify-between items-center mb-1">
                            <label
                                class="block text-sm font-medium text-gray-400"
                                >Bitrate</label
                            >
                            <span class="text-sm text-blue-400 font-mono"
                                >{{
                                    (config.bitrate / 1_000_000).toFixed(1)
                                }}
                                Mbps</span
                            >
                        </div>

                        <input
                            type="range"
                            v-model.number="config.bitrate"
                            min="2000000"
                            max="50000000"
                            step="500000"
                            class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <p class="text-xs text-gray-500 mt-1">
                            Recommended for {{ config.resolution }}:
                            {{ getRecommendedBitrateText() }}
                        </p>
                    </div>
                </div>

                <!-- Progress View -->
                <div v-else class="text-center py-4">
                    <div
                        v-if="error"
                        class="text-red-400 mb-4 bg-red-900/20 p-4 rounded border border-red-500/30"
                    >
                        <p class="font-medium text-red-300">Export Failed</p>
                        <p class="text-sm opacity-80 mt-1">{{ error }}</p>
                    </div>

                    <div v-else>
                        <div
                            class="relative w-32 h-32 mx-auto mb-6 flex items-center justify-center"
                        >
                            <div
                                class="border-4 border-gray-700 rounded-full w-full h-full"
                            ></div>
                            <div
                                class="border-4 border-blue-500 rounded-full w-full h-full absolute top-0 left-0 border-t-transparent animate-spin-slow"
                                v-if="!isDone"
                            ></div>

                            <div class="absolute flex flex-col items-center">
                                <span
                                    class="text-3xl font-bold text-white tracking-tighter"
                                    v-if="!isDone"
                                    >{{ progress }}%</span
                                >
                                <component
                                    :is="CheckIcon"
                                    class="w-12 h-12 text-green-500"
                                    v-if="isDone"
                                />
                            </div>
                        </div>

                        <p class="text-white font-medium text-lg mb-1">
                            {{ statusText }}
                        </p>

                        <!-- Stats -->
                        <div
                            v-if="!isDone && stats.totalFrames > 0"
                            class="flex justify-center gap-6 mt-4 text-xs text-gray-400 bg-gray-800/50 py-2 rounded-lg mx-4"
                        >
                            <div class="flex flex-col">
                                <span
                                    class="uppercase tracking-wider font-semibold opacity-60"
                                    >Frames</span
                                >
                                <span class="font-mono text-gray-200"
                                    >{{ stats.currentFrame }} /
                                    {{ stats.totalFrames }}</span
                                >
                            </div>
                            <div
                                class="flex flex-col border-l border-gray-700 pl-6"
                            >
                                <span
                                    class="uppercase tracking-wider font-semibold opacity-60"
                                    >Time Left</span
                                >
                                <span class="font-mono text-gray-200">{{
                                    stats.timeLeft
                                }}</span>
                            </div>
                        </div>

                        <p v-if="isDone" class="text-green-400 text-sm mt-2">
                            Download started automatically.
                        </p>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div
                class="px-6 py-4 bg-gray-800/50 flex justify-end space-x-3 shrink-0 border-t border-gray-700"
            >
                <button
                    v-if="!isExporting || isDone"
                    @click="close"
                    class="px-4 py-2 rounded text-gray-300 hover:text-white hover:bg-gray-700 transition font-medium text-sm"
                >
                    {{ isDone ? "Close" : "Cancel" }}
                </button>

                <button
                    v-if="!isExporting && !isDone"
                    @click="startExport"
                    class="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition flex items-center space-x-2 text-sm shadow-lg shadow-blue-900/20"
                >
                    <span>Start Export</span>
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from "vue";
import { X as XIcon, Check as CheckIcon } from "lucide-vue-next";
import { exportService } from "../../core/export/ExportService";
import Select from "../UI/Input/Select.vue";

const props = defineProps<{
    modelValue: boolean;
}>();

const emit = defineEmits(["update:modelValue"]);

const isOpen = ref(true);

const isExporting = ref(false);
const isDone = ref(false);
const progress = ref(0);
const statusText = ref("");
const error = ref<string | null>(null);

const stats = reactive({
    currentFrame: 0,
    totalFrames: 0,
    startTime: 0,
    timeLeft: "--:--",
});

const config = reactive({
    resolution: "1080p",
    fps: 30, // Default to 30 as requested
    bitrate: 15_000_000,
    format: "mp4",
});

const resolutionOptions = [
    { label: "HD (1280x720)", value: "720p" },
    { label: "Full HD (1920x1080)", value: "1080p" },
    { label: "4K (3840x2160)", value: "4k" },
];

const fpsOptions = [
    { label: "24 FPS", value: 24, subLabel: "Cinematic" },
    { label: "30 FPS", value: 30, subLabel: "Standard" },
    { label: "60 FPS", value: 60, subLabel: "Smooth" },
];

const formatOptions = [
    { label: "MP4 (H.264)", value: "mp4", subLabel: "Universal Compatibility" },
    { label: "WebM (VP9)", value: "webm", subLabel: "Web Optimized" },
];

const getRecommendedBitrateText = () => {
    if (config.resolution === "4k") return "35-45 Mbps";
    if (config.resolution === "1080p") return "12-16 Mbps";
    return "5-8 Mbps";
};

const close = () => {
    if (isExporting.value && !isDone.value) {
        if (!confirm("Stop export?")) return;
        exportService.cancel();
    }
    emit("update:modelValue", false);
    setTimeout(() => {
        isExporting.value = false;
        isDone.value = false;
        error.value = null;
        progress.value = 0;
    }, 200);
};

const formatTime = (ms: number) => {
    if (!Number.isFinite(ms)) return "--:--";
    const seconds = Math.ceil(ms / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
};

const startExport = async () => {
    isExporting.value = true;
    isDone.value = false;
    error.value = null;
    progress.value = 0;
    statusText.value = "Initializing...";

    stats.currentFrame = 0;
    stats.totalFrames = 0;
    stats.startTime = Date.now();
    stats.timeLeft = "Calculating...";

    let width = 1920;
    let height = 1080;

    switch (config.resolution) {
        case "720p":
            width = 1280;
            height = 720;
            break;
        case "1080p":
            width = 1920;
            height = 1080;
            break;
        case "4k":
            width = 3840;
            height = 2160;
            break;
    }

    try {
        await exportService.exportVideo(
            {
                width,
                height,
                fps: config.fps,
                bitrate: config.bitrate,
                format: config.format as "mp4" | "webm",
            },
            (p: number, status: string) => {
                progress.value = p;
                statusText.value = status;

                // Parse status for stats if possible
                // Basic heuristic: check if status contains "Frame X/Y"
                // Or better: update exportService callback to pass more data?
                // For now, let's parse string or just rely on percentage for rough ETA.
                const now = Date.now();
                const elapsed = now - stats.startTime;
                if (p > 0) {
                    const totalTime = elapsed * (100 / p);
                    const remaining = totalTime - elapsed;
                    stats.timeLeft = formatTime(remaining);
                }
            },
        );
        isDone.value = true;
        stats.timeLeft = "0:00";
        statusText.value = "Export Complete!";
    } catch (e: any) {
        error.value = e.message || "Unknown error";
        statusText.value = "Error";
    } finally {
        isExporting.value = false;
    }
};
</script>

<style scoped>
.animate-spin-slow {
    animation: spin 2s linear infinite;
}
@keyframes spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}
.custom-scrollbar::-webkit-scrollbar {
    width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
}
</style>
