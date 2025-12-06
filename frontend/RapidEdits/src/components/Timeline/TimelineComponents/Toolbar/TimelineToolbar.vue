<script setup lang="ts">
import {
    Play,
    Pause,
    SkipBack,
    ZoomIn,
    ZoomOut,
    Scissors,
    Magnet,
    MousePointer2,
    Slash,
} from "lucide-vue-next";
import Button from "../../../UI/Button/Button.vue";
import Tooltip from "../../../UI/Overlay/Tooltip.vue";
import Divider from "../../../UI/Divider/Divider.vue";
import KeyChip from "../../../UI/KeyChip/KeyChip.vue";
import { formatTime } from "../../../../utils/time";

defineProps<{
    currentTime: number;
    duration: number; // Not strictly needed for display if we only show current time, but good for context if needed
    isPlaying: boolean;
    isSnapping: boolean;
    zoomLevel: number;
    activeTool: "select" | "razor";
}>();

const emit = defineEmits<{
    (e: "seek", time: number): void;
    (e: "togglePlayback"): void;
    (e: "toggleSnapping"): void;
    (e: "split"): void;
    (e: "update:zoomLevel", val: number): void;
    (e: "update:activeTool", val: "select" | "razor"): void;
}>();
</script>

<template>
    <div
        class="h-10 border-b border-canvas-border flex items-center justify-between px-4 bg-canvas-light shrink-0"
    >
        <!-- Left Controls -->
        <div class="flex items-center gap-2">
            <Tooltip text="Go to Start" position="bottom">
                <template #content>
                    <div class="flex items-center gap-2">
                        <span>Go to Start</span>
                        <KeyChip char="Home" />
                    </div>
                </template>
                <Button
                    variant="icon"
                    size="sm"
                    :icon="SkipBack"
                    @click="emit('seek', 0)"
                />
            </Tooltip>

            <Divider orientation="vertical" />

            <Tooltip text="Select Tool" position="bottom">
                <template #content>
                    <div class="flex items-center gap-2">
                        <span>Select Tool</span>
                        <KeyChip char="V" />
                    </div>
                </template>
                <Button
                    variant="icon"
                    size="sm"
                    :icon="MousePointer2"
                    :active="activeTool === 'select'"
                    @click="emit('update:activeTool', 'select')"
                />
            </Tooltip>

            <Divider orientation="vertical" />

            <!-- Split Action -->
            <Tooltip text="Split Clip at Playhead" position="bottom">
                <template #content>
                    <div class="flex items-center gap-2">
                        <span>Split</span>
                        <KeyChip char="S" />
                    </div>
                </template>
                <Button
                    variant="icon"
                    size="sm"
                    :icon="Scissors"
                    @click="emit('split')"
                />
            </Tooltip>

            <!-- Razor Tool -->
            <Tooltip text="Razor Tool" position="bottom">
                <template #content>
                    <div class="flex items-center gap-2">
                        <span>Razor Tool</span>
                        <KeyChip char="C" />
                    </div>
                </template>
                <Button
                    variant="icon"
                    size="sm"
                    :icon="Slash"
                    :active="activeTool === 'razor'"
                    @click="emit('update:activeTool', 'razor')"
                />
            </Tooltip>

            <Divider orientation="vertical" />

            <Tooltip text="Snapping" position="bottom">
                <template #content>
                    <div class="flex items-center gap-2">
                        <span>Snapping</span>
                        <KeyChip char="M" />
                    </div>
                </template>
                <Button
                    variant="icon"
                    size="sm"
                    :icon="Magnet"
                    :active="isSnapping"
                    @click="emit('toggleSnapping')"
                />
            </Tooltip>
        </div>

        <!-- Center Controls -->
        <div class="flex items-center gap-4">
            <span class="font-mono text-sm text-brand-accent select-none">
                {{ formatTime(currentTime) }}
            </span>

            <Tooltip :text="isPlaying ? 'Pause' : 'Play'" position="bottom">
                <template #content>
                    <div class="flex items-center gap-2">
                        <span>{{ isPlaying ? "Pause" : "Play" }}</span>
                        <KeyChip char="Space" />
                    </div>
                </template>
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
            <Tooltip text="Zoom Out" position="bottom">
                <template #content>
                    <div class="flex items-center gap-2">
                        <span>Zoom Out</span>
                        <KeyChip char="-" />
                    </div>
                </template>
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

            <Tooltip text="Zoom In" position="bottom">
                <template #content>
                    <div class="flex items-center gap-2">
                        <span>Zoom In</span>
                        <KeyChip char="+" />
                    </div>
                </template>
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
