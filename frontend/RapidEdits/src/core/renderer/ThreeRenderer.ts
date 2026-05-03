import { editorEngine } from "../EditorEngine";
import { globalEventBus } from "../events/EventBus";
import { TextureAllocator } from "./textures/TextureAllocator";
import type { Track } from "../../types/Timeline";
import { ThreeSceneManager } from "./managers/ThreeSceneManager";
import { ThreeInteractionManager } from "./managers/ThreeInteractionManager";
import { ThreeSelectionManager } from "./managers/ThreeSelectionManager";
import { ThreeClipManager } from "./managers/ThreeClipManager";
import { ThreeVideoManager } from "./managers/ThreeVideoManager";
import { ThreeCropManager } from "./managers/ThreeCropManager";
import { ThreeGizmoManager, type ScreenRect } from "./managers/ThreeGizmoManager";
import { EditorEventType } from "../../types/Media";
export type { ScreenRect };

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
    public cropManager: ThreeCropManager | null = null;
    public gizmoManager: ThreeGizmoManager | null = null;
    public clipManager: ThreeClipManager;
    public videoManager: ThreeVideoManager;

    // State
    private isCaptureMode: boolean = false;
    private resizeObserver: ResizeObserver | null = null;

    // We expose clipMeshes for managers via a getter, but implementation is in ClipManager.
    // InteractionManager expects a callback `(clipId) => Object3D`.
    // ClipManager owns the map now.

    constructor(options: ThreeRendererOptions) {
        const allocator = options.allocator || new TextureAllocator();
        this.isCaptureMode = options.isCaptureMode || false;

        this.sceneManager = new ThreeSceneManager({
            container: options.container,
            width: options.width,
            height: options.height,
            canvas: options.canvas,
        });

        this.clipManager = new ThreeClipManager(
            this.sceneManager.scene,
            allocator,
            () => ({
                width: this.sceneManager.getWidth(),
                height: this.sceneManager.getHeight(),
            }),
        );

        this.videoManager = new ThreeVideoManager((clipId) =>
            this.clipManager.getClipMesh(clipId),
        );
    }

    public setCaptureMode(isCapture: boolean) {
        this.isCaptureMode = isCapture;
    }

    public setSize(width: number, height: number) {
        this.sceneManager.setSize(width, height);
    }

    public setProjectResolution(width: number, height: number) {
        this.sceneManager.setProjectResolution(width, height);
        this.clipManager.refitAllMeshes();
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
                    (clipId: string) => this.clipManager.getClipMesh(clipId),
                    () => this.selectionManager?.updateSelectionGizmo(),
                    () => this.selectionManager?.updateSelectionGizmo(),
                );

                this.selectionManager = new ThreeSelectionManager(
                    this.sceneManager.scene,
                    this.interactionManager.transformControls,
                    (clipId) => this.clipManager.getClipMesh(clipId),
                );

                this.cropManager = new ThreeCropManager(
                    this.sceneManager.scene,
                    this.sceneManager.camera,
                    this.sceneManager.renderer.domElement,
                    (clipId) => this.clipManager.getClipMesh(clipId),
                );

                this.gizmoManager = new ThreeGizmoManager(
                    this.sceneManager.camera,
                    this.sceneManager.renderer.domElement,
                    (clipId) => this.clipManager.getClipMesh(clipId),
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
        await this.clipManager.waitForPendingLoads();
    }

    public setScaleMode(mode: "fit" | "fill" | number) {
        this.sceneManager.setZoom(mode);
    }

    public render() {
        if (this.interactionManager) this.interactionManager.update();
        if (this.selectionManager) this.selectionManager.update();
        if (this.cropManager) this.cropManager.update();
        if (this.gizmoManager) this.gizmoManager.update();

        const currentTime = editorEngine.getCurrentTime();
        const tracks = editorEngine.getTracks();
        this.renderFrame(currentTime, tracks);
    }

    public renderFrame(currentTime: number, tracks: Track[]) {
        // 1. Update Content (Clips)
        const visibleClips = this.clipManager.update(
            currentTime,
            tracks,
            this.isCaptureMode,
        );

        // 2. Sync Videos
        this.videoManager.sync(visibleClips, currentTime, this.isCaptureMode);

        // 3. Render Scene
        this.sceneManager.placeholderMesh.visible = visibleClips.length === 0;
        this.sceneManager.renderer.render(
            this.sceneManager.scene,
            this.sceneManager.camera,
        );

        // 4. Update Ambient Light (Throttled)
        if (!this.isCaptureMode) {
            this.updateAmbientLight();
        }
    }

    private lastAmbientUpdate = 0;
    private ambientUpdateInterval = 100; // ms

    private updateAmbientLight() {
        const now = Date.now();
        if (now - this.lastAmbientUpdate < this.ambientUpdateInterval) return;
        this.lastAmbientUpdate = now;

        try {
            const gl = this.sceneManager.renderer.getContext();
            const width = gl.drawingBufferWidth;
            const height = gl.drawingBufferHeight;

            // Sample a few pixels from center/around
            const pixel = new Uint8Array(4);
            gl.readPixels(
                width / 2,
                height / 2,
                1,
                1,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                pixel,
            );

            const r = pixel[0];
            const g = pixel[1];
            const b = pixel[2];
            // alpha = pixel[3]

            const color = `rgb(${r}, ${g}, ${b})`;

            // Emit event
            globalEventBus.emit({
                type: EditorEventType.AMBIENT_COLOR_UPDATE,
                payload: color,
            });
        } catch (e) {
            // Context lost or other issue
        }
    }

    // Used by ExportService
    public getActiveVideoElements(): HTMLVideoElement[] {
        return this.clipManager.getActiveVideoElements();
    }

    /** Returns the screen-space bounding rect of the selected object for the CSS gizmo overlay. */
    public getGizmoScreenRect(): import("./managers/ThreeGizmoManager").ScreenRect | null {
        return this.gizmoManager?.getScreenRect() ?? null;
    }

    public dispose() {
        this.sceneManager.dispose();
        this.interactionManager?.dispose();
        this.clipManager.dispose();
    }

    public destroy() {
        this.dispose();
    }
}
