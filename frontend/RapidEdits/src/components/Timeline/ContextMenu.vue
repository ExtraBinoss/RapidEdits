<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import { useProjectStore } from "../../stores/projectStore";
import Button from "../UI/Button.vue";
import { Trash2, Unlink, Gauge } from "lucide-vue-next";

const props = defineProps<{
    modelValue: boolean; // Is Open
    x: number;
    y: number;
    targetClipIds: string[];
}>();

const emit = defineEmits<{
    (e: "update:modelValue", val: boolean): void;
}>();

const store = useProjectStore();
const menuEl = ref<HTMLElement | null>(null);

const close = () => emit("update:modelValue", false);

const handleClickOutside = (e: MouseEvent) => {
    if (menuEl.value && !menuEl.value.contains(e.target as Node)) {
        close();
    }
};

onMounted(() => {
    setTimeout(() => {
        window.addEventListener("click", handleClickOutside);
        window.addEventListener("contextmenu", handleClickOutside);
    }, 0);
});

onBeforeUnmount(() => {
    window.removeEventListener("click", handleClickOutside);
    window.removeEventListener("contextmenu", handleClickOutside);
});

const handleDelete = () => {
    store.deleteSelectedClips();
    close();
};

const handleUnlink = () => {
    store.unlinkSelectedClips();
    close();
};
</script>

<template>
    <div
        v-if="modelValue"
        ref="menuEl"
        class="fixed z-50 bg-canvas-light border border-canvas-border rounded shadow-xl py-1 flex flex-col min-w-[200px]"
        :style="{ top: `${y}px`, left: `${x}px` }"
        @click.stop
        @contextmenu.prevent
    >
        <div
            class="px-3 py-2 text-xs text-text-muted border-b border-canvas-border mb-1"
        >
            Selected: {{ targetClipIds.length }} items
        </div>

        <!-- Actions -->
        <button
            class="flex items-center gap-2 px-3 py-2 text-sm text-text-main hover:bg-canvas-lighter w-full text-left"
            @click="handleUnlink"
        >
            <Unlink :size="14" />
            <span>Unlink Clips</span>
        </button>

        <button
            class="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-canvas-lighter hover:text-red-300 w-full text-left"
            @click="handleDelete"
        >
            <Trash2 :size="14" />
            <span>Delete</span>
        </button>

        <!-- Placeholder for Speed -->
        <div class="border-t border-canvas-border mt-1 pt-1">
            <div class="px-3 py-1 text-xs text-text-muted">
                Speed (Coming Soon)
            </div>
        </div>
    </div>
</template>
