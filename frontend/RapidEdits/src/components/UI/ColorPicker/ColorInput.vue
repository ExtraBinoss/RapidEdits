<script setup lang="ts">
import Input from "../Input/Input.vue";

defineProps<{
    modelValue: string;
}>();

const emit = defineEmits<{
    (e: "update:modelValue", value: string): void;
}>();

const updateValue = (value: string) => {
    emit("update:modelValue", value);
};

const handleNativeInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    updateValue(target.value);
};
</script>

<template>
    <div class="flex items-center gap-3">
        <div
            class="relative w-10 h-10 rounded-md overflow-hidden ring-1 ring-canvas-border shadow-sm transition-shadow hover:ring-brand-primary/50 shrink-0"
        >
            <input
                type="color"
                :value="modelValue"
                class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 m-0 border-0 cursor-pointer"
                @input="handleNativeInput"
            />
        </div>
        <div class="flex-1">
            <Input
                type="text"
                :model-value="modelValue"
                class="font-mono uppercase text-xs"
                @update:model-value="(val) => updateValue(String(val))"
            >
                <template #prepend>
                    <span class="text-text-muted select-none">#</span>
                </template>
            </Input>
        </div>
    </div>
</template>
