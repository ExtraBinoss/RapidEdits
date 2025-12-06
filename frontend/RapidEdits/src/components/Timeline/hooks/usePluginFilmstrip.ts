import { ref, watch, onUnmounted } from "vue";
import * as THREE from "three";
import { pluginRegistry } from "../../../core/plugins/PluginRegistry";
import type { Clip } from "../../../types/Timeline";
import { globalEventBus } from "../../../core/events/EventBus";

// Shared renderer pool to avoid WebGL context limits
// We use a singleton approach for the thumbnail renderer
let thumbRenderer: THREE.WebGLRenderer | null = null;
let thumbCamera: THREE.OrthographicCamera | null = null;

function getSharedResources() {
    if (!thumbRenderer) {
        thumbRenderer = new THREE.WebGLRenderer({
            alpha: true, // Alpha enabled for transparent thumbnails
            antialias: true,
            preserveDrawingBuffer: true, // Needed for toDataURL
        });
        thumbRenderer.setPixelRatio(1);
        thumbRenderer.setSize(128, 72);
        thumbRenderer.outputColorSpace = THREE.LinearSRGBColorSpace;
        // No setClearColor, use default transparent

        thumbCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
        thumbCamera.position.z = 100;
    }
    return {
        renderer: thumbRenderer!,
        camera: thumbCamera!,
    };
}

export function usePluginFilmstrip(
    clipGetter: () => Clip,
    widthRef: { value: number },
) {
    console.log("[DebounceDebug] Hook Mounted", clipGetter().id);
    const thumbnails = ref<{ id: number; url: string; loaded: boolean }[]>([]);
    const version = ref(0);

    // Listen for property changes from the plugin properties panel
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handlePropertyChange = (payload: any) => {
        const currentClip = clipGetter();
        if (payload?.clipId === currentClip.id) {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            debounceTimer = setTimeout(() => {
                // console.log('[DebounceDebug] Timer Fired - Version Incrementing');
                version.value++;
                debounceTimer = null;
            }, 500);
        } else {
            // console.log('[DebounceDebug] Payload ID mismatch', payload?.clipId, currentClip.id);
        }
    };

    globalEventBus.on("PLUGIN_PROPERTY_CHANGED", handlePropertyChange);

    // Cleanup listener when the component using this hook is unmounted
    // Since this is a composable, we rely on the watcher's cleanup or onUnmounted if we were in a component
    // But specific to this watch scope:

    // Actually, we should register the listener outside the watch, and clean it up when the scope is disposed.
    // Vue's onScopeDispose or onUnmounted is better, but let's use the watch cleanup for simplicity if possible?
    // No, watch cleanup is for the specific side effect.
    // We'll use onUnmounted or onScopeDispose if we can import it.

    // Let's import onUnmounted
    onUnmounted(() => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        globalEventBus.off("PLUGIN_PROPERTY_CHANGED", handlePropertyChange);
    });

    watch(
        () => [
            // We removed clipGetter().data from here to prevent immediate updates on every prop change.
            // Updates are now driven by the debounced 'version' signal.
            widthRef.value,
            clipGetter().type,
            version.value,
        ],
        async (newVal, oldVal, onCleanup) => {
            const [newWidth, newType, newVersion] = newVal;
            const [oldWidth, oldType, oldVersion] = oldVal || [];

            // Prevent spurious triggers
            if (
                newWidth === oldWidth &&
                newType === oldType &&
                newVersion === oldVersion
            ) {
                return;
            }

            console.log("[DebounceDebug] Watch Triggered", {
                changes: {
                    width: newWidth !== oldWidth,
                    type: newType !== oldType,
                    version: newVersion !== oldVersion,
                },
                newVal,
                oldVal,
            });
            const clip = clipGetter();
            const plugin = pluginRegistry.get(clip.type);
            if (!plugin) return;

            // If width is 0, don't bother yet
            if (!widthRef.value) return;

            const containerWidth = widthRef.value;
            const thumbWidth = 96 * 1.77;
            const count = Math.max(1, Math.ceil(containerWidth / thumbWidth));

            // Reset
            thumbnails.value = Array.from({ length: count }, (_, i) => ({
                id: i,
                url: "",
                loaded: false,
            }));

            const { renderer, camera } = getSharedResources();

            // Use LOCAL scene to avoid sharing conflicts
            const scene = new THREE.Scene();

            // Get config
            const config = plugin.getFilmstripConfig
                ? plugin.getFilmstripConfig(clip)
                : {};

            // Apply background color from config
            if (config.backgroundColor) {
                scene.background = new THREE.Color(config.backgroundColor);
            } else {
                scene.background = null; // Transparent default
            }

            // Setup Camera
            // Reset camera logic - we will Auto-Fit later
            camera.position.set(0, 0, 100);
            camera.lookAt(0, 0, 0);

            // Retry loop for asset loading (e.g. Font)
            let object: THREE.Object3D | null = null;
            let attempts = 0;
            // Wait up to 10 seconds for assets to load
            while (!object && attempts < 100) {
                object = plugin.render(clip);
                if (!object) {
                    await new Promise((r) => setTimeout(r, 100));
                    attempts++;
                }
            }

            if (!object) {
                console.warn("[Filmstrip] Failed to render plugin object");
                // Fill with empty or error placeholder?
                return;
            }

            scene.add(object);

            if (config.disableAutoFit && config.fixedSceneWidth) {
                // Fixed camera view
                const width = config.fixedSceneWidth;
                const height = width / 1.777; // 16:9 aspect ratio

                camera.left = -width / 2;
                camera.right = width / 2;
                camera.top = height / 2;
                camera.bottom = -height / 2;

                // Center camera at origin (or configurable offset?)
                // Assuming objects are centered at (0,0) or placed relative to (0,0)
                camera.position.set(0, 0, 500);
                camera.lookAt(0, 0, 0);
                camera.updateProjectionMatrix();
            } else {
                // Auto-Fit Camera to Object
                const box = new THREE.Box3().setFromObject(object);
                const size = new THREE.Vector3();
                box.getSize(size);
                const center = new THREE.Vector3();
                box.getCenter(center);

                if (size.lengthSq() === 0) {
                    size.set(100, 100, 100);
                }

                const padding = config.cameraPadding || 1.2;
                const camWidth = Math.max(size.x, size.y * 1.77) * padding;
                const camHeight = camWidth / 1.77;

                camera.left = -camWidth / 2;
                camera.right = camWidth / 2;
                camera.top = camHeight / 2;
                camera.bottom = -camHeight / 2;

                camera.position.set(center.x, center.y, box.max.z + 500);
                camera.lookAt(center.x, center.y, center.z);
                camera.updateProjectionMatrix();
            }

            // Lighting for 3D visibility
            const ambient = new THREE.AmbientLight(0xffffff, 1.2);
            scene.add(ambient);
            const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
            dirLight.position.set(5, 5, 10);
            scene.add(dirLight);

            let cancelled = false;
            onCleanup(() => {
                cancelled = true;
                // Cleanup local scene
                scene.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material))
                                child.material.forEach((m: any) => m.dispose());
                            else child.material.dispose();
                        }
                    }
                });
            });

            // Render Loop via RAF
            const duration = clip.duration;
            const step = duration / count;
            let i = 0;

            const renderNext = () => {
                if (cancelled || i >= count) {
                    // if (i >= count) console.log("[Filmstrip] Finished generating thumbnails");
                    return;
                }

                // console.log(`[Filmstrip] Rendering frame ${i}/${count}`);
                const time = i * step;
                plugin.update(object!, clip, time, 1 / 60);

                renderer.clear(); // Clear before render
                renderer.render(scene, camera);

                const url = renderer.domElement.toDataURL("image/jpeg", 0.9);

                const newThumbs = [...thumbnails.value];
                newThumbs[i] = { id: i, url, loaded: true };
                thumbnails.value = newThumbs;

                i++;
                requestAnimationFrame(renderNext);
            };

            requestAnimationFrame(renderNext);
        },
        // Removed deep: true as we are watching primitives
    );

    return { thumbnails };
}
