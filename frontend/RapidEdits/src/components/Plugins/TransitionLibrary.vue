<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, markRaw } from "vue";
import * as THREE from "three";
import { pluginRegistry } from "../../core/plugins/PluginRegistry";
import { useProjectStore } from "../../stores/projectStore";
import { editorEngine } from "../../core/EditorEngine";
import type { IPlugin, TransitionPlugin } from "../../core/plugins/PluginInterface";
import { isPluginClip, type Clip } from "../../types/Timeline";
import { applyScissorBox } from "../../utils/threeScissor";

const projectStore = useProjectStore();
const containerRef = ref<HTMLElement | null>(null);
const gridRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const previewRefs = ref<Map<string, HTMLElement>>(new Map());

const transitions = computed(() => {
    return pluginRegistry.state.availablePlugins.filter((p) => {
        const meta = p.getMetadata();
        return meta.type === "transition" && !meta.isGlobalInspector;
    });
});

// State for animations
const hoverStates = ref<Map<string, { progress: number; isHovered: boolean }>>(new Map());

// Three.js Core
let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let animationFrameId: number;
let lastViewportWidth = 0;
let lastViewportHeight = 0;
let gridResizeObserver: ResizeObserver | null = null;

// Preview content
let previewMesh: THREE.Object3D | null = null;
let currentSourceClipId: string | null = null;

const storePreviewBaseState = (root: THREE.Object3D) => {
    root.traverse((node) => {
        node.userData.__previewBaseTransform = {
            position: node.position.clone(),
            quaternion: node.quaternion.clone(),
            scale: node.scale.clone(),
        };
        if (node instanceof THREE.Mesh) {
            const mats = Array.isArray(node.material) ? node.material : [node.material];
            node.userData.__previewBaseMaterials = mats.map((mat) => ({
                transparent: mat.transparent,
                opacity: mat.opacity,
                shaderOpacity:
                    mat instanceof THREE.ShaderMaterial && mat.uniforms.opacity
                        ? Number(mat.uniforms.opacity.value)
                        : null,
            }));
        }
    });
};

const resetPreviewToBaseState = (root: THREE.Object3D) => {
    root.traverse((node) => {
        const t = node.userData.__previewBaseTransform;
        if (t) {
            node.position.copy(t.position);
            node.quaternion.copy(t.quaternion);
            node.scale.copy(t.scale);
        }
        if (node instanceof THREE.Mesh) {
            const mats = Array.isArray(node.material) ? node.material : [node.material];
            const baseMats = node.userData.__previewBaseMaterials as
                | Array<{ transparent: boolean; opacity: number; shaderOpacity: number | null }>
                | undefined;
            if (baseMats) {
                mats.forEach((mat, i) => {
                    const base = baseMats[i];
                    if (!base) return;
                    mat.transparent = base.transparent;
                    mat.opacity = base.opacity;
                    if (mat instanceof THREE.ShaderMaterial && mat.uniforms.opacity && base.shaderOpacity !== null) {
                        mat.uniforms.opacity.value = base.shaderOpacity;
                    }
                });
            }
        }
    });
};

const initThree = () => {
    if (!canvasRef.value) return;

    renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.value,
        antialias: true,
        alpha: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setScissorTest(true);

    scene = new THREE.Scene();
    // Match the main editor's camera scale so transition plugins with absolute distances (like 500 units) work normally.
    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
    camera.position.z = 1000;

    // Add some lights just in case
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 3));
    const light = new THREE.DirectionalLight(0xffffff, 1.5);
    light.position.set(1, 1, 1);
    scene.add(light);

    animate();
};

const syncCanvasToGridViewport = () => {
    if (!renderer || !containerRef.value || !canvasRef.value) return;

    const viewportWidth = Math.max(1, Math.floor(containerRef.value.clientWidth));
    const viewportHeight = Math.max(1, Math.floor(containerRef.value.clientHeight));
    if (lastViewportWidth === viewportWidth && lastViewportHeight === viewportHeight) return;

    lastViewportWidth = viewportWidth;
    lastViewportHeight = viewportHeight;

    // Let Three.js control the CSS size explicitly to prevent intrinsic scaling issues on high-DPR screens.
    renderer.setSize(viewportWidth, viewportHeight, true);
};

const updatePreviewContent = async () => {
    const selectedId = projectStore.selectedClipIds[0];
    if (selectedId === currentSourceClipId && previewMesh) return;

    // Cleanup old preview
    if (previewMesh) {
        scene.remove(previewMesh);
        // We should ideally dispose but let's be careful with shared textures
        previewMesh = null;
    }

    currentSourceClipId = selectedId || null;
    
    let sourceClip: Clip | undefined;
    if (selectedId) {
        sourceClip = editorEngine.getClip(selectedId);
    }

    if (sourceClip) {
        // Create a visual for the preview
        if (isPluginClip(sourceClip)) {
            const plugin = pluginRegistry.get(sourceClip.type as any);
            if (plugin) {
                const mesh = plugin.render(sourceClip);
                if (mesh) {
                    const group = new THREE.Group();
                    group.add(mesh);
                    previewMesh = group;
                    
                    // Trigger an update to ensure it's rendered correctly
                    plugin.update(mesh, sourceClip, 0, 0);
                }
            }
        } else {
            // Media clip - Create a simple plane with the texture
            const asset = editorEngine.getAsset(sourceClip.assetId);
            if (asset) {
                const geometry = new THREE.PlaneGeometry(1, 1);
                const material = new THREE.ShaderMaterial({
                    uniforms: {
                        map: { value: null },
                        opacity: { value: 1.0 },
                        color: { value: new THREE.Color(0xffffff) },
                        borderRadius: { value: 0 },
                        edgeSoftness: { value: 0 },
                        crop: { value: new THREE.Vector4(0,0,0,0) },
                        resolution: { value: new THREE.Vector2(1,1) }
                    },
                    vertexShader: `
                        varying vec2 vUv;
                        void main() {
                            vUv = uv;
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `,
                    fragmentShader: `
                        uniform sampler2D map;
                        uniform float opacity;
                        uniform vec3 color;
                        varying vec2 vUv;
                        void main() {
                            vec4 tex = texture2D(map, vUv);
                            gl_FragColor = vec4(tex.rgb * color, tex.a * opacity);
                            #include <colorspace_fragment>
                        }
                    `,
                    transparent: true,
                });
                const mesh = new THREE.Mesh(geometry, material);
                previewMesh = mesh;

                // Load texture
                const mainRenderer = editorEngine.getRenderer();
                if (mainRenderer) {
                    const texture = await mainRenderer.textureAllocator.getTexture(asset);
                    if (texture) {
                        material.uniforms.map.value = texture;
                        // Fit to screen logic (simplified)
                        const img = texture.image as any;
                        const aspect = (img?.videoWidth || img?.width || 16) / (img?.videoHeight || img?.height || 9);
                        const renderAspect = 1.0; 
                        
                        // Visible height at z=1000, fov=50
                        const VISIBLE_HEIGHT = 2 * 1000 * Math.tan((50 * Math.PI) / 360);

                        if (aspect > renderAspect) {
                            // Video is wider than square preview: cover height
                            mesh.scale.set(VISIBLE_HEIGHT * aspect, VISIBLE_HEIGHT, 1);
                        } else {
                            // Video is taller than square preview: cover width
                            mesh.scale.set(VISIBLE_HEIGHT, VISIBLE_HEIGHT / aspect, 1);
                        }
                        mesh.userData.originalScale = mesh.scale.clone();
                    }
                }
            }
        }
    } else {
        // No selected clip: do not render a fallback object in previews.
        previewMesh = null;
    }

    if (previewMesh) {
        storePreviewBaseState(previewMesh);
        scene.add(previewMesh);
    }
};

const animate = () => {
    animationFrameId = requestAnimationFrame(animate);
    if (!renderer || !gridRef.value || !canvasRef.value) return;

    // Because the canvas is now outside the scrollable container, it naturally covers the whole area without needing to be manually shifted!
    const canvasRect = canvasRef.value.getBoundingClientRect();
    const viewportWidth = Math.max(1, Math.floor(canvasRect.width));
    const viewportHeight = Math.max(1, Math.floor(canvasRect.height));

    renderer.setClearColor(0x000000, 0);
    renderer.setScissorTest(false);
    renderer.clear();
    renderer.setScissorTest(true);

    const time = Date.now() * 0.001;

    transitions.value.forEach((plugin) => {
        const meta = plugin.getMetadata();
        const el = previewRefs.value.get(meta.id);
        if (!el) return;
        
        const tileRect = el.getBoundingClientRect();

        // Calculate position relative to the canvas
        const left = tileRect.left - canvasRect.left;
        const top = tileRect.top - canvasRect.top;
        const width = tileRect.width;
        const height = tileRect.height;

        if (width <= 0 || height <= 0) return;

        // Clamp to canvas bounds
        const clampedLeft = Math.max(0, left);
        const clampedTop = Math.max(0, top);
        const clampedRight = Math.min(viewportWidth, left + width);
        const clampedBottomFromTop = Math.min(viewportHeight, top + height);
        
        const clampedWidth = Math.max(0, clampedRight - clampedLeft);
        const clampedHeight = Math.max(0, clampedBottomFromTop - clampedTop);
        if (clampedWidth <= 0 || clampedHeight <= 0) return;

        const box = {
            left: Math.floor(clampedLeft),
            // Three.js uses bottom-up coordinates
            bottom: Math.floor(viewportHeight - clampedBottomFromTop),
            width: Math.floor(clampedWidth),
            height: Math.floor(clampedHeight),
        };
        applyScissorBox(renderer, box);

        // Update progress
        let state = hoverStates.value.get(meta.id);
        if (!state) {
            state = { progress: 0, isHovered: false };
            hoverStates.value.set(meta.id, state);
        }

        if (state.isHovered) {
            state.progress += 0.02;
            if (state.progress > 1) state.progress = 0;
        } else {
            state.progress = 0;
        }

        // Render preview
        if (previewMesh) {
            // Important: each tile preview must start from exactly the same base state.
            resetPreviewToBaseState(previewMesh);

            if (state.isHovered) {
                // Apply transition only on hover; idle state keeps base frame visible.
                const transitionPlugin = plugin as unknown as TransitionPlugin;
                const mockClip: any = {
                    id: "preview",
                    data: plugin.createData(),
                    duration: 1.0,
                    start: 0,
                };
                transitionPlugin.apply(mockClip, [previewMesh], state.progress, time);
            }

            // Update camera aspect for this tile
            const tileAspect = width / height;
            if (camera.aspect !== tileAspect) {
                camera.aspect = tileAspect;
                camera.updateProjectionMatrix();
            }

            renderer.render(scene, camera);
        }
    });
};

onMounted(() => {
    initThree();
    updatePreviewContent();
    syncCanvasToGridViewport();

    if (containerRef.value) {
        gridResizeObserver = new ResizeObserver(() => {
            syncCanvasToGridViewport();
        });
        gridResizeObserver.observe(containerRef.value);
    }
});

onUnmounted(() => {
    cancelAnimationFrame(animationFrameId);
    if (gridResizeObserver) {
        gridResizeObserver.disconnect();
        gridResizeObserver = null;
    }
    if (renderer) {
        renderer.dispose();
    }
    lastViewportWidth = 0;
    lastViewportHeight = 0;
});

watch(() => projectStore.selectedClipIds, () => {
    updatePreviewContent();
}, { deep: true });

const setPreviewRef = (el: any, id: string) => {
    if (el) previewRefs.value.set(id, el);
};

const onMouseEnter = (id: string) => {
    const state = hoverStates.value.get(id);
    if (state) state.isHovered = true;
    else hoverStates.value.set(id, { progress: 0, isHovered: true });
};

const onMouseLeave = (id: string) => {
    const state = hoverStates.value.get(id);
    if (state) state.isHovered = false;
};

const addPlugin = (plugin: IPlugin) => {
    // ... logic from Sidebar.vue ...
    // Emit event or call a method
};

const handlePluginDragStart = (e: DragEvent, plugin: IPlugin) => {
    projectStore.draggedPlugin = markRaw(plugin);
    if (e.dataTransfer) {
        pluginRegistry.setDraggedPlugin(plugin);
        const meta = plugin.getMetadata();
        const payload = {
            type: "plugin",
            pluginId: meta.id,
            pluginType: meta.type,
            name: meta.name,
        };
        e.dataTransfer.setData("application/json", JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "copy";
    }
};

const handlePluginDragEnd = () => {
    projectStore.draggedPlugin = null;
    pluginRegistry.clearDraggedPlugin();
};
</script>

<template>
    <div ref="containerRef" class="flex-1 flex flex-col min-h-0 relative">
        <canvas
            ref="canvasRef"
            class="absolute inset-0 w-full h-full pointer-events-none z-0"
        ></canvas>

        <div class="p-4 border-b border-canvas-border flex flex-col gap-1 z-10 bg-canvas-light">
            <h2 class="font-semibold text-text-main capitalize text-sm">Transitions</h2>
            <p v-if="!projectStore.selectedClipIds.length" class="text-[10px] text-text-muted italic">
                Select a clip on the timeline to preview transitions
            </p>
            <p v-else class="text-[10px] text-brand-primary font-medium animate-pulse">
                Hover to preview transition
            </p>
        </div>

        <div ref="gridRef" class="flex-1 overflow-y-auto custom-scrollbar relative z-10">

            <div class="p-4 grid grid-cols-2 gap-3 relative z-10">
                <div
                    v-for="plugin in transitions"
                    :key="plugin.getMetadata().id"
                    class="aspect-square border border-canvas-border rounded-lg hover:border-brand-primary transition-all group select-none cursor-grab relative overflow-hidden"
                    @mouseenter="onMouseEnter(plugin.getMetadata().id)"
                    @mouseleave="onMouseLeave(plugin.getMetadata().id)"
                    draggable="true"
                    @dragstart="handlePluginDragStart($event as DragEvent, plugin)"
                    @dragend="handlePluginDragEnd"
                    @click="$emit('add', plugin)"
                >
                    <div
                        :ref="(el) => setPreviewRef(el, plugin.getMetadata().id)"
                        class="absolute inset-0 pointer-events-none bg-canvas/40"
                    ></div>

                    <div class="absolute inset-x-2 bottom-2 z-20 pointer-events-none">
                        <span class="block text-center text-[10px] text-white font-semibold bg-black/60 backdrop-blur-md px-2 py-1 rounded shadow-lg border border-white/10 uppercase tracking-wider">
                            {{ plugin.getMetadata().name }}
                        </span>
                    </div>
                </div>

                <div
                    v-if="transitions.length === 0"
                    class="col-span-2 py-8 text-center text-text-muted text-xs"
                >
                    No transitions found.
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.bg-canvas\/40 {
    background-color: rgba(var(--color-canvas), 0.4);
}

canvas {
    will-change: transform;
}
</style>
