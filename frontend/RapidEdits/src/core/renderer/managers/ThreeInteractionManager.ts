import * as THREE from "three";
import { OrbitControls, TransformControls } from "three-stdlib";
import { editorEngine } from "../../EditorEngine";
import { globalEventBus } from "../../events/EventBus";

export class ThreeInteractionManager {
    private camera: THREE.OrthographicCamera;
    private scene: THREE.Scene;
    private rendererDomElement: HTMLCanvasElement;

    // Controls
    public orbitControls: OrbitControls;
    public transformControls: TransformControls;

    // State
    private mouse: THREE.Vector2 = new THREE.Vector2();
    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private isInteracting: boolean = false;

    // Drag State
    private isDraggingObject: boolean = false;
    private dragPlane: THREE.Plane = new THREE.Plane();
    private dragOffset: THREE.Vector3 = new THREE.Vector3();

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

        // Init Controls
        this.orbitControls = new OrbitControls(
            this.camera,
            this.rendererDomElement,
        );
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.05;
        this.orbitControls.screenSpacePanning = true;
        this.orbitControls.enableRotate = false; // Lock to 2D view
        this.orbitControls.enabled = true;

        this.transformControls = new TransformControls(
            this.camera,
            this.rendererDomElement,
        );
        this.scene.add(this.transformControls);

        this.setupEventListeners();
    }

    private setupEventListeners() {
        (this.transformControls as any).addEventListener(
            "dragging-changed",
            (event: any) => {
                const isDragging = event.value as boolean;
                this.orbitControls.enabled = !isDragging;
                this.isInteracting = isDragging;
            },
        );

        (this.transformControls as any).addEventListener("change", () => {
            if (this.isInteracting) {
                this.syncTransformToClip();
            }
        });

        this.rendererDomElement.addEventListener(
            "pointerdown",
            this.onPointerDown.bind(this),
        );
        this.rendererDomElement.addEventListener(
            "pointermove",
            this.onPointerMove.bind(this),
        );
        this.rendererDomElement.addEventListener(
            "pointerup",
            this.onPointerUp.bind(this),
        );

        globalEventBus.on("SELECTION_CHANGED", () => {
            this.onSelectionChanged();
        });
    }

    public update() {
        this.orbitControls.update();
    }

    public dispose() {
        this.orbitControls.dispose();
        this.transformControls.dispose();
        // Remove event listeners if needed (though often fine if class is forgotten)
    }

    private onPointerDown(event: PointerEvent) {
        if (this.isInteracting) return;

        const rect = this.rendererDomElement.getBoundingClientRect();
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
                if (this.isGizmo(obj)) {
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

            // Initiate Drag
            if (foundObject) {
                this.isDraggingObject = true;
                this.dragPlane.setFromNormalAndCoplanarPoint(
                    new THREE.Vector3(0, 0, 1),
                    foundObject.position,
                );

                const intersection = new THREE.Vector3();
                this.raycaster.ray.intersectPlane(this.dragPlane, intersection);
                this.dragOffset.subVectors(foundObject.position, intersection);

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

        if (this.isDraggingObject) {
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersection = new THREE.Vector3();
            if (
                this.raycaster.ray.intersectPlane(this.dragPlane, intersection)
            ) {
                const selectedIds = editorEngine.getSelectedClipIds();
                if (selectedIds.length === 1) {
                    const clipId = selectedIds[0];
                    if (clipId) {
                        const objGroup = this.getClipMesh(clipId);
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

                            this.syncTransformToClip();
                            this.onTransformChanged(); // Trigger gizmo update
                        }
                    }
                }
            }
            this.rendererDomElement.style.cursor = "move";
            return;
        }

        // Hover Logic
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(
            this.scene.children,
            true,
        );

        let foundSelectable = false;

        for (const intersect of intersects) {
            let obj: THREE.Object3D | null = intersect.object;
            if (this.isSelectionHelper(obj) || this.isGizmo(obj)) continue;

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
            if (
                intersects.some(
                    (i) =>
                        i.object.userData?.clipId &&
                        selectedIds.includes(i.object.userData.clipId),
                )
            ) {
                this.rendererDomElement.style.cursor = "move";
            } else {
                this.rendererDomElement.style.cursor = "pointer";
            }
        } else {
            this.rendererDomElement.style.cursor = "default";
        }
    }

    private onPointerUp() {
        if (this.isDraggingObject) {
            this.isDraggingObject = false;
            this.orbitControls.enabled = true;
        }
    }

    private syncTransformToClip() {
        if (!this.transformControls || !(this.transformControls as any).object)
            return;

        const object = (this.transformControls as any).object;
        const clipId = object.userData.clipId;
        if (!clipId) return;

        // If we are dragging manually (isDraggingObject), we might not be using TransformControls object,
        // but current logic uses TransformControls 'dragging-changed' for isInteracting.
        // However, 'isDraggingObject' implies we are dragging the mesh directly.
        // We need to support both. Use the selected object.

        // If we are using TransformControls (handles), 'object' is correct.

        // Wait, if we are NOT interacting with gizmo (isInteracting=false) but isDraggingObject=true,
        // we updated 'target.position' in onPointerMove.
        // We need to save that.

        // Actually, let's just get the clip from the engine or the mesh map
        // But here we might not have direct access to map.
        // We used 'getClipMesh' in onPointerMove.

        // Let's rely on 'object' from TransformControls if attached.
        // If not attached, or if we are body-dragging, we need to check the selected clip.

        const selectedIds = editorEngine.getSelectedClipIds();
        if (selectedIds.length !== 1) return;

        const selectedClipId = selectedIds[0];
        if (!selectedClipId) return;

        // The mesh should have been updated in Scene.
        // We need to read from Mesh and write to Clip.

        const mesh = this.getClipMesh(selectedClipId);
        if (!mesh) return;

        // If group, use child
        let actualObj = mesh;
        if (mesh instanceof THREE.Group && mesh.children.length > 0) {
            actualObj = mesh.children[0]!;
        }

        const position = {
            x: actualObj.position.x,
            y: actualObj.position.y,
            z: actualObj.position.z,
        };
        const rotation = {
            x: actualObj.rotation.x,
            y: actualObj.rotation.y,
            z: actualObj.rotation.z,
        };
        const scale = {
            x: actualObj.scale.x,
            y: actualObj.scale.y,
            z: actualObj.scale.z,
        };

        const clip = editorEngine.timelineSystem.getClip(selectedClipId);
        if (clip) {
            editorEngine.updateClip(selectedClipId, {
                data: { ...clip.data, position, rotation, scale },
            });
        }
    }

    private isGizmo(obj: THREE.Object3D): boolean {
        return (
            this.transformControls &&
            (obj.uuid ===
                (this.transformControls as unknown as THREE.Object3D).uuid ||
                (
                    this.transformControls as unknown as THREE.Object3D
                ).children?.some((c) => c.uuid === obj?.uuid))
        );
    }

    // Quick hack to identify selection helper if passed down or we check vaguely
    // Ideally we should pass exclusion list
    private isSelectionHelper(_obj: THREE.Object3D): boolean {
        // We don't have reference to selectionHelper here directly unless we pass it.
        // But usually it's LineDashedMaterial.
        // Better way: use userData
        return false; // For now
    }
}
