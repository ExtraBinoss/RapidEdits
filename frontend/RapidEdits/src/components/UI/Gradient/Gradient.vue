<script setup lang="ts">
    import { Trash2, X, Library, Maximize, Circle } from 'lucide-vue-next';
    import Button from '../Button/Button.vue';
    import Slider from '../Slider/Slider.vue';
    import Popover from '../Overlay/Popover.vue';
    import ColorPicker from '../ColorPicker/ColorPicker.vue';
    import {
        useGradient,
        type GradientValue,
        type GradientPreset,
    } from './composables/useGradient';
import { ref } from 'vue';

    const props = defineProps<{
        modelValue: GradientValue | null | undefined;
        presets?: GradientPreset[];
        minStops?: number;
        maxStops?: number;
    }>();

    const emit = defineEmits<{
        (e: 'update:modelValue', value: GradientValue): void;
    }>();

    const {
        stops,
        selectedStop,
        selectedStopId,
        draggingStopId,
        showDragLabels,
        dragDeleteDirection,
        isOverTrash,
        popoverAnchor,
        isStopPopoverVisible,
        isPopoverOpen,
        isPresetsPopoverOpen,
        presetsPopoverAnchor,
        allPresets,
        gradientType,
        gradientAngle,
        origin,
        destination,
        gradientSpeed: speed,
        noiseStrength: noise,
        noiseSpeed,
        noiseScale,
        offset,
        wrapMode,
        gradientPreviewStyle,
        trackRef,
        padRef,
        effectiveMinStops,
        addStop,
        removeStop,
        updateStop,
        updateGradientType,
        updateGradientAngle,
        updateGradientDisposition,
        updateGradientSpeed: updateSpeed,
        updateNoiseStrength: updateNoise,
        updateNoiseSpeed,
        updateNoiseScale,
        updateOffset,
        updateWrapMode,
        startDraggingDisposition,
        onTrackClick,
        startDragging,
        handleStopClick,
        applyPreset,
        togglePresets,
        updateSelectedStopAlpha,
        updateSelectedStopPosition,
        normalizeStops,
        hexToRgb,
        effectiveMaxStops,
    } = useGradient(props, emit);

    const getPresetPreviewStyle = (preset: GradientPreset) => {
        const normalized = normalizeStops(preset);
        const stopsStr = normalized
            .map((s) => {
                const rgb = hexToRgb(s.color);
                const alpha = s.alpha ?? 1;
                return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha}) ${Math.round(s.position * 100)}%`;
            })
            .join(', ');
        return {
            background: `linear-gradient(to right, ${stopsStr})`,
        };
    };

</script>

<template>
    <div class="gradient-editor">
        <!-- Top Toolbar: Type & Disposition -->
        <div class="gradient-toolbar-integrated">
            <div class="toolbar-left">
                <div class="flex items-center gap-1">
                    <Button 
                        variant="ghost" 
                        size="xs" 
                        :active="gradientType === 'linear'"
                        @click="updateGradientType('linear')"
                        title="Linear"
                    >
                        <Maximize :size="14" />
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="xs" 
                        :active="gradientType === 'radial'"
                        @click="updateGradientType('radial')"
                        title="Radial"
                    >
                        <Circle :size="14" />
                    </Button>
                </div>
            </div>

            <div class="toolbar-right">
                <!-- Direction Popover -->
                <Popover
                    placement="bottom"
                    align="center"
                    :offset="12"
                    :z-index="10001"
                    transparent
                >
                    <template #trigger="{ isOpen }">
                        <Button 
                            variant="ghost" 
                            size="xs" 
                            class="direction-btn"
                            :active="isOpen"
                        >
                            <span class="text-[10px] uppercase font-bold tracking-tighter opacity-70">Direction</span>
                        </Button>
                    </template>
                    <template #content="{ close }">
                        <div class="direction-card" @click.stop>
                            <div class="card-header">
                                <span>Geometry</span>
                                <button class="close-icon" @click="close()"><X :size="14" /></button>
                            </div>
                            
                            <div class="pad-container">
                                <div class="large-pad" ref="padRef">
                                    <div class="pad-grid"></div>
                                    <div class="pad-preview" :style="gradientPreviewStyle"></div>
                                    <svg class="pad-vector" width="100%" height="100%">
                                        <line
                                            :x1="`${origin.x * 100}%`" :y1="`${origin.y * 100}%`"
                                            :x2="`${destination.x * 100}%`" :y2="`${destination.y * 100}%`"
                                        />
                                    </svg>
                                    <div
                                        class="pad-dot origin"
                                        :style="{ left: `${origin.x * 100}%`, top: `${origin.y * 100}%` }"
                                        @mousedown="startDraggingDisposition('origin', $event)"
                                    ></div>
                                    <div
                                        class="pad-dot destination"
                                        :style="{ left: `${destination.x * 100}%`, top: `${destination.y * 100}%` }"
                                        @mousedown="startDraggingDisposition('destination', $event)"
                                    ></div>
                                </div>
                            </div>

                            <div v-if="gradientType === 'linear'" class="angle-section">
                                <label>Angle</label>
                                <div class="slider-with-text">
                                    <Slider
                                        :model-value="gradientAngle"
                                        :min="0" :max="360"
                                        @update:model-value="updateGradientAngle"
                                        class="flex-1"
                                    />
                                    <span class="angle-val">{{ gradientAngle }}°</span>
                                </div>
                            </div>
                        </div>
                    </template>
                </Popover>

                <div class="divider-v"></div>

                <!-- Presets Popover -->
                <Popover
                    placement="bottom"
                    align="end"
                    :offset="12"
                    :z-index="10001"
                >
                    <template #trigger="{ isOpen }">
                        <Button 
                            variant="ghost" 
                            size="xs" 
                            :icon="Library" 
                            :active="isOpen"
                            title="Presets" 
                        />
                    </template>
                    <template #content="{ close }">
                        <div class="presets-card" @click.stop>
                            <div class="card-header">
                                <span>Library</span>
                                <button class="close-icon" @click="close()"><X :size="14" /></button>
                            </div>
                            <div class="presets-grid">
                                <button
                                    v-for="preset in allPresets"
                                    :key="preset.id"
                                    class="preset-item"
                                    @click="applyPreset(preset); close()"
                                >
                                    <div class="preset-mini-preview" :style="getPresetPreviewStyle(preset)"></div>
                                    <span class="preset-label">{{ preset.id }}</span>
                                </button>
                            </div>
                        </div>
                    </template>
                </Popover>
            </div>
        </div>


        <!-- Main Interaction Area -->
        <div class="gradient-visual-area">
            <div class="delete-zone top" :class="{ visible: showDragLabels, active: showDragLabels && dragDeleteDirection === 'top' }">
                <Trash2 :size="12" /> <span>Release to delete</span>
            </div>
            
            <div 
                ref="trackRef" 
                class="gradient-track" 
                :class="{ locked: stops.length >= effectiveMaxStops }"
                @mousedown="onTrackClick"
            >
                <div class="track-checkers"></div>
                <div class="track-fill" :style="gradientPreviewStyle"></div>

                <!-- Handles -->
                <div
                    v-for="stop in stops"
                    :key="stop.id"
                    class="stop-handle"
                    :class="{
                        active: selectedStopId === stop.id,
                        dragging: draggingStopId === stop.id,
                        'is-over-trash': draggingStopId === stop.id && isOverTrash,
                    }"
                    :style="{ left: `${stop.position * 100}%` }"
                    @mousedown="startDragging($event, stop.id)"
                    @click="handleStopClick($event, stop.id)"
                >
                    <div class="handle-stem"></div>
                    <div 
                        class="handle-color" 
                        :style="{ backgroundColor: `rgba(${hexToRgb(stop.color).r}, ${hexToRgb(stop.color).g}, ${hexToRgb(stop.color).b}, ${stop.alpha ?? 1})` }"
                    ></div>
                </div>
            </div>

            <div class="delete-zone bottom" :class="{ visible: showDragLabels, active: showDragLabels && dragDeleteDirection === 'bottom' }">
                <Trash2 :size="12" /> <span>Release to delete</span>
            </div>
        </div>

        <!-- Stop Editor Popover -->
        <Popover
            :model-value="isStopPopoverVisible"
            @update:model-value="isStopPopoverVisible = $event"
            :anchor-point="popoverAnchor"
            :reference-el="trackRef"
            placement="top"
            align="center"
            :offset="24"
            :z-index="10000"
            transparent
        >
            <div v-if="selectedStop" class="stop-popover-card" @click.stop>
                <div class="card-header">
                    <span>Edit Stop</span>
                    <button class="close-icon" @click="isStopPopoverVisible = false"><X :size="14" /></button>
                </div>

                <div class="card-body">
                    <div class="body-row">
                        <label>Color</label>
                        <div class="flex-1">
                            <ColorPicker
                                :model-value="selectedStop.color"
                                @update:model-value="updateStop(selectedStop.id, { color: $event })"
                            />
                        </div>
                    </div>
                    <div class="body-row">
                        <label>Alpha</label>
                        <Slider
                            :model-value="selectedStop.alpha ?? 1"
                            :min="0" :max="1" :step="0.01"
                            @update:model-value="updateSelectedStopAlpha"
                            class="flex-1"
                        />
                    </div>
                    <div class="body-row">
                        <label>Pos</label>
                        <Slider
                            :model-value="selectedStop.position"
                            :min="0" :max="1" :step="0.001"
                            @update:model-value="updateSelectedStopPosition"
                            class="flex-1"
                        />
                    </div>
                </div>

                <div class="card-footer">
                    <Button variant="danger" size="xs" :icon="Trash2" 
                        :disabled="stops.length <= effectiveMinStops"
                        @click="removeStop(selectedStop!.id)"
                        class="w-full"
                    >
                        Delete Stop
                    </Button>
                </div>
            </div>
        </Popover>


    </div>
</template>

<style scoped>
    .gradient-editor {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
        user-select: none;
    }

    /* Toolbar Layout */
    .gradient-toolbar-integrated {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(15, 23, 42, 0.6);
        padding: 5px 10px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(16px);
        margin-bottom: 4px;
    }

    .angle-section {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .angle-section label {
        font-size: 0.65rem;
        font-weight: 700;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.3);
    }

    .slider-with-text {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .angle-val {
        font-family: var(--font-mono, monospace);
        font-size: 0.7rem;
        color: #fff;
        min-width: 32px;
        text-align: right;
    }

    .toolbar-left {
        display: flex;
        align-items: center;
        gap: 16px; /* Increased gap */
        padding-left: 4px;
    }

    .toolbar-right {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .divider-v {
        width: 1px;
        height: 16px;
        background: rgba(255, 255, 255, 0.1);
        margin: 0 4px;
    }

    .direction-btn {
        padding: 0 8px !important;
        height: 24px !important;
        border-radius: 6px !important;
    }

    .direction-btn.active {
        background: rgba(255, 255, 255, 0.1) !important;
        color: #55b2e2 !important;
    }

    /* Direction Card */
    .direction-card {
        width: 180px;
        background: #1e293b;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
        overflow: hidden;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .pad-container {
        display: flex;
        justify-content: center;
    }

    .large-pad {
        width: 120px;
        height: 120px;
        background: #000;
        border-radius: 8px;
        position: relative;
        /* overflow: hidden; */ /* Allow handles to breathe at edges */
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.8);
    }

    .pad-grid {
        position: absolute;
        inset: 0;
        border-radius: 7px;
        background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
        background-size: 25% 25%;
    }

    .pad-preview {
        position: absolute;
        inset: 0;
        opacity: 0.4;
        border-radius: 7px;
        overflow: hidden;
    }

    .pad-vector {
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: visible;
    }

    .pad-vector line {
        stroke: rgba(255, 255, 255, 0.5);
        stroke-width: 1.5;
        stroke-dasharray: 4 3;
    }

    .pad-dot {
        position: absolute;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        border: 1.5px solid #000;
        background: #fff;
        transform: translate(-50%, -50%);
        cursor: grab;
        z-index: 5;
        box-shadow: 0 0 6px rgba(0,0,0,0.5);
    }

    .pad-dot.destination {
        background: #55b2e2;
    }

    .pad-dot:active {
        cursor: grabbing;
        transform: translate(-50%, -50%) scale(1.2);
    }

    /* Visual Area (Track + Delete zones) */
    .gradient-visual-area {
        display: flex;
        flex-direction: column;
        padding-bottom: 12px;
    }

    .delete-zone {
        height: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-size: 0.65rem;
        font-weight: 600;
        color: rgba(239, 68, 68, 0.6);
        background: rgba(127, 29, 29, 0.1);
        border-radius: 4px;
        opacity: 0;
        transform: scale(0.95);
        transition: all 0.2s;
        pointer-events: none;
        margin: 2px 0;
    }

    .delete-zone.visible {
        opacity: 0.4;
    }

    .delete-zone.active {
        opacity: 1;
        color: #ef4444;
        background: rgba(127, 29, 29, 0.3);
        transform: scale(1);
        border: 1px dashed rgba(239, 68, 68, 0.5);
    }

    .gradient-track {
        position: relative;
        height: 22px;
        background: #000;
        border-radius: 4px;
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 2px 6px rgba(0,0,0,0.4);
        cursor: crosshair;
        z-index: 10;
    }

    .track-checkers {
        position: absolute;
        inset: 0;
        border-radius: 4px;
        background-color: #fff;
        background-image: linear-gradient(45deg, #ddd 25%, transparent 25%),
                          linear-gradient(-45deg, #ddd 25%, transparent 25%),
                          linear-gradient(45deg, transparent 75%, #ddd 75%),
                          linear-gradient(-45deg, transparent 75%, #ddd 75%);
        background-size: 6px 6px;
        background-position: 0 0, 0 3px, 3px -3px, -3px 0;
    }

    .track-fill {
        position: absolute;
        inset: 0;
        border-radius: 4px;
    }

    /* Handles */
    .stop-handle {
        position: absolute;
        top: 22px;
        width: 12px;
        height: 18px;
        transform: translateX(-50%);
        cursor: grab;
        z-index: 20;
    }

    .handle-stem {
        position: absolute;
        top: -6px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-bottom: 6px solid #1e293b;
    }

    .stop-handle.active .handle-stem {
        border-bottom-color: #55b2e2;
    }

    .handle-color {
        width: 100%;
        height: 100%;
        border-radius: 2px;
        border: 1.5px solid #1e293b;
        background: #fff;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    }

    .stop-handle.active .handle-color {
        border-color: #55b2e2;
        box-shadow: 0 0 8px rgba(85, 178, 226, 0.3);
    }

    .stop-handle.is-over-trash .handle-color {
        opacity: 0.3;
        border-color: #ef4444;
    }

    /* Popover Card Styles */
    .stop-popover-card {
        width: 200px;
        background: #1e293b;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
        overflow: hidden;
    }

    .card-header {
        background: rgba(255, 255, 255, 0.03);
        padding: 8px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .card-header span {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: rgba(255, 255, 255, 0.5);
    }

    .close-icon {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.3);
        cursor: pointer;
        padding: 2px;
    }

    .card-body {
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .body-row {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .body-row label {
        font-size: 0.65rem;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.4);
        min-width: 40px;
    }

    .card-footer {
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.1);
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .spacer { flex: 1; }

    /* Presets Panel */
    .presets-panel {
        width: 240px;
        background: #1e293b;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        padding: 12px;
    }

    .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
    }

    .panel-header span {
        font-size: 0.75rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.6);
    }

    .presets-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
    }

    .preset-item {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 6px;
        padding: 4px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .preset-item:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: #55b2e2;
        transform: translateY(-1px);
    }

    .preset-mini-preview {
        height: 20px;
        border-radius: 4px;
        margin-bottom: 4px;
    }

    .preset-label {
        font-size: 0.6rem;
        color: rgba(255, 255, 255, 0.6);
        display: block;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
</style>
