<script setup lang="ts">
    import { ref, computed } from 'vue';
    import ColorPickerCustom from './ColorPickerCustom.vue';
    import Popover from '../Overlay/Popover.vue';

    const props = defineProps({
        modelValue: {
            type: String,
            default: '#f57600',
        },
        label: {
            type: String,
            default: undefined,
        },
        inline: {
            type: Boolean,
            default: false,
        },
        type: {
            type: String as () => 'standard' | 'triangle',
            default: 'standard',
        },
        alphaValue: {
            type: Number,
            default: 1,
        },
        showAlpha: {
            type: Boolean,
            default: false,
        },
    });

    const emit = defineEmits(['update:modelValue', 'update:alpha']);

    const displayLabel = computed(() => props.label ?? 'Color');

    const triggerEl = ref<HTMLElement | null>(null);
    const isPopoverOpen = ref(false);

    const updateColor = (val: string) => {
        emit('update:modelValue', val);
    };
    const updateAlpha = (val: number) => {
        emit('update:alpha', val);
    };

    function togglePicker() {
        isPopoverOpen.value = !isPopoverOpen.value;
    }
</script>

<template>
    <div class="color-picker-wrapper">
        <label
            v-if="!inline"
            class="color-picker-label"
        >
            {{ displayLabel }}
        </label>

        <!-- Inline Mode: just the full picker -->
        <ColorPickerCustom
            v-if="inline"
            :model-value="props.modelValue"
            :type="type"
            :alpha-value="props.alphaValue"
            :show-alpha="props.showAlpha"
            @update:model-value="updateColor"
            @update:alpha="updateAlpha"
        />

        <!-- Trigger Mode: color bubble + popover -->
        <div
            v-else
            ref="triggerEl"
            class="color-picker-trigger-container"
            :class="{ 'is-standard': type === 'standard' }"
            @click="togglePicker"
        >
            <div
                class="color-picker-bubble"
                :style="{ backgroundColor: modelValue }"
            >
                <div class="bubble-inner"></div>
            </div>
            <div class="color-hex-label">
                {{ modelValue.toUpperCase() }}
            </div>

            <Popover
                v-model="isPopoverOpen"
                :reference-el="triggerEl"
                placement="bottom"
                align="start"
                :offset="12"
                :z-index="10000"
            >
                <div
                    class="popover-picker-content"
                    :class="{ 'is-triangle': type === 'triangle' }"
                >
                    <ColorPickerCustom
                        :model-value="props.modelValue"
                        :type="type"
                        :alpha-value="props.alphaValue"
                        :show-alpha="props.showAlpha"
                        @update:model-value="updateColor"
                        @update:alpha="updateAlpha"
                        @close="isPopoverOpen = false"
                        flat
                    />
                </div>
            </Popover>
        </div>
    </div>
</template>

<style scoped>
    .color-picker-wrapper {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
    }

    .color-picker-label {
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--text-color, #fff);
    }

    .color-picker-trigger-container {
        display: flex;
        align-items: center;
        gap: 10px;
        background: rgba(0, 0, 0, 0.2);
        padding: 4px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        cursor: pointer;
        transition: all 0.2s;
        width: fit-content;
        min-width: 120px;
    }

    .color-picker-trigger-container:hover {
        background: rgba(255, 255, 255, 0.05);
        border-color: var(--primary-color, #55b2e2);
    }

    .color-picker-trigger-container.is-standard:hover {
        border-color: rgba(255, 255, 255, 0.1);
    }

    .color-picker-bubble {
        width: 28px;
        height: 28px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        position: relative;
        overflow: hidden;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .bubble-inner {
        position: absolute;
        inset: 0;
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
    }

    .color-hex-label {
        font-family: var(--font-mono, monospace);
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--text-color, #fff);
        padding-right: 8px;
    }

    .popover-picker-content {
        padding: 12px;
        width: 240px;
        overflow: hidden;
    }

    .popover-picker-content.is-triangle {
        width: 240px;
    }
</style>
