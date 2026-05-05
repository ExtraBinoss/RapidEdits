import * as THREE from "three";
import { editorEngine } from "../../EditorEngine";
import { TextureAllocator } from "../textures/TextureAllocator";
import { pluginRegistry } from "../../plugins/PluginRegistry";
import { type PluginId } from "../../plugins/PluginTypes";
import { isPluginClip, type Clip, type Track } from "../../../types/Timeline";

export class ThreeClipManager {
    private scene: THREE.Scene;
    private allocator: TextureAllocator;
    private clipMeshes: Map<string, THREE.Object3D> = new Map();
    private pendingLoads: Set<Promise<any>> = new Set();
    private planeGeometry: THREE.PlaneGeometry;
    private getSceneDimensions: () => { width: number; height: number };

    public getClipMeshes() { return this.clipMeshes; }

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
        const contentClips: Clip[] = [];
        const transitionClips: Clip[] = [];
        const effectClips: Clip[] = [];

        visibleClips.forEach((clip) => {
            if (clip.type === "audio") return; // Skip audio tracks for rendering

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
                    contentClips.push(clip);
                }
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

            // Reset Opacity & Migration for Media Clips
            if (object) {
                object.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        // Migration: If media clip has MeshBasicMaterial, replace it with ShaderMaterial
                        if (!isPluginClip(clip) && child.material instanceof THREE.MeshBasicMaterial) {
                            const oldMat = child.material;
                            const newMat = this.createMediaMaterial();
                            newMat.uniforms.map.value = oldMat.map;
                            child.material = newMat;
                            oldMat.dispose();
                        }

                        const mat = child.material;
                        if (Array.isArray(mat)) {
                            mat.forEach((m) => {
                                if (m.transparent) {
                                    m.opacity = 1.0;
                                    if (m instanceof THREE.ShaderMaterial && m.uniforms.opacity) {
                                        m.uniforms.opacity.value = 1.0;
                                    }
                                }
                            });
                        } else {
                            if (mat.transparent) {
                                mat.opacity = 1.0;
                                if (mat instanceof THREE.ShaderMaterial && mat.uniforms.opacity) {
                                    mat.uniforms.opacity.value = 1.0;
                                }
                            }
                        }
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
                            
                            // Tag for selection
                            group.userData.isSelectable = true;
                            group.userData.clipId = clip.id;
                            
                            this.scene.add(group);
                            this.clipMeshes.set(clip.id, group);
                            object = group;
                        }
                    }

                    if (object) {
                        object.position.z = (tracks.length - trackIndex) * 10;
                        this.applyClipTransform(object, clip);

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
                // Media clip — plain Mesh, just needs userData for raycasting
                if (!object) {
                    const shaderMaterial = this.createMediaMaterial();
                    const newMesh = new THREE.Mesh(this.planeGeometry, shaderMaterial);
                    newMesh.userData.isSelectable = true;
                    newMesh.userData.clipId = clip.id;
                    this.scene.add(newMesh);
                    this.clipMeshes.set(clip.id, newMesh);
                    object = newMesh;

                    const asset = editorEngine.getAsset(clip.assetId);
                    if (asset) {
                        const promise = this.allocator
                            .getTexture(asset)
                            .then((texture) => {
                                const currentObj = this.clipMeshes.get(clip.id);
                                if (texture && currentObj instanceof THREE.Mesh) {
                                    const mat = currentObj.material;
                                    if (mat instanceof THREE.ShaderMaterial) {
                                        mat.uniforms.map.value = texture;
                                        mat.uniforms.resolution.value.set(currentObj.scale.x, currentObj.scale.y);
                                        mat.needsUpdate = true;
                                    }
                                    this.fitMeshToScreen(currentObj, texture);
                                }
                            });
                        this.pendingLoads.add(promise);
                    } else {
                        console.warn("[ThreeClipManager] Asset not found for clip:", clip.assetId);
                    }
                }

                if (object) {
                    object.position.z = (tracks.length - trackIndex) * 10;
                    this.applyClipTransform(object, clip);
                }
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

                    const metadata = plugin.getMetadata();
                    const typeOffset = metadata.type === "transition" ? 5 : 2;
                    object.position.z = ((tracks.length - trackIndex) * 10) + typeOffset;
                    
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
            .filter((obj): obj is THREE.Object3D => obj !== undefined);

        const getTargetsForModifierClip = (modifierClip: Clip): THREE.Object3D[] => {
            // Restrict transition/effect scope to the same track by default.
            const sameTrackTargets = contentClips
                .filter((c) => c.trackId === modifierClip.trackId)
                .map((c) => this.clipMeshes.get(c.id))
                .filter((obj): obj is THREE.Object3D => obj !== undefined);

            if (sameTrackTargets.length > 0) return sameTrackTargets;

            // If no content clip exists on that track at this frame, do not affect the whole scene.
            return [];
        };

        transitionClips.forEach((tClip) => {
            const pluginId = tClip.type as PluginId;
            const transitionPlugin = pluginRegistry.getTransition(pluginId);
            if (!transitionPlugin) return;
            const transitionTargets = getTargetsForModifierClip(tClip);
            if (transitionTargets.length === 0) return;

            const progress = (currentTime - tClip.start) / tClip.duration;
            const clampedProgress = Math.max(0, Math.min(1, progress));

            transitionPlugin.apply(tClip, transitionTargets, clampedProgress, currentTime);
        });

        effectClips.forEach((eClip) => {
            const pluginId = eClip.type as PluginId;
            const effectPlugin = pluginRegistry.getEffect(pluginId);
            if (!effectPlugin) return;
            const effectTargets = getTargetsForModifierClip(eClip);
            if (effectTargets.length === 0) return;

            effectPlugin.apply(eClip, effectTargets, currentTime - eClip.start, currentTime);
        });

        // Capture Mode Update
        if (isCaptureMode) {
            visibleClips.forEach((c) => {
                const mesh = this.clipMeshes.get(c.id);
                if (mesh) {
                    mesh.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            const mat = child.material;
                            if (mat instanceof THREE.MeshBasicMaterial || mat instanceof THREE.ShaderMaterial) {
                                const map = (mat as any).map || (mat instanceof THREE.ShaderMaterial ? mat.uniforms.map.value : null);
                                if (map) map.needsUpdate = true;
                            }
                        }
                    });
                }
            });
        }

        return visibleClips;
    }

    private applyClipTransform(object: THREE.Object3D, clip: Clip) {
        // Position, Rotation, Scale should be applied to the ROOT object of the clip
        const { position, rotation, scale } = clip.data || {};
        
        // Base scale only applies to Media Clips (to fit them to screen)
        // For Plugins, baseScale is 1,1,1
        const baseScale = (object.userData.baseScale as THREE.Vector3) || new THREE.Vector3(1, 1, 1);

        // Always reset to a deterministic base before effects/transitions mutate transforms.
        // If clip has no explicit position, fallback to basePosition or origin.
        const basePosition = (object.userData.basePosition as THREE.Vector3) || new THREE.Vector3(0, 0, object.position.z);
        object.position.x = position?.x ?? basePosition.x ?? 0;
        object.position.y = position?.y ?? basePosition.y ?? 0;

        // Always set a full rotation state (otherwise rotations can persist frame-to-frame).
        object.rotation.set(
            THREE.MathUtils.degToRad(rotation?.x ?? 0),
            THREE.MathUtils.degToRad(rotation?.y ?? 0),
            THREE.MathUtils.degToRad(rotation?.z ?? 0)
        );
        
        if (scale) {
            object.scale.set(
                baseScale.x * (scale.x ?? 1), 
                baseScale.y * (scale.y ?? 1), 
                baseScale.z * (scale.z ?? 1)
            );
        } else {
            object.scale.copy(baseScale);
        }

        // Shader specific uniforms (only for Media Clips)
        if (object instanceof THREE.Mesh && object.material instanceof THREE.ShaderMaterial) {
            const mat = object.material;
            const uniforms = mat.uniforms;
            uniforms.borderRadius.value = clip.data?.borderRadius ?? 0;
            uniforms.edgeSoftness.value = clip.data?.edgeSoftness ?? 0;
            const rawCrop = clip.data?.crop || {};
            const crop = {
                left: rawCrop.left ?? 0,
                right: rawCrop.right ?? 0,
                top: rawCrop.top ?? 0,
                bottom: rawCrop.bottom ?? 0
            };
            uniforms.crop.value.set(crop.left, crop.right, crop.top, crop.bottom);
            uniforms.resolution.value.set(object.scale.x, object.scale.y);
            if (clip.data?.opacity !== undefined) uniforms.opacity.value = clip.data.opacity;
            if (uniforms.map.value instanceof THREE.VideoTexture) {
                uniforms.map.value.needsUpdate = true;
                uniforms.map.value.updateMatrix();
            }
        }
    }

    private applyAttachedTransitions(
        clip: Clip,
        object: THREE.Object3D,
        currentTime: number,
    ): void {
        const transitions = clip.data?.transitions;
        if (!transitions) return;

        for (const [pluginId, transitionData] of Object.entries(transitions)) {
            const plugin = pluginRegistry.get(pluginId as PluginId) as any;
            if (!plugin || typeof plugin.apply !== "function") continue;

            const metadata = plugin.getMetadata();
            const duration = (transitionData as any).duration || 1.0;
            const slot = metadata.transitionSlot || "in";

            let progress = -1;
            let effectiveSlot: "in" | "out" = "in";

            if (slot === "in") {
                progress = (currentTime - clip.start) / duration;
                effectiveSlot = "in";
            } else if (slot === "out") {
                const fadeOutStart = clip.start + clip.duration - duration;
                progress = (currentTime - fadeOutStart) / duration;
                effectiveSlot = "out";
            } else {
                const timeFromStart = currentTime - clip.start;
                const timeFromEnd = (clip.start + clip.duration) - currentTime;
                
                if (timeFromStart <= duration) {
                    progress = timeFromStart / duration;
                    effectiveSlot = "in";
                } else if (timeFromEnd <= duration) {
                    progress = 1.0 - (timeFromEnd / duration);
                    effectiveSlot = "out";
                }
            }

            if (progress >= 0 && progress <= 1) {
                const mockClip = {
                    ...clip,
                    data: {
                        ...(transitionData as any),
                        __slot: effectiveSlot
                    },
                    duration: duration,
                };
                plugin.apply(mockClip, [object], progress, currentTime);
            }
        }
    }

    private disposeObject(object: THREE.Object3D) {
        if (object instanceof THREE.Mesh) {
            const mat = object.material;
            
            let texture: THREE.Texture | null = null;
            if (mat instanceof THREE.MeshBasicMaterial) {
                texture = mat.map;
            } else if (mat instanceof THREE.ShaderMaterial) {
                texture = mat.uniforms.map.value;
            }

            if (texture instanceof THREE.VideoTexture) {
                const video = texture.image;
                if (video instanceof HTMLVideoElement && !video.paused) {
                    video.pause();
                }
            }

            object.geometry.dispose();
            
            if (Array.isArray(mat)) {
                mat.forEach((m) => m.dispose());
            } else if (mat instanceof THREE.Material) {
                mat.dispose();
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
        
        if (texture.colorSpace !== THREE.SRGBColorSpace) {
            texture.colorSpace = THREE.SRGBColorSpace;
        }

        let imgWidth = (texture.image as any).videoWidth || (texture.image as any).width || 0;
        let imgHeight = (texture.image as any).videoHeight || (texture.image as any).height || 0;
        
        if (imgWidth === 0 || imgHeight === 0) {
            imgWidth = 16;
            imgHeight = 9;
        }

        const aspect = imgWidth / imgHeight;
        const { width: renderWidth, height: renderHeight } = this.getSceneDimensions();
        
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false; 
        
        const engineRenderer = editorEngine.getRenderer();
        if (engineRenderer) {
            const nativeRenderer = engineRenderer.sceneManager.renderer;
            if (nativeRenderer.capabilities) {
                texture.anisotropy = nativeRenderer.capabilities.getMaxAnisotropy();
            }
        }
        texture.needsUpdate = true;

        const currentAspect = renderWidth / renderHeight;

        let w, h;
        if (aspect > currentAspect) {
            w = renderWidth;
            h = w / aspect;
        } else {
            h = renderHeight;
            w = h * aspect;
        }
        
        mesh.scale.set(w, h, 1);
        mesh.userData.baseScale = new THREE.Vector3(w, h, 1);
        mesh.userData.basePosition = new THREE.Vector3(0, 0, mesh.position.z);
        
        const mat = mesh.material;
        if (mat instanceof THREE.MeshBasicMaterial) {
            mat.color.setHex(0xffffff);
            mat.needsUpdate = true;
        } else if (mat instanceof THREE.ShaderMaterial) {
            if (mat.uniforms.color) {
                mat.uniforms.color.value.setHex(0xffffff);
            }
            mat.uniforms.resolution.value.set(w, h);
            mat.needsUpdate = true;
        }
    }

    public getActiveVideoElements(): HTMLVideoElement[] {
        const videos: HTMLVideoElement[] = [];
        this.clipMeshes.forEach((object) => {
            object.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    const mat = child.material;
                    let texture: THREE.Texture | null = null;
                    
                    if (mat instanceof THREE.ShaderMaterial) {
                        texture = mat.uniforms.map.value;
                    } else if (mat instanceof THREE.MeshBasicMaterial) {
                        texture = mat.map;
                    }

                    if (texture instanceof THREE.VideoTexture) {
                        const video = texture.image;
                        if (video instanceof HTMLVideoElement) {
                            videos.push(video);
                        }
                    }
                }
            });
        });
        return videos;
    }

    public getClipMesh(clipId: string): THREE.Object3D | undefined {
        return this.clipMeshes.get(clipId);
    }

    private createMediaMaterial(): THREE.ShaderMaterial {
        return new THREE.ShaderMaterial({
            uniforms: {
                map: { value: null },
                color: { value: new THREE.Color(0xffffff) },
                opacity: { value: 1.0 },
                borderRadius: { value: 0.0 },
                edgeSoftness: { value: 0.0 },
                crop: { value: new THREE.Vector4(0, 0, 0, 0) },
                resolution: { value: new THREE.Vector2(1, 1) }
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
                uniform vec3 color;
                uniform float opacity;
                uniform float borderRadius;
                uniform float edgeSoftness;
                uniform vec4 crop;
                uniform vec2 resolution;
                varying vec2 vUv;

                // Signed Distance Function for a rounded box
                float sdRoundedBox(vec2 p, vec2 b, float r) {
                    vec2 q = abs(p) - b + r;
                    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
                }

                void main() {
                    // Crop check
                    if (vUv.x < crop.x || vUv.x > (1.0 - crop.y) || vUv.y < crop.w || vUv.y > (1.0 - crop.z)) {
                        discard;
                    }

                    vec4 texColor = texture2D(map, vUv);
                    
                    // Map UV to 0-1 within the cropped area
                    vec2 croppedUv = vec2(
                        (vUv.x - crop.x) / max(0.0001, 1.0 - crop.x - crop.y),
                        (vUv.y - crop.w) / max(0.0001, 1.0 - crop.z - crop.w)
                    );
                    
                    // Actual rendered size after crop
                    vec2 actualRes = vec2(
                        resolution.x * (1.0 - crop.x - crop.y),
                        resolution.y * (1.0 - crop.z - crop.w)
                    );
                    
                    vec2 pos = croppedUv * actualRes;
                    vec2 halfSize = actualRes * 0.5;
                    vec2 centerPos = pos - halfSize;
                    
                    float minDim = min(actualRes.x, actualRes.y);
                    float absRadius = borderRadius * minDim * 0.5;
                    
                    // Distance to perimeter (negative inside)
                    float d = sdRoundedBox(centerPos, halfSize, absRadius);
                    
                    float alpha = 1.0;
                    
                    // Handle edge softness (inward)
                    if (edgeSoftness > 0.0) {
                        float softPixels = max(1.0, edgeSoftness * minDim * 0.5);
                        // smoothstep(edge_start, edge_end, x)
                        // We want 0 at d=0 (edge) and 1 at d=-softPixels (inside)
                        alpha = smoothstep(0.0, -softPixels, d);
                    } else {
                        // Standard AA or hard cut
                        if (d > 0.0) discard;
                    }
                    
                    if (alpha <= 0.0) discard;

                    gl_FragColor = vec4(texColor.rgb * color, texColor.a * opacity * alpha);
                    #include <colorspace_fragment>
                }
            `,
            transparent: true,
        });
    }

    public refitAllMeshes() {
        this.clipMeshes.forEach((obj) => {
            // Find the mesh that actually has the material (either the obj itself or its first child)
            const mesh = obj instanceof THREE.Mesh 
                ? obj 
                : (obj instanceof THREE.Group ? obj.children[0] as THREE.Mesh : null);
            
            if (!mesh || !mesh.material) return;

            let texture: THREE.Texture | null = null;
            const mat = mesh.material;
            if (mat instanceof THREE.ShaderMaterial) {
                texture = mat.uniforms.map.value;
            } else if (mat instanceof THREE.MeshBasicMaterial) {
                texture = mat.map;
            }

            if (texture) {
                this.fitMeshToScreen(mesh, texture);
            }
        });
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
