<script setup lang="ts">
defineProps<{
    modelValue: string | number;
    placeholder?: string;
    rows?: number | string;
    id?: string;
    name?: string;
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
        :id="id"
        :name="name"
        :value="modelValue"
        :rows="rows || 3"
        :placeholder="placeholder"
        class="w-full bg-transparent border border-canvas-border rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary/50 transition-all placeholder-text-muted/30 resize-y min-h-[80px] hover:bg-canvas-dark/30 focus:bg-canvas-dark/50"
        @input="updateValue"
    ></textarea>
</template>
