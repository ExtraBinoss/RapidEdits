import { editorEngine } from "../../EditorEngine";
import { ThreeRenderer } from "../../renderer/ThreeRenderer";
import { TextureAllocator } from "../../renderer/textures/TextureAllocator";
import { ResourceManager } from "../../ResourceManager"; // Using isolated one
import { FrameSynchronizer } from "./FrameSynchronizer";
import type { WebCodecsEncoder } from "../encoder/WebCodecsEncoder";

export class RenderPipeline {
    private renderer: ThreeRenderer;
    private allocator: TextureAllocator;
    private resourceManager: ResourceManager;
    private synchronizer: FrameSynchronizer;
    private container: HTMLElement;

    constructor(width: number, height: number) {
        // 1. Offscreen Container
        this.container = document.createElement("div");
        Object.assign(this.container.style, {
            position: "fixed",
            top: "0",
            left: "0",
            zIndex: "-9999",
            width: `${width}px`,
            height: `${height}px`,
            visibility: "visible",
            pointerEvents: "none",
        });
        document.body.appendChild(this.container);

        // 2. Isolated Modules
        this.resourceManager = new ResourceManager();
        this.allocator = new TextureAllocator(this.resourceManager);
        this.renderer = new ThreeRenderer(this.container, this.allocator, {
            isCaptureMode: true,
        });
        this.synchronizer = new FrameSynchronizer();
    }

    public async init() {
        await this.renderer.init();
        this.renderer.setScaleMode("fill");
    }

    public async run(
        encoder: WebCodecsEncoder,
        totalDuration: number,
        fps: number,
        onProgress: (progress: number) => void,
        checkCancel: () => boolean,
    ) {
        const frameCount = Math.ceil(totalDuration * fps);
        const dt = 1 / fps;
        const tracks = editorEngine.getTracks();

        for (let i = 0; i < frameCount; i++) {
            if (checkCancel()) {
                console.log("[ExportDebug] Cancelled at frame", i);
                throw new Error("Cancelled");
            }
            if (i % 30 === 0)
                console.log(
                    "[ExportDebug] Rendering frame",
                    i,
                    "/",
                    frameCount,
                );

            const time = i * dt;

            // 0. Initial Delay for Textures/GPU Upload (Prevents Black Video)
            if (i === 0) await new Promise((r) => setTimeout(r, 50));

            // 1. Render Frame (Triggers Texture Updates / Seeks)
            this.renderer.renderFrame(time, tracks);

            // 1.5. Wait for Textures to Load
            await this.renderer.waitForPendingLoads();

            // 2. Ensure Video Elements are Attached
            const activeVideos = this.renderer.getActiveVideoElements();
            activeVideos.forEach((v) => {
                if (!v.parentNode) {
                    this.container.appendChild(v);
                    Object.assign(v.style, {
                        position: "absolute",
                        top: "0",
                        left: "0",
                        width: "1px",
                        height: "1px",
                        opacity: "0.01",
                    });
                }
            });

            // 3. Synchronize
            await this.synchronizer.syncVideos(this.renderer, time);

            // 4. Final Render (Clean)
            this.renderer.renderFrame(time, tracks);

            // 5. Capture & Encode
            const canvas = this.renderer.renderer.domElement;
            const frame = new VideoFrame(canvas, {
                timestamp: Math.round(time * 1_000_000), // Microseconds
                duration: Math.round(dt * 1_000_000),
            });

            await encoder.encodeFrame(frame, i % (fps * 2) === 0); // Keyframe every 2s
            // frame.close(); // MOVED TO WORKER: Ownership transferred!

            // Progress
            if (i % 10 === 0) onProgress(Math.round((i / frameCount) * 100));
        }
    }

    public destroy() {
        this.renderer.destroy();
        this.allocator.destroy();
        this.resourceManager.cleanup();
        if (document.body.contains(this.container)) {
            document.body.removeChild(this.container);
        }
    }
}
