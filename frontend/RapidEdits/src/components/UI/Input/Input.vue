<script setup lang="ts">
import { useSlots } from "vue";

defineProps<{
    modelValue: string | number;
    placeholder?: string;
    type?: string;
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
        class="flex items-center bg-canvas-dark border border-canvas-border rounded-md px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all"
    >
        <div v-if="slots.prepend" class="mr-2 text-text-muted">
            <slot name="prepend"></slot>
        </div>
        <input
            :type="type || 'text'"
            :value="modelValue"
            :placeholder="placeholder"
            class="bg-transparent border-none outline-none text-text-main w-full placeholder-text-muted/50"
            @input="updateValue"
        />
        <div v-if="slots.append" class="ml-2 text-text-muted">
            <slot name="append"></slot>
        </div>
    </div>
</template>
