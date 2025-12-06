<script setup lang="ts">
import { inject, computed } from "vue";

const props = defineProps<{
    value: string | number;
}>();

const tabs = inject("tabs") as {
    activeTab: { value: string | number };
};

const isActive = computed(() => tabs.activeTab.value === props.value);
</script>

<template>
    <div v-show="isActive" class="flex-1 flex flex-col h-full overflow-hidden">
        <slot></slot>
    </div>
</template>
