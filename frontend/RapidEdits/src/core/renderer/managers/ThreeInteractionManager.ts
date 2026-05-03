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
        console.log("[Interaction] PointerDown at", event.clientX, event.clientY);
        if (this.isInteracting) {
            console.log("[Interaction] Interaction in progress, skipping click selection");
            return;
        }

        const rect = this.rendererDomElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        // Increase threshold for easier selection of small lines
        this.raycaster.params.Line.threshold = 10;
        
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        console.log("[Interaction] Raycast intersects count:", intersects.length);

        let foundClipId: string | null = null;

        for (const intersect of intersects) {
            let obj: THREE.Object3D | null = intersect.object;
            
            // 1. Check if we hit the selection helper (the dashed box)
            // We want to "click through" it to hit the actual mesh.
            if (obj.userData?.isGizmo) {
                console.log("[Interaction] Selection helper hit, passing through...");
                continue;
            }

            console.log("[Interaction] Testing hit object:", obj.type, obj.name, obj.userData);

            // 2. Specialized Gizmo check: TransformControls uses internal planes for calculation.
            // We should NOT let these planes block our own selection logic unless a visual handle is hit.
            if (obj.type === "TransformControlsPlane" || obj.name.includes("TransformControlsPlane")) {
                console.log("[Interaction] TransformControls internal plane hit, passing through...");
                continue; 
            }

            while (obj) {
                if (this.isGizmo(obj)) {
                    console.log("[Interaction] TransformControls visual handle hit - letting Three.js handle it");
                    return; // Let TransformControls own the event
                }
                if (obj.userData?.isSelectable && obj.userData?.clipId) {
                    foundClipId = obj.userData.clipId;
                    break;
                }
                obj = obj.parent;
            }
            if (foundClipId) break;
        }

        if (foundClipId) {
            console.log("[Interaction] SUCCESS: Found clip ID:", foundClipId);
            const selectedIds = editorEngine.getSelectedClipIds();
            if (!selectedIds.includes(foundClipId)) {
                editorEngine.selectClip(foundClipId);
            }

            const clipMesh = this.getClipMesh(foundClipId);
            if (clipMesh) {
                this.isDraggingObject = true;
                this.draggedClipId = foundClipId;
                const posObj = this.getPositionObject(clipMesh);
                this.dragPlane.setFromNormalAndCoplanarPoint(
                    new THREE.Vector3(0, 0, 1),
                    posObj.position,
                );
                const intersection = new THREE.Vector3();
                this.raycaster.ray.intersectPlane(this.dragPlane, intersection);
                this.dragOffset.subVectors(posObj.position, intersection);
                this.orbitControls.enabled = false;
                console.log("[Interaction] Dragging started for", foundClipId);
            }
        } else {
            console.log("[Interaction] Nothing selectable hit, deselecting all");
            editorEngine.selectionSystem.deselectAll();
        }
    }
    // ── Pointer Move: drag ────────────────────────────────────────────────────

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
                    
                    console.log("[Interaction] Dragging mesh", this.draggedClipId, "to:", posObj.position.x.toFixed(2), posObj.position.y.toFixed(2));
                    
                    this.syncTransformToClip();
                    this.onTransformChanged();
                } else {
                    console.warn("[Interaction] Dragging, but clip mesh lost for", this.draggedClipId);
                }
            } else {
                console.warn("[Interaction] Dragging, but ray missed plane");
            }
            this.rendererDomElement.style.cursor = "move";
            return;
        }

        // Hover cursor
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

    // ── Pointer Up ────────────────────────────────────────────────────────────

    private onPointerUp() {
        if (this.isDraggingObject) {
            console.log("[Interaction] PointerUp, ending drag for", this.draggedClipId);
            this.isDraggingObject = false;
            this.draggedClipId = null;
            this.orbitControls.enabled = true;
        }
    }

    // ── Sync 3D → clip.data ───────────────────────────────────────────────────

    private syncTransformToClip() {
        const clipId = this.draggedClipId || editorEngine.getSelectedClipIds()[0];
        if (!clipId) return;

        const clipMesh = this.getClipMesh(clipId);
        if (!clipMesh) return;

        const posObj  = this.getPositionObject(clipMesh);
        const scaleObj = this.getScaleObject(clipMesh);

        const position = { x: posObj.position.x, y: posObj.position.y, z: posObj.position.z };
        const rotation = { x: posObj.rotation.x, y: posObj.rotation.y, z: posObj.rotation.z };

        const baseScale = (clipMesh.userData.baseScale as THREE.Vector3) ?? new THREE.Vector3(1, 1, 1);
        const scale = {
            x: scaleObj.scale.x / baseScale.x,
            y: scaleObj.scale.y / baseScale.y,
            z: scaleObj.scale.z / baseScale.z,
        };

        const clip = editorEngine.timelineSystem.getClip(clipId);
        if (clip) {
            console.log("[Interaction] Syncing to clip store:", clipId, { position, scale });
            editorEngine.updateClip(clipId, { data: { ...clip.data, position, rotation, scale } });
        }
    }
}
