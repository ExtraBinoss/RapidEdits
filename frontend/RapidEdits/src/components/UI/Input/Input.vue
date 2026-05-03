<script setup lang="ts">
import { useSlots, ref } from "vue";

const props = defineProps<{
    modelValue: string | number;
    placeholder?: string;
    type?: string;
    size?: "tiny" | "small" | "medium";
    step?: number;
}>();

const emit = defineEmits<{
    (e: "update:modelValue", value: string | number): void;
}>();

const slots = useSlots();
const isDragging = ref(false);
const startX = ref(0);
const startValue = ref(0);

const updateValue = (val: string | number) => {
    emit("update:modelValue", val);
};

const handleInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    updateValue(target.value);
};

const handleMouseDown = (e: MouseEvent) => {
    if (props.type !== 'number' || document.activeElement === e.target) return;
    
    isDragging.value = true;
    startX.value = e.clientX;
    startValue.value = Number(props.modelValue) || 0;
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'ew-resize';
    
    // Prevent text selection while dragging
    e.preventDefault();
};

const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.value) return;
    
    const delta = e.clientX - startX.value;
    let sensitivity = props.step || 0.2; // Default to 0.2 as requested
    
    // Modifier keys for speed
    if (e.shiftKey) sensitivity *= 5;
    if (e.altKey) sensitivity *= 0.1;
    
    const change = delta * sensitivity;
    let newValue = startValue.value + change;
    
    // Clamp to 2 decimal places for clean UI
    newValue = Math.round(newValue * 100) / 100;
    
    updateValue(newValue);
};

const handleMouseUp = () => {
    isDragging.value = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
};
</script>

<template>
    <div
        class="group flex items-center bg-canvas-dark border border-canvas-border rounded transition-all hover:bg-canvas-lighter focus-within:ring-1 focus-within:ring-brand-primary/50 focus-within:border-brand-primary/50 focus-within:shadow-[0_0_0_2px_rgba(49,110,160,0.15)] relative"
        :class="[
            size === 'tiny' ? 'h-7 px-1.5' : 'h-8 px-2',
            type === 'number' ? 'cursor-ew-resize' : ''
        ]"
        @mousedown="handleMouseDown"
    >
        <div v-if="slots.prepend" class="mr-1.5 text-text-muted/40 flex items-center select-none pointer-events-none">
            <slot name="prepend"></slot>
        </div>
        <input
            :type="type || 'text'"
            :value="modelValue"
            :placeholder="placeholder"
            class="bg-transparent border-none outline-none text-text-main w-full placeholder-text-muted/20 text-[12px] font-semibold tracking-tight appearance-none"
            :class="type === 'number' ? 'cursor-ew-resize focus:cursor-text' : ''"
            @input="handleInput"
        />
        <div v-if="slots.append" class="ml-1.5 text-text-muted/40 flex items-center select-none pointer-events-none">
            <slot name="append"></slot>
        </div>
    </div>
</template>

<style scoped>
/* Hide arrows for number input */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type=number] {
  -moz-appearance: textfield;
}
</style>
