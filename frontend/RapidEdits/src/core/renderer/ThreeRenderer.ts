import * as THREE from "three";
import { editorEngine } from "../EditorEngine";
import { globalEventBus } from "../events/EventBus";
import { TextureAllocator } from "./textures/TextureAllocator";
import { pluginRegistry } from "../plugins/PluginRegistry"; // Import Registry
import type { Clip, Track } from "../../types/Timeline";

export interface ThreeRendererOptions {
    container?: HTMLElement;
    width?: number;
    height?: number;
    canvas?: HTMLCanvasElement | OffscreenCanvas;
    allocator?: TextureAllocator;
    isCaptureMode?: boolean;
}

export class ThreeRenderer {
    private container: HTMLElement | null = null;
    private scene: THREE.Scene;
    public camera: THREE.OrthographicCamera;
    public renderer: THREE.WebGLRenderer;

    // State
    public width: number = 1920;
    public height: number = 1080;

    // Modules
    private allocator: TextureAllocator;
    private resizeObserver: ResizeObserver | null = null;
    private scaleMode: "fit" | "fill" | number = "fit";

    // Scene Graph
    private clipMeshes: Map<string, THREE.Object3D> = new Map(); // Changed to Object3D

    // Geometry Cache
    private planeGeometry: THREE.PlaneGeometry;
    private placeholderMesh: THREE.Mesh;

    // Ambient Sampling
    private samplingCanvas: OffscreenCanvas;
    private samplingCtx: OffscreenCanvasRenderingContext2D;
    private lastSampleTime: number = 0;
    private isCaptureMode: boolean = false;
    private pendingLoads: Set<Promise<any>> = new Set();

    constructor(options: ThreeRendererOptions) {
        this.container = options.container || null;
        this.width = options.width || (this.container ? this.container.clientWidth : 1920);
        this.height = options.height || (this.container ? this.container.clientHeight : 1080);
        
        this.allocator = options.allocator || new TextureAllocator();
        this.isCaptureMode = options.isCaptureMode || false;

        // Ambient Sampler Init
        this.samplingCanvas = new OffscreenCanvas(1, 1);
        this.samplingCtx = this.samplingCanvas.getContext("2d", {
            willReadFrequently: true,
        })!;

        // 1. Init Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0b0e14);

        // 2. Init Camera
        this.camera = new THREE.OrthographicCamera(
            -this.width / 2, this.width / 2,
            this.height / 2, -this.height / 2, 
            0.1, 3000
        );
        this.camera.position.z = 2000;

        // 3. Init Renderer
        const rendererParams: THREE.WebGLRendererParameters = {
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
            preserveDrawingBuffer: true,
        };

        if (options.canvas) {
            rendererParams.canvas = options.canvas;
        }

        this.renderer = new THREE.WebGLRenderer(rendererParams);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.toneMapping = THREE.NoToneMapping;
        this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
        
        // Only append if we have a container (and no explicit canvas was passed, or even if it was, usually we append)
        if (this.container && !options.canvas) {
            this.container.appendChild(this.renderer.domElement);
        }

        this.renderer.setSize(this.width, this.height, false); // false = do not update style if offscreen? Actually default is true.

        // 4. Geometry
        this.planeGeometry = new THREE.PlaneGeometry(1, 1);

        // 5. Placeholder
        this.placeholderMesh = new THREE.Mesh(
            this.planeGeometry,
            new THREE.MeshBasicMaterial({ color: 0x000000 }),
        );
        this.placeholderMesh.position.z = -10;
        // Scale placeholder to cover screen
        this.placeholderMesh.scale.set(this.width, this.height, 1);
        this.scene.add(this.placeholderMesh);
    }

    public setCaptureMode(isCapture: boolean) {
        this.isCaptureMode = isCapture;
    }

    public setSize(width: number, height: number) {
        this.width = width;
        this.height = height;
        
        this.camera.left = -width / 2;
        this.camera.right = width / 2;
        this.camera.top = height / 2;
        this.camera.bottom = -height / 2;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height, false);
        this.placeholderMesh.scale.set(width, height, 1);
        
        // Re-fit meshes
        this.clipMeshes.forEach((mesh) => {
             if (mesh instanceof THREE.Mesh) { // Only refit standard meshes
                const mat = mesh.material as THREE.MeshBasicMaterial;
                if (mat.map) this.fitMeshToScreen(mesh, mat.map);
             }
        });
    }

    public async init() {
        if (this.container) {
            this.resizeObserver = new ResizeObserver(() => this.handleResize());
            this.resizeObserver.observe(this.container);
            this.handleResize();
        }
        
        if (!this.isCaptureMode) {
            this.renderer.setAnimationLoop(this.render.bind(this));
        }
    }

    public async waitForPendingLoads() {
        if (this.pendingLoads.size === 0) return;
        console.log(
            `[Renderer] Waiting for ${this.pendingLoads.size} textures...`,
        );
        await Promise.all(Array.from(this.pendingLoads));
        this.pendingLoads.clear();
    }

    public setScaleMode(mode: "fit" | "fill" | number) {
        this.scaleMode = mode;
        if (this.container) this.handleResize();
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
        const currentTime = editorEngine.getCurrentTime();
        const tracks = editorEngine.getTracks();
        this.renderFrame(currentTime, tracks);
    }

    public renderFrame(currentTime: number, tracks: Track[]) {
        const visibleClips: Clip[] = [];
        tracks.forEach((track: Track) => {
            // Support both standard and custom types (plugins)
            if (track.isMuted) return;
             
            const clip = track.clips.find(
                (c) =>
                    currentTime >= c.start &&
                    currentTime < c.start + c.duration,
            );
            if (clip) visibleClips.push(clip);
        });

        const visibleClipIds = new Set(visibleClips.map((c) => c.id));
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
                } else {
                    // Plugin Object Cleanup?
                    // For now assume plugin objects clean themselves up or rely on GC if detached
                    // But we should ideally call plugin.destroy(object)
                }

                this.scene.remove(object);
                this.clipMeshes.delete(clipId);
            }
        }

        // If no clips, reset ambient
        const videoClips = visibleClips.filter(c => c.type === 'video');
        if (videoClips.length === 0) {
            this.updateAmbientColor(null);
        }

        visibleClips.forEach((clip) => {
            let object = this.clipMeshes.get(clip.id);
            const trackIndex = tracks.findIndex((t: Track) => t.id === clip.trackId);

            // Check if it's a Plugin Clip
            const plugin = pluginRegistry.get(clip.type);
            if (plugin) {
                if (!object) {
                    // Delegate to Plugin
                    const contentMesh = plugin.render(clip);
                    if (contentMesh) {
                        // WRAPPER GROUP: Isolates Renderer's Z-layering from Plugin's local transforms
                        const group = new THREE.Group();
                        group.add(contentMesh);
                        
                        this.scene.add(group);
                        this.clipMeshes.set(clip.id, group);
                        object = group;
                    }
                }
                
                // Update Plugin Object
                if (object) {
                    // Renderer controls World Z (Layering)
                    // Layering Logic: Custom/Plugin tracks: Base Z = 500 + trackIndex
                    // Video/Audio tracks don't enter this block
                    object.position.z = 500 + trackIndex;
                    
                    // Plugin controls Local Transform (inside group)
                    // We pass the child mesh to the plugin
                    if (object.children.length > 0) {
                        plugin.update(object.children[0], clip, currentTime - clip.start, 1/60);
                    }
                }
                return; // Skip standard logic
            }

            // Standard Video/Image Logic
            if (!object) {
                const material = new THREE.MeshBasicMaterial({
                    color: 0x222222,
                    map: null,
                });
                const newMesh = new THREE.Mesh(this.planeGeometry, material);
                this.scene.add(newMesh);
                this.clipMeshes.set(clip.id, newMesh);
                object = newMesh;

                const promise = this.allocator
                    .getTexture(editorEngine.getAsset(clip.assetId)!)
                    .then((texture) => {
                        const currentMesh = this.clipMeshes.get(clip.id);
                        if (texture && currentMesh === object) {
                            const mesh = object as THREE.Mesh;
                            const mat = mesh.material as THREE.MeshBasicMaterial;
                            mat.map = texture;
                            mat.color.setHex(0xffffff);
                            mat.needsUpdate = true;
                            this.fitMeshToScreen(mesh, texture);
                        }
                    });
                this.pendingLoads.add(promise);
            }

            // Layering Logic:
            // Video/Audio tracks: Base Z = trackIndex (0..99)
            // Custom/Plugin tracks: Base Z = 500 + trackIndex
            // This ensures Text/Effects always render ON TOP of video.
            // Note: We use the track type from the clip's track to determine this.
            const track = tracks.find(t => t.id === clip.trackId);
            const isOverlayTrack = track && (track.type !== 'video' && track.type !== 'audio');
            const zLayer = isOverlayTrack ? 500 : 0;

            if (object) object.position.z = zLayer + trackIndex;

            if (clip.type === "video" && object instanceof THREE.Mesh) {
                this.syncVideoFrame(clip, object, currentTime);
            }
        });

        this.placeholderMesh.visible = visibleClips.length === 0;
        this.renderer.render(this.scene, this.camera);
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
                    console.warn(
                        `[Renderer] Hard Seek: Drift ${drift.toFixed(3)}s > ${threshold}s`,
                    );
                }
                video.currentTime = clipTime;
            }
        }

        if (editorEngine.getIsPlaying()) {
            if (video.paused) video.play().catch(() => {});
        } else {
            if (!video.paused) video.pause();
        }

        const now = performance.now();
        if (!this.isCaptureMode && now - this.lastSampleTime > 100) {
            this.updateAmbientColor(video);
            this.lastSampleTime = now;
        }
    }

    private updateAmbientColor(video: HTMLVideoElement | null) {
        if (!video) {
            globalEventBus.emit({
                type: "AMBIENT_COLOR_UPDATE",
                payload: "#00000000",
            });
            return;
        }
        if (video.readyState < 3) return;
        try {
            this.samplingCtx.drawImage(video, 0, 0, 1, 1);
            const [r, g, b] = this.samplingCtx.getImageData(0, 0, 1, 1).data;
            const color = `rgba(${r},${g},${b}, 0.6)`; 
            globalEventBus.emit({
                type: "AMBIENT_COLOR_UPDATE",
                payload: color,
            });
        } catch (e) {}
    }

    private handleResize() {
        if (!this.container) return;
        // When container exists, sync internal size with container
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.setSize(width, height);
    }

    private fitMeshToScreen(mesh: THREE.Mesh, texture: THREE.Texture) {
        const image = texture.image as any;
        if (!image) return;
        let imgW = 0,
            imgH = 0;
        if (image instanceof HTMLVideoElement) {
            imgW = image.videoWidth;
            imgH = image.videoHeight;
        } else {
            imgW = image.width;
            imgH = image.height;
        }
        if (imgW === 0 || imgH === 0) return;

        // Use internal width/height which handles both offscreen and onscreen
        const screenW = this.width; 
        const screenH = this.height;

        let scale = 1;
        if (this.scaleMode === "fill") {
            scale = Math.max(screenW / imgW, screenH / imgH);
        } else if (this.scaleMode === "fit") {
            scale = Math.min(screenW / imgW, screenH / imgH);
        } else if (typeof this.scaleMode === "number") {
            scale = this.scaleMode;
        }

        mesh.scale.set(imgW * scale, imgH * scale, 1);
    }

    public destroy() {
        this.resizeObserver?.disconnect();
        this.renderer.setAnimationLoop(null);
        this.renderer.dispose();
        this.allocator.destroy();
        (this.placeholderMesh.material as THREE.Material).dispose();
        (this.placeholderMesh.geometry as THREE.BufferGeometry).dispose();
        this.clipMeshes.forEach((m) => {
            if (m instanceof THREE.Mesh) {
                (m.material as THREE.Material).dispose();
            }
        });
        this.planeGeometry.dispose();
    }
}
