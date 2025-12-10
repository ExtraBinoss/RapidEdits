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
            this.renderer.domElement.style.display = "block";
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
    }

    public getWidth() {
        return this.width;
    }

    public getHeight() {
        return this.height;
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
