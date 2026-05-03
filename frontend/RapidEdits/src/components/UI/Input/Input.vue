<script setup lang="ts">
import { useSlots } from "vue";

defineProps<{
    modelValue: string | number;
    placeholder?: string;
    type?: string;
    size?: "tiny" | "small" | "medium";
}>();

const emit = defineEmits<{
    (e: "update:modelValue", value: string | number): void;
}>();

const slots = useSlots();

const updateValue = (event: Event) => {
    const target = event.target as HTMLInputElement;
    emit("update:modelValue", target.value);
};
</script>

<template>
    <div
        class="group flex items-center bg-canvas-dark border border-canvas-border rounded transition-all hover:bg-canvas-lighter focus-within:ring-1 focus-within:ring-brand-primary/50 focus-within:border-brand-primary/50 focus-within:shadow-[0_0_0_2px_rgba(49,110,160,0.15)]"
        :class="size === 'tiny' ? 'h-6 px-1.5' : 'h-7 px-2'"
    >
        <div v-if="slots.prepend" class="mr-1.5 text-text-muted/40 flex items-center select-none">
            <slot name="prepend"></slot>
        </div>
        <input
            :type="type || 'text'"
            :value="modelValue"
            :placeholder="placeholder"
            class="bg-transparent border-none outline-none text-text-main w-full placeholder-text-muted/20 text-[11px] font-semibold tracking-tight"
            @input="updateValue"
        />
        <div v-if="slots.append" class="ml-1.5 text-text-muted/40 flex items-center select-none">
            <slot name="append"></slot>
        </div>
    </div>
</template>
