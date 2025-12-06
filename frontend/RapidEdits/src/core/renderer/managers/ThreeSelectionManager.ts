import * as THREE from "three";
import { editorEngine } from "../../EditorEngine";
import { TransformControls } from "three-stdlib";

export class ThreeSelectionManager {
    private scene: THREE.Scene;
    private transformControls: TransformControls | null = null;
    private selectionHelper: THREE.Object3D | null = null;
    private getClipMesh: (clipId: string) => THREE.Object3D | undefined;

    constructor(
        scene: THREE.Scene,
        transformControls: TransformControls | null,
        getClipMesh: (clipId: string) => THREE.Object3D | undefined,
    ) {
        this.scene = scene;
        this.transformControls = transformControls;
        this.getClipMesh = getClipMesh;
    }

    public setTransformControls(controls: TransformControls) {
        this.transformControls = controls;
    }

    public update() {
        if (this.selectionHelper) {
            const selectedIds = editorEngine.getSelectedClipIds();
            if (selectedIds.length === 1) {
                const clipId = selectedIds[0];
                if (clipId) {
                    const objGroup = this.getClipMesh(clipId);
                    if (objGroup) {
                        let target = objGroup;
                        if (
                            objGroup instanceof THREE.Group &&
                            objGroup.children.length > 0
                        ) {
                            target = objGroup.children[0] as THREE.Object3D;
                        }

                        this.selectionHelper.position.copy(target.position);
                        this.selectionHelper.position.z += 1; // Offset
                        this.selectionHelper.rotation.copy(target.rotation);
                        this.selectionHelper.scale.copy(target.scale);
                    }
                }
            }
        }
    }

    public updateSelectionGizmo() {
        if (!this.transformControls) return;

        const selectedIds = editorEngine.getSelectedClipIds();
        if (selectedIds.length === 1) {
            const clipId = selectedIds[0];
            if (!clipId) return;

            const object = this.getClipMesh(clipId);
            if (object) {
                let target: THREE.Object3D = object;
                if (
                    object instanceof THREE.Group &&
                    object.children.length > 0
                ) {
                    target = object.children[0] as THREE.Object3D;
                }

                this.transformControls.attach(target);

                // Re-create selection helper
                this.createSelectionHelper(target);
            } else {
                this.clearSelection();
            }
        } else {
            this.clearSelection();
        }
    }

    private clearSelection() {
        if (this.transformControls) this.transformControls.detach();
        if (this.selectionHelper) {
            this.scene.remove(this.selectionHelper);
            if ((this.selectionHelper as any).geometry)
                (this.selectionHelper as any).geometry.dispose();
            if ((this.selectionHelper as any).material)
                (this.selectionHelper as any).material.dispose();
            this.selectionHelper = null;
        }
    }

    private createSelectionHelper(target: THREE.Object3D) {
        if (this.selectionHelper) {
            this.scene.remove(this.selectionHelper);
            if ((this.selectionHelper as any).geometry)
                (this.selectionHelper as any).geometry.dispose();
            if ((this.selectionHelper as any).material)
                (this.selectionHelper as any).material.dispose();
            this.selectionHelper = null;
        }

        const box = new THREE.Box3().setFromObject(target);
        // Expand slightly
        box.min.subScalar(5);
        box.max.addScalar(5);

        const width = box.max.x - box.min.x;
        const height = box.max.y - box.min.y;
        const radius = 10;

        // Create Rounded Rect Path
        const shape = new THREE.Shape();
        const x = -width / 2;
        const y = -height / 2;

        shape.moveTo(x, y + radius);
        shape.lineTo(x, y + height - radius);
        shape.quadraticCurveTo(x, y + height, x + radius, y + height);
        shape.lineTo(x + width - radius, y + height);
        shape.quadraticCurveTo(
            x + width,
            y + height,
            x + width,
            y + height - radius,
        );
        shape.lineTo(x + width, y + radius);
        shape.quadraticCurveTo(x + width, y, x + width - radius, y);
        shape.lineTo(x + radius, y);
        shape.quadraticCurveTo(x, y, x, y + radius);

        const points = shape.getPoints();
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        const material = new THREE.LineDashedMaterial({
            color: 0xffff00,
            dashSize: 10,
            gapSize: 5,
            linewidth: 2,
            depthTest: false,
            depthWrite: false,
        });

        const line = new THREE.Line(geometry, material);
        line.renderOrder = 9999; // Ensure it renders on top
        line.computeLineDistances();
        this.selectionHelper = line;

        const center = new THREE.Vector3();
        box.getCenter(center);
        this.selectionHelper.position.copy(center);
        this.selectionHelper.position.z += 1; // Offset to sit on top of object

        this.scene.add(this.selectionHelper);

        // Initial sync
        this.selectionHelper.position.copy(target.position);
        this.selectionHelper.position.z += 1;
        this.selectionHelper.rotation.copy(target.rotation);
        this.selectionHelper.scale.copy(target.scale);
    }
}
