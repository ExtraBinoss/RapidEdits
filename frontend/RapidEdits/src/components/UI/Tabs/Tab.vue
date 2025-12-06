<script setup lang="ts">
import { inject, computed } from "vue";

const props = defineProps<{
    value: string | number;
    activeClass?: string;
}>();

const tabs = inject("tabs") as {
    activeTab: { value: string | number };
    setActiveTab: (val: string | number) => void;
};

const isActive = computed(() => tabs.activeTab.value === props.value);

const handleClick = () => {
    tabs.setActiveTab(props.value);
};
</script>

<template>
    <button
        class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-200"
        :class="[
            isActive
                ? activeClass || 'bg-canvas-dark text-text-main shadow-sm'
                : 'text-text-muted hover:text-text-main hover:bg-canvas-dark/50',
        ]"
        @click="handleClick"
    >
        <slot></slot>
    </button>
</template>
