<template>
    <Teleport to="body">
        <Transition name="dialog-fade">
            <div
                v-if="isOpen"
                class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                @click="closeOnBackdrop ? $emit('close') : null"
            >
                <div
                    class="bg-canvas border border-canvas-border rounded-lg shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[90vh]"
                    @click.stop
                >
                    <!-- Header -->
                    <div
                        class="flex items-center justify-between p-4 border-b border-canvas-border"
                    >
                        <h3 class="text-text-main font-medium">{{ title }}</h3>
                        <button
                            @click="$emit('close')"
                            class="text-text-muted hover:text-text-main transition-colors"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <path d="M18 6 6 18" />
                                <path d="m6 6 12 12" />
                            </svg>
                        </button>
                    </div>

                    <!-- Content -->
                    <div class="p-4 overflow-y-auto custom-scrollbar text-sm text-text-main">
                        <slot />
                    </div>

                    <!-- Footer -->
                    <div
                        v-if="$slots.footer"
                        class="p-4 border-t border-canvas-border bg-canvas-darker rounded-b-lg flex justify-end gap-2"
                    >
                        <slot name="footer" />
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from "vue";

defineProps({
    isOpen: {
        type: Boolean,
        required: true,
    },
    title: {
        type: String,
        default: "Dialog",
    },
    closeOnBackdrop: {
        type: Boolean,
        default: true,
    },
});

defineEmits(["close"]);
</script>

<style scoped>
.dialog-fade-enter-active,
.dialog-fade-leave-active {
    transition: opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
    opacity: 0;
}
</style>
