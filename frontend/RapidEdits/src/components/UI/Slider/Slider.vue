<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import Input from "../Input/Input.vue";

interface Props {
    modelValue: number;
    min?: number;
    max?: number;
    step?: number;
}

const props = withDefaults(defineProps<Props>(), {
    min: 0,
    max: 100,
    step: 1,
});

const emit = defineEmits<{
    (e: "update:modelValue", value: number): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);

const percentage = computed(() => {
    const range = props.max - props.min;
    if (range === 0) return 0;
    const clamped = Math.max(props.min, Math.min(props.max, props.modelValue));
    return ((clamped - props.min) / range) * 100;
});

function getValueFromX(clientX: number): number {
    if (!containerRef.value) return props.modelValue;
    const rect = containerRef.value.getBoundingClientRect();
    
    let ratio = (clientX - rect.left) / rect.width;
    ratio = Math.max(0, Math.min(1, ratio));

    const range = props.max - props.min;
    let rawValue = props.min + ratio * range;

    if (props.step > 0) {
        const steps = Math.round((rawValue - props.min) / props.step);
        rawValue = props.min + steps * props.step;
    }

    return Math.max(props.min, Math.min(props.max, rawValue));
}

function formatValue(val: number): number {
    if (Number.isInteger(props.step)) {
        return Math.round(val);
    }
    const stepStr = props.step.toString();
    const decimals = stepStr.indexOf('.') >= 0 ? stepStr.split('.')[1].length : 0;
    return Number(val.toFixed(decimals));
}

function onMouseDown(e: MouseEvent) {
    e.preventDefault();
    isDragging.value = true;

    const newVal = formatValue(getValueFromX(e.clientX));
    if (newVal !== props.modelValue) {
        emit('update:modelValue', newVal);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
}

function onMouseMove(e: MouseEvent) {
    if (!isDragging.value) return;
    const newVal = formatValue(getValueFromX(e.clientX));
    if (newVal !== props.modelValue) {
        emit('update:modelValue', newVal);
    }
}

function onMouseUp() {
    isDragging.value = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
}

onUnmounted(() => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
});

const updateValue = (value: number) => {
    emit("update:modelValue", value);
};
</script>

<template>
    <div class="flex items-center gap-2">
        <div
            ref="containerRef"
            class="relative flex-1 h-5 flex items-center cursor-pointer select-none group"
            @mousedown="onMouseDown"
            :class="{ 'cursor-grabbing': isDragging }"
        >
            <!-- Track Background -->
            <div class="w-full h-1.5 bg-canvas-border rounded-full overflow-hidden relative">
                <!-- Track Fill (Gradient) -->
                <div 
                    class="absolute top-0 left-0 h-full bg-brand-gradient rounded-full"
                    :class="{ 'transition-none': isDragging, 'transition-all duration-150 ease-out': !isDragging }"
                    :style="{ width: percentage + '%' }"
                ></div>
            </div>

            <!-- Thumb Handle -->
            <div
                class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-2 border-brand-primary rounded-full shadow-md pointer-events-none"
                :class="[
                    isDragging ? 'scale-125 border-white bg-brand-accent transition-none' : 'group-hover:scale-110 transition-all duration-150 ease-out'
                ]"
                :style="{ left: percentage + '%' }"
            ></div>
        </div>
        
        <Input
            type="number"
            class="w-14 shrink-0 !text-right !font-mono !px-1"
            :model-value="modelValue"
            :min="min"
            :max="max"
            :step="step"
            @update:model-value="(val) => updateValue(Number(val))"
        />
    </div>
</template>
