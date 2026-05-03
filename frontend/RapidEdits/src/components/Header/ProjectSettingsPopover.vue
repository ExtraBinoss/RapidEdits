<script setup lang="ts">
import { useProjectStore } from "../../stores/projectStore";
import Popover from "../UI/Overlay/Popover.vue";
import ProjectSettings from "../Project/ProjectSettings.vue";

const projectStore = useProjectStore();
</script>

<template>
    <Popover position="bottom" :offset="12">
        <template #trigger="{ isOpen }">
            <div
                class="hidden md:flex items-center gap-4 text-sm text-text-muted bg-canvas px-4 py-1.5 rounded-full border border-canvas-border hover:border-brand-primary/30 transition-colors group cursor-pointer"
                :class="{ 'border-brand-primary/50 bg-canvas-lighter': isOpen }"
            >
                <span class="group-hover:text-text-main transition-colors font-medium">
                    {{ projectStore.projectName }}
                </span>
                <span class="text-canvas-border">|</span>
                <span class="text-xs">
                    {{ projectStore.resolution.width }}x{{ projectStore.resolution.height }} • {{ projectStore.fps }}fps
                </span>
            </div>
        </template>

        <template #content="{ close }">
            <div class="p-4 w-80">
                <ProjectSettings show-save-button @saved="close" />
            </div>
        </template>
    </Popover>
</template>
