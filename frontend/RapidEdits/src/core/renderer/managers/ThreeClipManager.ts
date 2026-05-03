import * as THREE from "three";
import { editorEngine } from "../../EditorEngine";
import { TextureAllocator } from "../textures/TextureAllocator";
import { pluginRegistry } from "../../plugins/PluginRegistry";
import type { EffectPlugin, TransitionPlugin } from "../../plugins/PluginInterface";
import type { PluginId } from "../../plugins/PluginTypes";
import { createPluginId, PluginCategory } from "../../plugins/PluginTypes";
import { isMediaClip, isPluginClip, type Clip, type Track } from "../../../types/Timeline";

export class ThreeClipManager {
    private scene: THREE.Scene;
    private allocator: TextureAllocator;
    private clipMeshes: Map<string, THREE.Object3D> = new Map();
    private pendingLoads: Set<Promise<any>> = new Set();
    private planeGeometry: THREE.PlaneGeometry;
    private getSceneDimensions: () => { width: number; height: number };

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

        // Separate Content vs Transitions vs Effects
        // Use type-safe classification based on plugin metadata
        const contentClips: Clip[] = [];
        const transitionClips: Clip[] = [];
        const effectClips: Clip[] = [];

        visibleClips.forEach((clip) => {
            if (isPluginClip(clip)) {
                const pluginId = clip.type as PluginId;
                const plugin = pluginRegistry.get(pluginId);
                if (plugin) {
                    const metadata = plugin.getMetadata();
                    if (metadata.type === "transition") {
                        transitionClips.push(clip);
                    } else if (metadata.type === "effect") {
                        effectClips.push(clip);
                    } else {
                        contentClips.push(clip);
                    }
                } else {
                    // Plugin not found, treat as content (will render as placeholder)
                    contentClips.push(clip);
                }
            } else {
                // Media clip
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

            if (isPluginClip(clip)) {
                // Plugin-based content clip
                const pluginId = clip.type as PluginId;
                const plugin = pluginRegistry.get(pluginId);
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
                }
            } else {
                // Media clip
                if (!object) {
                    const material = new THREE.MeshBasicMaterial({
                        color: 0x222222,
                        map: null,
                        transparent: true,
                        opacity: 1.0,
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
                this.applyAttachedTransitions(clip, object, currentTime);
            }
        });

        // 1.5 Render/Update Transition and Effect Meshes
        [...transitionClips, ...effectClips].forEach((clip) => {
            let object = this.clipMeshes.get(clip.id);
            const trackIndex = tracks.findIndex(t => t.id === clip.trackId);
            const pluginId = clip.type as PluginId;
            const plugin = pluginRegistry.get(pluginId);

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
                    const { width: rW, height: rH } = this.getSceneDimensions();
                    object.userData.logicalWidth = rW;
                    object.userData.logicalHeight = rH;
                    
                    if (object.children.length > 0) {
                        object.children[0]!.userData.logicalWidth = rW;
                        object.children[0]!.userData.logicalHeight = rH;
                    }

                    // Transitions usually go on top, but effects might vary.
                    const metadata = plugin.getMetadata();
                    const zBase = metadata.type === "transition" ? 1000 : 800;
                    object.position.z = zBase + trackIndex;
                    
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

        // 2. Apply Transitions and Effects
        const contentTargets = contentClips
            .map((c) => this.clipMeshes.get(c.id))
            .filter((obj) => obj !== undefined) as THREE.Object3D[];

        transitionClips.forEach((tClip) => {
            const pluginId = tClip.type as PluginId;
            const transitionPlugin = pluginRegistry.getTransition(pluginId);
            if (!transitionPlugin) return;

            const progress = (currentTime - tClip.start) / tClip.duration;
            const clampedProgress = Math.max(0, Math.min(1, progress));

            transitionPlugin.apply(tClip, contentTargets, clampedProgress, currentTime);
        });

        effectClips.forEach((eClip) => {
            const pluginId = eClip.type as PluginId;
            const effectPlugin = pluginRegistry.getEffect(pluginId);
            if (!effectPlugin) return;

            effectPlugin.apply(eClip, contentTargets, currentTime - eClip.start, currentTime);
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

    /**
     * Apply attached transitions (fade in/out) to a clip.
     * These are metadata transitions stored in clip.data.transitions.
     */
    private applyAttachedTransitions(
        clip: Clip,
        object: THREE.Object3D,
        currentTime: number,
    ): void {
        const transitions = clip.data?.transitions;
        if (!transitions) return;

        const fadeId = createPluginId(PluginCategory.Transitions, "fade") as PluginId;

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
                const fadePlugin = pluginRegistry.getTransition(fadeId);
                if (fadePlugin) {
                    fadePlugin.apply(mockClip, [object], progress, currentTime);
                }
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
                const fadePlugin = pluginRegistry.getTransition(fadeId);
                if (fadePlugin) {
                    fadePlugin.apply(mockClip, [object], progress, currentTime);
                }
            }
        }
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
        
        // Use SRGB for better quality if not already set
        if (texture.colorSpace !== THREE.SRGBColorSpace) {
            texture.colorSpace = THREE.SRGBColorSpace;
        }

        // Handle both Video and Image properties
        let imgWidth = (texture.image as any).videoWidth || (texture.image as any).width || 0;
        let imgHeight = (texture.image as any).videoHeight || (texture.image as any).height || 0;
        
        // If dimensions are not yet available, use 16:9 as fallback instead of returning
        if (imgWidth === 0 || imgHeight === 0) {
            imgWidth = 16;
            imgHeight = 9;
        }

        const aspect = imgWidth / imgHeight;
        const { width: renderWidth, height: renderHeight } = this.getSceneDimensions();
        
        // Improve texture quality
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false; 
        
        const engineRenderer = editorEngine.getRenderer();
        if (engineRenderer) {
            const nativeRenderer = engineRenderer.sceneManager.renderer;
            if (nativeRenderer.capabilities) {
                texture.anisotropy = nativeRenderer.capabilities.getMaxAnisotropy();
            }
        } else {
            texture.anisotropy = 1;
        }
        texture.needsUpdate = true;

        const currentAspect = renderWidth / renderHeight;

        let w, h;
        // Default "fit" (Letterbox/Pillarbox) logic relative to 1920x1080
        if (aspect > currentAspect) {
            w = renderWidth;
            h = w / aspect;
        } else {
            h = renderHeight;
            w = h * aspect;
        }
        
        if (Math.random() < 0.05) {
            console.log(`[ThreeClipManager] FitMesh: ${w.toFixed(0)}x${h.toFixed(0)} | Aspect: ${aspect.toFixed(2)} | RenderW: ${renderWidth.toFixed(0)}`);
        }

        mesh.scale.set(w, h, 1);
        mesh.userData.baseScale = new THREE.Vector3(w, h, 1);
        mesh.userData.basePosition = new THREE.Vector3(0, 0, mesh.position.z);
        
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.color.setHex(0xffffff);
        mat.needsUpdate = true;
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
