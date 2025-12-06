<script setup lang="ts">
defineProps<{
    char: string;
}>();
</script>

<template>
    <span
        class="inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-[10px] font-mono font-medium text-text-main bg-canvas-dark border border-canvas-border rounded shadow-sm select-none"
    >
        {{ char }}
    </span>
</template>
