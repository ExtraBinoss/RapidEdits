import * as THREE from "three";
import { editorEngine } from "../../EditorEngine";
import { TransformControls } from "three-stdlib";

export class ThreeSelectionManager {
    private scene: THREE.Scene;
    private transformControls: TransformControls | null = null;
    private selectionHelper: THREE.Line | null = null;
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

    // Called every frame
    public update() {
        const selectedIds = editorEngine.getSelectedClipIds();
        if (selectedIds.length === 0) {
            this.clearHelper();
            return;
        }

        // Find the "primary" visible mesh (same logic as GizmoManager)
        let clipMesh: THREE.Object3D | undefined;
        for (let i = selectedIds.length - 1; i >= 0; i--) {
            const mesh = this.getClipMesh(selectedIds[i]);
            if (mesh) {
                clipMesh = mesh;
                break;
            }
        }

        if (!clipMesh) { this.clearHelper(); return; }

        // Ensure matrix is up to date for accurate world box
        clipMesh.updateMatrixWorld(true);

        // Compute world box — works for any object type
        const box = new THREE.Box3().setFromObject(clipMesh);
        if (box.isEmpty()) { this.clearHelper(); return; }

        const key = [
            box.min.x.toFixed(1), box.min.y.toFixed(1),
            box.max.x.toFixed(1), box.max.y.toFixed(1),
        ].join(",");

        if (key !== this.lastBoxKey) {
            this.lastBoxKey = key;
            this.rebuildHelper(box);
            // Must sync immediately after rebuild to set position/rotation
            this.syncHelper(clipMesh, box);
        } else {
            // Just re-position (rotation may have changed)
            this.syncHelper(clipMesh, box);
        }
    }

    // Called when selection changes
    public updateSelectionGizmo() {
        if (!this.transformControls) return;

        const selectedIds = editorEngine.getSelectedClipIds();
        if (selectedIds.length === 0) {
            this.clearAll();
            return;
        }

        // Find the "primary" visible mesh
        let clipMesh: THREE.Object3D | undefined;
        for (let i = selectedIds.length - 1; i >= 0; i--) {
            const mesh = this.getClipMesh(selectedIds[i]);
            if (mesh) {
                clipMesh = mesh;
                break;
            }
        }

        if (!clipMesh) { this.clearAll(); return; }

        // Attach TransformControls to the clip object
        this.transformControls.attach(clipMesh);

        // Force rebuild
        this.lastBoxKey = "";
        this.update();
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    private clearHelper() {
        if (this.selectionHelper) {
            this.scene.remove(this.selectionHelper);
            this.selectionHelper.geometry.dispose();
            (this.selectionHelper.material as THREE.Material).dispose();
            this.selectionHelper = null;
            this.lastBoxKey = "";
        }
    }

    private clearAll() {
        this.clearHelper();
        if (this.transformControls) this.transformControls.detach();
    }

    private rebuildHelper(box: THREE.Box3) {
        this.clearHelper();

        const size = new THREE.Vector3();
        box.getSize(size);
        const pad = Math.max(4, Math.min(size.x, size.y) * 0.01);
        const w = size.x + pad * 2;
        const h = size.y + pad * 2;
        const r = Math.max(2, Math.min(w, h) * 0.04);

        // Rounded rect path in LOCAL space (centered at 0,0)
        const shape = new THREE.Shape();
        const x = -w / 2, y = -h / 2;
        shape.moveTo(x, y + r);
        shape.lineTo(x, y + h - r);
        shape.quadraticCurveTo(x, y + h, x + r, y + h);
        shape.lineTo(x + w - r, y + h);
        shape.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
        shape.lineTo(x + w, y + r);
        shape.quadraticCurveTo(x + w, y, x + w - r, y);
        shape.lineTo(x + r, y);
        shape.quadraticCurveTo(x, y, x, y + r);

        const geo = new THREE.BufferGeometry().setFromPoints(shape.getPoints(16));
        const mat = new THREE.LineDashedMaterial({
            color: 0x4facfe,
            dashSize: 6, gapSize: 3,
            depthTest: false, depthWrite: false,
            transparent: true, opacity: 0.95,
        });
        this.selectionHelper = new THREE.Line(geo, mat);
        this.selectionHelper.renderOrder = 999999;
        this.selectionHelper.computeLineDistances();
        this.selectionHelper.userData.isGizmo = true;
        this.scene.add(this.selectionHelper);
    }

    private syncHelper(clipMesh: THREE.Object3D, box: THREE.Box3) {
        if (!this.selectionHelper) return;

        // Center of world box
        const center = new THREE.Vector3();
        box.getCenter(center);
        this.selectionHelper.position.set(center.x, center.y, center.z + 1);

        // Mirror the clip's Z rotation only
        const euler = new THREE.Euler().setFromRotationMatrix(clipMesh.matrixWorld, "XYZ");
        this.selectionHelper.rotation.set(0, 0, euler.z);
        this.selectionHelper.scale.set(1, 1, 1);
    }
}
