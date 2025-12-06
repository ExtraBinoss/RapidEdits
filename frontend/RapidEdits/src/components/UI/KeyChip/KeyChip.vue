<script setup lang="ts">
defineProps<{
    char: string;
}>();
</script>

<template>
    <span
        class="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] leading-none font-mono font-medium text-text-main bg-canvas-dark border border-canvas-border rounded shadow-sm select-none pt-[1px]"
    >
        {{ char }}
    </span>
</template>
