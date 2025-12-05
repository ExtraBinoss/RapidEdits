import * as THREE from "three";
import { editorEngine } from "./EditorEngine";
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

    // Scene Graph
    // Map clipId -> Mesh
    private clipMeshes: Map<string, THREE.Mesh> = new Map();

    // Geometry Cache (Reusable Plane)
    private planeGeometry: THREE.PlaneGeometry;
    private placeholderMesh: THREE.Mesh;

    constructor(container: HTMLElement) {
        this.container = container;
        this.allocator = new TextureAllocator();

        // 1. Init Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0b0e14); // Match App bg

        // 2. Init Camera (Orthographic for 2D)
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
        this.camera.position.z = 100;

        // 3. Init Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        // Ensure 1:1 color reproduction
        this.renderer.toneMapping = THREE.NoToneMapping;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        container.appendChild(this.renderer.domElement);

        // 4. Geometry
        this.planeGeometry = new THREE.PlaneGeometry(1, 1);

    // 5. Placeholder (Dark square fallback)
    this.placeholderMesh = new THREE.Mesh(
        this.planeGeometry,
        new THREE.MeshBasicMaterial({ color: 0x000000 }) // Pure black
    );
    // Put it way back
    this.placeholderMesh.position.z = -10;
    this.scene.add(this.placeholderMesh);
  }

    public async init() {
        this.resizeObserver = new ResizeObserver(() => this.handleResize());
        this.resizeObserver.observe(this.container);

        // Initial resize
        this.handleResize();

        // Start Loop
        this.renderer.setAnimationLoop(this.render.bind(this));
    }

    private render() {
        const currentTime = editorEngine.getCurrentTime();
        const tracks = editorEngine.getTracks();

        // 1. Visibility Logic
        const visibleClips: Clip[] = [];
        tracks.forEach((track) => {
            if (track.type !== "video" || track.isMuted) return;
            const clip = track.clips.find(
                (c) =>
                    currentTime >= c.start &&
                    currentTime < c.start + c.duration,
            );
            if (clip) visibleClips.push(clip);
        });

        // Debug log (throttle this if needed, or just print length if it changes)
        // console.log('Visible clips:', visibleClips.length, 'Time:', currentTime);

        // 2. Pruning
        const visibleClipIds = new Set(visibleClips.map((c) => c.id));
        for (const [clipId, mesh] of this.clipMeshes) {
            if (!visibleClipIds.has(clipId)) {
                this.scene.remove(mesh);
                // We don't dispose material/texture here immediately to cache them?
                // Actually, standard material is cheap. Texture is cached in Allocator.
                (mesh.material as THREE.MeshBasicMaterial).dispose();
                this.clipMeshes.delete(clipId);
            }
        }

        // 3. Render / Update
        visibleClips.forEach((clip) => {
            // ... existing clip logic ...
            let mesh = this.clipMeshes.get(clip.id);

            // Init Mesh
            if (!mesh) {
                const material = new THREE.MeshBasicMaterial({
                    color: 0x222222, // Placeholder color
                    map: null,
                });
                const newMesh = new THREE.Mesh(this.planeGeometry, material);
                this.scene.add(newMesh);
                this.clipMeshes.set(clip.id, newMesh);
                mesh = newMesh; // Update local var for subsequent logic

                // Async Texture Load
                this.allocator
                    .getTexture(editorEngine.getAsset(clip.assetId)!)
                    .then((texture) => {
                        // Check if mesh is still valid in the scene (might have been removed during load)
                        // AND matches the one we created (race condition check)
                        const currentMesh = this.clipMeshes.get(clip.id);
                        if (texture && currentMesh === newMesh) {
                            const mat =
                                newMesh.material as THREE.MeshBasicMaterial;
                            mat.map = texture;
                            mat.color.setHex(0xffffff); // Reset color to white so texture shows true colors
                            mat.needsUpdate = true;
                            this.fitMeshToScreen(newMesh, texture);
                        } else {
                            console.warn(
                                "Texture failed or mesh stale for clip:",
                                clip.id,
                            );
                        }
                    });
            }

            // Z-Index based on track order + manual offset to avoid z-fighting
            // Higher track index = On top
            // Track 1 -> z=1, Track 2 -> z=2
            // But 'visibleClips' doesn't carry track index easily unless we map it.
            // tracks loop above does it implicitly by order?
            // Actually we want consistent Z per track.
            // Let's find the track ID for this clip.
            const trackIndex = tracks.findIndex(
                (t: Track) => t.id === clip.trackId,
            );
            if (mesh) {
                mesh.position.z = trackIndex;
            }

            // Sync Frame
            if (clip.type === "video" && mesh) {
                this.syncVideoFrame(clip, mesh, currentTime);
            }
        });

        // Toggle placeholder
        this.placeholderMesh.visible = visibleClips.length === 0;

        this.renderer.render(this.scene, this.camera);
    }

    private syncVideoFrame(clip: Clip, mesh: THREE.Mesh, globalTime: number) {
        const material = mesh.material as THREE.MeshBasicMaterial;
        if (!material.map || !(material.map instanceof THREE.VideoTexture))
            return;

        const video = material.map.image as HTMLVideoElement;
        if (!video) return;

        // A. Time Sync
        const clipTime = globalTime - clip.start + clip.offset;

        // B. Seek
        if (Math.abs(video.currentTime - clipTime) > 0.15) {
            if (!video.seeking) video.currentTime = clipTime;
        }

        // C. Playback State
        if (editorEngine.getIsPlaying()) {
            if (video.paused) video.play().catch(() => {});
        } else {
            if (!video.paused) video.pause();
        }

        // D. Texture Update
        // Three.js VideoTexture handles auto-update if video plays.
        // But if we are paused and scrubbing (seeking), we might need to force update?
        // Three.js checks 'video.readyState >= 2'.
        // Usually it works automatically.
    }

    private handleResize() {
        if (!this.container) return;

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        // Update Camera Frustum to match pixels 1:1
        // Center is (0,0)
        this.camera.left = -width / 2;
        this.camera.right = width / 2;
        this.camera.top = height / 2;
        this.camera.bottom = -height / 2;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);

        // Update placeholder to cover screen
        this.placeholderMesh.scale.set(width, height, 1);

        // Re-fit existing meshes
        this.clipMeshes.forEach((mesh) => {
            const mat = mesh.material as THREE.MeshBasicMaterial;
            if (mat.map) {
                this.fitMeshToScreen(mesh, mat.map);
            }
        });
    }

    private fitMeshToScreen(mesh: THREE.Mesh, texture: THREE.Texture) {
        const image = texture.image as any;
        if (!image) return;

        let imgW = 0;
        let imgH = 0;

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

        // Uniform Scale to Fit (Aspect Fit)
        const scale = Math.min(screenW / imgW, screenH / imgH);

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
            (m.material as THREE.Material).dispose();
            // Geometry is shared, don't dispose per mesh
        });
        this.planeGeometry.dispose();
    }
}
