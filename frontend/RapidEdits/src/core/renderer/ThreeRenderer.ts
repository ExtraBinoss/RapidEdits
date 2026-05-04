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
import { ThreeGuidesManager } from "./managers/ThreeGuidesManager";
import { EditorEventType } from "../../types/Media";
export type { ScreenRect };

export interface ThreeRendererOptions {
    container?: HTMLElement;
    width?: number;
    height?: number;
    canvas?: HTMLCanvasElement | OffscreenCanvas;
    allocator?: TextureAllocator;
    isCaptureMode?: boolean;
    pixelRatio?: number;
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
    public guidesManager: ThreeGuidesManager;
    public textureAllocator: TextureAllocator;

    // State
    private isCaptureMode: boolean = false;
    private resizeObserver: ResizeObserver | null = null;

    // We expose clipMeshes for managers via a getter, but implementation is in ClipManager.
    // InteractionManager expects a callback `(clipId) => Object3D`.
    // ClipManager owns the map now.

    constructor(options: ThreeRendererOptions) {
        const allocator = options.allocator || new TextureAllocator();
        this.textureAllocator = allocator;
        this.isCaptureMode = options.isCaptureMode || false;

        this.sceneManager = new ThreeSceneManager({
            container: options.container,
            width: options.width,
            height: options.height,
            canvas: options.canvas,
            pixelRatio: options.pixelRatio,
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

        this.guidesManager = new ThreeGuidesManager(this.sceneManager.scene);
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
                    () => this.clipManager.getClipMeshes(),
                    () => ({
                        width: this.sceneManager.getWidth(),
                        height: this.sceneManager.getHeight(),
                    }),
                    () => this.selectionManager?.updateSelectionGizmo(),
                    () => this.selectionManager?.updateSelectionGizmo(),
                    this.guidesManager,
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

    public prepareFrame(currentTime: number, tracks: Track[]) {
        // 1. Update Content (Clips)
        const visibleClips = this.clipManager.update(
            currentTime,
            tracks,
            this.isCaptureMode,
        );

        // 2. Sync Videos
        this.videoManager.sync(visibleClips, currentTime, this.isCaptureMode);
        
        return visibleClips;
    }

    public renderOnly(visibleClips: any[]) {
        // 3. Render Scene
        this.sceneManager.placeholderMesh.visible = visibleClips.length === 0;
        this.sceneManager.renderer.render(
            this.sceneManager.scene,
            this.sceneManager.camera,
        );
    }

    public renderFrame(currentTime: number, tracks: Track[]) {
        const visibleClips = this.prepareFrame(currentTime, tracks);
        this.renderOnly(visibleClips);
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
        this.guidesManager.dispose();
    }

    public destroy() {
        this.dispose();
    }
}
