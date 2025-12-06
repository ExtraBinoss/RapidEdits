<script setup lang="ts">
defineProps<{
    modelValue: boolean;
    labelOn?: string;
    labelOff?: string;
}>();

const emit = defineEmits<{
    (e: "update:modelValue", value: boolean): void;
}>();

const updateValue = (event: Event) => {
    const target = event.target as HTMLInputElement;
    emit("update:modelValue", target.checked);
};
</script>

<template>
    <div class="flex items-center">
        <label class="relative inline-flex items-center cursor-pointer">
            <input
                type="checkbox"
                :checked="modelValue"
                class="sr-only peer"
                @change="updateValue"
            />
            <div
                class="w-9 h-5 bg-canvas-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary border border-transparent"
            ></div>
            <span class="ml-3 text-sm text-text-main select-none">
                <slot>
                    {{ modelValue ? labelOn || "On" : labelOff || "Off" }}
                </slot>
            </span>
        </label>
    </div>
</template>
