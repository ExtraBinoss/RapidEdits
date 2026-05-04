<script setup lang="ts">
    import {
        ref,
        computed,
        watch,
        onMounted,
        onUnmounted,
        nextTick,
    } from 'vue';
    import { Pipette, ArrowUpDown } from 'lucide-vue-next';
    import {
        useColorPicker,
        type RGB,
    } from './useColorPicker';
    import Input from '../Input/Input.vue';
    import Button from '../Button/Button.vue';

    const props = withDefaults(
        defineProps<{
            modelValue: string;
            label?: string;
            flat?: boolean;
            type?: 'standard' | 'triangle';
            alphaValue?: number;
            showAlpha?: boolean;
        }>(),
        {
            type: 'triangle',
            alphaValue: 1,
            showAlpha: false,
        }
    );

    const emit = defineEmits<{
        (e: 'update:modelValue', value: string): void;
        (e: 'update:alpha', value: number): void;
        (e: 'close'): void;
    }>();

    const { hexToRgb, rgbToHex, rgbToHsv, hsvToRgb } = useColorPicker();

    // Internal State
    const h = ref(0);
    const s = ref(0);
    const v = ref(0);
    const a = ref(1);
    const inputMode = ref(0); // 0: HEX, 1: RGB

    const triangleCanvas = ref<HTMLCanvasElement | null>(null);
    const interactionLayer = ref<HTMLDivElement | null>(null);
    const svArea = ref<HTMLElement | null>(null);
    const hueSlider = ref<HTMLElement | null>(null);
    const alphaSlider = ref<HTMLElement | null>(null);

    // Constants for compact triangle
    const RING_OUTER = 76;
    const RING_INNER = 64;
    const TRI_RADIUS = 58;
    const CANVAS_SIZE = 160;

    watch(
        () => props.modelValue,
        (newVal) => {
            if (!newVal) return;
            const hsvNow = hsvToRgb(h.value, s.value, v.value);
            const currentHex = rgbToHex(
                hsvNow.r,
                hsvNow.g,
                hsvNow.b
            ).toLowerCase();

            if (newVal.toLowerCase() !== currentHex) {
                const rgbVal = hexToRgb(newVal);
                const hsvVal = rgbToHsv(rgbVal.r, rgbVal.g, rgbVal.b);
                h.value = hsvVal.h;
                s.value = hsvVal.s;
                v.value = hsvVal.v;
                if (props.type === 'triangle') renderTriangle();
            }
        },
        { immediate: true }
    );
    watch(
        () => props.alphaValue,
        (newVal) => {
            const n = Number(newVal);
            if (!Number.isFinite(n)) return;
            a.value = Math.max(0, Math.min(1, n));
        },
        { immediate: true }
    );

    const rgb = computed(() => hsvToRgb(h.value, s.value, v.value));
    const hex = computed(() => rgbToHex(rgb.value.r, rgb.value.g, rgb.value.b));
    const pureHueColor = computed(() => {
        const rVal = hsvToRgb(h.value, 100, 100);
        return rgbToHex(rVal.r, rVal.g, rVal.b);
    });

    // Triangle Render
    function renderTriangle() {
        const canvas = triangleCanvas.value;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const center = CANVAS_SIZE / 2;
        const R = TRI_RADIUS;
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        const v1 = { x: center + R, y: center };
        const v2 = { x: center - R / 2, y: center - (R * Math.sqrt(3)) / 2 };
        const v3 = { x: center - R / 2, y: center + (R * Math.sqrt(3)) / 2 };

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(v1.x, v1.y);
        ctx.lineTo(v2.x, v2.y);
        ctx.lineTo(v3.x, v3.y);
        ctx.closePath();
        ctx.clip();

        const grayGrad = ctx.createLinearGradient(v2.x, v2.y, v2.x, v3.y);
        grayGrad.addColorStop(0, '#ffffff');
        grayGrad.addColorStop(1, '#000000');
        ctx.fillStyle = grayGrad;
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        const hueGrad = ctx.createLinearGradient(v1.x, v1.y, v2.x, v1.y);
        hueGrad.addColorStop(0, pureHueColor.value);
        hueGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = hueGrad;
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.restore();
    }

    // Interaction State
    let currentDragTarget:
        | 'triangle'
        | 'ring'
        | 'standard-sv'
        | 'standard-hue'
        | 'standard-alpha'
        | null = null;

    function handleTriangleRingUpdate(e: MouseEvent | TouchEvent) {
        if (!interactionLayer.value) return;
        const rect = interactionLayer.value.getBoundingClientRect();
        const clientX =
            'touches' in e
                ? (e as TouchEvent).touches[0].clientX
                : (e as MouseEvent).clientX;
        const clientY =
            'touches' in e
                ? (e as TouchEvent).touches[0].clientY
                : (e as MouseEvent).clientY;

        const x = clientX - rect.left - rect.width / 2;
        const y = clientY - rect.top - rect.height / 2;

        if (currentDragTarget === 'ring') {
            const angle = Math.atan2(y, x);
            let deg = (angle * 180) / Math.PI;
            if (deg < 0) deg += 360;
            h.value = deg;
        } else if (currentDragTarget === 'triangle') {
            const R = TRI_RADIUS;
            const h_tri = (R * 3) / 2;
            const s_raw = (x + R / 2) / h_tri;
            const s_val = Math.max(0, Math.min(1, s_raw));
            const currentHalfHeight = ((1 - s_val) * (R * Math.sqrt(3))) / 2;

            let v_val = 1;
            if (currentHalfHeight > 0.01) {
                const y_norm =
                    (y + currentHalfHeight) / (currentHalfHeight * 2);
                v_val = 1 - Math.max(0, Math.min(1, y_norm));
            }

            s.value = s_val * 100;
            v.value = v_val * 100;
        }
        emit('update:modelValue', hex.value);
    }

    function handleStandardSVUpdate(e: MouseEvent | TouchEvent) {
        if (!svArea.value) return;
        const rect = svArea.value.getBoundingClientRect();
        const clientX =
            'touches' in e
                ? (e as TouchEvent).touches[0].clientX
                : (e as MouseEvent).clientX;
        const clientY =
            'touches' in e
                ? (e as TouchEvent).touches[0].clientY
                : (e as MouseEvent).clientY;
        const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
        const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
        s.value = (x / rect.width) * 100;
        v.value = (1 - y / rect.height) * 100;
        emit('update:modelValue', hex.value);
    }

    function handleStandardHueUpdate(e: MouseEvent | TouchEvent) {
        if (!hueSlider.value) return;
        const rect = hueSlider.value.getBoundingClientRect();
        const clientY =
            'touches' in e
                ? (e as TouchEvent).touches[0].clientY
                : (e as MouseEvent).clientY;
        const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
        h.value = (y / rect.height) * 360;
        emit('update:modelValue', hex.value);
    }

    function handleStandardAlphaUpdate(e: MouseEvent | TouchEvent) {
        if (!alphaSlider.value) return;
        const rect = alphaSlider.value.getBoundingClientRect();
        const clientY =
            'touches' in e
                ? (e as TouchEvent).touches[0].clientY
                : (e as MouseEvent).clientY;
        const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
        a.value = 1 - y / rect.height;
        emit('update:alpha', a.value);
    }

    // Event Handlers
    function onMouseDownTri(e: MouseEvent) {
        if (!interactionLayer.value) return;
        const rect = interactionLayer.value.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        const dist = Math.sqrt(x * x + y * y);

        if (dist >= RING_INNER - 6) {
            currentDragTarget = 'ring';
        } else {
            currentDragTarget = 'triangle';
        }

        handleTriangleRingUpdate(e);
        window.addEventListener('mousemove', onGlobalMouseMove);
        window.addEventListener('mouseup', onGlobalMouseUp);
    }

    function onMouseDownSV(e: MouseEvent) {
        currentDragTarget = 'standard-sv';
        handleStandardSVUpdate(e);
        window.addEventListener('mousemove', onGlobalMouseMove);
        window.addEventListener('mouseup', onGlobalMouseUp);
    }

    function onMouseDownHue(e: MouseEvent) {
        currentDragTarget = 'standard-hue';
        handleStandardHueUpdate(e);
        window.addEventListener('mousemove', onGlobalMouseMove);
        window.addEventListener('mouseup', onGlobalMouseUp);
    }

    function onMouseDownAlpha(e: MouseEvent) {
        currentDragTarget = 'standard-alpha';
        handleStandardAlphaUpdate(e);
        window.addEventListener('mousemove', onGlobalMouseMove);
        window.addEventListener('mouseup', onGlobalMouseUp);
    }

    function onGlobalMouseMove(e: MouseEvent) {
        if (currentDragTarget === 'ring' || currentDragTarget === 'triangle') {
            handleTriangleRingUpdate(e);
        } else if (currentDragTarget === 'standard-sv') {
            handleStandardSVUpdate(e);
        } else if (currentDragTarget === 'standard-hue') {
            handleStandardHueUpdate(e);
        } else if (currentDragTarget === 'standard-alpha') {
            handleStandardAlphaUpdate(e);
        }
    }

    function onGlobalMouseUp() {
        currentDragTarget = null;
        window.removeEventListener('mousemove', onGlobalMouseMove);
        window.removeEventListener('mouseup', onGlobalMouseUp);
    }

    // Lifecycle
    onMounted(() => {
        if (props.type === 'triangle') nextTick(renderTriangle);
    });
    watch(
        () => h.value,
        () => {
            if (props.type === 'triangle') renderTriangle();
        }
    );
    onUnmounted(onGlobalMouseUp);

    const hasEyeDropper = ref(
        typeof window !== 'undefined' && 'EyeDropper' in window
    );

    async function openEyeDropper() {
        if (!hasEyeDropper.value) return;
        try {
            const eyeDropper = new (window as any).EyeDropper();
            const result = await eyeDropper.open();
            emit('update:modelValue', result.sRGBHex);
        } catch (e) {
            /* silent */
        }
    }

    function updateChannel(channel: keyof RGB, val: string | number) {
        const n = Math.max(0, Math.min(255, Number(val) || 0));
        const nextRgb = { ...rgb.value, [channel]: n };
        emit('update:modelValue', rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b));
    }

    const triangleCursorStyle = computed(() => {
        const R = TRI_RADIUS;
        const h_tri = (R * 3) / 2;
        const x = -R / 2 + (s.value / 100) * h_tri;
        const currentHalfHeight =
            ((1 - s.value / 100) * (R * Math.sqrt(3))) / 2;
        const y =
            (1 - v.value / 100) * (currentHalfHeight * 2) - currentHalfHeight;
        return { transform: `translate(${x}px, ${y}px)` };
    });

    const hueRingIndicatorStyle = computed(() => {
        const rad = (h.value * Math.PI) / 180;
        const r = (RING_INNER + RING_OUTER) / 2;
        return {
            transform: `translate(${Math.cos(rad) * r}px, ${Math.sin(rad) * r}px) rotate(${h.value}deg)`,
        };
    });
</script>

<template>
    <div class="custom-color-picker">
        <div class="picker-main-area">
            <template v-if="type === 'triangle'">
                <div
                    class="triangle-picker-container"
                    @mousedown.prevent="onMouseDownTri"
                >
                    <div
                        class="hue-wheel"
                        :style="{
                            width: RING_OUTER * 2 + 'px',
                            height: RING_OUTER * 2 + 'px',
                        }"
                    >
                        <div
                            class="hue-wheel-inner"
                            :style="{
                                width: RING_INNER * 2 + 'px',
                                height: RING_INNER * 2 + 'px',
                            }"
                        ></div>
                    </div>
                    <canvas
                        ref="triangleCanvas"
                        class="triangle-canvas"
                        :width="CANVAS_SIZE"
                        :height="CANVAS_SIZE"
                    ></canvas>
                    <div ref="interactionLayer" class="interaction-layer">
                        <div
                            class="hue-indicator"
                            :style="hueRingIndicatorStyle"
                        ></div>
                        <div
                            class="triangle-cursor"
                            :style="triangleCursorStyle"
                        ></div>
                    </div>
                </div>
            </template>
            <template v-else>
                <div
                    ref="svArea"
                    class="sv-container"
                    @mousedown.prevent="onMouseDownSV"
                >
                    <div
                        class="sv-color-layer"
                        :style="{ backgroundColor: pureHueColor }"
                    ></div>
                    <div class="sv-white"></div>
                    <div class="sv-black"></div>
                    <div
                        class="sv-cursor"
                        :style="{ left: `${s}%`, top: `${100 - v}%` }"
                    ></div>
                </div>
                <div
                    ref="hueSlider"
                    class="hue-slider-vertical"
                    @mousedown.prevent="onMouseDownHue"
                >
                    <div
                        class="hue-cursor-vertical"
                        :style="{ top: `${(h / 360) * 100}%` }"
                    ></div>
                </div>
                <div
                    v-if="showAlpha"
                    ref="alphaSlider"
                    class="alpha-slider-vertical"
                    :style="{ '--alpha-color': hex }"
                    @mousedown.prevent="onMouseDownAlpha"
                >
                    <div
                        class="alpha-cursor-vertical"
                        :style="{ top: `${(1 - a) * 100}%` }"
                    ></div>
                </div>
            </template>
        </div>

        <div class="controls-container">
            <div class="previews-row">
                <Button
                    variant="secondary"
                    size="sm"
                    icon-only
                    :icon="Pipette"
                    @click="openEyeDropper"
                    v-if="hasEyeDropper"
                />
                <div
                    class="color-preview-large"
                    :style="{ backgroundColor: hex }"
                ></div>
            </div>

            <div class="inputs-row">
                <div class="inputs-group">
                    <template v-if="inputMode === 1">
                        <Input
                            size="small"
                            type="number"
                            :model-value="rgb.r"
                            @update:model-value="updateChannel('r', $event)"
                            :min="0"
                            :max="255"
                        >
                            <template #prepend>R</template>
                        </Input>
                        <Input
                            size="small"
                            type="number"
                            :model-value="rgb.g"
                            @update:model-value="updateChannel('g', $event)"
                            :min="0"
                            :max="255"
                        >
                            <template #prepend>G</template>
                        </Input>
                        <Input
                            size="small"
                            type="number"
                            :model-value="rgb.b"
                            @update:model-value="updateChannel('b', $event)"
                            :min="0"
                            :max="255"
                        >
                            <template #prepend>B</template>
                        </Input>
                    </template>
                    <template v-else>
                        <Input
                            size="small"
                            type="text"
                            :model-value="hex.toUpperCase()"
                            @update:model-value="
                                emit('update:modelValue', $event as string)
                            "
                        >
                            <template #prepend>HEX</template>
                        </Input>
                    </template>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    icon-only
                    :icon="ArrowUpDown"
                    @click="inputMode = (inputMode + 1) % 2"
                    class="mode-switch-btn"
                />
            </div>
        </div>
    </div>
</template>

<style scoped>
    .custom-color-picker {
        width: 100%;
        display: flex;
        flex-direction: column;
        user-select: none;
    }

    .picker-main-area {
        padding: 5px;
        display: flex;
        justify-content: center;
        gap: 12px;
    }

    .triangle-picker-container {
        position: relative;
        width: 160px;
        height: 160px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: crosshair;
    }

    .hue-wheel {
        position: absolute;
        border-radius: 50%;
        background: conic-gradient(
            from 90deg,
            #f00,
            #ff0,
            #0f0,
            #0ff,
            #00f,
            #f0f,
            #f00
        );
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .hue-wheel-inner {
        background: var(--surface-color, #1e293b);
        border-radius: 50%;
    }

    .triangle-canvas {
        position: absolute;
        width: 100%;
        height: 100%;
        pointer-events: none;
    }

    .interaction-layer {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }

    .hue-indicator {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 3px;
        height: 14px;
        background: #fff;
        border-radius: 1px;
        margin-left: -1.5px;
        margin-top: -7px;
        box-shadow: 0 0 4px rgba(0, 0, 0, 0.7);
        border: 0.5px solid rgba(0, 0, 0, 0.2);
    }

    .triangle-cursor {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 12px;
        height: 12px;
        border: 2px solid #fff;
        border-radius: 50%;
        margin-left: -6px;
        margin-top: -6px;
        box-shadow: 0 0 6px rgba(0, 0, 0, 0.5);
        z-index: 10;
    }

    .sv-container {
        position: relative;
        width: 140px;
        height: 140px;
        border-radius: 6px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.12);
        cursor: crosshair;
        box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
        background-clip: padding-box;
        /* Force hardware acceleration for better clipping */
        transform: translateZ(0);
    }
    .sv-color-layer {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }
    .sv-white {
        position: absolute;
        inset: 0;
        background: linear-gradient(to right, #fff, transparent);
    }
    .sv-black {
        position: absolute;
        inset: 0;
        background: linear-gradient(to top, #000, transparent);
    }
    .sv-cursor {
        position: absolute;
        width: 12px;
        height: 12px;
        border: 2px solid #fff;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        box-shadow:
            0 0 0 1px rgba(0, 0, 0, 0.5),
            inset 0 0 0 1px rgba(0, 0, 0, 0.2);
    }

    .hue-slider-vertical {
        position: relative;
        width: 12px;
        height: 140px;
        border-radius: 6px;
        background: linear-gradient(
            to bottom,
            #f00,
            #ff0,
            #0f0,
            #0ff,
            #00f,
            #f0f,
            #f00
        );
        cursor: pointer;
    }
    .hue-cursor-vertical {
        position: absolute;
        left: 50%;
        width: 16px;
        height: 4px;
        background: #fff;
        border-radius: 2px;
        transform: translate(-50%, -50%);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    }

    .alpha-slider-vertical {
        position: relative;
        width: 12px;
        height: 140px;
        border-radius: 6px;
        cursor: pointer;
        border: 1px solid rgba(255, 255, 255, 0.15);
        background:
            linear-gradient(
                to bottom,
                var(--alpha-color),
                color-mix(in srgb, var(--alpha-color) 0%, transparent)
            ),
            linear-gradient(
                45deg,
                rgba(255, 255, 255, 0.16) 25%,
                transparent 25%,
                transparent 50%,
                rgba(255, 255, 255, 0.16) 50%,
                rgba(255, 255, 255, 0.16) 75%,
                transparent 75%,
                transparent
            );
        background-size:
            100% 100%,
            8px 8px;
    }

    .alpha-cursor-vertical {
        position: absolute;
        left: 50%;
        width: 16px;
        height: 4px;
        background: #fff;
        border-radius: 2px;
        transform: translate(-50%, -50%);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    }

    .controls-container {
        padding: 10px 0 0 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .previews-row {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .color-preview-large {
        flex: 1;
        height: 24px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .inputs-row {
        display: flex;
        align-items: flex-end;
        gap: 8px;
    }

    .inputs-group {
        flex: 1;
        display: flex;
        gap: 4px;
    }

    .mode-switch-btn {
        margin-bottom: 0px;
        opacity: 0.6;
    }
    .mode-switch-btn:hover {
        opacity: 1;
    }
</style>
