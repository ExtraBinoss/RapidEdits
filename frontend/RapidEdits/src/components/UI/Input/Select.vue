<template>
    <div class="relative" ref="container">
        <label
            v-if="label"
            class="block text-sm font-medium text-gray-400 mb-1"
            >{{ label }}</label
        >

        <button
            @click="isOpen = !isOpen"
            class="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white flex justify-between items-center focus:outline-none focus:border-blue-500 hover:border-gray-600 transition-colors"
        >
            <span class="truncate">{{ selectedLabel }}</span>
            <component
                :is="ChevronDown"
                class="w-4 h-4 text-gray-400 transition-transform"
                :class="{ 'rotate-180': isOpen }"
            />
        </button>

        <div
            v-if="isOpen"
            class="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded shadow-lg max-h-60 overflow-y-auto"
        >
            <div
                v-for="option in options"
                :key="option.value"
                @click="select(option)"
                class="px-3 py-2 text-white hover:bg-gray-700 cursor-pointer text-sm flex items-center justify-between group"
                :class="{ 'bg-blue-900/30': modelValue === option.value }"
            >
                <span>{{ option.label }}</span>
                <span
                    v-if="option.subLabel"
                    class="text-xs text-gray-500 group-hover:text-gray-400"
                    >{{ option.subLabel }}</span
                >
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { ChevronDown } from "lucide-vue-next";

interface Option {
    label: string;
    value: any;
    subLabel?: string;
}

const props = defineProps<{
    modelValue: any;
    options: Option[];
    label?: string;
}>();

const emit = defineEmits(["update:modelValue"]);

const isOpen = ref(false);
const container = ref<HTMLElement | null>(null);

const selectedLabel = computed(() => {
    const opt = props.options.find((o) => o.value === props.modelValue);
    return opt ? opt.label : String(props.modelValue);
});

const select = (option: Option) => {
    emit("update:modelValue", option.value);
    isOpen.value = false;
};

// Click outside
const handleClickOutside = (e: MouseEvent) => {
    if (container.value && !container.value.contains(e.target as Node)) {
        isOpen.value = false;
    }
};

onMounted(() => document.addEventListener("click", handleClickOutside));
onUnmounted(() => document.removeEventListener("click", handleClickOutside));
</script>
