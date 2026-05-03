import * as THREE from "three";

export interface ThreeSceneManagerOptions {
    container?: HTMLElement;
    width?: number;
    height?: number;
    canvas?: HTMLCanvasElement | OffscreenCanvas;
}

export class ThreeSceneManager {
    public scene: THREE.Scene;
    public camera: THREE.OrthographicCamera;
    public renderer: THREE.WebGLRenderer;
    public container: HTMLElement | null = null;

    // Geometry
    public planeGeometry: THREE.PlaneGeometry;
    public placeholderMesh: THREE.Mesh;

    private width: number = 1920;
    private height: number = 1080;

    constructor(options: ThreeSceneManagerOptions) {
        this.container = options.container || null;
        this.width = options.width || (this.container?.clientWidth ?? 1920);
        this.height = options.height || (this.container?.clientHeight ?? 1080);

        // 1. Init Scene
        this.scene = new THREE.Scene();
        // Background is transparent to show AmbientLight behind WebGL
        // this.scene.background = new THREE.Color(0x0b0e14);

        // 2. Init Camera (Logical units: matches container size exactly)
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
            alpha: true,
            powerPreference: "high-performance",
            preserveDrawingBuffer: true,
            logarithmicDepthBuffer: true
        };

        if (options.canvas) {
            rendererParams.canvas = options.canvas;
        }

        this.renderer = new THREE.WebGLRenderer(rendererParams);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3)); 
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.setClearColor(0x000000, 0);

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
        // Use container size for placeholder scale
        this.placeholderMesh.scale.set(this.width, this.height, 1);
        this.scene.add(this.placeholderMesh);
    }

    public zoom: number | "fit" | "fill" = "fit";
    public projectWidth: number = 1920;
    public projectHeight: number = 1080;

    public setSize(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.updateCamera();
        this.renderer.setSize(width, height, false);
    }

    public setProjectResolution(width: number, height: number) {
        this.projectWidth = width;
        this.projectHeight = height;
        this.updateCamera();
    }

    public setZoom(zoom: number | "fit" | "fill") {
        this.zoom = zoom;
        this.updateCamera();
    }

    public updateCamera() {
        const containerAspect = this.width / this.height;
        const projectAspect = this.projectWidth / this.projectHeight;

        let viewWidth = this.projectWidth;
        let viewHeight = this.projectHeight;

        if (this.zoom === "fit") {
            if (containerAspect > projectAspect) {
                viewWidth = this.projectHeight * containerAspect;
                viewHeight = this.projectHeight;
            } else {
                viewWidth = this.projectWidth;
                viewHeight = this.projectWidth / containerAspect;
            }
            // Add a 5% padding so the black canvas is clearly visible
            viewWidth *= 1.05;
            viewHeight *= 1.05;
        } else if (this.zoom === "fill") {
            if (containerAspect > projectAspect) {
                viewWidth = this.projectWidth;
                viewHeight = this.projectWidth / containerAspect;
            } else {
                viewWidth = this.projectHeight * containerAspect;
                viewHeight = this.projectHeight;
            }
        } else if (typeof this.zoom === "number") {
            // 100% means 1 screen pixel = 1 project pixel
            viewWidth = this.width / this.zoom;
            viewHeight = this.height / this.zoom;
        }

        this.camera.left = -viewWidth / 2;
        this.camera.right = viewWidth / 2;
        this.camera.top = viewHeight / 2;
        this.camera.bottom = -viewHeight / 2;
        this.camera.updateProjectionMatrix();

        this.placeholderMesh.scale.set(this.projectWidth, this.projectHeight, 1);
    }

    public getWidth() {
        return this.projectWidth;
    }

    public getHeight() {
        return this.projectHeight;
    }

    public dispose() {
        this.renderer.dispose();
        this.planeGeometry.dispose();
        // optionally remove domElement if we appended it
        if (
            this.container &&
            this.renderer.domElement.parentElement === this.container
        ) {
            this.container.removeChild(this.renderer.domElement);
        }
    }
}
