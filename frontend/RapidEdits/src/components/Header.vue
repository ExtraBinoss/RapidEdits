<script setup lang="ts">
import { Download, Settings, Monitor, Circle } from "lucide-vue-next";
import Button from "./UI/Button/Button.vue";
import Tooltip from "./UI/Overlay/Tooltip.vue";
import AppLogo from "./UI/Logo/AppLogo.vue";
import ExportMenu from "./Export/ExportMenu.vue";
import JobIndicator from "./Header/JobIndicator.vue";
import ProjectSettingsPopover from "./Header/ProjectSettingsPopover.vue";
import { ref } from "vue";

import { useRecorder } from "../composables/useRecorder";

const showExportModal = ref(false);
const { isRecording, setShowPicker, stopRecording } = useRecorder();

const handleRecordToggle = () => {
    if (isRecording.value) {
        stopRecording();
    } else {
        setShowPicker(true);
    }
};
</script>

<template>
    <header
        class="h-14 bg-canvas-light border-b border-canvas-border flex items-center justify-between px-4 shrink-0 z-20"
    >
        <ExportMenu v-if="showExportModal" v-model="showExportModal" />

        <!-- Logo Area -->
        <div class="flex items-center gap-3">
            <AppLogo size="w-8 h-8" />
            <span class="text-lg font-bold tracking-tight text-text-main">
                RapidEdits
            </span>
        </div>

        <!-- Center Project Info -->
        <ProjectSettingsPopover />

        <!-- Right Actions -->
        <div class="flex items-center gap-3">
            <JobIndicator />

            <div class="h-6 w-px bg-canvas-border mx-1"></div>

            <Tooltip :text="isRecording ? 'Stop Recording' : 'Record Screen'" position="bottom">
                <Button
                    :variant="isRecording ? 'danger' : 'secondary'"
                    :icon="isRecording ? Circle : Monitor"
                    @click="handleRecordToggle"
                    :class="isRecording ? 'animate-pulse' : ''"
                >
                    {{ isRecording ? 'Recording...' : 'Record' }}
                </Button>
            </Tooltip>

            <Tooltip text="Settings" position="bottom">
                <Button variant="icon" :icon="Settings" />
            </Tooltip>

            <Tooltip text="Export Project" position="bottom">
                <Button
                    variant="primary"
                    :icon="Download"
                    @click="showExportModal = true"
                >
                    Export
                </Button>
            </Tooltip>
        </div>
    </header>
</template>
