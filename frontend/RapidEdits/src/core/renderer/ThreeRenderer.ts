import * as THREE from "three";
import { editorEngine } from "../EditorEngine";
import { globalEventBus } from "../events/EventBus";
import { TextureAllocator } from "./textures/TextureAllocator";
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
    private clipMeshes: Map<string, THREE.Mesh> = new Map();

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
            0.1, 1000
        );
        this.camera.position.z = 100;

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
            const mat = mesh.material as THREE.MeshBasicMaterial;
            if (mat.map) this.fitMeshToScreen(mesh, mat.map);
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
                const mat = mesh.material as THREE.MeshBasicMaterial;
                if (mat.map) this.fitMeshToScreen(mesh, mat.map);
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
            if (
                (track.type !== "video" && track.type !== "image") ||
                track.isMuted
            )
                return;
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
                    if (mesh) {
                        const map = (mesh.material as any).map;
                        if (map) map.needsUpdate = true;
                    }
                });
            }
        }

        for (const [clipId, mesh] of this.clipMeshes) {
            if (!visibleClipIds.has(clipId)) {
                // Cleanup
                const mat = mesh.material as THREE.MeshBasicMaterial;
                if (mat.map && mat.map instanceof THREE.VideoTexture) {
                    const video = mat.map.image;
                    if (video && !video.paused) {
                        video.pause();
                    }
                }

                this.scene.remove(mesh);
                (mesh.material as THREE.MeshBasicMaterial).dispose();
                this.clipMeshes.delete(clipId);
            }
        }

        // If no clips, reset ambient
        if (visibleClips.length === 0) {
            this.updateAmbientColor(null);
        }

        visibleClips.forEach((clip) => {
            let mesh = this.clipMeshes.get(clip.id);

            if (!mesh) {
                const material = new THREE.MeshBasicMaterial({
                    color: 0x222222,
                    map: null,
                });
                const newMesh = new THREE.Mesh(this.planeGeometry, material);
                this.scene.add(newMesh);
                this.clipMeshes.set(clip.id, newMesh);
                mesh = newMesh;

                const promise = this.allocator
                    .getTexture(editorEngine.getAsset(clip.assetId)!)
                    .then((texture) => {
                        const currentMesh = this.clipMeshes.get(clip.id);
                        if (texture && currentMesh === newMesh) {
                            const mat =
                                newMesh.material as THREE.MeshBasicMaterial;
                            mat.map = texture;
                            mat.color.setHex(0xffffff);
                            mat.needsUpdate = true;
                            this.fitMeshToScreen(newMesh, texture);
                        }
                    });
                this.pendingLoads.add(promise);
            }

            const trackIndex = tracks.findIndex(
                (t: Track) => t.id === clip.trackId,
            );
            if (mesh) mesh.position.z = trackIndex;

            if (clip.type === "video" && mesh) {
                this.syncVideoFrame(clip, mesh, currentTime);
            }
        });

        this.placeholderMesh.visible = visibleClips.length === 0;
        this.renderer.render(this.scene, this.camera);
    }

    public getActiveVideoElements(): HTMLVideoElement[] {
        const videos: HTMLVideoElement[] = [];
        this.clipMeshes.forEach((mesh) => {
            const mat = mesh.material as THREE.MeshBasicMaterial;
            if (mat.map && mat.map instanceof THREE.VideoTexture) {
                const video = mat.map.image;
                if (video instanceof HTMLVideoElement) {
                    videos.push(video);
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
        this.clipMeshes.forEach((m) =>
            (m.material as THREE.Material).dispose(),
        );
        this.planeGeometry.dispose();
    }
}