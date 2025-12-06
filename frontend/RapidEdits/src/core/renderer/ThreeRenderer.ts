import * as THREE from "three";
import { editorEngine } from "../EditorEngine";
import { globalEventBus } from "../events/EventBus";
import { TextureAllocator } from "./textures/TextureAllocator";
import { pluginRegistry } from "../plugins/PluginRegistry";
import type { Clip, Track } from "../../types/Timeline";
import { OrbitControls, TransformControls } from "three-stdlib";

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
    private clipMeshes: Map<string, THREE.Object3D> = new Map();

    // Geometry Cache
    private planeGeometry: THREE.PlaneGeometry;
    private placeholderMesh: THREE.Mesh;

    // Ambient Sampling
    private samplingCanvas: OffscreenCanvas;
    private samplingCtx: OffscreenCanvasRenderingContext2D;
    private lastSampleTime: number = 0;
    private isCaptureMode: boolean = false;
    private pendingLoads: Set<Promise<any>> = new Set();

    // Interaction
    private orbitControls: OrbitControls | null = null;
    private transformControls: TransformControls | null = null;
    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private mouse: THREE.Vector2 = new THREE.Vector2();
    private isInteracting: boolean = false;

    // Drag State
    private isDraggingObject: boolean = false;
    private dragPlane: THREE.Plane = new THREE.Plane();
    private dragOffset: THREE.Vector3 = new THREE.Vector3();

    constructor(options: ThreeRendererOptions) {
        this.container = options.container || null;
        this.width =
            options.width ||
            (this.container ? this.container.clientWidth : 1920);
        this.height =
            options.height ||
            (this.container ? this.container.clientHeight : 1080);

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
            -this.width / 2,
            this.width / 2,
            this.height / 2,
            -this.height / 2,
            0.1,
            3000,
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

        if (this.container && !options.canvas) {
            this.container.appendChild(this.renderer.domElement);
        }

        this.renderer.setSize(this.width, this.height, false);

        // 4. Geometry
        this.planeGeometry = new THREE.PlaneGeometry(1, 1);

        // 5. Placeholder
        this.placeholderMesh = new THREE.Mesh(
            this.planeGeometry,
            new THREE.MeshBasicMaterial({ color: 0x000000 }),
        );
        this.placeholderMesh.position.z = -10;
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

        this.clipMeshes.forEach((mesh) => {
            if (mesh instanceof THREE.Mesh) {
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

            if (this.container) {
                // OrbitControls
                this.orbitControls = new OrbitControls(
                    this.camera,
                    this.renderer.domElement,
                );
                this.orbitControls.enableDamping = true;
                this.orbitControls.dampingFactor = 0.05;
                this.orbitControls.screenSpacePanning = true;
                this.orbitControls.enableRotate = false; // Lock to 2D view
                this.orbitControls.enabled = true;

                // TransformControls
                this.transformControls = new TransformControls(
                    this.camera,
                    this.renderer.domElement,
                );
                (this.transformControls as any).addEventListener(
                    "dragging-changed",
                    (event: any) => {
                        const isDragging = event.value as boolean;
                        if (this.orbitControls) {
                            this.orbitControls.enabled = !isDragging;
                        }
                        this.isInteracting = isDragging;
                    },
                );

                (this.transformControls as any).addEventListener(
                    "change",
                    () => {
                        if (this.isInteracting) {
                            this.syncTransformToClip();
                        }
                    },
                );

                this.scene.add(this.transformControls);

                this.renderer.domElement.addEventListener(
                    "pointerdown",
                    this.onPointerDown.bind(this),
                );
                this.renderer.domElement.addEventListener(
                    "pointermove",
                    this.onPointerMove.bind(this),
                );
                this.renderer.domElement.addEventListener(
                    "pointerup",
                    this.onPointerUp.bind(this),
                );

                globalEventBus.on("SELECTION_CHANGED", (_payload: any) => {
                    this.updateSelectionGizmo();
                });
            }
        }
    }

    private onPointerDown(event: PointerEvent) {
        if (!this.container) return;

        // If clicking gizmo interaction, ignore
        if (this.isInteracting) return;

        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObjects(
            this.scene.children,
            true,
        );

        let foundClipId: string | null = null;
        let foundObject: THREE.Object3D | null = null;

        for (const intersect of intersects) {
            let obj: THREE.Object3D | null = intersect.object;
            while (obj) {
                // Ignore gizmo
                if (
                    this.transformControls &&
                    (obj.uuid ===
                        (this.transformControls as unknown as THREE.Object3D)
                            .uuid ||
                        (
                            this.transformControls as unknown as THREE.Object3D
                        ).children?.some((c) => c.uuid === obj?.uuid))
                ) {
                    return;
                }

                if (
                    obj.userData &&
                    obj.userData.isSelectable &&
                    obj.userData.clipId
                ) {
                    foundClipId = obj.userData.clipId;
                    foundObject = obj;
                    break;
                }
                obj = obj.parent;
            }
            if (foundClipId) break;
        }

        const selectedIds = editorEngine.getSelectedClipIds();
        const isAlreadySelected =
            foundClipId && selectedIds.includes(foundClipId);

        if (foundClipId) {
            if (!isAlreadySelected) {
                editorEngine.selectClip(foundClipId);
            }

            // Initiate Drag for the object
            if (foundObject) {
                this.isDraggingObject = true;
                this.dragPlane.setFromNormalAndCoplanarPoint(
                    new THREE.Vector3(0, 0, 1), // Standard 2D plane normal
                    foundObject.position,
                );

                const intersection = new THREE.Vector3();
                this.raycaster.ray.intersectPlane(this.dragPlane, intersection);
                this.dragOffset.subVectors(foundObject.position, intersection);

                // If interacting via Gizmo, controls handles it.
                // But we are here because !isInteracting (gizmo not being dragged).
                // So we are dragging the object body.
                if (this.orbitControls) this.orbitControls.enabled = false;
            }
        } else {
            editorEngine.selectionSystem.deselectAll();
        }
    }

    private onPointerMove(event: PointerEvent) {
        if (!this.container) return;

        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // 1. Dragging Logic
        if (this.isDraggingObject) {
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersection = new THREE.Vector3();
            if (
                this.raycaster.ray.intersectPlane(this.dragPlane, intersection)
            ) {
                // Find current selected object
                const selectedIds = editorEngine.getSelectedClipIds();
                if (selectedIds.length === 1) {
                    const clipId = selectedIds[0]!;
                    const objGroup = this.clipMeshes.get(clipId);
                    if (objGroup) {
                        let target: THREE.Object3D = objGroup;
                        if (
                            objGroup instanceof THREE.Group &&
                            objGroup.children.length > 0
                        ) {
                            target = objGroup.children[0] as THREE.Object3D;
                        }

                        const newPos = intersection.add(this.dragOffset);
                        target.position.copy(newPos);

                        // Manually trigger sync or rely on manual update
                        this.syncTransformToClip();
                        this.updateSelectionGizmo(); // Move the box
                    }
                }
            }
            this.renderer.domElement.style.cursor = "move";
            return;
        }

        // 2. Cursor Hover Logic
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(
            this.scene.children,
            true,
        );

        let foundSelectable = false;

        for (const intersect of intersects) {
            let obj: THREE.Object3D | null = intersect.object;
            // Ignore helper/gizmo
            if (
                this.selectionHelper &&
                (obj === this.selectionHelper ||
                    (this.selectionHelper as any).children?.includes(obj))
            )
                continue;

            if (
                this.transformControls &&
                (obj.uuid ===
                    (this.transformControls as unknown as THREE.Object3D)
                        .uuid ||
                    (
                        this.transformControls as unknown as THREE.Object3D
                    ).children?.some((c) => c.uuid === obj?.uuid))
            ) {
                // Gizmo hover handled by itself usually
                continue;
            }

            while (obj) {
                if (obj.userData?.isSelectable) {
                    foundSelectable = true;
                    break;
                }
                obj = obj.parent;
            }
            if (foundSelectable) break;
        }

        if (foundSelectable) {
            const selectedIds = editorEngine.getSelectedClipIds();
            // If hovering selected item, show move cursor
            if (
                intersects.some(
                    (i) =>
                        i.object.userData?.clipId &&
                        selectedIds.includes(i.object.userData.clipId),
                )
            ) {
                this.renderer.domElement.style.cursor = "move";
            } else {
                this.renderer.domElement.style.cursor = "pointer";
            }
        } else {
            this.renderer.domElement.style.cursor = "default";
        }
    }

    private onPointerUp() {
        if (this.isDraggingObject) {
            this.isDraggingObject = false;
            // Re-enable controls if needed (though we disabled rotate, pan might be okay)
            if (this.orbitControls) this.orbitControls.enabled = true;
        }
    }

    private selectionHelper: THREE.Object3D | null = null;

    private updateSelectionGizmo() {
        if (!this.transformControls) return;

        const selectedIds = editorEngine.getSelectedClipIds();
        if (selectedIds.length === 1) {
            const clipId = selectedIds[0]!;
            const object = this.clipMeshes.get(clipId);
            if (object) {
                let target: THREE.Object3D = object;
                if (
                    object instanceof THREE.Group &&
                    object.children.length > 0
                ) {
                    target = object.children[0] as THREE.Object3D;
                }

                this.transformControls.attach(target);

                // Add Custom Dashed Rounded Box
                if (this.selectionHelper) {
                    this.scene.remove(this.selectionHelper);
                    // Dispose geometry/material if possible
                    if ((this.selectionHelper as any).geometry)
                        (this.selectionHelper as any).geometry.dispose();
                    if ((this.selectionHelper as any).material)
                        (
                            (this.selectionHelper as any)
                                .material as THREE.Material
                        ).dispose();
                    this.selectionHelper = null;
                }

                const box = new THREE.Box3().setFromObject(target);
                // Expand slightly
                box.min.subScalar(5);
                box.max.addScalar(5);

                const width = box.max.x - box.min.x;
                const height = box.max.y - box.min.y;
                const radius = 10;

                // Create Rounded Rect Path
                const shape = new THREE.Shape();
                const x = -width / 2;
                const y = -height / 2;

                shape.moveTo(x, y + radius);
                shape.lineTo(x, y + height - radius);
                shape.quadraticCurveTo(x, y + height, x + radius, y + height);
                shape.lineTo(x + width - radius, y + height);
                shape.quadraticCurveTo(
                    x + width,
                    y + height,
                    x + width,
                    y + height - radius,
                );
                shape.lineTo(x + width, y + radius);
                shape.quadraticCurveTo(x + width, y, x + width - radius, y);
                shape.lineTo(x + radius, y);
                shape.quadraticCurveTo(x, y, x, y + radius);

                const points = shape.getPoints();
                const geometry = new THREE.BufferGeometry().setFromPoints(
                    points,
                );

                const material = new THREE.LineDashedMaterial({
                    color: 0xffff00,
                    dashSize: 10,
                    gapSize: 5,
                    linewidth: 2,
                });

                const line = new THREE.Line(geometry, material);
                line.computeLineDistances();
                this.selectionHelper = line;

                const center = new THREE.Vector3();
                box.getCenter(center);
                this.selectionHelper.position.copy(center);
                this.selectionHelper.position.z += 1; // Offset to sit on top of object

                this.scene.add(this.selectionHelper);

                // Initial sync
                this.selectionHelper.position.copy(target.position);
                this.selectionHelper.position.z += 1; // Offset
                this.selectionHelper.rotation.copy(target.rotation);
                this.selectionHelper.scale.copy(target.scale);
            } else {
                this.transformControls.detach();
                if (this.selectionHelper) {
                    this.scene.remove(this.selectionHelper);
                    this.selectionHelper = null;
                }
            }
        } else {
            this.transformControls.detach();
            if (this.selectionHelper) {
                this.scene.remove(this.selectionHelper);
                this.selectionHelper = null;
            }
        }
    }

    private syncTransformToClip() {
        if (!this.transformControls || !(this.transformControls as any).object)
            return;

        const object = (this.transformControls as any).object;
        const clipId = object.userData.clipId;
        if (!clipId) return;

        const position = {
            x: object.position.x,
            y: object.position.y,
            z: object.position.z,
        };
        const rotation = {
            x: object.rotation.x,
            y: object.rotation.y,
            z: object.rotation.z,
        };
        const scale = {
            x: object.scale.x,
            y: object.scale.y,
            z: object.scale.z,
        };

        const clip = editorEngine.timelineSystem.getClip(clipId);
        if (clip) {
            editorEngine.updateClip(clipId, {
                data: {
                    ...clip.data,
                    position,
                    rotation,
                    scale,
                },
            });
        }
    }

    public async waitForPendingLoads() {
        if (this.pendingLoads.size === 0) return;
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
        if (this.orbitControls) this.orbitControls.update();
        // Update Helper Transform
        if (this.selectionHelper) {
            // BoxHelper specific update removed.
            // Custom helper update logic follows:
            const selectedIds = editorEngine.getSelectedClipIds();
            if (selectedIds.length === 1) {
                const clipId = selectedIds[0]!;
                const objGroup = this.clipMeshes.get(clipId);
                if (objGroup) {
                    let target = objGroup;
                    if (
                        objGroup instanceof THREE.Group &&
                        objGroup.children.length > 0
                    ) {
                        target = objGroup.children[0] as THREE.Object3D;
                    }

                    this.selectionHelper.position.copy(target.position);
                    // Add small Z offset to prevent fighting with video/text
                    this.selectionHelper.position.z += 1;
                    this.selectionHelper.rotation.copy(target.rotation);
                    this.selectionHelper.scale.copy(target.scale);
                }
            }
        }

        const currentTime = editorEngine.getCurrentTime();
        const tracks = editorEngine.getTracks();
        this.renderFrame(currentTime, tracks);
    }

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
                this.scene.remove(object);
                this.clipMeshes.delete(clipId);
            }
        }

        const videoClips = visibleClips.filter((c) => c.type === "video");
        if (videoClips.length === 0) {
            this.updateAmbientColor(null);
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
                return;
            }

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
