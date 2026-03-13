import * as THREE from "three";
import { editorEngine } from "../../EditorEngine";
import { TextureAllocator } from "../textures/TextureAllocator";
import { pluginRegistry } from "../../plugins/PluginRegistry";
import type { TransitionPlugin } from "../../plugins/PluginInterface";
import type { Clip, Track } from "../../../types/Timeline";

export class ThreeClipManager {
    private scene: THREE.Scene;
    private allocator: TextureAllocator;
    private clipMeshes: Map<string, THREE.Object3D> = new Map();
    private pendingLoads: Set<Promise<any>> = new Set();
    private planeGeometry: THREE.PlaneGeometry;
    private getSceneDimensions: () => { width: number; height: number };
    private scaleMode: "fit" | "fill" | number = "fit";

    constructor(
        scene: THREE.Scene,
        allocator: TextureAllocator,
        getSceneDimensions: () => { width: number; height: number },
    ) {
        this.scene = scene;
        this.allocator = allocator;
        this.getSceneDimensions = getSceneDimensions;
        this.planeGeometry = new THREE.PlaneGeometry(1, 1);
    }

    public setScaleMode(mode: "fit" | "fill" | number) {
        this.scaleMode = mode;
        this.refitAllMeshes();
    }

    private refitAllMeshes() {
        this.clipMeshes.forEach((mesh) => {
            if (mesh instanceof THREE.Mesh) {
                const mat = mesh.material as THREE.MeshBasicMaterial;
                if (mat.map) this.fitMeshToScreen(mesh, mat.map);
            }
        });
    }

    public update(
        currentTime: number,
        tracks: Track[],
        isCaptureMode: boolean,
    ): Clip[] {
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

        // Cleanup
        for (const [clipId, object] of this.clipMeshes) {
            if (!visibleClipIds.has(clipId)) {
                this.disposeObject(object);
                this.scene.remove(object);
                this.clipMeshes.delete(clipId);
            }
        }

        // Separate Content vs Transitions
        const contentClips: Clip[] = [];
        const transitionClips: Clip[] = [];

        visibleClips.forEach((clip) => {
            const plugin = pluginRegistry.get(clip.type);
            if (plugin && plugin.type === "transition") {
                transitionClips.push(clip);
            } else {
                contentClips.push(clip);
            }
        });

        // 1. Update/Render Content Clips
        contentClips.forEach((clip) => {
            let object = this.clipMeshes.get(clip.id);
            const trackIndex = tracks.findIndex(
                (t: Track) => t.id === clip.trackId,
            );

            // Reset Opacity (important if it was faded before but now transition is gone)
            if (object) {
                object.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        const materials = Array.isArray(child.material)
                            ? child.material
                            : [child.material];
                        materials.forEach((mat) => {
                            if (mat.transparent) mat.opacity = 1.0;
                        });
                    }
                });
            }

            const plugin = pluginRegistry.get(clip.type);
            if (plugin) {
                if (!object) {
                    const contentMesh = plugin.render(clip);
                    if (contentMesh) {
                        const group = new THREE.Group();
                        group.add(contentMesh);
                        this.scene.add(group);
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
            } else {
                // Default Asset Handling (Video/Image)
                if (!object) {
                    const material = new THREE.MeshBasicMaterial({
                        color: 0x222222,
                        map: null,
                    });
                    const newMesh = new THREE.Mesh(
                        this.planeGeometry,
                        material,
                    );
                    this.scene.add(newMesh);
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
            }

            // 3. Apply Attached Transitions (Fade In/Out from Drop)
            if (object && clip.data?.transitions) {
                const transitions = clip.data.transitions;
                const fadePlugin = pluginRegistry.get(
                    "transitions.fade",
                ) as TransitionPlugin;

                if (fadePlugin) {
                    // Fade In
                    if (transitions.fadeIn) {
                        const duration = transitions.fadeIn.duration || 1.0;
                        const progress = (currentTime - clip.start) / duration;
                        if (progress >= 0 && progress <= 1) {
                            const mockClip = {
                                ...clip,
                                data: {
                                    fadeType: "in",
                                    easing: transitions.fadeIn.easing || "linear",
                                },
                                duration: duration,
                            };
                            fadePlugin.apply(mockClip, [object], progress, currentTime);
                        }
                    }

                    // Fade Out
                    if (transitions.fadeOut) {
                        const duration = transitions.fadeOut.duration || 1.0;
                        const fadeOutStart = clip.start + clip.duration - duration;
                        const progress = (currentTime - fadeOutStart) / duration;
                        if (progress >= 0 && progress <= 1) {
                            const mockClip = {
                                ...clip,
                                data: {
                                    fadeType: "out",
                                    easing: transitions.fadeOut.easing || "linear",
                                },
                                duration: duration,
                            };
                            fadePlugin.apply(mockClip, [object], progress, currentTime);
                        }
                    }
                }
            }
        });

        // 1.5 Render/Update Transition Meshes (if any)
        transitionClips.forEach((clip) => {
            let object = this.clipMeshes.get(clip.id);
            const trackIndex = tracks.findIndex(t => t.id === clip.trackId);
            const plugin = pluginRegistry.get(clip.type);

            if (plugin) {
                if (!object) {
                    const contentMesh = plugin.render(clip);
                    if (contentMesh) {
                        const group = new THREE.Group();
                        group.add(contentMesh);
                        this.scene.add(group);
                        this.clipMeshes.set(clip.id, group);
                        object = group;
                    }
                }

                if (object) {
                    object.position.z = 1000 + trackIndex;
                    if (object.children.length > 0) {
                        plugin.update(
                            object.children[0]!,
                            clip,
                            currentTime - clip.start,
                            1 / 60,
                        );
                    }
                }
            }
        });

        // 2. Apply Transitions
        transitionClips.forEach((tClip) => {
            const plugin = pluginRegistry.get(tClip.type) as TransitionPlugin;
            if (!plugin) return;

            const progress = (currentTime - tClip.start) / tClip.duration;
            const clampedProgress = Math.max(0, Math.min(1, progress));

            const targets = contentClips
                .map((c) => this.clipMeshes.get(c.id))
                .filter((obj) => obj !== undefined) as THREE.Object3D[];

            plugin.apply(tClip, targets, clampedProgress, currentTime);
        });

        // Capture Mode Update
        if (isCaptureMode) {
            visibleClips.forEach((c) => {
                const mesh = this.clipMeshes.get(c.id);
                if (mesh) {
                    mesh.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            const map = (child.material as any).map;
                            if (map) map.needsUpdate = true;
                        }
                    });
                }
            });
        }

        return visibleClips;
    }

    private disposeObject(object: THREE.Object3D) {
        if (object instanceof THREE.Mesh) {
            const mat = object.material as THREE.MeshBasicMaterial;
            if (mat.map && mat.map instanceof THREE.VideoTexture) {
                const video = mat.map.image;
                if (video && !video.paused) {
                    video.pause();
                }
            }
            object.geometry.dispose();
            if (Array.isArray(object.material)) {
                object.material.forEach((m) => m.dispose());
            } else {
                (object.material as THREE.Material).dispose();
            }
        }

        while (object.children.length > 0) {
            const child = object.children[0];
            if (child) {
                object.remove(child);
                this.disposeObject(child);
            } else {
                break;
            }
        }
    }

    private fitMeshToScreen(mesh: THREE.Mesh, texture: THREE.Texture) {
        if (!texture.image) return;
        const imgWidth = (texture.image as any).videoWidth || (texture.image as any).width;
        const imgHeight = (texture.image as any).videoHeight || (texture.image as any).height;
        const { width: renderWidth, height: renderHeight } = this.getSceneDimensions();
        if (!imgWidth || !imgHeight) return;
        const aspect = imgWidth / imgHeight;
        const screenAspect = renderWidth / renderHeight;
        let w, h;
        if (this.scaleMode === "fill") {
            if (aspect > screenAspect) { h = renderHeight; w = h * aspect; }
            else { w = renderWidth; h = w / aspect; }
        } else if (typeof this.scaleMode === "number") {
            const scale = this.scaleMode;
            w = imgWidth * scale;
            h = imgHeight * scale;
        } else {
            if (aspect > screenAspect) { w = renderWidth; h = w / aspect; }
            else { h = renderHeight; w = h * aspect; }
        }
        mesh.scale.set(w, h, 1);
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

    public getClipMesh(clipId: string): THREE.Object3D | undefined {
        return this.clipMeshes.get(clipId);
    }

    public async waitForPendingLoads() {
        if (this.pendingLoads.size === 0) return;
        await Promise.all(Array.from(this.pendingLoads));
        this.pendingLoads.clear();
    }

    public dispose() {
        this.clipMeshes.forEach((obj) => this.disposeObject(obj));
        this.clipMeshes.clear();
        this.planeGeometry.dispose();
    }
}
