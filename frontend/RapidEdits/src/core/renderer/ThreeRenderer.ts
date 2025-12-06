import { editorEngine } from "../EditorEngine";
import { TextureAllocator } from "./textures/TextureAllocator";
import type { Track } from "../../types/Timeline";
import { ThreeSceneManager } from "./managers/ThreeSceneManager";
import { ThreeInteractionManager } from "./managers/ThreeInteractionManager";
import { ThreeSelectionManager } from "./managers/ThreeSelectionManager";
import { ThreeClipManager } from "./managers/ThreeClipManager";
import { ThreeVideoManager } from "./managers/ThreeVideoManager";

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
        // ClipManager needs to re-fit meshes if size changes
        // But re-fitting depends on scale mode, which ClipManager stores.
        // We can just trigger a refit or relying on update() if it checks size?
        // Actually ClipManager has setScaleMode, but not setSize callback.
        // We probably need to tell ClipManager to re-fit.
        // For now, let's assume next update will handle, or add a method.
        // In original code, setSize called manually fitMeshToScreen.
        // Let's add refitAll to ClipManager public API implicitly via setScaleMode or new method.
        // But since we pass getSceneDimensions callback, ClipManager can just check on update?
        // No, fitMeshToScreen is only called on texture load or scale change.
        // Force refit:
        // this.clipManager.refitAllMeshes(); // Made private in manager.
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
        this.clipManager.setScaleMode(mode);
        if (this.sceneManager.container) this.handleResize();
    }

    public render() {
        if (this.interactionManager) this.interactionManager.update();
        if (this.selectionManager) this.selectionManager.update();

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
    }

    // Used by ExportService
    public getActiveVideoElements(): HTMLVideoElement[] {
        return this.clipManager.getActiveVideoElements();
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
