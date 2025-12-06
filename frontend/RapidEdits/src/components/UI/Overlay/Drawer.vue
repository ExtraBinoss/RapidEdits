<script setup lang="ts">
import { ChevronRight } from "lucide-vue-next";

const props = defineProps<{
    title: string;
    isOpen: boolean;
    icon?: any;
}>();

const emit = defineEmits(["toggle"]);
</script>

<template>
    <div
        class="border-b border-canvas-border flex flex-col transition-all duration-300"
    >
        <button
            @click="$emit('toggle')"
            class="w-full h-12 flex items-center justify-between px-4 hover:bg-canvas-darker transition-colors outline-none"
            :class="{ 'bg-canvas-dark': props.isOpen }"
        >
            <div class="flex items-center gap-3">
                <component
                    v-if="icon"
                    :is="icon"
                    class="w-4 h-4 text-text-muted"
                    :class="{ 'text-brand-primary': props.isOpen }"
                />
                <span class="text-sm font-medium text-text-main">{{
                    title
                }}</span>
            </div>

            <ChevronRight
                class="w-4 h-4 text-text-muted transition-transform duration-300"
                :class="{ 'rotate-90': props.isOpen }"
            />
        </button>

        <div
            class="overflow-hidden transition-all duration-300 ease-in-out"
            :class="isOpen ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'"
        >
            <div
                class="p-4 bg-canvas-darker/50 border-t border-canvas-border border-dashed"
            >
                <slot />
            </div>
        </div>
    </div>
</template>
