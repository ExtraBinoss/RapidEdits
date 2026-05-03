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
    <div
        class="group relative flex flex-col bg-canvas-dark border border-canvas-border rounded transition-all hover:bg-canvas-lighter focus-within:ring-1 focus-within:ring-brand-primary/50 focus-within:border-brand-primary/50 focus-within:shadow-[0_0_0_2px_rgba(49,110,160,0.15)] overflow-hidden"
    >
        <textarea
            :id="id"
            :name="name"
            :value="modelValue"
            :rows="rows || 2"
            :placeholder="placeholder"
            class="w-full bg-transparent border-none outline-none text-text-main px-2 py-1.5 text-[12px] font-semibold tracking-tight placeholder-text-muted/20 resize-y min-h-[40px]"
            @input="updateValue"
        ></textarea>
        
        <!-- Subtle line count or indicator could go here in future -->
    </div>
</template>
