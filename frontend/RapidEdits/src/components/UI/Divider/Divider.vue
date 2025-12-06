<script setup lang="ts">
interface Props {
    orientation?: "horizontal" | "vertical";
}

withDefaults(defineProps<Props>(), {
    orientation: "vertical",
});
</script>

<template>
    <div
        :class="[
            'bg-canvas-border',
            orientation === 'vertical'
                ? 'h-4 w-[1px] mx-2'
                : 'w-full h-[1px] my-1',
        ]"
    ></div>
</template>
