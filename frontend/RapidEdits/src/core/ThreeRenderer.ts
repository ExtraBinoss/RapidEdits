import * as THREE from "three";
import { editorEngine } from "./EditorEngine";
import { globalEventBus } from "./EventBus";
import { TextureAllocator } from "./renderer/TextureAllocator";
import type { Clip, Track } from "../types/Timeline";

export class ThreeRenderer {
    private container: HTMLElement;
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private renderer: THREE.WebGLRenderer;

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

    constructor(container: HTMLElement) {
        this.container = container;
        this.allocator = new TextureAllocator();

        // Ambient Sampler Init
        this.samplingCanvas = new OffscreenCanvas(1, 1);
        this.samplingCtx = this.samplingCanvas.getContext("2d", {
            willReadFrequently: true,
        })!;

        // 1. Init Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0b0e14);

        // 2. Init Camera
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
        this.camera.position.z = 100;

        // 3. Init Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.toneMapping = THREE.NoToneMapping;
        this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // Linear for performance on Mac/Chrome
        container.appendChild(this.renderer.domElement);

        // 4. Geometry
        this.planeGeometry = new THREE.PlaneGeometry(1, 1);

        // 5. Placeholder
        this.placeholderMesh = new THREE.Mesh(
            this.planeGeometry,
            new THREE.MeshBasicMaterial({ color: 0x000000 }),
        );
        this.placeholderMesh.position.z = -10;
        this.scene.add(this.placeholderMesh);
    }

    public async init() {
        this.resizeObserver = new ResizeObserver(() => this.handleResize());
        this.resizeObserver.observe(this.container);
        this.handleResize();
        this.renderer.setAnimationLoop(this.render.bind(this));
    }

    public setScaleMode(mode: "fit" | "fill" | number) {
        this.scaleMode = mode;
        this.handleResize(); // Trigger re-layout
    }

    private render() {
        const currentTime = editorEngine.getCurrentTime();
        const tracks = editorEngine.getTracks();

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
        for (const [clipId, mesh] of this.clipMeshes) {
            if (!visibleClipIds.has(clipId)) {
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

                this.allocator
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
            }

            const trackIndex = tracks.findIndex(
                (t: Track) => t.id === clip.trackId,
            );
            if (mesh) mesh.position.z = trackIndex;

            if (clip.type === "video" && mesh) {
                this.syncVideoFrame(clip, mesh, currentTime);
            } else if (clip.type === "image" && mesh) {
                // Images are static, but we might want to sample them for ambient color if they are top-most
                // For now, simpler: do nothing as texture is static.
                // We could implement an updateAmbientColor(image) if desired.
            }
        });

        this.placeholderMesh.visible = visibleClips.length === 0;
        this.renderer.render(this.scene, this.camera);
    }

    private syncVideoFrame(clip: Clip, mesh: THREE.Mesh, globalTime: number) {
        const material = mesh.material as THREE.MeshBasicMaterial;
        if (!material.map || !(material.map instanceof THREE.VideoTexture))
            return;

        const video = material.map.image as HTMLVideoElement;
        if (!video) return;

        // Ensure this 'visual' video element is always muted so it doesn't conflict with AudioManager
        if (!video.muted) video.muted = true;

        const clipTime = globalTime - clip.start + clip.offset;
        // Looser threshold during playback to prevent stuttering seeks
        const threshold = editorEngine.getIsPlaying() ? 0.5 : 0.15;

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

        // Update Ambient Color
        // Sample the topmost/active video
        // Throttle to every 100ms
        const now = performance.now();
        if (now - this.lastSampleTime > 100) {
            this.updateAmbientColor(video);
            this.lastSampleTime = now;
        }
    }

    private updateAmbientColor(video: HTMLVideoElement | null) {
        if (!video) {
            globalEventBus.emit({
                type: "AMBIENT_COLOR_UPDATE",
                payload: "#00000000",
            }); // Transparent/Reset
            return;
        }

        // Skip if video data isn't ready enough to avoid stalling
        if (video.readyState < 3) return;

        try {
            this.samplingCtx.drawImage(video, 0, 0, 1, 1);
            const [r, g, b] = this.samplingCtx.getImageData(0, 0, 1, 1).data;
            const color = `rgba(${r},${g},${b}, 0.6)`; // 0.6 opacity for glow
            globalEventBus.emit({
                type: "AMBIENT_COLOR_UPDATE",
                payload: color,
            });
        } catch (e) {
            // Ignore CORS or not ready
        }
    }

    private handleResize() {
        if (!this.container) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera.left = -width / 2;
        this.camera.right = width / 2;
        this.camera.top = height / 2;
        this.camera.bottom = -height / 2;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.placeholderMesh.scale.set(width, height, 1);
        this.clipMeshes.forEach((mesh) => {
            const mat = mesh.material as THREE.MeshBasicMaterial;
            if (mat.map) this.fitMeshToScreen(mesh, mat.map);
        });
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
        const screenW = this.container.clientWidth;
        const screenH = this.container.clientHeight;

        let scale = 1;
        if (this.scaleMode === "fill") {
            scale = Math.max(screenW / imgW, screenH / imgH);
        } else if (this.scaleMode === "fit") {
            scale = Math.min(screenW / imgW, screenH / imgH);
        } else if (typeof this.scaleMode === "number") {
            // Percentage based (1.0 = 100% of video resolution)
            // Note: ThreeJS planes are 1x1 by default, scaled by imgW/imgH in fitMeshToScreen base.
            // If we want 1:1 pixel mapping:
            // The camera is Ortho with height = screenHeight (since top=h/2, bottom=-h/2).
            // A plane of height H will take up H pixels on screen if camera zoom is 1.

            // Wait, fitMeshToScreen logic:
            // mesh.scale.set(imgW * scale, imgH * scale, 1);
            // If scale = 1, then mesh is imgW x imgH world units.
            // Camera frustum height is screenH units.
            // So mesh height imgH takes up imgH pixels on screen.
            // This means scale = 1 gives 1:1 pixel mapping.
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
