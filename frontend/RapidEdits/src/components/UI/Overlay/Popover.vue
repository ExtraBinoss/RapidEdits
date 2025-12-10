<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from "vue";

const isOpen = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const contentRef = ref<HTMLElement | null>(null);
const coords = ref({ top: 0, left: 0 });

const props = withDefaults(
    defineProps<{
        position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
        trigger?: "click" | "hover" | "manual";
    }>(),
    {
        position: "bottom-right",
        trigger: "click",
    },
);

const toggle = () => {
    if (props.trigger !== "manual") {
        if (isOpen.value) {
            close();
        } else {
            open();
        }
    }
};

const open = async () => {
    isOpen.value = true;
    await nextTick();
    updatePosition();
};

const close = () => {
    isOpen.value = false;
};

const updatePosition = () => {
    if (!triggerRef.value || !contentRef.value) return;
    const triggerRect = triggerRef.value.getBoundingClientRect();
    const contentRect = contentRef.value.getBoundingClientRect();
    const gap = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Default to bottom-left relative to trigger for track headers (usually better than right)
    // But let's respect the prop first

    let top = 0;
    let left = 0;

    // Basic calculation based on prop
    if (props.position === "bottom-right") {
        top = triggerRect.bottom + gap;
        left = triggerRect.right - contentRect.width;
    } else if (props.position === "bottom-left") {
        top = triggerRect.bottom + gap;
        left = triggerRect.left;
    } else if (props.position === "top-right") {
        top = triggerRect.top - contentRect.height - gap;
        left = triggerRect.right - contentRect.width;
    } else if (props.position === "top-left") {
        top = triggerRect.top - contentRect.height - gap;
        left = triggerRect.left;
    }

    // Smart adjustment: Vertical
    // If it goes below viewport, flip to top
    if (top + contentRect.height > viewportHeight) {
        top = triggerRect.top - contentRect.height - gap;
    }
    // If it goes above viewport (after flipping or initially), flip to bottom (if there's space) or clamp
    if (top < 0) {
        top = triggerRect.bottom + gap;
    }

    // Smart adjustment: Horizontal
    // If it goes off right edge
    if (left + contentRect.width > viewportWidth) {
        left = viewportWidth - contentRect.width - gap;
    }
    // If it goes off left edge
    if (left < gap) {
        left = gap; // Clamp to left edge
    }

    coords.value = { top, left };
};

// Click outside to close
const handleClickOutside = (event: MouseEvent) => {
    if (
        triggerRef.value &&
        !triggerRef.value.contains(event.target as Node) &&
        contentRef.value &&
        !contentRef.value.contains(event.target as Node)
    ) {
        close();
    }
};

onMounted(() => {
    document.addEventListener("click", handleClickOutside);
    window.addEventListener("resize", updatePosition);
});

onUnmounted(() => {
    document.removeEventListener("click", handleClickOutside);
    window.removeEventListener("resize", updatePosition);
});

defineExpose({
    open,
    close,
    toggle,
});
</script>

<template>
    <div class="relative inline-block">
        <div ref="triggerRef" @click="toggle">
            <slot name="trigger" :isOpen="isOpen"></slot>
        </div>

        <Teleport to="body">
            <Transition
                enter-active-class="transition duration-100 ease-out"
                enter-from-class="transform scale-95 opacity-0"
                enter-to-class="transform scale-100 opacity-100"
                leave-active-class="transition duration-75 ease-in"
                leave-from-class="transform scale-100 opacity-100"
                leave-to-class="transform scale-95 opacity-0"
            >
                <div
                    v-if="isOpen"
                    ref="contentRef"
                    class="fixed z-40 bg-canvas-light border border-canvas-border rounded-lg shadow-2xl p-1"
                    :style="{
                        top: `${coords.top}px`,
                        left: `${coords.left}px`,
                    }"
                >
                    <slot name="content" :close="close"></slot>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>
