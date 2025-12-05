<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
    text: string;
    position?: "top" | "bottom" | "left" | "right";
}>();

const isVisible = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const tooltipRef = ref<HTMLElement | null>(null);
const coords = ref({ top: 0, left: 0 });

const updatePosition = () => {
    if (!triggerRef.value || !tooltipRef.value) return;

    const triggerRect = triggerRef.value.getBoundingClientRect();
    const tooltipRect = tooltipRef.value.getBoundingClientRect();
    const gap = 8;

    let top = 0;
    let left = 0;

    switch (props.position) {
        case "top":
            top = triggerRect.top - tooltipRect.height - gap;
            left =
                triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
            break;
        case "bottom":
            top = triggerRect.bottom + gap;
            left =
                triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
            break;
        case "left":
            top =
                triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
            left = triggerRect.left - tooltipRect.width - gap;
            break;
        case "right":
            top =
                triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
            left = triggerRect.right + gap;
            break;
        default: // default bottom
            top = triggerRect.bottom + gap;
            left =
                triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
    }

    coords.value = { top, left };
};

const show = () => {
    isVisible.value = true;
    // Wait for render to calculate size
    setTimeout(updatePosition, 0);
};

const hide = () => {
    isVisible.value = false;
};

// Update position on scroll/resize if needed, usually overkill for simple tooltips but good for "Pro" feel
</script>

<template>
    <div
        ref="triggerRef"
        class="inline-block"
        @mouseenter="show"
        @mouseleave="hide"
    >
        <slot></slot>

        <Teleport to="body">
            <Transition name="fade">
                <div
                    v-if="isVisible"
                    ref="tooltipRef"
                    class="fixed z-50 px-2 py-1 text-xs font-medium text-white bg-canvas-lighter border border-canvas-border rounded shadow-xl pointer-events-none whitespace-nowrap"
                    :style="{
                        top: `${coords.top}px`,
                        left: `${coords.left}px`,
                    }"
                >
                    {{ text }}
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition:
        opacity 0.15s ease,
        transform 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
    transform: scale(0.95);
}
</style>
