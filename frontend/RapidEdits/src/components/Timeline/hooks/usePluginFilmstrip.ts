import { ref, watchEffect, onWatcherCleanup } from "vue";
import * as THREE from "three";
import { pluginRegistry } from "../../../core/plugins/PluginRegistry";
import type { Clip } from "../../../types/Timeline";

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

export function usePluginFilmstrip(clip: Clip, widthRef: { value: number }) {
    const thumbnails = ref<{ id: number; url: string; loaded: boolean }[]>([]);
    watchEffect(async () => {
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
        // Transparent background by default (null)

        // Setup Camera
        // Reset camera logic - we will Auto-Fit later
        camera.position.set(0, 0, 100);
        camera.lookAt(0, 0, 0);

        // Retry loop for asset loading (e.g. Font)
        let object: THREE.Object3D | null = null;
        let attempts = 0;
        while (!object && attempts < 30) {
            // More attempts
            object = plugin.render(clip);
            console.log("object", object);
            if (!object) {
                await new Promise((r) => setTimeout(r, 100));
                attempts++;
            }
        }

        if (!object) {
            console.warn("[Filmstrip] Failed to render plugin object");
            return;
        }

        scene.add(object);

        // Auto-Fit Camera to Object
        const box = new THREE.Box3().setFromObject(object);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        if (size.lengthSq() === 0) {
            size.set(100, 100, 100);
        }

        const padding = 1.2;
        const camWidth = Math.max(size.x, size.y * 1.77) * padding;
        const camHeight = camWidth / 1.77;

        camera.left = -camWidth / 2;
        camera.right = camWidth / 2;
        camera.top = camHeight / 2;
        camera.bottom = -camHeight / 2;

        camera.position.set(center.x, center.y, box.max.z + 500);
        camera.lookAt(center.x, center.y, center.z);
        camera.updateProjectionMatrix();

        const ambient = new THREE.AmbientLight(0xffffff, 1.0);
        scene.add(ambient);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(1, 1, 2);
        scene.add(dirLight);

        let cancelled = false;
        onWatcherCleanup(() => {
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
                if (i >= count)
                    console.log("[Filmstrip] Finished generating thumbnails");
                return;
            }

            console.log(`[Filmstrip] Rendering frame ${i}/${count}`);
            const time = i * step;
            plugin.update(object!, clip, time, 1 / 60);

            renderer.clear(); // Clear before render
            renderer.render(scene, camera);

            const url = renderer.domElement.toDataURL("image/jpeg", 0.8); // JPEG might be faster/lighter

            const newThumbs = [...thumbnails.value];
            newThumbs[i] = { id: i, url, loaded: true };
            thumbnails.value = newThumbs;

            i++;
            requestAnimationFrame(renderNext);
        };

        requestAnimationFrame(renderNext);
    });

    return { thumbnails };
}
