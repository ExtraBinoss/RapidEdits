<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from "vue";

const internalIsOpen = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const contentRef = ref<HTMLElement | null>(null);
const coords = ref({ top: 0, left: 0, width: 0 });
let resizeObserver: ResizeObserver | null = null;

const props = withDefaults(
    defineProps<{
        isOpen?: boolean;
        modelValue?: boolean;
        position?: "bottom-right" | "bottom-left" | "top-right" | "top-left" | "bottom" | "top" | "right" | "left";
        align?: "start" | "center" | "end";
        trigger?: "click" | "hover" | "manual";
        matchWidth?: boolean;
        offset?: number;
        zIndex?: number;
        anchorPoint?: { x: number; y: number } | null;
        referenceEl?: HTMLElement | null;
        transparent?: boolean;
    }>(),
    {
        isOpen: undefined,
        modelValue: undefined,
        position: "bottom-left",
        align: "start",
        trigger: "click",
        matchWidth: false,
        offset: 8,
        zIndex: 40,
        anchorPoint: null,
        referenceEl: null,
        transparent: false,
    },
);

const emit = defineEmits(["update:isOpen", "update:modelValue"]);

const isActuallyOpen = computed({
    get: () => {
        if (props.isOpen !== undefined) return props.isOpen;
        if (props.modelValue !== undefined) return props.modelValue;
        return internalIsOpen.value;
    },
    set: (val) => {
        if (props.isOpen !== undefined) emit("update:isOpen", val);
        if (props.modelValue !== undefined) emit("update:modelValue", val);
        internalIsOpen.value = val;
    },
});

watch(isActuallyOpen, (val) => {
    if (val) {
        nextTick(() => {
            if (contentRef.value) {
                updatePosition(); // Immediate manual call
                resizeObserver = new ResizeObserver(() => {
                    updatePosition();
                });
                resizeObserver.observe(contentRef.value);
                if (triggerRef.value) {
                    resizeObserver.observe(triggerRef.value);
                }
            }
        });
    } else {
        resizeObserver?.disconnect();
    }
});

const toggle = () => {
    if (props.trigger !== "manual") {
        if (isActuallyOpen.value) {
            close();
        } else {
            open();
        }
    }
};

const open = async () => {
    isActuallyOpen.value = true;
};

const close = () => {
    isActuallyOpen.value = false;
};

const updatePosition = () => {
    if (!contentRef.value) return;

    let triggerRect: { top: number; left: number; right: number; bottom: number; width: number; height: number };

    if (props.anchorPoint) {
        triggerRect = {
            top: props.anchorPoint.y,
            bottom: props.anchorPoint.y,
            left: props.anchorPoint.x,
            right: props.anchorPoint.x,
            width: 0,
            height: 0,
        };
    } else if (props.referenceEl) {
        const rect = props.referenceEl.getBoundingClientRect();
        triggerRect = {
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            width: rect.width,
            height: rect.height,
        };
    } else if (triggerRef.value) {
        const rect = triggerRef.value.getBoundingClientRect();
        triggerRect = {
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            width: rect.width,
            height: rect.height,
        };
    } else {
        return;
    }
    
    // Use offsetWidth/Height to avoid transform interference (like scale-95 in transition)
    const contentWidth = contentRef.value.offsetWidth;
    const contentHeight = contentRef.value.offsetHeight;
    
    const gap = props.offset;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = 0;
    let left = 0;
    let width = props.matchWidth ? triggerRect.width : 0;
    let currentPos = props.position;

    // Flip logic: Horizontal (for right/left)
    if (currentPos === "right" && triggerRect.right + gap + contentWidth > viewportWidth - gap) {
        currentPos = "left";
    } else if (currentPos === "left" && triggerRect.left - gap - contentWidth < gap) {
        currentPos = "right";
    }

    // Flip logic: Vertical (for top/bottom)
    if (currentPos.startsWith("bottom") && triggerRect.bottom + gap + contentHeight > viewportHeight - gap) {
        currentPos = currentPos.replace("bottom", "top") as any;
    } else if (currentPos.startsWith("top") && triggerRect.top - gap - contentHeight < gap) {
        currentPos = currentPos.replace("top", "bottom") as any;
    }

    // Position logic
    if (currentPos.startsWith("bottom")) {
        top = triggerRect.bottom + gap;
    } else if (currentPos.startsWith("top")) {
        top = triggerRect.top - contentHeight - gap;
    } else if (currentPos === "right" || currentPos === "left") {
        top = triggerRect.top;
    }

    // Alignment logic
    if (currentPos.startsWith("bottom") || currentPos.startsWith("top")) {
        if (props.align === "start") {
            left = triggerRect.left;
        } else if (props.align === "center") {
            left = triggerRect.left + triggerRect.width / 2 - contentWidth / 2;
        } else if (props.align === "end") {
            left = triggerRect.right - contentWidth;
        }
    } else if (currentPos === "right") {
        left = triggerRect.right + gap;
    } else if (currentPos === "left") {
        left = triggerRect.left - contentWidth - gap;
    }

    // Secondary overflow adjustments
    if (top + contentHeight > viewportHeight - gap) {
        top = viewportHeight - contentHeight - gap;
    }
    if (top < gap) {
        top = gap;
    }

    if (left + contentWidth > viewportWidth - gap) {
        left = viewportWidth - contentWidth - gap;
    }
    if (left < gap) {
        left = gap;
    }

    coords.value = { top, left, width };
};

// Click outside to close
const handleClickOutside = (event: MouseEvent) => {
    if (
        triggerRef.value &&
        !triggerRef.value.contains(event.target as Node) &&
        contentRef.value &&
        !contentRef.value.contains(event.target as Node) &&
        (!props.referenceEl || !props.referenceEl.contains(event.target as Node))
    ) {
        close();
    }
};

const handleScroll = () => {
    if (isActuallyOpen.value) {
        updatePosition();
    }
};

onMounted(() => {
    document.addEventListener("click", handleClickOutside);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", handleScroll, true);
});

onUnmounted(() => {
    document.removeEventListener("click", handleClickOutside);
    window.removeEventListener("resize", updatePosition);
    window.removeEventListener("scroll", handleScroll, true);
});

defineExpose({
    open,
    close,
    toggle,
});
</script>

<template>
    <div class="relative inline-block">
        <div ref="triggerRef" @click="toggle" class="w-full h-full">
            <slot name="trigger" :isOpen="isActuallyOpen"></slot>
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
                    v-if="isActuallyOpen"
                    ref="contentRef"
                    class="fixed border border-canvas-border shadow-2xl overflow-hidden rounded-lg"
                    :class="[transparent ? 'bg-transparent border-none shadow-none' : 'bg-canvas-light']"
                    :style="{
                        top: `${coords.top}px`,
                        left: `${coords.left}px`,
                        minWidth: props.matchWidth ? `max(${coords.width}px, 120px)` : 'auto',
                        width: 'auto',
                        maxWidth: 'min(90vw, 400px)',
                        zIndex: props.zIndex
                    }"
                >
                    <slot name="content" :close="close"></slot>
                    <slot :close="close"></slot>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>
