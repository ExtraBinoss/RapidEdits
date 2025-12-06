import * as THREE from "three";
import type { Clip } from "../../../types/Timeline";
import type { IPlugin } from "../../../core/plugins/PluginInterface";

export interface ThumbnailRequest {
    clip: Clip;
    plugin: IPlugin;
    width: number;
    height: number;
    count: number;
    onFrame: (index: number, url: string, time: number) => void;
}

export class PluginThumbnailRenderer {
    private static instance: PluginThumbnailRenderer;
    private renderer: THREE.WebGLRenderer;
    private camera: THREE.OrthographicCamera;

    private constructor() {
        this.renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: true,
        });
        this.renderer.setPixelRatio(1); // Keep it performant
        this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

        // Initial size, will be resized per request if needed
        this.renderer.setSize(128, 72);

        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
        this.camera.position.z = 100;
    }

    public static getInstance(): PluginThumbnailRenderer {
        if (!PluginThumbnailRenderer.instance) {
            PluginThumbnailRenderer.instance = new PluginThumbnailRenderer();
        }
        return PluginThumbnailRenderer.instance;
    }

    /**
     * Generates a sequence of thumbnails for a given clip and plugin.
     * Returns a cancellation function.
     */
    public generateFilmstrip(request: ThumbnailRequest): () => void {
        let cancelled = false;

        const { clip, plugin, width, height, count, onFrame } = request;

        this.renderer.setSize(width, height);

        // 1. Setup Scene
        const scene = new THREE.Scene();
        const config = plugin.getFilmstripConfig
            ? plugin.getFilmstripConfig(clip)
            : {};

        if (config.backgroundColor) {
            scene.background = new THREE.Color(config.backgroundColor);
        }

        // 2. Setup Lighting
        const ambient = new THREE.AmbientLight(0xffffff, 1.2);
        scene.add(ambient);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(5, 5, 10);
        scene.add(dirLight);

        // 3. Create Plugin Object
        let object: THREE.Object3D | null = null;

        // Async loading handling
        const initAndRender = async () => {
            // Retry loop for asset loading
            let attempts = 0;
            while (!object && attempts < 50 && !cancelled) {
                object = plugin.render(clip);
                if (!object) {
                    await new Promise((r) => setTimeout(r, 50));
                    attempts++;
                }
            }

            if (cancelled || !object) {
                if (!object)
                    console.warn(
                        "[PluginThumbnailRenderer] Failed to render plugin object",
                    );
                cleanup();
                return;
            }

            scene.add(object);

            // 4. Setup Camera
            this.setupCamera(object, config);

            // 5. Render Loop
            const duration = clip.duration;
            const step = duration / Math.max(1, count);

            // We can't block the main thread, so we chunk it
            let i = 0;
            const renderLoop = () => {
                if (cancelled || i >= count) {
                    cleanup();
                    return;
                }

                const time = i * step;

                // Update plugin
                // Fix: Passing correct frame duration.
                // If rendering absolute points, 1/60 is a standard "instantaneous" delta approximation.
                // Ideally we should pass 'step' if the plugin needs to integrate, but usually it doesn't for filmstrips.
                plugin.update(object!, clip, time, 1 / 60);

                this.renderer.clear();
                this.renderer.render(scene, this.camera);

                const url = this.renderer.domElement.toDataURL(
                    "image/jpeg",
                    0.9,
                );
                onFrame(i, url, time);

                i++;
                if (!cancelled) {
                    requestAnimationFrame(renderLoop);
                }
            };

            renderLoop();
        };

        const cleanup = () => {
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
        };

        const cancel = () => {
            cancelled = true;
            cleanup();
        };

        initAndRender();

        return cancel;
    }

    private setupCamera(object: THREE.Object3D, config: any) {
        if (config.disableAutoFit && config.fixedSceneWidth) {
            const width = config.fixedSceneWidth;
            const height = width / 1.777;

            this.camera.left = -width / 2;
            this.camera.right = width / 2;
            this.camera.top = height / 2;
            this.camera.bottom = -height / 2;
            this.camera.position.set(0, 0, 500);
            this.camera.lookAt(0, 0, 0);
            this.camera.updateProjectionMatrix();
        } else {
            const box = new THREE.Box3().setFromObject(object);
            const size = new THREE.Vector3();
            box.getSize(size);
            const center = new THREE.Vector3();
            box.getCenter(center);

            if (size.lengthSq() === 0) size.set(100, 100, 100);

            const padding = config.cameraPadding || 1.2;
            const camWidth = Math.max(size.x, size.y * 1.77) * padding;
            const camHeight = camWidth / 1.77;

            this.camera.left = -camWidth / 2;
            this.camera.right = camWidth / 2;
            this.camera.top = camHeight / 2;
            this.camera.bottom = -camHeight / 2;

            this.camera.position.set(center.x, center.y, box.max.z + 500);
            this.camera.lookAt(center.x, center.y, center.z);
            this.camera.updateProjectionMatrix();
        }
    }
}
