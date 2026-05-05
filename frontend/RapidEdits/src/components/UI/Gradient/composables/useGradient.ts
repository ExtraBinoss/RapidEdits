import {
    ref,
    computed,
    onBeforeUnmount,
    onMounted,
    nextTick,
    watch,
} from 'vue';

export type GradientStop = {
    id: string;
    position: number;
    color: string;
    alpha?: number;
};

export type GradientValue = {
    type: 'linear' | 'radial';
    angle: number;
    stops: GradientStop[];
    origin?: { x: number; y: number };
    destination?: { x: number; y: number };
    speed?: number; // legacy alias for gradientSpeed
    noise?: number; // legacy alias for noiseStrength
    gradientSpeed?: number;
    noiseStrength?: number;
    noiseSpeed?: number;
    noiseScale?: number;
    offset?: number;
    halftoneStrength?: number;
    halftoneSize?: number;
    halftoneAngle?: number;
    wrapMode?: 'repeat' | 'mirror' | 'clamp';
};

export type GradientPreset = {
    id: string;
    type?: 'linear' | 'radial';
    angle?: number;
    stops: GradientStop[];
};

export function useGradient(
    props: {
        modelValue: GradientValue | null | undefined;
        presets?: GradientPreset[];
        minStops?: number;
        maxStops?: number;
    },
    emit: (e: 'update:modelValue', value: GradientValue) => void
) {
    const effectiveMinStops = computed(() => Math.max(2, props.minStops ?? 2));
    const effectiveMaxStops = computed(() => props.maxStops ?? Infinity);

    // Interaction State
    const trackRef = ref<HTMLElement | null>(null);
    const padRef = ref<HTMLElement | null>(null);
    const draggingStopId = ref<string | null>(null);
    const showDragLabels = ref(false);
    let dragLabelsTimeout: any = null;
    const dragDeleteDirection = ref<'top' | 'bottom' | null>(null);
    const selectedStopId = ref<string | null>(null);
    const isPopoverOpen = ref(false);
    const popoverAnchor = ref({ x: 0, y: 0 });
    const isOverTrash = ref(false);
    const trashThreshold = 24;
    const isPresetsPopoverOpen = ref(false);
    const presetsPopoverAnchor = ref({ x: 0, y: 0 });

    const isStopPopoverVisible = computed({
        get: () => isPopoverOpen.value && !!selectedStop.value,
        set: (val) => {
            isPopoverOpen.value = val;
            if (!val) selectedStopId.value = null;
        },
    });

    const DEFAULT_PRESETS: GradientPreset[] = [
        {
            id: 'Fire',
            stops: [
                { id: 'f1', position: 0, color: '#000000', alpha: 1 },
                { id: 'f2', position: 0.2, color: '#ff4500', alpha: 1 },
                { id: 'f3', position: 0.5, color: '#ff8c00', alpha: 1 },
                { id: 'f4', position: 1, color: '#ffff00', alpha: 1 },
            ],
        },
        {
            id: 'Ocean',
            stops: [
                { id: 'o1', position: 0, color: '#001219', alpha: 1 },
                { id: 'o2', position: 0.4, color: '#005f73', alpha: 1 },
                { id: 'o3', position: 0.7, color: '#0a9396', alpha: 1 },
                { id: 'o4', position: 1, color: '#94d2bd', alpha: 1 },
            ],
        },
        {
            id: 'Sunset',
            stops: [
                { id: 's1', position: 0, color: '#312244', alpha: 1 },
                { id: 's2', position: 0.3, color: '#d90429', alpha: 1 },
                { id: 's3', position: 0.6, color: '#f72585', alpha: 1 },
                { id: 's4', position: 1, color: '#ffb703', alpha: 1 },
            ],
        },
        {
            id: 'Neon',
            stops: [
                { id: 'n1', position: 0, color: '#7209b7', alpha: 1 },
                { id: 'n2', position: 0.5, color: '#b5179e', alpha: 1 },
                { id: 'n3', position: 1, color: '#4cc9f0', alpha: 1 },
            ],
        },
        {
            id: 'Forest',
            stops: [
                { id: 'fo1', position: 0, color: '#004b23', alpha: 1 },
                { id: 'fo2', position: 0.3, color: '#007200', alpha: 1 },
                { id: 'fo3', position: 0.6, color: '#38b000', alpha: 1 },
                { id: 'fo4', position: 1, color: '#ccff33', alpha: 1 },
            ],
        },
        {
            id: 'Gold',
            stops: [
                { id: 'g1', position: 0, color: '#582f0e', alpha: 1 },
                { id: 'g2', position: 0.4, color: '#7f4f24', alpha: 1 },
                { id: 'g3', position: 0.7, color: '#b08968', alpha: 1 },
                { id: 'g4', position: 1, color: '#ede0d4', alpha: 1 },
            ],
        },
        {
            id: 'Ice',
            stops: [
                { id: 'i1', position: 0, color: '#caf0f8', alpha: 1 },
                { id: 'i2', position: 0.5, color: '#ade8f4', alpha: 1 },
                { id: 'i3', position: 1, color: '#0077b6', alpha: 1 },
            ],
        },
        {
            id: 'Vaporwave',
            stops: [
                { id: 'v1', position: 0, color: '#ff71ce', alpha: 1 },
                { id: 'v2', position: 0.25, color: '#01cdfe', alpha: 1 },
                { id: 'v3', position: 0.5, color: '#05ffa1', alpha: 1 },
                { id: 'v4', position: 0.75, color: '#b967ff', alpha: 1 },
                { id: 'v5', position: 1, color: '#fffb96', alpha: 1 },
            ],
        },
        {
            id: 'Aurora',
            stops: [
                { id: 'a1', position: 0, color: '#011627', alpha: 1 },
                { id: 'a2', position: 0.4, color: '#2ec4b6', alpha: 1 },
                { id: 'a3', position: 0.7, color: '#e71d36', alpha: 1 },
                { id: 'a4', position: 1, color: '#ff9f1c', alpha: 1 },
            ],
        },
    ];

    function mergePresetsById(
        ...collections: Array<
            GradientPreset[] | readonly GradientPreset[] | undefined
        >
    ): GradientPreset[] {
        const seenIds = new Set<string>();
        const merged: GradientPreset[] = [];

        for (const collection of collections) {
            if (!collection) continue;
            for (const preset of collection) {
                const id =
                    typeof preset?.id === 'string' ? preset.id.trim() : '';
                if (!id || seenIds.has(id)) continue;
                seenIds.add(id);
                merged.push({
                    id,
                    stops: (preset.stops || []).map((stop) => ({ ...stop })),
                });
            }
        }

        return merged;
    }

    const allPresets = computed(() =>
        mergePresetsById(props.presets, DEFAULT_PRESETS)
    );

    function clamp01(value: number): number {
        return Math.max(0, Math.min(1, value));
    }

    function isHexColor(value: string): boolean {
        return /^#[0-9a-f]{6}$/i.test(value);
    }

    function hexToRgb(hex: string) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
            ? {
                  r: parseInt(result[1], 16),
                  g: parseInt(result[2], 16),
                  b: parseInt(result[3], 16),
              }
            : { r: 0, g: 0, b: 0 };
    }

    function rgbToHex(r: number, g: number, b: number) {
        const clampByte = (n: number) =>
            Math.max(0, Math.min(255, Math.round(n)));
        return (
            '#' +
            [r, g, b]
                .map((x) => {
                    const hex = clampByte(x).toString(16);
                    return hex.length === 1 ? '0' + hex : hex;
                })
                .join('')
        );
    }

    function lerp(a: number, b: number, t: number) {
        return a + (b - a) * t;
    }

    function normalizeStops(raw: unknown): GradientStop[] {
        const sourceStops = (raw as any)?.stops;
        const base = Array.isArray(sourceStops) ? sourceStops : [];

        const parsed = base
            .map((stop: any, index: number) => {
                const fallbackPosition =
                    base.length > 1 ? index / (base.length - 1) : 0;
                const position = clamp01(
                    Number.isFinite(Number(stop?.position))
                        ? Number(stop.position)
                        : fallbackPosition
                );
                const color =
                    typeof stop?.color === 'string' && isHexColor(stop.color)
                        ? stop.color
                        : '#ffffff';
                const alpha = Number(stop?.alpha);
                return {
                    id:
                        typeof stop?.id === 'string' &&
                        stop.id.trim().length > 0
                            ? stop.id
                            : `stop-${index}-${Math.random().toString(36).slice(2, 5)}`,
                    position,
                    color,
                    alpha: Number.isFinite(alpha) ? clamp01(alpha) : 1,
                } as GradientStop;
            })
            .sort((a, b) => a.position - b.position);

        if (parsed.length >= effectiveMinStops.value) {
            return parsed;
        }

        return [
            { id: 'default-0', position: 0, color: '#000000', alpha: 1 },
            { id: 'default-1', position: 1, color: '#ffffff', alpha: 1 },
        ];
    }

    // Local state to avoid flicker during parent prop updates
    const localStops = ref<GradientStop[]>(normalizeStops(props.modelValue));
    const gradientType = ref<'linear' | 'radial'>(
        props.modelValue?.type ?? 'linear'
    );
    const gradientAngle = ref<number>(props.modelValue?.angle ?? 90);
    const origin = ref<{ x: number; y: number }>(
        props.modelValue?.origin ?? { x: 0.5, y: 0.2 }
    );
    const destination = ref<{ x: number; y: number }>(
        props.modelValue?.destination ?? { x: 0.5, y: 0.8 }
    );
    const speed = ref<number>(props.modelValue?.gradientSpeed ?? props.modelValue?.speed ?? 0);
    const noise = ref<number>(props.modelValue?.noiseStrength ?? props.modelValue?.noise ?? 0);
    const noiseSpeed = ref<number>(props.modelValue?.noiseSpeed ?? 0);
    const noiseScale = ref<number>(props.modelValue?.noiseScale ?? 1);
    const offset = ref<number>(props.modelValue?.offset ?? 0);
    const halftoneStrength = ref<number>(props.modelValue?.halftoneStrength ?? 0);
    const halftoneSize = ref<number>(props.modelValue?.halftoneSize ?? 10);
    const halftoneAngle = ref<number>(props.modelValue?.halftoneAngle ?? 45);
    const wrapMode = ref<'repeat' | 'mirror' | 'clamp'>(props.modelValue?.wrapMode ?? 'mirror');

    watch(
        () => props.modelValue,
        (val) => {
            localStops.value = normalizeStops(val);
            if (val) {
                gradientType.value = val.type ?? 'linear';
                gradientAngle.value = val.angle ?? 90;
                origin.value = val.origin ?? { x: 0.5, y: 0.2 };
                destination.value = val.destination ?? { x: 0.5, y: 0.8 };
                speed.value = val.gradientSpeed ?? val.speed ?? 0;
                noise.value = val.noiseStrength ?? val.noise ?? 0;
                noiseSpeed.value = val.noiseSpeed ?? 0;
                noiseScale.value = val.noiseScale ?? 1;
                offset.value = val.offset ?? 0;
                halftoneStrength.value = val.halftoneStrength ?? 0;
                halftoneSize.value = val.halftoneSize ?? 10;
                halftoneAngle.value = val.halftoneAngle ?? 45;
                wrapMode.value = val.wrapMode ?? 'repeat';
            }
        },
        { deep: true }
    );

    const stops = computed(() => localStops.value);

    const gradientPreviewStyle = computed(() => {
        const cssStops = stops.value
            .map((stop) => {
                const rgb = hexToRgb(stop.color);
                const alpha = stop.alpha ?? 1;
                return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha}) ${Math.round(clamp01(stop.position) * 100)}%`;
            })
            .join(', ');

        if (gradientType.value === 'radial') {
            return {
                background: `radial-gradient(circle at ${origin.value.x * 100}% ${origin.value.y * 100}%, ${cssStops})`,
            };
        }

        return {
            background: `linear-gradient(${gradientAngle.value}deg, ${cssStops})`,
        };
    });

    const selectedStop = computed(() =>
        stops.value.find((s) => s.id === selectedStopId.value)
    );

    function emitValue(nextStops?: GradientStop[]) {
        const stopsToEmit = nextStops || localStops.value;
        emit('update:modelValue', {
            type: gradientType.value,
            angle: gradientAngle.value,
            stops: stopsToEmit,
            origin: origin.value,
            destination: destination.value,
            speed: speed.value,
            noise: noise.value,
            gradientSpeed: speed.value,
            noiseStrength: noise.value,
            noiseSpeed: noiseSpeed.value,
            noiseScale: noiseScale.value,
            offset: offset.value,
            halftoneStrength: halftoneStrength.value,
            halftoneSize: halftoneSize.value,
            halftoneAngle: halftoneAngle.value,
            wrapMode: wrapMode.value,
        });
    }

    function emitStops(nextStops: GradientStop[]): void {
        const normalized = [...nextStops]
            .map((stop, index) => ({
                id: stop.id || `stop-${index}`,
                position: clamp01(Number(stop.position)),
                color:
                    typeof stop.color === 'string' && isHexColor(stop.color)
                        ? stop.color
                        : '#ffffff',
                alpha: Number.isFinite(Number(stop.alpha))
                    ? clamp01(Number(stop.alpha))
                    : 1,
            }))
            .sort((a, b) => a.position - b.position);

        // Update local state immediately to avoid flicker
        localStops.value = normalized;
        emitValue(normalized);
    }

    function updateGradientType(type: 'linear' | 'radial') {
        gradientType.value = type;
        emitValue();
    }

    function updateGradientAngle(angle: number) {
        gradientAngle.value = angle;
        emitValue();
    }

    function updateGradientDisposition(
        newOrigin: { x: number; y: number },
        newDestination: { x: number; y: number }
    ) {
        origin.value = newOrigin;
        destination.value = newDestination;

        if (gradientType.value === 'linear') {
            const dy = newDestination.y - newOrigin.y;
            const dx = newDestination.x - newOrigin.x;
            if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
                const rad = Math.atan2(dy, dx);
                let deg = (rad * 180) / Math.PI + 90;
                if (deg < 0) deg += 360;
                gradientAngle.value = Math.round(deg % 360);
            }
        }

        emitValue();
    }

    function addStopAt(position: number): void {
        if (stops.value.length >= effectiveMaxStops.value) {
            return;
        }

        const current = [...stops.value];

        // Interpolate color from neighbors
        let left = current[0];
        let right = current[current.length - 1];

        for (let i = 0; i < current.length - 1; i++) {
            if (
                position >= current[i].position &&
                position <= current[i + 1].position
            ) {
                left = current[i];
                right = current[i + 1];
                break;
            }
        }

        let color = '#ffffff';
        let alpha = 1;

        if (left && right && left.id !== right.id) {
            const t =
                (position - left.position) / (right.position - left.position);
            const rgbL = hexToRgb(left.color);
            const rgbR = hexToRgb(right.color);
            color = rgbToHex(
                lerp(rgbL.r, rgbR.r, t),
                lerp(rgbL.g, rgbR.g, t),
                lerp(rgbL.b, rgbR.b, t)
            );
            alpha = lerp(left.alpha ?? 1, right.alpha ?? 1, t);
        } else if (left) {
            color = left.color;
            alpha = left.alpha ?? 1;
        }

        const newStop: GradientStop = {
            id: `stop-${Date.now()}`,
            position,
            color,
            alpha,
        };

        current.push(newStop);
        emitStops(current);

        // Select the new stop
        selectedStopId.value = newStop.id;
        openPopover(newStop.id);
    }

    function addStop(): void {
        addStopAt(0.5);
    }

    function removeStop(id: string): void {
        if (stops.value.length <= effectiveMinStops.value) return;
        const current = stops.value.filter((s) => s.id !== id);
        emitStops(current);
        if (selectedStopId.value === id) {
            isPopoverOpen.value = false;
            selectedStopId.value = null;
        }
    }

    function updateStop(
        id: string,
        updates: Partial<Omit<GradientStop, 'id'>>
    ): void {
        const current = stops.value.map((s) => {
            if (s.id === id) {
                return { ...s, ...updates };
            }
            return s;
        });
        emitStops(current);
    }

    function onTrackClick(e: MouseEvent) {
        if (stops.value.length >= effectiveMaxStops.value) return;

        // If clicking a handle, don't add a new stop (handle is inside track but has its own listener)
        if ((e.target as HTMLElement).closest('.stop-handle')) return;

        if (!trackRef.value) return;
        const rect = trackRef.value.getBoundingClientRect();
        const position = clamp01((e.clientX - rect.left) / rect.width);
        addStopAt(position);
    }

    function startDragging(e: MouseEvent, stopId: string) {
        e.stopPropagation();
        draggingStopId.value = stopId;
        selectedStopId.value = stopId;
        isOverTrash.value = false;

        window.addEventListener('mousemove', onDragging);
        window.addEventListener('mouseup', stopDragging);

        // Delay showing drag labels to avoid flickering on simple clicks
        clearTimeout(dragLabelsTimeout);
        dragLabelsTimeout = setTimeout(() => {
            if (draggingStopId.value) {
                showDragLabels.value = true;
            }
        }, 40);
    }

    function onDragging(e: MouseEvent) {
        if (!draggingStopId.value || !trackRef.value) return;

        const rect = trackRef.value.getBoundingClientRect();
        const position = clamp01((e.clientX - rect.left) / rect.width);

        const canDelete = stops.value.length > effectiveMinStops.value;
        const isAbove = e.clientY < rect.top - trashThreshold;
        const isBelow = e.clientY > rect.bottom + trashThreshold;
        dragDeleteDirection.value = isAbove ? 'top' : isBelow ? 'bottom' : null;
        isOverTrash.value = canDelete && dragDeleteDirection.value !== null;

        updateStop(draggingStopId.value, { position });

        // Update popover position if it's open for this stop
        if (
            isPopoverOpen.value &&
            selectedStopId.value === draggingStopId.value
        ) {
            popoverAnchor.value = {
                x: rect.left + position * rect.width,
                y: rect.top,
            };
        }
    }

    function stopDragging() {
        if (draggingStopId.value) {
            if (isOverTrash.value) {
                removeStop(draggingStopId.value);
            }
        }

        clearTimeout(dragLabelsTimeout);
        showDragLabels.value = false;
        draggingStopId.value = null;
        isOverTrash.value = false;
        dragDeleteDirection.value = null;
        window.removeEventListener('mousemove', onDragging);
        window.removeEventListener('mouseup', stopDragging);
    }

    function updatePopoverAnchor() {
        if (!selectedStopId.value || !trackRef.value) return;

        const stop = stops.value.find((s) => s.id === selectedStopId.value);
        if (!stop) return;

        const rect = trackRef.value.getBoundingClientRect();
        popoverAnchor.value = {
            x: rect.left + stop.position * rect.width,
            y: rect.top,
        };
    }

    async function openPopover(id: string) {
        selectedStopId.value = id;

        // Position *before* showing
        updatePopoverAnchor();

        // Wait for potential computed updates (like stops)
        await nextTick();
        updatePopoverAnchor();

        isPopoverOpen.value = true;
    }

    function handleStopClick(e: MouseEvent, id: string) {
        e.stopPropagation();
        openPopover(id);
    }

    function applyPreset(preset: GradientPreset) {
        let nextStops = normalizeStops({ stops: preset.stops || [] });

        // If we have a max limit, only take the first N stops
        if (nextStops.length > effectiveMaxStops.value) {
            nextStops = nextStops.slice(0, effectiveMaxStops.value);
        }

        // Update both local stops and selection in the same tick to avoid flicker
        localStops.value = nextStops;
        emitValue(nextStops);

        if (nextStops.length > 0) {
            selectedStopId.value = nextStops[0].id;
            // Immediate anchor update (next tick to allow DOM to react to localStops)
            nextTick(() => updatePopoverAnchor());
        }
    }

    function togglePresets(e: Event) {
        e.stopPropagation();
        const mouseEvent = e as MouseEvent;
        const rect = (
            mouseEvent.currentTarget as HTMLElement
        ).getBoundingClientRect();
        presetsPopoverAnchor.value = {
            x: rect.left,
            y: rect.top,
        };
        isPresetsPopoverOpen.value = !isPresetsPopoverOpen.value;
    }

    function updateSelectedStopAlpha(value: number): void {
        if (!selectedStop.value) return;
        updateStop(selectedStop.value.id, { alpha: clamp01(value) });
    }

    function updateSelectedStopPosition(value: number): void {
        if (!selectedStop.value) return;
        updateStop(selectedStop.value.id, { position: clamp01(value) });
    }

    function updateSpeed(val: number) {
        speed.value = val;
        emitValue();
    }

    function updateNoise(val: number) {
        noise.value = val;
        emitValue();
    }

    function updateNoiseSpeed(val: number) {
        noiseSpeed.value = val;
        emitValue();
    }

    function updateNoiseScale(val: number) {
        noiseScale.value = val;
        emitValue();
    }

    function updateOffset(val: number) {
        offset.value = val;
        emitValue();
    }

    function updateHalftoneStrength(val: number) {
        halftoneStrength.value = val;
        emitValue();
    }

    function updateHalftoneSize(val: number) {
        halftoneSize.value = val;
        emitValue();
    }

    function updateHalftoneAngle(val: number) {
        halftoneAngle.value = val;
        emitValue();
    }

    function updateWrapMode(val: 'repeat' | 'mirror' | 'clamp') {
        wrapMode.value = val;
        emitValue();
    }

    function startDraggingDisposition(type: 'origin' | 'destination', e: MouseEvent) {
        e.stopPropagation();
        const onMoving = (moveEvent: MouseEvent) => {
            if (!padRef.value) return;
            const rect = padRef.value.getBoundingClientRect();
            const x = clamp01((moveEvent.clientX - rect.left) / rect.width);
            const y = clamp01((moveEvent.clientY - rect.top) / rect.height);
            
            if (type === 'origin') {
                updateGradientDisposition({ x, y }, destination.value);
            } else {
                updateGradientDisposition(origin.value, { x, y });
            }
        };
        
        const onStopped = () => {
            window.removeEventListener('mousemove', onMoving);
            window.removeEventListener('mouseup', onStopped);
        };
        
        window.addEventListener('mousemove', onMoving);
        window.addEventListener('mouseup', onStopped);
    }

    onBeforeUnmount(() => {
        window.removeEventListener('mousemove', onDragging);
        window.removeEventListener('mouseup', stopDragging);
        window.removeEventListener('resize', updatePopoverAnchor);
    });

    onMounted(() => {
        window.addEventListener('resize', updatePopoverAnchor, {
            passive: true,
        });
    });

    return {
        stops,
        selectedStop,
        selectedStopId,
        draggingStopId,
        showDragLabels,
        dragDeleteDirection,
        isOverTrash,
        popoverAnchor,
        isStopPopoverVisible,
        isPopoverOpen,
        isPresetsPopoverOpen,
        presetsPopoverAnchor,
        allPresets,
        gradientType,
        gradientAngle,
        origin,
        destination,
        gradientSpeed: speed,
        noiseStrength: noise,
        noiseSpeed,
        noiseScale,
        offset,
        halftoneStrength,
        halftoneSize,
        halftoneAngle,
        wrapMode,
        gradientPreviewStyle,
        trackRef,
        padRef,
        effectiveMinStops,
        addStop,
        removeStop,
        updateStop,
        updateGradientType,
        updateGradientAngle,
        updateGradientDisposition,
        updateGradientSpeed: updateSpeed,
        updateNoiseStrength: updateNoise,
        updateNoiseSpeed,
        updateNoiseScale,
        updateOffset,
        updateHalftoneStrength,
        updateHalftoneSize,
        updateHalftoneAngle,
        updateWrapMode,
        startDraggingDisposition,
        onTrackClick,
        startDragging,
        handleStopClick,
        applyPreset,
        togglePresets,
        updateSelectedStopAlpha,
        updateSelectedStopPosition,
        normalizeStops,
        hexToRgb,
        effectiveMaxStops,
    };
}
