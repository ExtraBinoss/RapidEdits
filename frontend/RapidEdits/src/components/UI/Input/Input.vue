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
const hasMoved = ref(false);

const updateValue = (val: string | number) => {
    emit("update:modelValue", val);
};

const handleInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    
    if (props.type === 'number') {
        // Remove any non-numeric characters except for the first decimal point
        let sanitized = target.value.replace(/[^0-9.]/g, '');
        const parts = sanitized.split('.');
        if (parts.length > 2) {
            sanitized = parts[0] + '.' + parts.slice(1).join('');
        }
        
        if (target.value !== sanitized) {
            target.value = sanitized;
        }
        
        const numValue = parseFloat(sanitized);
        updateValue(isNaN(numValue) ? 0 : numValue);
    } else {
        updateValue(target.value);
    }
};

const handleKeyDown = (e: KeyboardEvent) => {
    if (props.type !== 'number') return;

    // Allow: backspace, delete, tab, escape, enter, .
    if ([46, 8, 9, 27, 13, 110, 190].indexOf(e.keyCode) !== -1 ||
        // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
        (e.keyCode === 65 && (e.ctrlKey === true || e.metaKey === true)) ||
        (e.keyCode === 67 && (e.ctrlKey === true || e.metaKey === true)) ||
        (e.keyCode === 86 && (e.ctrlKey === true || e.metaKey === true)) ||
        (e.keyCode === 88 && (e.ctrlKey === true || e.metaKey === true)) ||
        // Allow: home, end, left, right
        (e.keyCode >= 35 && e.keyCode <= 39)) {
            return;
    }
    
    // Ensure that it is a number and stop the keypress
    if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
        e.preventDefault();
    }
};

const handleMouseDown = (e: MouseEvent) => {
    // Only drag if it's a number and NOT already focused
    if (props.type !== 'number' || document.activeElement === e.target) return;
    
    startX.value = e.clientX;
    startValue.value = Number(props.modelValue) || 0;
    hasMoved.value = false;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = Math.abs(moveEvent.clientX - startX.value);
        if (!isDragging.value && delta > 3) {
            isDragging.value = true;
            document.body.style.cursor = 'ew-resize';
        }
        
        if (isDragging.value) {
            hasMoved.value = true;
            handleMouseMove(moveEvent);
        }
    };

    const onMouseUp = () => {
        if (!hasMoved.value && !isDragging.value) {
            // It was a click, focus the input
            (e.target as HTMLInputElement).focus();
            (e.target as HTMLInputElement).select();
        }
        
        isDragging.value = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    
    // Prevent immediate focus so we can distinguish between drag and click
    e.preventDefault();
};

const handleMouseMove = (e: MouseEvent) => {
    const delta = e.clientX - startX.value;
    let sensitivity = props.step || 1.0; 
    
    if (e.shiftKey) sensitivity *= 10;
    if (e.altKey) sensitivity *= 0.1;
    
    const change = delta * sensitivity;
    let newValue = startValue.value + change;
    
    newValue = Math.round(newValue * 100) / 100;
    updateValue(newValue);
};
</script>

<template>
    <div
        class="group flex items-center bg-canvas-dark border border-canvas-border rounded transition-all hover:bg-canvas-lighter focus-within:ring-1 focus-within:ring-brand-primary/50 focus-within:border-brand-primary/50 focus-within:shadow-[0_0_0_2px_rgba(49,110,160,0.15)] relative"
        :class="[
            size === 'tiny' ? 'h-7 px-1.5' : 'h-8 px-2',
            type === 'number' ? 'cursor-ew-resize' : ''
        ]"
    >
        <div v-if="slots.prepend" class="mr-1.5 text-text-muted/40 flex items-center select-none pointer-events-none">
            <slot name="prepend"></slot>
        </div>
        <input
            :type="type === 'number' ? 'text' : (type || 'text')"
            :value="modelValue"
            :placeholder="placeholder"
            class="bg-transparent border-none outline-none text-text-main w-full placeholder-text-muted/20 text-[12px] font-semibold tracking-tight appearance-none"
            :class="type === 'number' ? 'cursor-ew-resize focus:cursor-text' : ''"
            @input="handleInput"
            @keydown="handleKeyDown"
            @mousedown="handleMouseDown"
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
  appearance: none;
}
</style>
