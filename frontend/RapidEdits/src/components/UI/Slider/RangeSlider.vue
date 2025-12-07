<script setup lang="ts">
import { computed, ref } from "vue";
import Input from "../Input/Input.vue";

interface Props {
    min?: number;
    max?: number;
    step?: number;
    modelValue: [number, number];
}

const props = defineProps<Props>();
const emit = defineEmits<{
    (e: "update:modelValue", value: [number, number]): void;
}>();

const startVal = computed({
    get: () => props.modelValue[0],
    set: (v) =>
        emit("update:modelValue", [Math.min(v, endVal.value), endVal.value]),
});

const endVal = computed({
    get: () => props.modelValue[1],
    set: (v) =>
        emit("update:modelValue", [
            startVal.value,
            Math.max(v, startVal.value),
        ]),
});

// Calculate percentages for CSS
const leftPct = computed(() => {
    const range = (props.max || 100) - (props.min || 0);
    return ((startVal.value - (props.min || 0)) / range) * 100;
});

const widthPct = computed(() => {
    const range = (props.max || 100) - (props.min || 0);
    return ((endVal.value - startVal.value) / range) * 100;
});

const handleInput = (idx: 0 | 1, event: Event) => {
    const target = event.target as HTMLInputElement;
    const val = Number(target.value);
    const newVal: [number, number] = [...props.modelValue];
    newVal[idx] = val;

    // Constrain
    if (idx === 0) {
        newVal[0] = Math.min(newVal[0], newVal[1]);
    } else {
        newVal[1] = Math.max(newVal[1], newVal[0]);
    }

    emit("update:modelValue", newVal);
};
</script>

<template>
    <div class="flex flex-col gap-2">
        <div
            class="relative h-6 flex items-center select-none"
            ref="sliderTrack"
        >
            <!-- Background Track -->
            <div
                class="absolute w-full h-1.5 bg-canvas-border rounded-lg"
            ></div>

            <!-- Active Range -->
            <div
                class="absolute h-1.5 bg-brand-primary rounded-lg"
                :style="{ left: `${leftPct}%`, width: `${widthPct}%` }"
            ></div>

            <!-- Thumbs (Invisible Inputs) -->
            <input
                type="range"
                :min="min"
                :max="max"
                :step="step"
                :value="startVal"
                @input="(e) => handleInput(0, e)"
                class="absolute w-full h-full opacity-0 cursor-ew-resize z-20 pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto"
            />
            <input
                type="range"
                :min="min"
                :max="max"
                :step="step"
                :value="endVal"
                @input="(e) => handleInput(1, e)"
                class="absolute w-full h-full opacity-0 cursor-ew-resize z-20 pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto"
            />

            <!-- Visual Thumbs -->
            <div
                class="absolute h-4 w-4 bg-white rounded-full shadow border border-gray-300 pointer-events-none z-10 transition-transform hover:scale-110"
                :style="{ left: `calc(${leftPct}% - 8px)` }"
            ></div>
            <div
                class="absolute h-4 w-4 bg-white rounded-full shadow border border-gray-300 pointer-events-none z-10 transition-transform hover:scale-110"
                :style="{ left: `calc(${leftPct + widthPct}% - 8px)` }"
            ></div>
        </div>

        <div class="flex items-center justify-between gap-2">
            <Input
                type="number"
                class="w-20 text-xs font-mono"
                :model-value="startVal"
                :min="min"
                :max="max"
                :step="step"
                @update:model-value="(v) => (startVal = Number(v))"
            />
            <span class="text-text-muted text-xs">-</span>
            <Input
                type="number"
                class="w-20 text-xs font-mono text-right"
                :model-value="endVal"
                :min="min"
                :max="max"
                :step="step"
                @update:model-value="(v) => (endVal = Number(v))"
            />
        </div>
    </div>
</template>

<style scoped>
/* Reset inputs to stack properly */
input[type="range"] {
    -webkit-appearance: none;
    background: transparent;
}
input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    height: 16px;
    width: 16px;
    background: red; /* Debug color, hidden by opacity */
    cursor: pointer;
    pointer-events: auto;
}
input[type="range"]::-moz-range-thumb {
    height: 16px;
    width: 16px;
    cursor: pointer;
    pointer-events: auto;
}
</style>
