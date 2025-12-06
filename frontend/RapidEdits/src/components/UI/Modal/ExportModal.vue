<script setup lang="ts">
import { ref } from "vue";
import Button from "../../UI/Button/Button.vue";
import { videoExportService } from "../../../core/services/VideoExportService";

const emit = defineEmits<{
    (e: "close"): void;
}>();

const fps = ref(30);
const format = ref("mp4");
const isExporting = ref(false);
const progress = ref(0);
const status = ref("");

const startExport = async () => {
    isExporting.value = true;
    try {
        // Fixed 1080p for now or customizable?
        // Let's assume 1920x1080
        await videoExportService.exportVideo(
            { width: 1280, height: 720, fps: fps.value, format: format.value },
            (percent, msg) => {
                progress.value = percent;
                status.value = msg;
            },
        );
        // Completed
        emit("close");
    } catch (e) {
        status.value = "Error: " + (e as Error).message;
        // Keep open to show error
        isExporting.value = false;
    }
};

const cancel = () => {
    if (isExporting.value) {
        videoExportService.cancel();
        isExporting.value = false;
    } else {
        emit("close");
    }
};
</script>

<template>
    <div
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
        <div
            class="bg-canvas-light border border-canvas-border rounded-lg shadow-2xl w-96 p-6 flex flex-col gap-4"
        >
            <h2 class="text-lg font-bold text-text-main">Export Video</h2>

            <!-- Config Form -->
            <div v-if="!isExporting" class="flex flex-col gap-4">
                <div class="flex flex-col gap-1">
                    <label class="text-xs text-text-muted">Format</label>
                    <select
                        v-model="format"
                        class="bg-canvas-dark border border-canvas-border rounded p-2 text-text-main text-sm"
                    >
                        <option value="mp4">MP4 (H.264)</option>
                        <option value="webm">WebM</option>
                    </select>
                </div>

                <div class="flex flex-col gap-1">
                    <label class="text-xs text-text-muted">Frame Rate</label>
                    <select
                        v-model="fps"
                        class="bg-canvas-dark border border-canvas-border rounded p-2 text-text-main text-sm"
                    >
                        <option :value="24">24 FPS</option>
                        <option :value="30">30 FPS</option>
                        <option :value="60">60 FPS</option>
                    </select>
                </div>

                <div class="flex flex-col gap-1">
                    <label class="text-xs text-text-muted">Resolution</label>
                    <div class="text-sm text-text-muted">
                        1280x720 (Fixed for Demo)
                    </div>
                </div>
            </div>

            <!-- Progress View -->
            <div v-else class="flex flex-col gap-2">
                <div
                    class="w-full h-2 bg-canvas-dark rounded-full overflow-hidden"
                >
                    <div
                        class="h-full bg-brand-primary transition-all duration-300"
                        :style="{ width: `${progress}%` }"
                    ></div>
                </div>
                <div class="flex justify-between text-xs text-text-muted">
                    <span>{{ status }}</span>
                    <span>{{ progress }}%</span>
                </div>
            </div>

            <!-- Actions -->
            <div class="flex justify-end gap-2 mt-2">
                <Button variant="ghost" label="Cancel" @click="cancel" />
                <Button
                    v-if="!isExporting"
                    variant="primary"
                    label="Export"
                    @click="startExport"
                />
            </div>
        </div>
    </div>
</template>
