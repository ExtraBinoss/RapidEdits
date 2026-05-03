import * as THREE from "three";
import { OrbitControls, TransformControls } from "three-stdlib";
import { editorEngine } from "../../EditorEngine";
import { globalEventBus } from "../../events/EventBus";
import { EditorEventType } from "../../../types/Media";

export class ThreeInteractionManager {
    private camera: THREE.OrthographicCamera;
    private scene: THREE.Scene;
    private rendererDomElement: HTMLCanvasElement;

    public orbitControls: OrbitControls;
    public transformControls: TransformControls;

    private mouse: THREE.Vector2 = new THREE.Vector2();
    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private isInteracting: boolean = false;

    private isDraggingObject = false;
    private draggedClipId: string | null = null;
    private dragPlane = new THREE.Plane();
    private dragOffset = new THREE.Vector3();
    private dragIntersection = new THREE.Vector3();

    private getClipMesh: (clipId: string) => THREE.Object3D | undefined;
    private onSelectionChanged: () => void;
    private onTransformChanged: () => void;

    constructor(
        camera: THREE.OrthographicCamera,
        scene: THREE.Scene,
        rendererDomElement: HTMLCanvasElement,
        getClipMesh: (clipId: string) => THREE.Object3D | undefined,
        onSelectionChanged: () => void,
        onTransformChanged: () => void,
    ) {
        this.camera = camera;
        this.scene = scene;
        this.rendererDomElement = rendererDomElement;
        this.getClipMesh = getClipMesh;
        this.onSelectionChanged = onSelectionChanged;
        this.onTransformChanged = onTransformChanged;

        this.orbitControls = new OrbitControls(this.camera, this.rendererDomElement);
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.05;
        this.orbitControls.screenSpacePanning = true;
        this.orbitControls.enableRotate = false;
        this.orbitControls.enabled = true;

        this.transformControls = new TransformControls(this.camera, this.rendererDomElement);
        this.scene.add(this.transformControls);

        this.setupEventListeners();
    }

    private setupEventListeners() {
        (this.transformControls as any).addEventListener("dragging-changed", (event: any) => {
            const isDragging = event.value as boolean;
            this.orbitControls.enabled = !isDragging;
            this.isInteracting = isDragging;
        });

        (this.transformControls as any).addEventListener("change", () => {
            if (this.isInteracting) this.syncTransformToClip();
        });

        this.rendererDomElement.addEventListener("pointerdown", this.onPointerDown.bind(this));
        this.rendererDomElement.addEventListener("pointermove", this.onPointerMove.bind(this));
        this.rendererDomElement.addEventListener("pointerup", this.onPointerUp.bind(this));

        globalEventBus.on(EditorEventType.SELECTION_CHANGED, () => this.onSelectionChanged());
    }

    public update() { this.orbitControls.update(); }

    public dispose() {
        this.orbitControls.dispose();
        this.transformControls.dispose();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Given a clipMesh (Group for plugins, Mesh for media), returns the object
     * that owns position/rotation (the top-level stored object).
     * Scale for media lives on the Mesh itself; for plugins on children[0].
     */
    private getPositionObject(clipMesh: THREE.Object3D): THREE.Object3D {
        return clipMesh; // always the top-level stored object
    }

    private getScaleObject(clipMesh: THREE.Object3D): THREE.Object3D {
        if (clipMesh instanceof THREE.Group && clipMesh.children.length > 0) {
            return clipMesh.children[0]!;
        }
        return clipMesh; // Mesh: scale is on itself
    }

    private isGizmo(obj: THREE.Object3D): boolean {
        if (!this.transformControls) return false;
        let current: THREE.Object3D | null = obj;
        const tc = this.transformControls as unknown as THREE.Object3D;
        while (current) {
            if (current === tc) return true;
            current = current.parent;
        }
        return false;
    }

    // ── Pointer Down: selection + drag init ───────────────────────────────────

    private onPointerDown(event: PointerEvent) {
        if (this.isInteracting) return;

        const rect = this.rendererDomElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        this.raycaster.params.Line.threshold = 10;
        
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        let foundClipId: string | null = null;
        for (const intersect of intersects) {
            let obj: THREE.Object3D | null = intersect.object;
            if (obj.userData?.isGizmo) continue;
            if (obj.type === "TransformControlsPlane" || obj.name.includes("TransformControlsPlane")) continue;

            while (obj) {
                if (this.isGizmo(obj)) return;
                if (obj.userData?.isSelectable && obj.userData?.clipId) {
                    foundClipId = obj.userData.clipId;
                    break;
                }
                obj = obj.parent;
            }
            if (foundClipId) break;
        }

        if (foundClipId) {
            const selectedIds = editorEngine.getSelectedClipIds();
            if (!selectedIds.includes(foundClipId)) {
                editorEngine.selectClip(foundClipId);
            }

            const clipMesh = this.getClipMesh(foundClipId);
            if (clipMesh) {
                this.isDraggingObject = true;
                this.draggedClipId = foundClipId;
                const posObj = this.getPositionObject(clipMesh);
                this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), posObj.position);
                const intersection = new THREE.Vector3();
                this.raycaster.ray.intersectPlane(this.dragPlane, intersection);
                this.dragOffset.subVectors(posObj.position, intersection);
                this.orbitControls.enabled = false;
            }
        } else {
            editorEngine.selectionSystem.deselectAll();
        }
    }

    private onPointerMove(event: PointerEvent) {
        const rect = this.rendererDomElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        if (this.isDraggingObject && this.draggedClipId) {
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersection = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(this.dragPlane, intersection)) {
                const clipMesh = this.getClipMesh(this.draggedClipId);
                if (clipMesh) {
                    const posObj = this.getPositionObject(clipMesh);
                    const newPos = intersection.add(this.dragOffset);
                    posObj.position.x = newPos.x;
                    posObj.position.y = newPos.y;
                    this.syncTransformToClip();
                    this.onTransformChanged();
                }
            }
            this.rendererDomElement.style.cursor = "move";
            return;
        }

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        let foundSelectable = false;
        for (const intersect of intersects) {
            let obj: THREE.Object3D | null = intersect.object;
            while (obj) {
                if (obj.userData?.isSelectable) { foundSelectable = true; break; }
                obj = obj.parent;
            }
            if (foundSelectable) break;
        }
        this.rendererDomElement.style.cursor = foundSelectable ? "move" : "default";
    }

    private onPointerUp() {
        if (this.isDraggingObject) {
            this.isDraggingObject = false;
            this.draggedClipId = null;
            this.orbitControls.enabled = true;
        }
    }

    private syncTransformToClip() {
        const clipId = this.draggedClipId || editorEngine.getSelectedClipIds()[0];
        if (!clipId) return;

        const clipMesh = this.getClipMesh(clipId);
        if (!clipMesh) return;

        const posObj  = this.getPositionObject(clipMesh);
        const scaleObj = this.getScaleObject(clipMesh);

        const position = { x: posObj.position.x, y: posObj.position.y, z: posObj.position.z };
        const rotation = { 
            x: THREE.MathUtils.radToDeg(posObj.rotation.x), 
            y: THREE.MathUtils.radToDeg(posObj.rotation.y), 
            z: THREE.MathUtils.radToDeg(posObj.rotation.z) 
        };

        const baseScale = (clipMesh.userData.baseScale as THREE.Vector3) ?? new THREE.Vector3(1, 1, 1);
        const scale = {
            x: scaleObj.scale.x / baseScale.x,
            y: scaleObj.scale.y / baseScale.y,
            z: scaleObj.scale.z / baseScale.z,
        };

        const clip = editorEngine.timelineSystem.getClip(clipId);
        if (clip) {
            editorEngine.updateClip(clipId, { data: { ...clip.data, position, rotation, scale } });
        }
    }
}
