import * as THREE from "three";
import { editorEngine } from "../../EditorEngine";
import { TransformControls } from "three-stdlib";

export class ThreeSelectionManager {
    private scene: THREE.Scene;
    private transformControls: TransformControls | null = null;
    private selectionHelper: THREE.Group | null = null;
    private outlineLine: THREE.Line | null = null;
    private getClipMesh: (clipId: string) => THREE.Object3D | undefined;

    private lastBoxKey = "";

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
        const selectedIds = editorEngine.getSelectedClipIds();
        if (selectedIds.length === 0) {
            this.clearHelper();
            return;
        }

        let clipMesh: THREE.Object3D | undefined;
        for (let i = selectedIds.length - 1; i >= 0; i--) {
            const mesh = this.getClipMesh(selectedIds[i]);
            if (mesh) {
                clipMesh = mesh;
                break;
            }
        }

        if (!clipMesh) { this.clearHelper(); return; }

        clipMesh.updateMatrixWorld(true);

        // Get local bounds
        const localBox = new THREE.Box3();
        const inverseWorld = clipMesh.matrixWorld.clone().invert();
        
        let hasGeometry = false;
        clipMesh.traverse(child => {
            if (child instanceof THREE.Mesh) {
                if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
                if (child.geometry.boundingBox) {
                    const b = child.geometry.boundingBox.clone();
                    b.applyMatrix4(child.matrixWorld.clone().premultiply(inverseWorld));
                    localBox.union(b);
                    hasGeometry = true;
                }
            }
        });

        if (!hasGeometry || localBox.isEmpty()) { 
            localBox.set(new THREE.Vector3(-0.5, -0.5, 0), new THREE.Vector3(0.5, 0.5, 0));
        }

        const key = [
            localBox.min.x.toFixed(1), localBox.min.y.toFixed(1),
            localBox.max.x.toFixed(1), localBox.max.y.toFixed(1),
        ].join(",");

        if (key !== this.lastBoxKey) {
            this.lastBoxKey = key;
            this.rebuildHelper(localBox);
            this.syncHelper(clipMesh, localBox);
        } else {
            this.syncHelper(clipMesh, localBox);
        }
    }

    public updateSelectionGizmo() {
        if (!this.transformControls) return;

        const selectedIds = editorEngine.getSelectedClipIds();
        if (selectedIds.length === 0) {
            this.clearAll();
            return;
        }

        let clipMesh: THREE.Object3D | undefined;
        for (let i = selectedIds.length - 1; i >= 0; i--) {
            const mesh = this.getClipMesh(selectedIds[i]);
            if (mesh) {
                clipMesh = mesh;
                break;
            }
        }

        if (!clipMesh) { this.clearAll(); return; }

        this.transformControls.attach(clipMesh);
        this.lastBoxKey = "";
        this.update();
    }

    private clearHelper() {
        if (this.selectionHelper) {
            this.scene.remove(this.selectionHelper);
            // Clean up children
            this.selectionHelper.traverse(child => {
                if (child instanceof THREE.Line) {
                    child.geometry.dispose();
                    (child.material as THREE.Material).dispose();
                }
            });
            this.selectionHelper = null;
            this.outlineLine = null;
            this.lastBoxKey = "";
        }
    }

    private clearAll() {
        this.clearHelper();
        if (this.transformControls) this.transformControls.detach();
    }

    private rebuildHelper(localBox: THREE.Box3) {
        this.clearHelper();

        this.selectionHelper = new THREE.Group();
        this.selectionHelper.renderOrder = 9999;
        
        const size = new THREE.Vector3();
        localBox.getSize(size);
        const pad = Math.max(0.01, Math.min(size.x, size.y) * 0.02);
        const w = size.x + pad * 2;
        const h = size.y + pad * 2;

        // Simple rectangle path
        const points = [
            new THREE.Vector3(-w/2, -h/2, 0),
            new THREE.Vector3(w/2, -h/2, 0),
            new THREE.Vector3(w/2, h/2, 0),
            new THREE.Vector3(-w/2, h/2, 0),
            new THREE.Vector3(-w/2, -h/2, 0),
        ];

        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({
            color: 0x4facfe,
            depthTest: false,
            transparent: true,
            opacity: 0.8,
        });

        this.outlineLine = new THREE.Line(geo, mat);
        this.outlineLine.frustumCulled = false;
        this.selectionHelper.add(this.outlineLine);

        this.scene.add(this.selectionHelper);
    }

    private syncHelper(clipMesh: THREE.Object3D, localBox: THREE.Box3) {
        if (!this.selectionHelper) return;

        clipMesh.updateMatrixWorld(true);
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        const worldScale = new THREE.Vector3();
        clipMesh.matrixWorld.decompose(worldPos, worldQuat, worldScale);

        const center = new THREE.Vector3();
        localBox.getCenter(center);
        
        this.selectionHelper.position.copy(worldPos);
        this.selectionHelper.quaternion.copy(worldQuat);
        this.selectionHelper.scale.copy(worldScale);
        
        const offset = center.clone().multiply(worldScale).applyQuaternion(worldQuat);
        this.selectionHelper.position.add(offset);
        this.selectionHelper.position.z += 10; // More aggressive Z offset
    }
}
