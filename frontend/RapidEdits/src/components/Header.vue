<script setup lang="ts">
import { Download, Settings } from "lucide-vue-next";
import Button from "./UI/Button/Button.vue";
import Tooltip from "./UI/Overlay/Tooltip.vue";
import AppLogo from "./UI/Logo/AppLogo.vue";
import ExportModal from "./UI/Modal/ExportModal.vue";
import { ref } from "vue";

const showExportModal = ref(false);
</script>

<template>
    <header
        class="h-14 bg-canvas-light border-b border-canvas-border flex items-center justify-between px-4 shrink-0 z-20"
    >
        <ExportModal v-if="showExportModal" @close="showExportModal = false" />

        <!-- Logo Area -->
        <div class="flex items-center gap-3">
            <AppLogo size="w-8 h-8" />
            <span class="text-lg font-bold tracking-tight text-text-main">
                RapidEdits
            </span>
        </div>

        <!-- Center Project Info -->
        <div
            class="hidden md:flex items-center gap-4 text-sm text-text-muted bg-canvas px-4 py-1.5 rounded-full border border-canvas-border hover:border-brand-primary/30 transition-colors group"
        >
            <span
                class="group-hover:text-text-main cursor-pointer transition-colors"
                >Untitled Project</span
            >
            <span class="text-canvas-border">|</span>
            <span class="text-xs">1920x1080 • 30fps</span>
        </div>

        <!-- Right Actions -->
        <div class="flex items-center gap-3">
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
