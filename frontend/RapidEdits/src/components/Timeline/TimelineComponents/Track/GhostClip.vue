<script setup lang="ts">
import { computed } from "vue";
import { Video, Music, Image as ImageIcon, Box } from "lucide-vue-next";

const props = defineProps<{
    ghostData: {
        duration: number;
        color: string;
        icon: any;
        name: string;
    } | null;
    x: number;
    zoomLevel: number;
}>();
</script>

<template>
    <div
        v-if="ghostData"
        class="absolute top-0 h-full opacity-40 pointer-events-none z-50 border-2 border-white/30 rounded-md overflow-hidden flex flex-col"
        :class="ghostData.color"
        :style="{
            left: `${x}px`,
            width: `${ghostData.duration * zoomLevel}px`,
        }"
    >
        <div class="flex-1 flex items-center justify-center bg-black/20">
            <component :is="ghostData.icon" class="w-6 h-6 text-white opacity-60" />
        </div>
        <div class="px-2 py-1 bg-black/40 text-[10px] text-white font-medium truncate">
            {{ ghostData.name }}
        </div>
    </div>
</template>
