<script setup lang="ts">
import { Download, Settings, FileVideo } from "lucide-vue-next";
import Button from "./UI/Button.vue";
import Tooltip from "./UI/Tooltip.vue";
import Popover from "./UI/Popover.vue";
import AppLogo from "./AppLogo.vue";
</script>

<template>
    <header
        class="h-14 bg-canvas-light border-b border-canvas-border flex items-center justify-between px-4 shrink-0 z-20"
    >
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

            <Popover position="bottom-right">
                <template #trigger>
                    <Tooltip text="Export Project" position="bottom">
                        <Button variant="primary" :icon="Download"
                            >Export</Button
                        >
                    </Tooltip>
                </template>

                <template #content="{ close }">
                    <div class="flex flex-col gap-1">
                        <div
                            class="px-3 py-2 text-xs font-bold text-text-muted uppercase tracking-wider"
                        >
                            Export Options
                        </div>

                        <Button
                            variant="ghost"
                            class="w-full justify-start px-3 py-2 text-sm text-text-main hover:bg-canvas-lighter"
                        >
                            <FileVideo :size="16" class="text-brand-accent" />
                            <div class="flex flex-col items-start">
                                <span>Video (MP4)</span>
                                <span class="text-[10px] text-text-muted"
                                    >High Quality • H.264</span
                                >
                            </div>
                        </Button>
                        <Button
                            variant="ghost"
                            class="w-full justify-start px-3 py-2 text-sm text-text-main hover:bg-canvas-lighter"
                        >
                            <FileVideo
                                :size="16"
                                class="text-brand-secondary"
                            />
                            <div class="flex flex-col items-start">
                                <span>WebM</span>
                                <span class="text-[10px] text-text-muted"
                                    >Efficient • VP9</span
                                >
                            </div>
                        </Button>

                        <div class="h-[1px] bg-canvas-border my-1"></div>

                        <Button
                            variant="ghost"
                            @click="close"
                            class="w-full justify-start px-3 py-2 text-xs text-text-muted hover:text-text-main hover:bg-canvas-lighter"
                        >
                            Cancel
                        </Button>
                    </div>
                </template>
            </Popover>
        </div>
    </header>
</template>
