<script setup lang="ts">
    import { Trash2, X, Library } from 'lucide-vue-next';
    import Button from '../Button/Button.vue';
    import Slider from '../Slider/Slider.vue';
    import Popover from '../Overlay/Popover.vue';
    import ColorPicker from '../ColorPicker/ColorPicker.vue';
    import {
        useGradient,
        type GradientValue,
        type GradientPreset,
    } from './composables/useGradient';

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
        gradientPreviewStyle,
        trackRef,
        effectiveMinStops,
        addStop,
        removeStop,
        updateStop,
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
    void trackRef;
    void addStop;
</script>

<template>
    <div class="gradient-editor">
        <div class="gradient-visual-container">
            <div
                class="delete-zone delete-zone--top"
                :class="{
                    'is-visible': showDragLabels,
                    'is-active':
                        showDragLabels && dragDeleteDirection === 'top',
                }"
            >
                <Trash2 :size="12" />
                <span>Drag up to delete</span>
            </div>
            <div
                ref="trackRef"
                class="gradient-track"
                :class="{ 'is-locked': stops.length >= effectiveMaxStops }"
                @mousedown="onTrackClick"
            >
                <!-- Checkerboard background for alpha visibility -->
                <div class="checkerboard"></div>
                <!-- Gradient preview -->
                <div class="gradient-fill" :style="gradientPreviewStyle"></div>

                <!-- Interaction markers -->
                <div
                    v-for="stop in stops"
                    :key="stop.id"
                    class="stop-handle"
                    :class="{
                        active: selectedStopId === stop.id,
                        dragging: draggingStopId === stop.id,
                        'over-trash': draggingStopId === stop.id && isOverTrash,
                    }"
                    :style="{ left: `${stop.position * 100}%` }"
                    @mousedown="startDragging($event, stop.id)"
                    @click="handleStopClick($event, stop.id)"
                >
                    <div
                        class="stop-marker"
                        :style="{
                            backgroundColor: `rgba(${hexToRgb(stop.color).r}, ${hexToRgb(stop.color).g}, ${hexToRgb(stop.color).b}, ${stop.alpha ?? 1})`,
                        }"
                    ></div>
                    <div
                        v-if="draggingStopId === stop.id && isOverTrash"
                        class="trash-indicator"
                    >
                        <Trash2 :size="14" />
                    </div>
                </div>
            </div>
            <div
                class="delete-zone delete-zone--bottom"
                :class="{
                    'is-visible': showDragLabels,
                    'is-active':
                        showDragLabels && dragDeleteDirection === 'bottom',
                }"
            >
                <Trash2 :size="12" />
                <span>Drag down to delete</span>
            </div>
        </div>

        <!-- Stop Editor Popover -->
        <Popover
            :model-value="isStopPopoverVisible"
            @update:model-value="isStopPopoverVisible = $event"
            :anchor-point="popoverAnchor"
            placement="top"
            align="center"
            :offset="20"
            :z-index="9999"
            transparent
            class="stop-popover"
        >
            <div v-if="selectedStop" class="stop-edit-form">
                <div class="form-header">
                    <span class="form-title">Edit Stop</span>
                    <button class="close-btn" @click="isPopoverOpen = false">
                        <X :size="14" />
                    </button>
                </div>

                <div class="form-row">
                    <label>Color</label>
                    <ColorPicker
                        :model-value="selectedStop.color"
                        @update:model-value="
                            updateStop(selectedStop.id, { color: $event })
                        "
                    />
                </div>

                <div class="form-row">
                    <label>Opacity</label>
                    <div class="range-group">
                        <Slider
                            :model-value="selectedStop.alpha ?? 1"
                            :min="0"
                            :max="1"
                            :step="0.01"
                            @update:model-value="updateSelectedStopAlpha"
                        />
                        <span class="value-label">
                            {{ Math.round((selectedStop.alpha ?? 1) * 100) }}%
                        </span>
                    </div>
                </div>

                <div class="form-row">
                    <label>Position</label>
                    <div class="range-group">
                        <Slider
                            :model-value="selectedStop.position"
                            :min="0"
                            :max="1"
                            :step="0.001"
                            @update:model-value="updateSelectedStopPosition"
                        />
                        <span class="value-label">
                            {{ Math.round(selectedStop.position * 100) }}%
                        </span>
                    </div>
                </div>

                <div class="form-actions merged-actions">
                    <Button
                        variant="secondary"
                        size="sm"
                        :icon="Library"
                        icon-only
                        title="Presets"
                        @click="togglePresets"
                    />
                    <div class="flex-spacer"></div>
                    <Button
                        variant="danger"
                        size="sm"
                        :icon="Trash2"
                        icon-only
                        title="Remove Stop"
                        :disabled="stops.length <= effectiveMinStops"
                        @click="removeStop(selectedStop!.id)"
                    />
                </div>
            </div>
        </Popover>

        <!-- Presets Library Popover -->
        <Popover
            v-model="isPresetsPopoverOpen"
            :anchor-point="presetsPopoverAnchor"
            placement="right"
            align="start"
            :offset="10"
            :z-index="4000"
            transparent
            class="presets-library-popover"
        >
            <div class="presets-library compact">
                <div class="presets-header">
                    <span class="presets-title">Presets</span>
                    <button
                        class="close-btn"
                        @click="isPresetsPopoverOpen = false"
                    >
                        <X :size="14" />
                    </button>
                </div>
                <div class="presets-grid">
                    <div
                        v-for="preset in allPresets"
                        :key="preset.id"
                        class="preset-card"
                        @click="applyPreset(preset)"
                    >
                        <div
                            class="preset-preview-large"
                            :style="{
                                background: `linear-gradient(90deg, ${normalizeStops(
                                    { stops: preset.stops }
                                )
                                    .map(
                                        (s) => `${s.color} ${s.position * 100}%`
                                    )
                                    .join(', ')})`,
                            }"
                        ></div>
                        <span class="preset-name">{{ preset.id }}</span>
                    </div>
                </div>
            </div>
        </Popover>
    </div>
</template>

<style scoped>
    .gradient-editor {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 100%;
        user-select: none;
    }

    .gradient-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .gradient-count {
        font-size: 0.75rem;
        color: var(--text-color-secondary, #9ca3af);
        font-weight: 500;
    }

    .gradient-visual-container {
        padding: 8px 0 22px 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .delete-zone {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        height: 18px;
        border-radius: 6px;
        border: 1px dashed rgba(156, 163, 175, 0.35);
        background: rgba(15, 23, 42, 0.25);
        color: var(--text-color-secondary, #9ca3af);
        font-size: 0.66rem;
        opacity: 0;
        transform: scale(0.98);
        transition: all 0.15s ease;
        pointer-events: none;
    }

    .delete-zone.is-visible {
        opacity: 0.8;
    }

    .delete-zone.is-active {
        opacity: 1;
        border-color: rgba(239, 68, 68, 0.75);
        color: var(--error-color, #ef4444);
        background: rgba(127, 29, 29, 0.22);
        transform: scale(1);
    }

    .gradient-track {
        position: relative;
        width: 100%;
        height: 28px;
        border-radius: 8px;
        cursor: crosshair;
        background: #000;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
        overflow: visible;
        transition: opacity 0.2s;
    }

    .gradient-track.is-locked {
        cursor: default;
    }

    .checkerboard {
        position: absolute;
        inset: 0;
        border-radius: 8px;
        background-color: #ffffff;
        background-image:
            linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
            linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
            linear-gradient(-45deg, transparent 75%, #e5e7eb 75%);
        background-size: 8px 8px;
        background-position:
            0 0,
            0 4px,
            4px -4px,
            -4px 0px;
    }

    .gradient-fill {
        position: absolute;
        inset: 0;
        border-radius: 8px;
    }

    .stop-handle {
        position: absolute;
        top: 28px;
        width: 14px;
        height: 18px;
        transform: translateX(-50%);
        cursor: grab;
        z-index: 10;
        transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .stop-handle:active {
        cursor: grabbing;
    }

    .stop-handle.active {
        z-index: 12;
    }

    .stop-handle.dragging {
        z-index: 13;
        transition: none; /* Disable transition while dragging for responsiveness */
    }

    .stop-handle::before {
        content: '';
        position: absolute;
        top: -6px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-bottom: 6px solid var(--surface-color-light, #374151);
    }

    .stop-handle.active::before {
        border-bottom-color: var(--primary-color, #55b2e2);
    }

    .stop-marker {
        width: 100%;
        height: 100%;
        border-radius: 2px;
        border: 2px solid var(--surface-color-light, #374151);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        position: relative;
        overflow: hidden;
        background-color: #fff;
    }

    .stop-handle.active .stop-marker {
        border-color: var(--primary-color, #55b2e2);
        box-shadow: 0 0 0 2px rgba(85, 178, 226, 0.2);
    }

    .trash-indicator {
        position: absolute;
        bottom: -24px;
        left: 50%;
        transform: translateX(-50%);
        color: var(--error-color, #ef4444);
        animation: bounce 0.5s infinite alternate;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
    }

    @keyframes bounce {
        from {
            transform: translateX(-50%) translateY(0);
        }
        to {
            transform: translateX(-50%) translateY(-4px);
        }
    }

    .stop-handle.over-trash .stop-marker {
        border-color: var(--error-color, #ef4444);
        opacity: 0.5;
        transform: scale(0.8);
    }

    .gradient-presets {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 4px;
    }

    .preset-chip {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--surface-color-light, #374151);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 6px;
        padding: 4px 10px 4px 4px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .preset-chip:hover {
        background: var(--surface-color-lighter, #4b5563);
        border-color: var(--primary-color, #55b2e2);
    }

    .preset-preview {
        width: 24px;
        height: 24px;
        border-radius: 4px;
        border: 1px solid rgba(0, 0, 0, 0.2);
    }

    .preset-chip span {
        font-size: 0.72rem;
        color: var(--text-color, #e5e7eb);
        font-weight: 500;
    }

    /* Popover Styles */
    .stop-edit-form {
        width: 220px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: var(--canvas-light, #1e293b);
        padding: 14px;
        border-radius: 12px;
        border: 1px solid var(--canvas-border, rgba(255, 255, 255, 0.1));
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }

    .form-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 4px;
    }

    .form-title {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--text-color-secondary, #9ca3af);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .close-btn {
        background: none;
        border: none;
        color: var(--text-color-secondary, #9ca3af);
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        display: flex;
        transition: all 0.2s;
    }

    .close-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: var(--text-color, #fff);
    }

    .form-row {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .form-row label {
        font-size: 0.7rem;
        font-weight: 500;
        color: var(--text-color-secondary, #9ca3af);
    }

    .color-input-wrapper {
        display: flex;
        align-items: center;
        gap: 10px;
        background: rgba(0, 0, 0, 0.2);
        padding: 4px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .color-input-wrapper input[type='color'] {
        width: 28px;
        height: 28px;
        border: none;
        border-radius: 4px;
        background: none;
        padding: 0;
        cursor: pointer;
    }

    .hex-value {
        font-family: var(--font-mono, monospace);
        font-size: 0.75rem;
        color: var(--text-color, #fff);
    }

    .range-group {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
    }

    .value-label {
        font-size: 0.7rem;
        min-width: 36px;
        text-align: right;
        color: var(--text-color, #fff);
    }

    .form-actions.merged-actions {
        margin-top: 8px;
        padding-top: 12px;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        display: flex;
        align-items: center;
        width: 100%;
    }

    .flex-spacer {
        flex: 1;
    }

    /* Presets Library */
    .presets-library {
        width: 260px;
        max-height: 320px;
        overflow-y: auto;
        padding: 10px;
        background: var(--surface-color, #1e293b);
        border-radius: 8px;
    }

    .presets-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
        padding-bottom: 6px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .presets-title {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--text-color-secondary);
        letter-spacing: 0.05em;
    }

    .presets-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
    }

    .preset-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 6px;
        padding: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .preset-card:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: var(--primary-color);
        transform: translateY(-1px);
    }

    .preset-preview-large {
        width: 100%;
        height: 24px;
        border-radius: 3px;
        border: 1px solid rgba(0, 0, 0, 0.2);
    }

    .preset-name {
        font-size: 0.65rem;
        color: var(--text-color);
        font-weight: 500;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
</style>
