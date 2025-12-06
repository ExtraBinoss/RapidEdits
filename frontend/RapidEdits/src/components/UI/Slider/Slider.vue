<script setup lang="ts">
import Input from "../Input/Input.vue";

interface Props {
    modelValue: number;
    min?: number;
    max?: number;
    step?: number;
}

withDefaults(defineProps<Props>(), {
    min: 0,
    max: 100,
    step: 1,
});

const emit = defineEmits<{
    (e: "update:modelValue", value: number): void;
}>();

const updateValue = (value: number) => {
    emit("update:modelValue", value);
};

const handleRangeInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    updateValue(Number(target.value));
};
</script>

<template>
    <div class="flex items-center gap-3">
        <input
            type="range"
            :value="modelValue"
            :min="min"
            :max="max"
            :step="step"
            class="flex-1 h-1.5 bg-canvas-border rounded-lg appearance-none cursor-pointer accent-brand-primary hover:accent-brand-accent transition-all"
            @input="handleRangeInput"
        />
        <Input
            type="number"
            class="w-20 shrink-0 text-right font-mono"
            :model-value="modelValue"
            :min="min"
            :max="max"
            :step="step"
            @update:model-value="(val) => updateValue(Number(val))"
        />
    </div>
</template>
