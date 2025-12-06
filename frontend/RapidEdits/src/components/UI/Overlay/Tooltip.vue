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
    const padding = 8; // Minimum distance from screen edge

    let pos = props.position || "bottom";

    // Helper to calculate position based on a given direction
    const calculateCoords = (
        direction: "top" | "bottom" | "left" | "right",
    ) => {
        let t = 0;
        let l = 0;
        switch (direction) {
            case "top":
                t = triggerRect.top - tooltipRect.height - gap;
                l =
                    triggerRect.left +
                    (triggerRect.width - tooltipRect.width) / 2;
                break;
            case "bottom":
                t = triggerRect.bottom + gap;
                l =
                    triggerRect.left +
                    (triggerRect.width - tooltipRect.width) / 2;
                break;
            case "left":
                t =
                    triggerRect.top +
                    (triggerRect.height - tooltipRect.height) / 2;
                l = triggerRect.left - tooltipRect.width - gap;
                break;
            case "right":
                t =
                    triggerRect.top +
                    (triggerRect.height - tooltipRect.height) / 2;
                l = triggerRect.right + gap;
                break;
        }
        return { t, l };
    };

    // Initial calculation
    let { t, l } = calculateCoords(pos);

    // Check boundary collisions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const overlapsTop = t < padding;
    const overlapsBottom = t + tooltipRect.height > viewportHeight - padding;
    const overlapsLeft = l < padding;
    const overlapsRight = l + tooltipRect.width > viewportWidth - padding;

    // Smart flipping logic
    if (pos === "top" && overlapsTop) pos = "bottom";
    else if (pos === "bottom" && overlapsBottom) pos = "top";
    else if (pos === "left" && overlapsLeft) pos = "right";
    else if (pos === "right" && overlapsRight) pos = "left";

    // Recalculate based on new pos (if flipped)
    ({ t, l } = calculateCoords(pos));

    // Clamp to viewport for secondary axis (e.g. if top/bottom, clamp left/right)
    if (pos === "top" || pos === "bottom") {
        l = Math.max(
            padding,
            Math.min(l, viewportWidth - tooltipRect.width - padding),
        );
    } else {
        // left or right
        t = Math.max(
            padding,
            Math.min(t, viewportHeight - tooltipRect.height - padding),
        );
    }

    coords.value = { top: t, left: l };
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
