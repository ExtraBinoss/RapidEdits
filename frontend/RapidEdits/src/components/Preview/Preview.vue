<script setup lang="ts">
import { onMounted, ref, onBeforeUnmount, shallowRef, watch } from "vue";
import { ThreeRenderer } from "../../core/renderer/ThreeRenderer";
import type { ScreenRect } from "../../core/renderer/ThreeRenderer";
import { useProjectStore } from "../../stores/projectStore";
import { editorEngine } from "../../core/EditorEngine";
import OSD from "../UI/Overlay/OSD.vue";
import Select from "../UI/Input/Select.vue";
import QuickActions from "./QuickActions.vue";

const canvasContainer = ref<HTMLElement | null>(null);
const store = useProjectStore();

let renderer: ThreeRenderer | null = null;
const currentScaleMode = ref<"fit" | "fill" | number>("fit");

const zoomOptions = [
    { label: "Fit", value: "fit" },
    { label: "Fill", value: "fill" },
    { label: "100%", value: 1.0 },
    { label: "125%", value: 1.25 },
    { label: "150%", value: 1.5 },
    { label: "200%", value: 2.0 },
];

watch(currentScaleMode, (newMode) => {
    if (renderer) {
        renderer.setScaleMode(newMode);
    }
});

watch(() => store.resolution, (newRes) => {
    if (renderer) {
        renderer.setProjectResolution(newRes.width, newRes.height);
    }
}, { deep: true });

// ── Gizmo Overlay State ──────────────────────────────────────────────────────

const gizmoRect = ref<ScreenRect | null>(null);
let rafId: number | null = null;

/** Poll the gizmo manager every animation frame (it runs ~60fps alongside Three). */
function startGizmoPoll() {
    console.log("[Preview] Starting gizmo poll loop");
    function tick() {
        if (renderer && canvasContainer.value) {
            const rect = renderer.getGizmoScreenRect();
            if (rect) {
                // The GizmoManager computes coords relative to the Three.js canvas element.
                // We need coords relative to canvasContainer (the overlay's positioned parent).
                const canvas = renderer.sceneManager.renderer.domElement;
                const canvasBounds = canvas.getBoundingClientRect();
                const containerBounds = canvasContainer.value.getBoundingClientRect();
                const offsetX = canvasBounds.left - containerBounds.left;
                const offsetY = canvasBounds.top - containerBounds.top;
                
                const newRect = {
                    ...rect,
                    x: rect.x + offsetX,
                    y: rect.y + offsetY,
                };
                
                if (!gizmoRect.value) {
                    console.log("[Preview] Gizmo handles APPEARED", newRect);
                }
                gizmoRect.value = newRect;
            } else {
                if (gizmoRect.value) {
                    console.log("[Preview] Gizmo handles HIDDEN");
                }
                gizmoRect.value = null;
            }
        }
        rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
}

function stopGizmoPoll() {
    console.log("[Preview] Stopping gizmo poll loop");
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
}

// ── Resize Handle Logic ──────────────────────────────────────────────────────

/**
 * The 8 handles: corners + edge midpoints.
 */
const HANDLES = [
    { id: "nw", cursor: "nwse-resize", x: 0, y: 0,   dx: -1, dy:  1 },
    { id: "n",  cursor: "ns-resize",   x: 0.5, y: 0,   dx:  0, dy:  1 },
    { id: "ne", cursor: "nesw-resize", x: 1, y: 0,   dx:  1, dy:  1 },
    { id: "e",  cursor: "ew-resize",   x: 1, y: 0.5, dx:  1, dy:  0 },
    { id: "se", cursor: "nwse-resize", x: 1, y: 1,   dx:  1, dy: -1 },
    { id: "s",  cursor: "ns-resize",   x: 0.5, y: 1, dx:  0, dy: -1 },
    { id: "sw", cursor: "nesw-resize", x: 0, y: 1,   dx: -1, dy: -1 },
    { id: "w",  cursor: "ew-resize",   x: 0, y: 0.5, dx: -1, dy:  0 },
] as const;

// Drag state
let activeHandle: typeof HANDLES[number] | null = null;
let dragStartMouse = { x: 0, y: 0 };
let dragStartScale = { x: 1, y: 1 };
let dragStartRect: ScreenRect | null = null;
let draggingClipId: string | null = null;

function onHandlePointerDown(e: PointerEvent, handle: typeof HANDLES[number]) {
    e.preventDefault();
    e.stopPropagation();

    const selectedIds = editorEngine.getSelectedClipIds();
    if (selectedIds.length === 0) return;

    // KISS: Find the clip that actually has a visible mesh in the renderer
    // (This avoids trying to "scale" an audio clip if both are selected)
    let targetClipId: string | null = null;
    const renderer = editorEngine.getRenderer();
    
    for (let i = selectedIds.length - 1; i >= 0; i--) {
        const id = selectedIds[i];
        if (renderer?.clipManager.getClipMesh(id)) {
            targetClipId = id;
            break;
        }
    }

    if (!targetClipId) {
        // Fallback to last selected if no mesh found (though handles shouldn't be visible)
        targetClipId = selectedIds[selectedIds.length - 1];
    }

    draggingClipId = targetClipId;
    const clip = editorEngine.timelineSystem.getClip(draggingClipId);
    if (!clip) return;

    activeHandle = handle;
    dragStartMouse = { x: e.clientX, y: e.clientY };
    dragStartScale = { x: clip.data?.scale?.x ?? 1, y: clip.data?.scale?.y ?? 1 };
    dragStartRect = gizmoRect.value ? { ...gizmoRect.value } : null;

    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);

    // Prevent canvas from stealing pointer while resizing
    (e.target as Element).setPointerCapture(e.pointerId);
}

function onWindowPointerMove(e: PointerEvent) {
    if (!activeHandle || !draggingClipId || !dragStartRect) return;

    const clip = editorEngine.timelineSystem.getClip(draggingClipId);
    if (!clip) return;

    // 1. Project the screen delta onto the rotated axes of the object
    const dx = e.clientX - dragStartMouse.x;
    const dy = e.clientY - dragStartMouse.y;
    
    const theta = dragStartRect.rotation;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    // Rotate mouse delta into local space
    const localDx = dx * cos + dy * sin;
    const localDy = -dx * sin + dy * cos;
    
    const rectW = dragStartRect.width;
    const rectH = dragStartRect.height;

    // Bypass TS narrowing for literal dx/dy types to avoid "no overlap" errors
    const hDx = activeHandle.dx as number;
    const hDy = activeHandle.dy as number;

    let newScaleX = dragStartScale.x;
    let newScaleY = dragStartScale.y;

    if (e.shiftKey) {
        // Proportional scaling: calculate a single unified factor
        let factor = 0;
        
        if (hDx !== 0 && hDy !== 0) {
            // For corners, average the relative changes for a perfectly smooth transition
            const fx = (hDx * localDx) / rectW * 2;
            const fy = -(hDy * localDy) / rectH * 2;
            factor = (fx + fy) / 2;
        } else if (hDx !== 0) {
            factor = (hDx * localDx) / rectW * 2;
        } else if (hDy !== 0) {
            factor = -(hDy * localDy) / rectH * 2;
        }

        newScaleX = dragStartScale.x * (1 + factor);
        newScaleY = dragStartScale.y * (1 + factor);
    } else {
        // Independent scaling
        if (hDx !== 0) {
            newScaleX = dragStartScale.x + (hDx * localDx) / rectW * dragStartScale.x * 2;
        }
        if (hDy !== 0) {
            newScaleY = dragStartScale.y - (hDy * localDy) / rectH * dragStartScale.y * 2;
        }
    }

    const newScale = {
        x: Math.max(0.01, newScaleX),
        y: Math.max(0.01, newScaleY),
        z: clip.data?.scale?.z ?? 1,
    };

    editorEngine.updateClip(draggingClipId, {
        data: { ...clip.data, scale: newScale },
    });
}

function onWindowPointerUp() {
    activeHandle = null;
    draggingClipId = null;
    dragStartRect = null;
    window.removeEventListener("pointermove", onWindowPointerMove);
    window.removeEventListener("pointerup", onWindowPointerUp);
}

// ── Mount / Unmount ──────────────────────────────────────────────────────────

onMounted(async () => {
    if (!canvasContainer.value) return;

    renderer = new ThreeRenderer({ container: canvasContainer.value });
    renderer.setProjectResolution(store.resolution.width, store.resolution.height);
    await renderer.init();
    editorEngine.registerRenderer(renderer);

    startGizmoPoll();
});

onBeforeUnmount(() => {
    stopGizmoPoll();
    onWindowPointerUp(); // clean up any active drag
    if (renderer) renderer.destroy();
    editorEngine.registerRenderer(null);
    renderer = null;
});

// ── Drag & Drop to Preview ───────────────────────────────────────────────────

const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer?.getData("application/json");
    if (data) {
        try {
            const assetData = JSON.parse(data);

            let trackType: "video" | "audio" = "video";
            if (assetData.type === "audio") trackType = "audio";

            let targetTrack = store.tracks.find(
                (t) => t.type === trackType && t.clips.length === 0,
            );

            if (!targetTrack) {
                targetTrack = store.addTrack(trackType);
            }

            store.addClipToTimeline(
                assetData.id,
                targetTrack.id,
                store.currentTime,
            );
        } catch (err) {
            console.error(err);
        }
    }
};
</script>

<template>
    <div class="w-full h-full relative isolate">

        <!-- Main Canvas Container -->
        <div
            ref="canvasContainer"
            class="w-full h-full overflow-hidden flex items-center justify-center relative z-10 bg-transparent"
            @dragover.prevent
            @drop="handleDrop"
        >
            <OSD />

            <!-- Zoom Controls -->
            <div class="absolute top-4 left-4 z-20 w-[50px]">
                <Select
                    v-model="currentScaleMode"
                    :options="zoomOptions"
                    class="text-xs"
                />
            </div>

            <!-- Resolution Info -->
            <div class="absolute bottom-4 left-4 z-20 px-2 py-1 rounded bg-black/40 backdrop-blur-sm border border-white/5 pointer-events-none">
                <span class="text-[10px] font-mono text-white/60 tracking-wider">
                    {{ store.resolution.width }}x{{ store.resolution.height }}
                </span>
            </div>

            <!-- ── CSS Gizmo Resize Handles ───────────────────────────────── -->
            <div
                v-if="gizmoRect"
                class="gizmo-overlay pointer-events-none"
                :style="{
                    left: gizmoRect.x + 'px',
                    top: gizmoRect.y + 'px',
                    width: gizmoRect.width + 'px',
                    height: gizmoRect.height + 'px',
                    transform: `rotate(${gizmoRect.rotation}rad)`,
                }"
            >
                <!-- Quick Actions Popover -->
                <QuickActions :gizmo-rect="gizmoRect" />

                <!-- 8 Resize Handles: corners + edge midpoints -->
                <div
                    v-for="handle in HANDLES"
                    :key="handle.id"
                    class="gizmo-handle pointer-events-auto"
                    :class="`gizmo-handle--${handle.id}`"
                    :style="{
                        left: `${handle.x * 100}%`,
                        top:  `${handle.y * 100}%`,
                        cursor: handle.cursor,
                    }"
                    @pointerdown.stop="onHandlePointerDown($event, handle)"
                />
            </div>
        </div>
    </div>
</template>

<style scoped>
/* ── Gizmo Resize Handles ─────────────────────────────────────────────────── */

.gizmo-overlay {
    position: absolute;
    z-index: 50;
    pointer-events: none;
}

.gizmo-handle {
    position: absolute;
    width: 10px;
    height: 10px;
    background: #ffffff;
    border: 2px solid #4facfe;
    border-radius: 2px;
    box-shadow: 0 1px 5px rgba(0, 0, 0, 0.6);
    transform: translate(-50%, -50%);
    transition: background 0.12s, box-shadow 0.12s;
    pointer-events: auto;
}

.gizmo-handle:hover,
.gizmo-handle:active {
    background: #4facfe;
    box-shadow: 0 0 0 2px rgba(79, 172, 254, 0.35), 0 1px 5px rgba(0,0,0,0.6);
}

/* Edge handles: slim rectangles */
.gizmo-handle--n,
.gizmo-handle--s {
    width: 18px;
    height: 7px;
}

.gizmo-handle--e,
.gizmo-handle--w {
    width: 7px;
    height: 18px;
}
</style>
