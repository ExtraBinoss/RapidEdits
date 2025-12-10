<template>
    <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
        <div
            class="bg-canvas-light border border-canvas-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] text-text-main"
        >
            <!-- Header -->
            <div
                class="px-8 py-5 border-b border-canvas-border flex justify-between items-center shrink-0"
            >
                <div class="flex items-center space-x-3">
                    <div
                        class="w-10 h-10 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center shadow-lg shadow-brand-primary/20"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-5 w-5 text-white"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path
                                fill-rule="evenodd"
                                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                                clip-rule="evenodd"
                            />
                        </svg>
                    </div>
                    <div>
                        <h3
                            class="text-xl font-bold text-text-main tracking-tight"
                        >
                            Export Video
                        </h3>
                        <p class="text-xs text-text-muted font-medium">
                            Share your creation with the world
                        </p>
                    </div>
                </div>
                <button
                    @click="close"
                    class="text-text-muted hover:text-text-main transition-colors p-2 hover:bg-white/5 rounded-full"
                    :disabled="isExporting && !isDone"
                >
                    <component :is="XIcon" class="w-5 h-5" />
                </button>
            </div>

            <!-- Content -->
            <div class="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                <!-- Config Form -->
                <transition name="fade" mode="out-in">
                    <div
                        v-if="!isExporting && !isDone"
                        class="space-y-6"
                        key="config"
                    >
                        <div class="grid grid-cols-2 gap-5">
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
                        </div>

                        <!-- Codec / Format -->
                        <Select
                            v-model="config.format"
                            label="Format"
                            :options="formatOptions"
                        />

                        <!-- Bitrate -->
                        <div
                            class="bg-canvas-lighter rounded-xl p-5 border border-canvas-border"
                        >
                            <div class="flex justify-between items-end mb-4">
                                <div>
                                    <label
                                        class="block text-sm font-semibold text-text-main mb-1"
                                        >Bitrate Quality</label
                                    >
                                    <p class="text-xs text-text-muted">
                                        Adjust video file size and quality
                                    </p>
                                </div>
                                <span
                                    class="text-lg font-mono font-bold text-brand-accent"
                                    >{{
                                        (config.bitrate / 1_000_000).toFixed(1)
                                    }}
                                    <span
                                        class="text-sm font-medium text-text-muted"
                                        >Mbps</span
                                    ></span
                                >
                            </div>

                            <input
                                type="range"
                                v-model.number="config.bitrate"
                                min="2000000"
                                max="50000000"
                                step="500000"
                                class="w-full h-2 bg-canvas-border rounded-lg appearance-none cursor-pointer accent-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all hover:bg-canvas-border/80"
                            />
                            <div
                                class="flex justify-between items-center mt-3 text-xs"
                            >
                                <span class="text-text-muted">Low</span>
                                <span class="text-brand-accent font-medium"
                                    >Recommended:
                                    {{ getRecommendedBitrateText() }}</span
                                >
                                <span class="text-text-muted">High</span>
                            </div>
                        </div>
                    </div>

                    <!-- Progress View -->
                    <div v-else class="py-2" key="progress">
                        <div
                            v-if="error"
                            class="text-red-400 mb-4 bg-red-500/10 p-5 rounded-xl border border-red-500/20 flex items-start space-x-3"
                        >
                            <div
                                class="bg-red-500/20 p-2 rounded-full shrink-0"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="h-5 w-5 text-red-400"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path
                                        fill-rule="evenodd"
                                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                        clip-rule="evenodd"
                                    />
                                </svg>
                            </div>
                            <div>
                                <p class="font-bold text-red-300 mb-1">
                                    Export Failed
                                </p>
                                <p class="text-sm opacity-80 leading-relaxed">
                                    {{ error }}
                                </p>
                            </div>
                        </div>

                        <div v-else class="space-y-8">
                            <!-- Status Header -->
                            <div class="text-center space-y-2">
                                <div
                                    class="inline-flex items-center justify-center p-3 rounded-full mb-2 transition-all duration-500"
                                    :class="
                                        isDone
                                            ? 'bg-green-500/20 text-green-400'
                                            : 'bg-brand-primary/20 text-brand-primary'
                                    "
                                >
                                    <component
                                        :is="isDone ? CheckIcon : 'svg'"
                                        class="w-8 h-8"
                                        :class="{ 'animate-pulse': !isDone }"
                                    >
                                        <path
                                            v-if="!isDone"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        ></path>
                                    </component>
                                </div>
                                <h4 class="text-2xl font-bold text-text-main">
                                    {{
                                        isDone
                                            ? "Export Complete!"
                                            : "Rendering Video..."
                                    }}
                                </h4>
                                <p class="text-text-muted text-sm">
                                    {{ statusText }}
                                </p>
                            </div>

                            <!-- Progress Bar -->
                            <div class="space-y-2">
                                <div
                                    class="flex justify-between text-xs font-semibold uppercase tracking-wider text-text-muted"
                                >
                                    <span>Progress</span>
                                    <span class="text-text-main"
                                        >{{ progress }}%</span
                                    >
                                </div>
                                <div
                                    class="h-3 bg-canvas-border rounded-full overflow-hidden backdrop-blur-sm shadow-inner"
                                >
                                    <div
                                        class="h-full bg-gradient-to-r from-brand-primary to-brand-secondary transition-all duration-300 ease-out shadow-[0_0_15px_rgba(49,110,160,0.5)]"
                                        :style="{ width: `${progress}%` }"
                                    ></div>
                                </div>
                            </div>

                            <!-- Stats Grid -->
                            <div
                                v-if="!isDone && stats.totalFrames > 0"
                                class="grid grid-cols-2 gap-4"
                            >
                                <div
                                    class="bg-canvas-lighter p-4 rounded-xl border border-canvas-border backdrop-blur-sm"
                                >
                                    <p
                                        class="text-xs text-text-muted uppercase font-bold tracking-wider mb-1"
                                    >
                                        Elapsed Time
                                    </p>
                                    <p
                                        class="text-xl font-mono font-bold text-text-main"
                                    >
                                        {{ stats.elapsedTime }}
                                    </p>
                                </div>
                                <div
                                    class="bg-canvas-lighter p-4 rounded-xl border border-canvas-border backdrop-blur-sm"
                                >
                                    <p
                                        class="text-xs text-text-muted uppercase font-bold tracking-wider mb-1"
                                    >
                                        Estimated Left
                                    </p>
                                    <p
                                        class="text-xl font-mono font-bold text-brand-accent"
                                    >
                                        {{ stats.timeLeft }}
                                    </p>
                                </div>
                                <div
                                    class="bg-canvas-lighter p-4 rounded-xl border border-canvas-border backdrop-blur-sm"
                                >
                                    <p
                                        class="text-xs text-text-muted uppercase font-bold tracking-wider mb-1"
                                    >
                                        Frames
                                    </p>
                                    <p
                                        class="text-lg font-mono font-medium text-text-main"
                                    >
                                        <span
                                            class="text-text-main font-bold"
                                            >{{ stats.currentFrame }}</span
                                        >
                                        <span class="opacity-50 mx-1">/</span
                                        >{{ stats.totalFrames }}
                                    </p>
                                </div>
                                <div
                                    class="bg-canvas-lighter p-4 rounded-xl border border-canvas-border backdrop-blur-sm"
                                >
                                    <p
                                        class="text-xs text-text-muted uppercase font-bold tracking-wider mb-1"
                                    >
                                        Speed
                                    </p>
                                    <p
                                        class="text-lg font-mono font-medium text-text-main"
                                    >
                                        {{ stats.fps }}
                                        <span class="text-xs opacity-60"
                                            >fps</span
                                        >
                                    </p>
                                </div>
                            </div>

                            <!-- Success Actions -->
                            <div
                                v-if="isDone"
                                class="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center space-y-2"
                            >
                                <p class="text-green-400 font-medium text-sm">
                                    Export successfully completed in
                                    <span class="font-bold text-green-300">{{
                                        stats.elapsedTime
                                    }}</span>
                                </p>
                                <p class="text-xs text-text-muted">
                                    File saved as:
                                    <span
                                        class="text-text-main font-mono break-all"
                                        >{{ exportedFilename }}</span
                                    >
                                </p>
                                <p
                                    class="text-xs text-text-muted italic opacity-70"
                                >
                                    Check your browser's downloads folder.
                                </p>
                            </div>
                        </div>
                    </div>
                </transition>
            </div>

            <!-- Footer -->
            <div
                class="px-8 py-5 bg-canvas-light flex justify-end space-x-4 shrink-0 border-t border-canvas-border"
            >
                <button
                    v-if="!isExporting || isDone"
                    @click="close"
                    class="px-5 py-2.5 rounded-lg text-text-muted hover:text-text-main hover:bg-white/5 transition-colors font-medium text-sm"
                >
                    {{ isDone ? "Close" : "Cancel" }}
                </button>

                <button
                    v-if="!isExporting && !isDone"
                    @click="startExport"
                    class="px-8 py-2.5 bg-gradient-to-r from-brand-primary to-brand-secondary hover:brightness-110 text-white rounded-lg font-bold transition-all shadow-lg shadow-brand-primary/25 active:scale-95 flex items-center space-x-2"
                >
                    <span>Start Export</span>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M14 5l7 7m0 0l-7 7m7-7H3"
                        />
                    </svg>
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, onUnmounted } from "vue";
import { X as XIcon, Check as CheckIcon } from "lucide-vue-next";
import { exportService } from "../../core/export/ExportService";
import Select from "../UI/Input/Select.vue";

defineProps<{
    modelValue: boolean;
}>();

const emit = defineEmits(["update:modelValue"]);

const isOpen = ref(true);

const isExporting = ref(false);
const isDone = ref(false);
const progress = ref(0);
const statusText = ref("");
const error = ref<string | null>(null);
const timerInterval = ref<number | null>(null);
const exportedFilename = ref("");

const stats = reactive({
    currentFrame: 0,
    totalFrames: 0,
    startTime: 0,
    elapsedTime: "00:00",
    timeLeft: "--:--",
    fps: 0,
    framesProcessed: 0,
    lastFrameTime: 0,
});

const config = reactive({
    resolution: "1080p",
    fps: 30,
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

const stopTimer = () => {
    if (timerInterval.value) {
        clearInterval(timerInterval.value);
        timerInterval.value = null;
    }
};

const close = () => {
    if (isExporting.value && !isDone.value) {
        if (!confirm("Stop export?")) return;
        exportService.cancel();
    }
    stopTimer();
    emit("update:modelValue", false);
    setTimeout(() => {
        isExporting.value = false;
        isDone.value = false;
        error.value = null;
        progress.value = 0;
    }, 200);
};

const formatTime = (ms: number) => {
    if (!Number.isFinite(ms) || ms < 0) return "--:--";
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
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
    stats.framesProcessed = 0;
    stats.startTime = Date.now();
    stats.lastFrameTime = stats.startTime;
    stats.timeLeft = "Calculating...";
    stats.elapsedTime = "00:00";
    stats.fps = 0;

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

    // Start timer for UI updates
    stopTimer();
    timerInterval.value = window.setInterval(() => {
        const now = Date.now();
        const elapsed = now - stats.startTime;
        stats.elapsedTime = formatTime(elapsed);

        // Calculate instantaneous FPS (avg over last second roughly)
        // This is tricky without exact frame callbacks, but we can estimate
        // from progress if we know total frames.
        // Better: we'll update stats in the callback.
    }, 100); // Faster update for smooth timer

    try {
        const filename = await exportService.exportVideo(
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

                // Try to extract frame info from status string "Rendering Frame X/Y"
                // This is a bit brittle, but effective given current service impl.
                const frameMatch = status.match(/Frame (\d+)\/(\d+)/);
                if (frameMatch) {
                    const current = parseInt(frameMatch[1] || "0");
                    const total = parseInt(frameMatch[2] || "0");

                    stats.currentFrame = current;
                    stats.totalFrames = total;

                    const now = Date.now();
                    const elapsed = now - stats.startTime;

                    if (p > 0) {
                        const totalTime = elapsed * (100 / p);
                        const remaining = totalTime - elapsed;
                        stats.timeLeft = formatTime(remaining);

                        // Calculate Rendering FPS
                        // Frames processed / elapsed seconds
                        if (elapsed > 1000) {
                            stats.fps = Math.round((current / elapsed) * 1000);
                        }
                    }
                }
            },
        );
        isDone.value = true;
        stats.timeLeft = "0:00";
        // Final update
        const now = Date.now();
        stats.elapsedTime = formatTime(now - stats.startTime);
        exportedFilename.value =
            filename || `rapid_edits_export.${config.format}`;
        statusText.value = "Export Complete!";
    } catch (e: any) {
        error.value = e.message || "Unknown error";
        statusText.value = "Error";
    } finally {
        stopTimer();
        isExporting.value = false;
    }
};

onUnmounted(() => {
    stopTimer();
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

.custom-scrollbar::-webkit-scrollbar {
    width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
}
</style>
