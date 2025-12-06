<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from "vue";

export interface ContextMenuItem {
    label?: string;
    action?: () => void;
    icon?: any;
    disabled?: boolean;
    danger?: boolean;
    divider?: boolean;
}

const props = defineProps<{
    items: ContextMenuItem[];
    x: number;
    y: number;
    show: boolean;
}>();

const emit = defineEmits<{
    (e: "close"): void;
}>();

const menuRef = ref<HTMLElement | null>(null);
const coords = ref({ x: 0, y: 0 });

const calculatePosition = async () => {
    if (!menuRef.value) return;

    // Wait for DOM to update and styles to apply
    await nextTick();
    await new Promise((resolve) => requestAnimationFrame(resolve));

    if (!menuRef.value) return;

    // Use offsetWidth/Height to get layout size, ignoring transforms (like scale)
    const width = menuRef.value.offsetWidth;
    const height = menuRef.value.offsetHeight;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 8;

    let left = props.x;
    let top = props.y;

    // Check if it overflows right
    if (left + width > viewportWidth - padding) {
        left = props.x - width;
    }

    // Check if it overflows bottom
    if (top + height > viewportHeight - padding) {
        top = props.y - height;
    }

    // Ensure it doesn't go off the top or left edge
    left = Math.max(padding, left);
    top = Math.max(padding, top);

    coords.value = { x: left, y: top };
};

// Recalculate when shown or coordinates change
watch(
    () => [props.show, props.x, props.y],
    ([newShow]) => {
        if (newShow) {
            // Reset to prevent flash of wrong position if needed, but usually okay
            coords.value = { x: props.x, y: props.y };
            calculatePosition();
        }
    },
);

const handleClickOutside = (event: MouseEvent) => {
    if (
        props.show &&
        menuRef.value &&
        !menuRef.value.contains(event.target as Node)
    ) {
        emit("close");
    }
};

onMounted(() => {
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", calculatePosition);
});

onUnmounted(() => {
    document.removeEventListener("mousedown", handleClickOutside);
    window.removeEventListener("resize", calculatePosition);
});
</script>

<template>
    <Teleport to="body">
        <Transition name="scale">
            <div
                v-if="show"
                ref="menuRef"
                class="fixed z-[100] min-w-[160px] py-1 bg-canvas-lighter border border-canvas-border rounded-lg shadow-xl overflow-hidden"
                :style="{
                    top: `${coords.y}px`,
                    left: `${coords.x}px`,
                }"
                @contextmenu.prevent
            >
                <template v-for="(item, index) in items" :key="index">
                    <div
                        v-if="item.divider"
                        class="h-px bg-canvas-border my-1 mx-2"
                    ></div>
                    <button
                        v-else
                        class="w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-brand-primary/10 transition-colors"
                        :class="[
                            item.danger
                                ? 'text-red-400 hover:bg-red-500/10'
                                : 'text-text-main hover:text-white',
                            item.disabled
                                ? 'opacity-50 cursor-not-allowed'
                                : 'cursor-pointer',
                        ]"
                        :disabled="item.disabled"
                        @click="
                            () => {
                                if (!item.disabled && item.action) {
                                    item.action();
                                    emit('close');
                                }
                            }
                        "
                    >
                        <component
                            v-if="item.icon"
                            :is="item.icon"
                            :size="14"
                            class="opacity-70"
                        />
                        {{ item.label }}
                    </button>
                </template>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.scale-enter-active,
.scale-leave-active {
    transition:
        opacity 0.1s ease,
        transform 0.1s ease;
}

.scale-enter-from,
.scale-leave-to {
    opacity: 0;
    transform: scale(0.95);
    transform-origin: top left;
}
</style>
