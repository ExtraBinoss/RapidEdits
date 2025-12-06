<script setup lang="ts">
import { provide, ref, watch } from "vue";

const props = defineProps<{
    modelValue: string | number;
}>();

const emit = defineEmits<{
    (e: "update:modelValue", value: string | number): void;
}>();

const activeTab = ref(props.modelValue);

watch(
    () => props.modelValue,
    (newVal) => {
        activeTab.value = newVal;
    },
);

const setActiveTab = (value: string | number) => {
    activeTab.value = value;
    emit("update:modelValue", value);
};

provide("tabs", {
    activeTab,
    setActiveTab,
});
</script>

<template>
    <div class="flex flex-col">
        <slot></slot>
    </div>
</template>
