<script setup lang="ts">
import { ref, onMounted } from "vue";
import { Play, Pause, Volume2 } from "lucide-vue-next";
import { globalEventBus } from "../../core/EventBus";

const isVisible = ref(false);
const icon = ref<any>(Play);
const label = ref("");

let timeout: number | null = null;

const getIconComponent = (name: string) => {
    switch (name) {
        case "Play":
            return Play;
        case "Pause":
            return Pause;
        case "Volume":
            return Volume2;
        default:
            return Play;
    }
};

onMounted(() => {
    globalEventBus.on("SHOW_FEEDBACK", (payload: any) => {
        if (timeout) clearTimeout(timeout);

        icon.value = getIconComponent(payload.icon);
        label.value = payload.text || "";
        isVisible.value = true;

        timeout = window.setTimeout(() => {
            isVisible.value = false;
        }, 800);
    });
});
</script>

<template>
    <Transition name="fade">
        <div
            v-if="isVisible"
            class="absolute bottom-8 right-8 z-50 flex flex-col items-center justify-center w-20 h-20 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 shadow-2xl pointer-events-none"
        >
            <component
                :is="icon"
                :size="32"
                class="text-white/90 drop-shadow-lg mb-1"
                fill="currentColor"
            />
            <span
                v-if="label"
                class="text-xs font-bold text-white/90 drop-shadow-md"
                >{{ label }}</span
            >
        </div>
    </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition:
        opacity 0.2s ease,
        transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
}
</style>
