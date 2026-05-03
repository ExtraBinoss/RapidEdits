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

    private lastWidth = 0;
    private lastHeight = 0;

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

                        // Check if bounds changed
                        const box = new THREE.Box3().setFromObject(target);
                        const width = box.max.x - box.min.x;
                        const height = box.max.y - box.min.y;

                        if (Math.abs(width - this.lastWidth) > 0.1 || Math.abs(height - this.lastHeight) > 0.1) {
                            this.createSelectionHelper(target);
                            return; 
                        }

                        this.syncGizmo(target);
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

        // Get local bounds
        // For Troika or any mesh, we can use the geometry bounding box
        let geometry = (target as any).geometry;
        if (!geometry && target.children.length > 0) {
            geometry = (target.children[0] as any).geometry;
        }
        
        if (!geometry) {
            // Fallback to world box if no geometry found (less accurate for rotation)
            const box = new THREE.Box3().setFromObject(target);
            this.lastWidth = box.max.x - box.min.x;
            this.lastHeight = box.max.y - box.min.y;
        } else {
            if (!geometry.boundingBox) geometry.computeBoundingBox();
            const box = geometry.boundingBox;
            this.lastWidth = box.max.x - box.min.x;
            this.lastHeight = box.max.y - box.min.y;
        }

        const width = this.lastWidth + 10; // Add some padding
        const height = this.lastHeight + 10;
        const radius = Math.max(2, Math.min(width, height) * 0.1);

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

        const points = shape.getPoints(12);
        const bufferGeometry = new THREE.BufferGeometry().setFromPoints(points);

        const material = new THREE.LineDashedMaterial({
            color: 0xffff00,
            dashSize: 4,
            gapSize: 2,
            linewidth: 2,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            opacity: 0.9
        });

        const line = new THREE.Line(bufferGeometry, material);
        line.renderOrder = 999999;
        line.computeLineDistances();
        this.selectionHelper = line;

        this.scene.add(this.selectionHelper);

        // Initial sync
        this.syncGizmo(target);
    }

    private syncGizmo(target: THREE.Object3D) {
        if (!this.selectionHelper) return;
        
        // Calculate the offset if the geometry isn't centered on local 0,0,0
        let geometry = (target as any).geometry;
        if (!geometry && target.children.length > 0) geometry = (target.children[0] as any).geometry;
        
        const centerOffset = new THREE.Vector3();
        if (geometry && geometry.boundingBox) {
            geometry.boundingBox.getCenter(centerOffset);
        }
        
        // Apply target transform + local offset
        this.selectionHelper.position.copy(centerOffset).applyMatrix4(target.matrixWorld);
        this.selectionHelper.position.z += 1;
        this.selectionHelper.rotation.copy(target.rotation);
        this.selectionHelper.scale.copy(target.scale);
    }
}
