<script setup lang="ts">
import { defineProps } from "vue";

const props = defineProps<{
    size?: string; // Tailwind width/height class e.g. "w-8 h-8"
    className?: string; // Extra classes
}>();
</script>

<template>
    <div
        class="rounded bg-brand-gradient flex items-center justify-center text-white font-bold shadow-lg shadow-brand-primary/20 select-none"
        :class="[props.size || 'w-8 h-8', props.className]"
        :style="{ fontFamily: `'Gliker', sans-serif` }"
    >
        <span class="translate-y-[0px]">RE</span>
    </div>
</template>
