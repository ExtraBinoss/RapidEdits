<script setup lang="ts">
import { ref, computed, watch } from "vue";
import Popover from "../Overlay/Popover.vue";
import { ChevronDown } from "lucide-vue-next";

interface SelectOption {
    kind?: "option";
    value?: any;
    label: string;
    subLabel?: string;
    imageSrc?: string;
    imageAlt?: string;
}

interface SelectSeparator {
    kind: "separator";
    label: string;
}

type SelectItem = SelectOption | SelectSeparator;

const props = withDefaults(
    defineProps<{
        modelValue: any;
        options: SelectItem[];
        placeholder?: string;
        disabled?: boolean;
        icon?: any;
        size?: "tiny" | "small" | "medium";
        matchWidth?: boolean;
        maxHeight?: string;
        label?: string;
    }>(),
    {
        placeholder: "Select an option",
        disabled: false,
        size: "medium",
        matchWidth: true,
        maxHeight: "320px",
    },
);

const emit = defineEmits(["update:modelValue"]);

const isOpen = ref(false);

const selectedOption = computed(() => {
    return props.options.find(
        (option) =>
            option.kind !== "separator" && option.value === props.modelValue,
    ) as SelectOption | undefined;
});

const selectOption = (option: SelectItem) => {
    if (option.kind === "separator") return;
    emit("update:modelValue", (option as SelectOption).value);
    isOpen.value = false;
};

// Hover Scroll Logic for long labels
const triggerScrollDist = ref(0);
const isTriggerScrolling = ref(false);
const activeOptionValue = ref<any>(null);
const activeOptionScrollDist = ref(0);

const handleTriggerEnter = (e: MouseEvent) => {
    const target = (e.currentTarget as HTMLElement).querySelector(
        ".select-text-inner",
    ) as HTMLElement;
    if (!target) return;
    const scrollWidth = target.scrollWidth;
    const clientWidth = target.clientWidth;
    if (scrollWidth > clientWidth) {
        triggerScrollDist.value = scrollWidth - clientWidth + 12;
        isTriggerScrolling.value = true;
    }
};

const handleTriggerLeave = () => {
    isTriggerScrolling.value = false;
};

const handleOptionEnter = (e: MouseEvent, option: SelectItem) => {
    if (option.kind === "separator") return;
    const target = (e.currentTarget as HTMLElement).querySelector(
        ".select-option-label",
    ) as HTMLElement;
    if (!target) return;
    const scrollWidth = target.scrollWidth;
    const clientWidth = target.clientWidth;
    if (scrollWidth > clientWidth) {
        activeOptionValue.value = option.value;
        activeOptionScrollDist.value = scrollWidth - clientWidth + 12;
    }
};

const handleOptionLeave = () => {
    activeOptionValue.value = null;
};
</script>

<template>
    <div class="w-full relative">
        <label v-if="label" class="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1 px-1">
            {{ label }}
        </label>
        
        <Popover
            v-model:isOpen="isOpen"
            :match-width="matchWidth"
            :offset="4"
            position="bottom"
            :z-index="1000"
        >
            <template #trigger="{ isOpen }">
                <button
                    type="button"
                    class="w-full flex items-center gap-2 bg-canvas-dark border border-canvas-border rounded transition-all hover:bg-canvas-lighter group overflow-hidden"
                    :class="[
                        size === 'tiny' ? 'h-6 px-1.5 py-0 min-w-[40px]' : size === 'small' ? 'h-7 px-2 py-0 min-w-[60px]' : 'h-9 px-3 min-w-[80px]',
                        isOpen ? 'ring-1 ring-brand-primary border-brand-primary shadow-[0_0_0_2px_rgba(49,110,160,0.15)]' : 'hover:border-text-muted/30',
                        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    ]"
                    :title="selectedOption?.label || placeholder"
                    @mouseenter="handleTriggerEnter"
                    @mouseleave="handleTriggerLeave"
                >
                    <component v-if="icon" :is="icon" :size="size === 'tiny' ? 12 : 14" class="text-text-muted shrink-0" />
                    
                    <div class="flex-1 min-w-0 flex items-center overflow-hidden py-1">
                        <div
                            class="select-text-inner text-left w-full transition-transform duration-300"
                            :class="[
                                size === 'tiny' ? 'text-[10px]' : 'text-[11px]',
                                isTriggerScrolling ? 'is-scrolling whitespace-nowrap' : 'truncate whitespace-nowrap',
                                !selectedOption ? 'text-text-muted/50 font-normal' : 'text-text-main font-semibold'
                            ]"
                            :style="{ '--scroll-dist': `${triggerScrollDist}px` }"
                        >
                            {{ selectedOption?.label || placeholder }}
                        </div>
                    </div>

                    <img
                        v-if="selectedOption?.imageSrc"
                        class="w-4 h-4 rounded-sm object-cover shrink-0 border border-canvas-border ml-auto"
                        :src="selectedOption.imageSrc"
                    />

                    <ChevronDown 
                        :size="size === 'tiny' ? 12 : 14" 
                        class="text-text-muted/50 transition-transform duration-200 shrink-0 ml-auto"
                        :class="{ 'rotate-180 text-brand-primary': isOpen }"
                    />
                </button>
            </template>

            <template #content="{ close }">
                <div 
                    class="flex flex-col p-1 max-h-[320px] overflow-y-auto custom-scrollbar bg-canvas-light"
                    :style="{ 
                        width: matchWidth ? '100%' : 'auto',
                        minWidth: size === 'tiny' ? '120px' : '160px'
                    }"
                >
                    <div
                        v-for="option in options"
                        :key="option.kind === 'separator' ? `sep-${option.label}` : option.value"
                        @click="selectOption(option)"
                        class="flex items-center gap-2 px-2 rounded-sm transition-colors cursor-pointer group/opt"
                        :class="[
                            size === 'tiny' ? 'py-1 min-h-[24px]' : 'py-1.5 min-h-[32px]',
                            option.kind === 'separator' ? 'cursor-default border-t border-canvas-border mt-1 pt-2' : 'hover:bg-brand-primary/10',
                            option.kind !== 'separator' && option.value === modelValue ? 'bg-brand-primary/20 text-brand-primary font-bold' : 'text-text-main font-medium'
                        ]"
                        @mouseenter="handleOptionEnter($event, option)"
                        @mouseleave="handleOptionLeave"
                    >
                        <template v-if="option.kind === 'separator'">
                            <span class="text-[9px] font-black uppercase tracking-widest text-text-muted/40">{{ option.label }}</span>
                        </template>
                        <template v-else>
                            <img
                                v-if="option.imageSrc"
                                class="w-5 h-5 rounded-sm object-cover shrink-0 border border-canvas-border"
                                :src="option.imageSrc"
                            />
                            
                            <div class="flex-1 min-w-0 flex flex-col overflow-hidden">
                                <span 
                                    class="select-option-label"
                                    :class="[
                                        size === 'tiny' ? 'text-[10px]' : 'text-[11px]',
                                        activeOptionValue === option.value ? 'is-scrolling whitespace-nowrap' : 'truncate whitespace-nowrap'
                                    ]"
                                    :style="{ '--scroll-dist': `${activeOptionScrollDist}px` }"
                                >
                                    {{ option.label }}
                                </span>
                                <span v-if="option.subLabel" class="text-[9px] text-text-muted/60 truncate">{{ option.subLabel }}</span>
                            </div>

                            <div v-if="option.value === modelValue" class="shrink-0 w-1.5 h-1.5 rounded-full bg-brand-primary shadow-[0_0_8px_rgba(49,110,160,0.8)]"></div>
                        </template>
                    </div>
                </div>
            </template>
        </Popover>
    </div>
</template>

<style scoped>
.select-text-inner.is-scrolling,
.select-option-label.is-scrolling {
    text-overflow: clip;
    overflow: visible;
    width: auto;
    animation: scroll-text 4s linear infinite alternate;
}

@keyframes scroll-text {
    0% { transform: translateX(0); }
    10% { transform: translateX(0); }
    90% { transform: translateX(calc(-1 * var(--scroll-dist))); }
    100% { transform: translateX(calc(-1 * var(--scroll-dist))); }
}

.custom-scrollbar::-webkit-scrollbar {
    width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: var(--color-canvas-border);
    border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-muted);
}
</style>

