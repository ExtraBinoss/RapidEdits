import * as THREE from "three";
import { editorEngine } from "../EditorEngine";
import { TextureAllocator } from "./textures/TextureAllocator";
import { pluginRegistry } from "../plugins/PluginRegistry";
import type { Clip, Track } from "../../types/Timeline";
import { ThreeSceneManager } from "./managers/ThreeSceneManager";
import { ThreeInteractionManager } from "./managers/ThreeInteractionManager";
import { ThreeSelectionManager } from "./managers/ThreeSelectionManager";

export interface ThreeRendererOptions {
    container?: HTMLElement;
    width?: number;
    height?: number;
    canvas?: HTMLCanvasElement | OffscreenCanvas;
    allocator?: TextureAllocator;
    isCaptureMode?: boolean;
}

export class ThreeRenderer {
    // Managers
    public sceneManager: ThreeSceneManager;
    public interactionManager: ThreeInteractionManager | null = null;
    public selectionManager: ThreeSelectionManager | null = null;

    // State
    private isCaptureMode: boolean = false;
    private allocator: TextureAllocator;
    private resizeObserver: ResizeObserver | null = null;
    private scaleMode: "fit" | "fill" | number = "fit";

    // Scene Graph
    private clipMeshes: Map<string, THREE.Object3D> = new Map();

    // Ambient Sampling

    private pendingLoads: Set<Promise<any>> = new Set();

    constructor(options: ThreeRendererOptions) {
        this.allocator = options.allocator || new TextureAllocator();
        this.isCaptureMode = options.isCaptureMode || false;

        this.sceneManager = new ThreeSceneManager({
            container: options.container,
            width: options.width,
            height: options.height,
            canvas: options.canvas,
        });
    }

    public setCaptureMode(isCapture: boolean) {
        this.isCaptureMode = isCapture;
    }

    public setSize(width: number, height: number) {
        this.sceneManager.setSize(width, height);

        this.clipMeshes.forEach((mesh) => {
            if (mesh instanceof THREE.Mesh) {
                const mat = mesh.material as THREE.MeshBasicMaterial;
                if (mat.map) this.fitMeshToScreen(mesh, mat.map);
            }
        });
    }

    public async init() {
        if (this.sceneManager.container) {
            this.resizeObserver = new ResizeObserver(() => this.handleResize());
            this.resizeObserver.observe(this.sceneManager.container);
            this.handleResize();
        }

        if (!this.isCaptureMode) {
            this.sceneManager.renderer.setAnimationLoop(this.render.bind(this));

            if (this.sceneManager.container) {
                this.interactionManager = new ThreeInteractionManager(
                    this.sceneManager.camera,
                    this.sceneManager.scene,
                    this.sceneManager.renderer.domElement,
                    (clipId: string) => this.clipMeshes.get(clipId),
                    () => this.selectionManager?.updateSelectionGizmo(),
                    () => this.selectionManager?.updateSelectionGizmo(), // Transform changed -> update gizmo
                );

                this.selectionManager = new ThreeSelectionManager(
                    this.sceneManager.scene,
                    this.interactionManager.transformControls,
                    (clipId) => this.clipMeshes.get(clipId),
                );
            }
        }
    }

    private handleResize() {
        if (!this.sceneManager.container) return;
        const width = this.sceneManager.container.clientWidth;
        const height = this.sceneManager.container.clientHeight;
        this.setSize(width, height);
    }

    public async waitForPendingLoads() {
        if (this.pendingLoads.size === 0) return;
        await Promise.all(Array.from(this.pendingLoads));
        this.pendingLoads.clear();
    }

    public setScaleMode(mode: "fit" | "fill" | number) {
        this.scaleMode = mode;
        if (this.sceneManager.container) this.handleResize();
        else {
            this.clipMeshes.forEach((mesh) => {
                if (mesh instanceof THREE.Mesh) {
                    const mat = mesh.material as THREE.MeshBasicMaterial;
                    if (mat.map) this.fitMeshToScreen(mesh, mat.map);
                }
            });
        }
    }

    public render() {
        if (this.interactionManager) this.interactionManager.update();
        if (this.selectionManager) this.selectionManager.update();

        const currentTime = editorEngine.getCurrentTime();
        const tracks = editorEngine.getTracks();
        this.renderFrame(currentTime, tracks);
    }

    // Core Rendering Logic (Clip -> Mesh)
    public renderFrame(currentTime: number, tracks: Track[]) {
        const visibleClips: Clip[] = [];
        tracks.forEach((track: Track) => {
            if (track.isMuted) return;

            const clip = track.clips.find(
                (c) =>
                    currentTime >= c.start &&
                    currentTime < c.start + c.duration,
            );
            if (clip) visibleClips.push(clip);
        });

        const visibleClipIds = new Set(visibleClips.map((c) => c.id));

        // Capture Mode Update
        if (this.isCaptureMode) {
            if (visibleClips.length > 0) {
                visibleClips.forEach((c) => {
                    const mesh = this.clipMeshes.get(c.id);
                    if (mesh && mesh instanceof THREE.Mesh) {
                        const map = (mesh.material as any).map;
                        if (map) map.needsUpdate = true;
                    }
                });
            }
        }

        // Cleanup
        for (const [clipId, object] of this.clipMeshes) {
            if (!visibleClipIds.has(clipId)) {
                if (object instanceof THREE.Mesh) {
                    const mat = object.material as THREE.MeshBasicMaterial;
                    if (mat.map && mat.map instanceof THREE.VideoTexture) {
                        const video = mat.map.image;
                        if (video && !video.paused) {
                            video.pause();
                        }
                    }
                    object.geometry.dispose();
                    (object.material as THREE.Material).dispose();
                }
                this.sceneManager.scene.remove(object);
                this.clipMeshes.delete(clipId);
            }
        }

        const videoClips = visibleClips.filter((c) => c.type === "video");
        if (videoClips.length === 0) {
            // this.updateAmbientColor(null); // Moved out or ignored for now? Original had it.
            // Let's implement updateAmbientColor locally if needed or remove it if not critical.
            // It was private in original. Kept minimal here for now.
        }

        visibleClips.forEach((clip) => {
            let object = this.clipMeshes.get(clip.id);
            const trackIndex = tracks.findIndex(
                (t: Track) => t.id === clip.trackId,
            );

            const plugin = pluginRegistry.get(clip.type);
            if (plugin) {
                if (!object) {
                    const contentMesh = plugin.render(clip);
                    if (contentMesh) {
                        const group = new THREE.Group();
                        group.add(contentMesh);

                        this.sceneManager.scene.add(group);
                        this.clipMeshes.set(clip.id, group);
                        object = group;
                    }
                }

                if (object) {
                    object.position.z = 500 + trackIndex;

                    if (object.children.length > 0) {
                        plugin.update(
                            object.children[0]!,
                            clip,
                            currentTime - clip.start,
                            1 / 60,
                        );
                    }
                }
                return;
            }

            if (!object) {
                const material = new THREE.MeshBasicMaterial({
                    color: 0x222222,
                    map: null,
                });
                const newMesh = new THREE.Mesh(
                    this.sceneManager.planeGeometry,
                    material,
                );
                this.sceneManager.scene.add(newMesh);
                this.clipMeshes.set(clip.id, newMesh);
                object = newMesh;

                const promise = this.allocator
                    .getTexture(editorEngine.getAsset(clip.assetId)!)
                    .then((texture) => {
                        const currentMesh = this.clipMeshes.get(clip.id);
                        if (texture && currentMesh === object) {
                            const mesh = object as THREE.Mesh;
                            const mat =
                                mesh.material as THREE.MeshBasicMaterial;
                            mat.map = texture;
                            mat.color.setHex(0xffffff);
                            mat.needsUpdate = true;
                            this.fitMeshToScreen(mesh, texture);
                        }
                    });
                this.pendingLoads.add(promise);
            }

            const track = tracks.find((t) => t.id === clip.trackId);
            const isOverlayTrack =
                track && track.type !== "video" && track.type !== "audio";
            const zLayer = isOverlayTrack ? 500 : 0;

            if (object) object.position.z = zLayer + trackIndex;

            if (clip.type === "video" && object instanceof THREE.Mesh) {
                this.syncVideoFrame(clip, object, currentTime);
            }
        });

        this.sceneManager.placeholderMesh.visible = visibleClips.length === 0;
        this.sceneManager.renderer.render(
            this.sceneManager.scene,
            this.sceneManager.camera,
        );
    }

    public getActiveVideoElements(): HTMLVideoElement[] {
        const videos: HTMLVideoElement[] = [];
        this.clipMeshes.forEach((mesh) => {
            if (mesh instanceof THREE.Mesh) {
                const mat = mesh.material as THREE.MeshBasicMaterial;
                if (mat.map && mat.map instanceof THREE.VideoTexture) {
                    const video = mat.map.image;
                    if (video instanceof HTMLVideoElement) {
                        videos.push(video);
                    }
                }
            }
        });
        return videos;
    }

    private syncVideoFrame(clip: Clip, mesh: THREE.Mesh, globalTime: number) {
        const material = mesh.material as THREE.MeshBasicMaterial;
        if (!material.map || !(material.map instanceof THREE.VideoTexture))
            return;

        const video = material.map.image as HTMLVideoElement;
        if (!video) return;

        if (!video.muted) video.muted = true;

        const clipTime = globalTime - clip.start + clip.offset;
        const threshold = editorEngine.getIsPlaying() ? 0.5 : 0.15;

        if (this.isCaptureMode) {
            if (Math.abs(video.currentTime - clipTime) > 0.01) {
                video.currentTime = clipTime;
            }
            if (!video.paused) video.pause();
            return;
        }

        const drift = Math.abs(video.currentTime - clipTime);
        if (drift > threshold) {
            if (!video.seeking) {
                if (editorEngine.getIsPlaying()) {
                    // console.warn(`[Renderer] Drift...`);
                }
                video.currentTime = clipTime;
            }
        }

        if (editorEngine.getIsPlaying()) {
            if (video.paused) video.play().catch(() => {});
        } else {
            if (!video.paused) video.pause();
        }

        // Ambient color update skipped for now to keep refactor clean
        // const now = performance.now();
        // if (!this.isCaptureMode && now - this.lastSampleTime > 100) {
        //     this.lastSampleTime = now;
        // }
    }

    // Copy over helper private methods
    private fitMeshToScreen(mesh: THREE.Mesh, texture: THREE.Texture) {
        if (!texture.image) return;

        const imgWidth =
            (texture.image as any).videoWidth || (texture.image as any).width;
        const imgHeight =
            (texture.image as any).videoHeight || (texture.image as any).height;
        const renderWidth = this.sceneManager.getWidth();
        const renderHeight = this.sceneManager.getHeight();

        if (!imgWidth || !imgHeight) return;

        const aspect = imgWidth / imgHeight;
        const screenAspect = renderWidth / renderHeight;

        let w, h;

        if (this.scaleMode === "fill") {
            if (aspect > screenAspect) {
                h = renderHeight;
                w = h * aspect;
            } else {
                w = renderWidth;
                h = w / aspect;
            }
        } else if (typeof this.scaleMode === "number") {
            const scale = this.scaleMode;
            w = imgWidth * scale;
            h = imgHeight * scale;
        } else {
            // fit
            if (aspect > screenAspect) {
                w = renderWidth;
                h = w / aspect;
            } else {
                h = renderHeight;
                w = h * aspect;
            }
        }

        mesh.scale.set(w, h, 1);
    }

    // Cleanup helper
    public dispose() {
        this.sceneManager.dispose();
        this.interactionManager?.dispose();
    }

    public destroy() {
        this.dispose();
    }
}
