import { ref, watchEffect, onWatcherCleanup } from "vue";
import * as THREE from "three";
import { pluginRegistry } from "../../../core/plugins/PluginRegistry";
import type { Clip } from "../../../types/Timeline";

// Shared renderer pool to avoid WebGL context limits
// We use a singleton approach for the thumbnail renderer
let thumbRenderer: THREE.WebGLRenderer | null = null;
let thumbScene: THREE.Scene | null = null;
let thumbCamera: THREE.OrthographicCamera | null = null;

function getSharedResources() {
    if (!thumbRenderer) {
        thumbRenderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: true, // Needed for toDataURL
        });
        thumbRenderer.setPixelRatio(1); // Low res is fine for thumbs
        thumbRenderer.setSize(128, 72); // Fixed thumbnail size
        thumbRenderer.outputColorSpace = THREE.LinearSRGBColorSpace;

        thumbScene = new THREE.Scene();
        
        thumbCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
        thumbCamera.position.z = 100;
    }
    return {
        renderer: thumbRenderer!,
        scene: thumbScene!,
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

        const { renderer, scene, camera } = getSharedResources();

        // Setup Camera 
        const CAM_WIDTH = 1920;
        const CAM_HEIGHT = 1080;

        camera.left = -CAM_WIDTH / 2;
        camera.right = CAM_WIDTH / 2;
        camera.top = CAM_HEIGHT / 2;
        camera.bottom = -CAM_HEIGHT / 2;
        camera.updateProjectionMatrix();

        // Retry loop for asset loading (e.g. Font)
        let object: THREE.Object3D | null = null;
        let attempts = 0;
        while (!object && attempts < 10) {
            object = plugin.render(clip);
            if (!object) {
                await new Promise(r => setTimeout(r, 200)); // Wait for font
                attempts++;
            }
        }

        if (!object) {
            console.warn("[Filmstrip] Failed to render plugin object (assets missing?)");
            return;
        }

        scene.add(object);
        const ambient = new THREE.AmbientLight(0xffffff, 1.0);
        scene.add(ambient);

        let cancelled = false;
        onWatcherCleanup(() => {
            cancelled = true;
            scene.remove(object!);
            scene.remove(ambient);
            // Optional: Dispose
        });

        // Render Loop via RAF
        const duration = clip.duration;
        const step = duration / count;
        let i = 0;

        const renderNext = () => {
            if (cancelled || i >= count) return;

            const time = i * step;
            plugin.update(object!, clip, time, 1 / 60);
            renderer.render(scene, camera);
            
            const url = renderer.domElement.toDataURL("image/png");
            
            // Update reactive array efficiently
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
