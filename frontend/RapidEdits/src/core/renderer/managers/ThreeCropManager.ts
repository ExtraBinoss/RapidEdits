import * as THREE from "three";
import { editorEngine } from "../../EditorEngine";
import { isMediaClip } from "../../../types/Timeline";

export class ThreeCropManager {
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private rendererDomElement: HTMLElement;
    private getClipMesh: (clipId: string) => THREE.Object3D | undefined;

    private group: THREE.Group;
    private handles: Map<string, THREE.Mesh> = new Map();
    
    private selectedClipId: string | null = null;
    private activeHandle: string | null = null;
    private dragStartMouse = new THREE.Vector2();
    private initialCrop = { left: 0, right: 0, top: 0, bottom: 0 };
    private lastMeshScale = new THREE.Vector3();

    constructor(
        scene: THREE.Scene,
        camera: THREE.Camera,
        rendererDomElement: HTMLElement,
        getClipMesh: (clipId: string) => THREE.Object3D | undefined,
    ) {
        this.scene = scene;
        this.camera = camera;
        this.rendererDomElement = rendererDomElement;
        this.getClipMesh = getClipMesh;

        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.createHandles();
        this.setupEventListeners();
    }

    private createHandles() {
        const handleGeometry = new THREE.PlaneGeometry(20, 20);
        const handleMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            depthTest: false,
            transparent: true,
            opacity: 0.8,
        });

        const sides = ["left", "right", "top", "bottom"];
        sides.forEach((side) => {
            const mesh = new THREE.Mesh(handleGeometry, handleMaterial.clone());
            mesh.userData.side = side;
            this.handles.set(side, mesh);
            this.group.add(mesh);
        });
        
        // Add corner handles
        const corners = ["top-left", "top-right", "bottom-left", "bottom-right"];
        corners.forEach((corner) => {
            const mesh = new THREE.Mesh(handleGeometry, handleMaterial.clone());
            mesh.userData.side = corner;
            this.handles.set(corner, mesh);
            this.group.add(mesh);
        });
    }

    private setupEventListeners() {
        this.rendererDomElement.addEventListener("pointerdown", this.onPointerDown.bind(this));
        window.addEventListener("pointermove", this.onPointerMove.bind(this));
        window.addEventListener("pointerup", this.onPointerUp.bind(this));
    }

    public update() {
        const isCropMode = editorEngine.getIsCropMode();
        const selectedIds = editorEngine.getSelectedClipIds();

        if (!isCropMode || selectedIds.length !== 1) {
            this.group.visible = false;
            return;
        }

        const clipId = selectedIds[0];
        const clip = editorEngine.timelineSystem.getClip(clipId);

        if (!clip || !isMediaClip(clip)) {
            this.group.visible = false;
            return;
        }

        this.selectedClipId = clipId;
        const mesh = this.getClipMesh(clipId);
        if (!mesh) {
            this.group.visible = false;
            return;
        }

        this.group.visible = true;
        this.updateHandlesPosition(mesh, clip.data?.crop || { left: 0, right: 0, top: 0, bottom: 0 });
    }

    private updateHandlesPosition(mesh: THREE.Object3D, crop: any) {
        let target = mesh;
        if (mesh instanceof THREE.Group && mesh.children.length > 0) {
            target = mesh.children[0];
        }

        const scale = target.scale;
        this.lastMeshScale.copy(scale);

        const w = scale.x;
        const h = scale.y;

        // Current visible area (after crop)
        const left = -w/2 + w * crop.left;
        const right = w/2 - w * crop.right;
        const top = h/2 - h * crop.top;
        const bottom = -h/2 + h * crop.bottom;

        this.group.position.copy(target.position);
        this.group.rotation.copy(target.rotation);
        this.group.position.z += 2; // Above selection gizmo

        const setHandle = (side: string, x: number, y: number, sw: number, sh: number) => {
            const hMesh = this.handles.get(side);
            if (hMesh) {
                hMesh.position.set(x, y, 0);
                hMesh.scale.set(sw / 20, sh / 20, 1);
            }
        };

        const handleThickness = 6;

        // Edges
        setHandle("left", left, (top + bottom) / 2, handleThickness, (top - bottom));
        setHandle("right", right, (top + bottom) / 2, handleThickness, (top - bottom));
        setHandle("top", (left + right) / 2, top, (right - left), handleThickness);
        setHandle("bottom", (left + right) / 2, bottom, (right - left), handleThickness);

        // Corners
        setHandle("top-left", left, top, handleThickness * 2, handleThickness * 2);
        setHandle("top-right", right, top, handleThickness * 2, handleThickness * 2);
        setHandle("bottom-left", left, bottom, handleThickness * 2, handleThickness * 2);
        setHandle("bottom-right", right, bottom, handleThickness * 2, handleThickness * 2);
    }

    private onPointerDown(event: PointerEvent) {
        if (!this.group.visible || !this.selectedClipId) return;

        const mouse = this.getMouseNDC(event);
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        const intersects = raycaster.intersectObjects(Array.from(this.handles.values()));
        if (intersects.length > 0) {
            this.activeHandle = intersects[0].object.userData.side;
            this.dragStartMouse.copy(mouse);
            
            const clip = editorEngine.timelineSystem.getClip(this.selectedClipId);
            const crop = clip?.data?.crop || { left: 0, right: 0, top: 0, bottom: 0 };
            this.initialCrop = { ...crop };
            
            event.stopPropagation();
        }
    }

    private onPointerMove(event: PointerEvent) {
        if (!this.activeHandle || !this.selectedClipId) return;

        const mouse = this.getMouseNDC(event);
        const delta = new THREE.Vector2().subVectors(mouse, this.dragStartMouse);

        // Convert mouse delta to local mesh units
        // Since we are using Orthographic camera, we can use camera zoom
        const cam = this.camera as THREE.OrthographicCamera;
        const viewWidth = (cam.right - cam.left) / cam.zoom;
        const viewHeight = (cam.top - cam.bottom) / cam.zoom;
        
        const localDeltaX = (delta.x * viewWidth) / 2;
        const localDeltaY = (delta.y * viewHeight) / 2;

        const newCrop = { ...this.initialCrop };
        const w = this.lastMeshScale.x;
        const h = this.lastMeshScale.y;

        if (this.activeHandle.includes("left")) {
            newCrop.left = Math.max(0, Math.min(1 - newCrop.right - 0.05, this.initialCrop.left + localDeltaX / w));
        }
        if (this.activeHandle.includes("right")) {
            newCrop.right = Math.max(0, Math.min(1 - newCrop.left - 0.05, this.initialCrop.right - localDeltaX / w));
        }
        if (this.activeHandle.includes("top")) {
            newCrop.top = Math.max(0, Math.min(1 - newCrop.bottom - 0.05, this.initialCrop.top - localDeltaY / h));
        }
        if (this.activeHandle.includes("bottom")) {
            newCrop.bottom = Math.max(0, Math.min(1 - newCrop.top - 0.05, this.initialCrop.bottom + localDeltaY / h));
        }

        editorEngine.updateClip(this.selectedClipId, {
            data: {
                ...editorEngine.timelineSystem.getClip(this.selectedClipId)?.data,
                crop: newCrop
            }
        });
    }

    private onPointerUp() {
        this.activeHandle = null;
    }

    private getMouseNDC(event: PointerEvent): THREE.Vector2 {
        const rect = this.rendererDomElement.getBoundingClientRect();
        return new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
    }
}
