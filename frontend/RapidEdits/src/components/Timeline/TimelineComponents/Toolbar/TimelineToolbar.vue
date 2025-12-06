<script setup lang="ts">
import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    ZoomIn,
    ZoomOut,
    Scissors,
    Magnet,
} from "lucide-vue-next";
import Button from "../../../UI/Button/Button.vue";
import Tooltip from "../../../UI/Overlay/Tooltip.vue";
import Divider from "../../../UI/Divider/Divider.vue";
import { formatTime } from "../../../../utils/time";

const props = defineProps<{
    currentTime: number;
    duration: number; // Not strictly needed for display if we only show current time, but good for context if needed
    isPlaying: boolean;
    isSnapping: boolean;
    zoomLevel: number;
}>();

const emit = defineEmits<{
    (e: "seek", time: number): void;
    (e: "togglePlayback"): void;
    (e: "toggleSnapping"): void;
    (e: "split"): void;
    (e: "update:zoomLevel", val: number): void;
}>();
</script>

<template>
    <div
        class="h-10 border-b border-canvas-border flex items-center justify-between px-4 bg-canvas-light shrink-0"
    >
        <!-- Left Controls -->
        <div class="flex items-center gap-2">
            <Tooltip text="Go to Start (Home)" position="bottom">
                <Button
                    variant="icon"
                    size="sm"
                    :icon="SkipBack"
                    @click="emit('seek', 0)"
                />
            </Tooltip>

            <Tooltip text="Next Frame (Coming Soon)" position="bottom">
                <Button variant="icon" size="sm" :icon="SkipForward" disabled />
            </Tooltip>

            <Divider orientation="vertical" />

            <Tooltip text="Toggle Snapping (N)" position="bottom">
                <Button
                    variant="icon"
                    size="sm"
                    :icon="Magnet"
                    :active="isSnapping"
                    @click="emit('toggleSnapping')"
                />
            </Tooltip>

            <Tooltip text="Split Clip (S)" position="bottom">
                <Button
                    variant="ghost"
                    size="sm"
                    :icon="Scissors"
                    @click="emit('split')"
                >
                    Split
                </Button>
            </Tooltip>
        </div>

        <!-- Center Controls -->
        <div class="flex items-center gap-4">
            <span class="font-mono text-sm text-brand-accent select-none">
                {{ formatTime(currentTime) }}
            </span>

            <Tooltip
                :text="isPlaying ? 'Pause (Space)' : 'Play (Space)'"
                position="bottom"
            >
                <Button
                    variant="secondary"
                    class="rounded-full w-8 h-8 flex items-center justify-center"
                    @click="emit('togglePlayback')"
                >
                    <component
                        :is="isPlaying ? Pause : Play"
                        :size="14"
                        fill="currentColor"
                    />
                </Button>
            </Tooltip>
        </div>

        <!-- Right Controls (Zoom) -->
        <div class="flex items-center gap-2">
            <Tooltip text="Zoom Out (-)" position="bottom">
                <Button
                    variant="icon"
                    size="sm"
                    :icon="ZoomOut"
                    @click="
                        emit('update:zoomLevel', Math.max(5, zoomLevel - 5))
                    "
                />
            </Tooltip>

            <input
                type="range"
                :value="zoomLevel"
                @input="
                    emit(
                        'update:zoomLevel',
                        Number(($event.target as HTMLInputElement).value),
                    )
                "
                min="5"
                max="100"
                class="w-20 h-1 bg-canvas-border rounded-lg appearance-none cursor-pointer accent-brand-primary"
            />

            <Tooltip text="Zoom In (+)" position="bottom">
                <Button
                    variant="icon"
                    size="sm"
                    :icon="ZoomIn"
                    @click="
                        emit('update:zoomLevel', Math.min(100, zoomLevel + 5))
                    "
                />
            </Tooltip>
        </div>
    </div>
</template>
