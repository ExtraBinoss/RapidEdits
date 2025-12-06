<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { globalEventBus } from "../../core/events/EventBus";

const ambientShadow = ref<string>("transparent");

const handleAmbientUpdate = (color: any) => {
    ambientShadow.value = color;
};

onMounted(() => {
    globalEventBus.on("AMBIENT_COLOR_UPDATE", handleAmbientUpdate);
});

onBeforeUnmount(() => {
    globalEventBus.off("AMBIENT_COLOR_UPDATE", handleAmbientUpdate);
});
</script>

<template>
    <div
        class="absolute inset-0 pointer-events-none transition-shadow duration-700 ease-out -z-10 rounded-lg"
        :style="{ boxShadow: `0 0 150px 20px ${ambientShadow}` }"
    ></div>
</template>
