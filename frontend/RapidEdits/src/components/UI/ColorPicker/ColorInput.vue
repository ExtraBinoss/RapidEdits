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
    <div class="flex items-center gap-1.5 w-full">
        <div
            class="relative w-7 h-5 rounded overflow-hidden border border-canvas-border shadow-sm transition-all hover:border-brand-primary/50 shrink-0 bg-canvas-dark"
        >
            <input
                type="color"
                :value="modelValue"
                class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] p-0 m-0 border-0 cursor-pointer"
                @input="handleNativeInput"
            />
        </div>
        <div class="flex-1 min-w-0">
            <Input
                type="text"
                :model-value="String(modelValue || '').startsWith('#') ? String(modelValue).substring(1) : modelValue"
                class="!font-mono !uppercase !text-[10px] !h-7 !py-0 !px-1.5"
                @update:model-value="(val) => updateValue(String(val).startsWith('#') ? String(val) : '#' + val)"
            >
                <template #prepend>
                    <span class="text-text-muted/40 select-none text-[9px] font-bold">HEX</span>
                </template>
            </Input>
        </div>
    </div>
</template>
