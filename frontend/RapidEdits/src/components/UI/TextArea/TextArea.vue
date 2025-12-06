<script setup lang="ts">
defineProps<{
    modelValue: string | number;
    placeholder?: string;
    rows?: number | string;
}>();

const emit = defineEmits<{
    (e: "update:modelValue", value: string): void;
    (e: "input", value: Event): void;
}>();

const updateValue = (event: Event) => {
    const target = event.target as HTMLTextAreaElement;
    emit("update:modelValue", target.value);
    emit("input", event);
};
</script>

<template>
    <textarea
        :value="modelValue"
        :rows="rows || 3"
        :placeholder="placeholder"
        class="w-full bg-canvas-dark border border-canvas-border rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary/50 transition-all placeholder-text-muted/30 resize-y min-h-[80px]"
        @input="updateValue"
    ></textarea>
</template>
