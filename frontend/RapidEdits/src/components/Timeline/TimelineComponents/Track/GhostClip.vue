<script setup lang="ts">
import { computed } from "vue";
import { Video, Music, Image as ImageIcon, Box } from "lucide-vue-next";

const props = defineProps<{
    ghostData: {
        duration: number;
        color: string;
        icon: any;
        name: string;
        type?: string;
        transitionSlot?: string;
    } | null;
    x: number;
    zoomLevel: number;
}>();

const isTransition = computed(() => props.ghostData?.type === 'transition');

const transitionStyle = computed(() => {
    if (!isTransition.value || !props.ghostData) return {};
    
    const slot = props.ghostData.transitionSlot || 'in';
    
    // Create a curve effect using clip-path
    const clipPath = slot === 'in' 
        ? 'polygon(0 100%, 100% 0, 100% 100%, 0 100%)' 
        : 'polygon(0 0, 100% 100%, 100% 100%, 0 100%)';
        
    return {
        clipPath,
        borderRadius: '0px',
        backgroundColor: '#10b981', // Emerald 500
        boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)',
    };
});
</script>

<template>
    <div
        v-if="ghostData"
        class="absolute top-1 bottom-1 h-auto opacity-40 pointer-events-none z-20 border-2 border-white/30 rounded-md overflow-hidden flex flex-col transition-all"
        :class="[
            ghostData.color, 
            isTransition ? '!top-0 !bottom-0 !border-0 opacity-80 animate-pulse' : ''
        ]"
        :style="{
            left: '0px',
            transform: `translate3d(${x}px, 0, 0)`,
            width: `${(isTransition ? (ghostData.duration || 1.0) : ghostData.duration) * zoomLevel}px`,
            willChange: 'transform',
            ...transitionStyle
        }"
    >
        <div class="flex-1 flex items-center justify-center bg-black/20">
            <component :is="ghostData.icon" :class="isTransition ? 'w-4 h-4 text-white' : 'w-6 h-6'" class="text-white opacity-90" />
        </div>
        <div v-if="!isTransition" class="px-2 py-1 bg-black/40 text-[10px] text-white font-medium truncate">
            {{ ghostData.name }}
        </div>
    </div>
</template>
