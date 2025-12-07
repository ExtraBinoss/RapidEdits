<template>
    <div class="relative" ref="container">
        <label
            v-if="label"
            class="block text-xs font-medium text-text-muted mb-1"
            >{{ label }}</label
        >

        <button
            @click="toggleDropdown"
            class="w-full bg-canvas-dark border border-canvas-border rounded px-2 py-1.5 text-text-main flex justify-between items-center focus:outline-none focus:border-brand-primary hover:border-text-muted transition-colors text-xs"
        >
            <span class="truncate">{{ selectedLabel }}</span>
            <component
                :is="ChevronDown"
                class="w-3.5 h-3.5 text-text-muted transition-transform"
                :class="{ 'rotate-180': isOpen }"
            />
        </button>

        <Teleport to="body">
            <div
                v-if="isOpen"
                class="fixed z-[9999] bg-canvas-lighter border border-canvas-border rounded shadow-lg overflow-y-auto custom-scrollbar"
                :style="dropdownStyle"
            >
                <div
                    v-for="option in options"
                    :key="option.value"
                    @click="select(option)"
                    class="px-2 py-1.5 text-text-main hover:bg-canvas-light text-xs flex items-center justify-between group"
                    :class="{
                        'bg-brand-primary/20 text-brand-primary':
                            modelValue === option.value,
                    }"
                >
                    <span>{{ option.label }}</span>
                    <span
                        v-if="option.subLabel"
                        class="text-[10px] text-text-muted group-hover:text-text-main"
                        >{{ option.subLabel }}</span
                    >
                </div>
            </div>
        </Teleport>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
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
const dropdownStyle = ref({});

const selectedLabel = computed(() => {
    const opt = props.options.find((o) => o.value === props.modelValue);
    return opt ? opt.label : String(props.modelValue);
});

const calculatePosition = () => {
    if (!container.value) return;
    const rect = container.value.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropdownHeight = Math.min(props.options.length * 36 + 10, 240);

    let top: number | "auto" = rect.bottom + 4;
    let bottom: string | "auto" = "auto";

    // Flip if not enough space below
    if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
        top = "auto";
        bottom = window.innerHeight - rect.top + 4 + "px";
    }

    dropdownStyle.value = {
        top: top === "auto" ? "auto" : `${top}px`,
        bottom: bottom,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        maxHeight: "240px",
    };
};

const toggleDropdown = async () => {
    isOpen.value = !isOpen.value;
    if (isOpen.value) {
        await nextTick();
        calculatePosition();
    }
};

const select = (option: Option) => {
    emit("update:modelValue", option.value);
    isOpen.value = false;
};

// Click outside
const handleClickOutside = (e: MouseEvent) => {
    if (container.value && !container.value.contains(e.target as Node)) {
        // We also need to check if we clicked inside the dropdown (which is now in body)
        // But the dropdown elements are destroyed when isOpen becomes false, so maybe we don't need to check?
        // Wait, if we click inside the dropdown, select() is called which closes it.
        // If we click on scrollbar of dropdown...
        // The dropdown is in body, so container.contains will return false.
        // We need a ref to the dropdown or check if target is inside a specific class.
        // But wait, the dropdown v-if="isOpen" means it exists.
        // Let's rely on event bubbling check.
        // A simple way is to check if closest is .fixed.z-[9999]...
        const target = e.target as HTMLElement;
        if (target.closest(".fixed.z-\\[9999\\]")) return;

        isOpen.value = false;
    }
};

// Re-calculate on scroll or resize
const handleScrollOrResize = () => {
    if (isOpen.value) {
        calculatePosition(); // Ideally throttle
        // Or close it
        isOpen.value = false;
    }
};

onMounted(() => {
    document.addEventListener("click", handleClickOutside);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
});

onUnmounted(() => {
    document.removeEventListener("click", handleClickOutside);
    window.removeEventListener("scroll", handleScrollOrResize, true);
    window.removeEventListener("resize", handleScrollOrResize);
});
</script>
