<template>
    <div class="border border-canvas-border rounded-lg bg-canvas-lighter overflow-hidden mt-2 first:mt-0 shadow-sm">
        <button 
            @click="isOpen = !isOpen" 
            class="w-full flex items-center justify-between px-3 py-2.5 bg-canvas-dark/30 hover:bg-canvas-dark/60 transition-colors select-none"
        >
            <span class="text-xs font-bold uppercase tracking-wider text-text-main/80">{{ title }}</span>
            <div class="flex items-center gap-2">
                <slot name="action"></slot>
                <component :is="isOpen ? ChevronUp : ChevronDown" class="w-4 h-4 text-text-muted/70 transition-transform duration-200" />
            </div>
        </button>
        
        <div 
            v-if="isOpen" 
            class="p-2 space-y-1 bg-canvas-lighter"
        >
            <slot></slot>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { ChevronDown, ChevronUp } from 'lucide-vue-next';

const props = defineProps<{
    title: string;
    defaultOpen?: boolean;
}>();

const isOpen = ref(props.defaultOpen ?? false);

// Optional: allow external control if needed later
watch(() => props.defaultOpen, (newVal) => {
    if (newVal !== undefined) {
        isOpen.value = newVal;
    }
});
</script>
