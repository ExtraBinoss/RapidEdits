import * as THREE from "three";
import { editorEngine } from "../../EditorEngine";

export interface ScreenRect {
    x: number;       // left px (relative to canvas)
    y: number;       // top px (relative to canvas)
    width: number;
    height: number;
    rotation: number; // Z rotation in radians
}

/**
 * KISS: every frame, gets the selected clip's world AABB via Box3.setFromObject(),
 * projects the 4 corners to canvas pixels, returns a ScreenRect for the CSS overlay.
 */
export class ThreeGizmoManager {
    private camera: THREE.OrthographicCamera;
    private rendererDomElement: HTMLCanvasElement;
    private getClipMesh: (clipId: string) => THREE.Object3D | undefined;

    private _lastRect: ScreenRect | null = null;

    constructor(
        camera: THREE.OrthographicCamera,
        rendererDomElement: HTMLCanvasElement,
        getClipMesh: (clipId: string) => THREE.Object3D | undefined,
    ) {
        this.camera = camera;
        this.rendererDomElement = rendererDomElement;
        this.getClipMesh = getClipMesh;
    }

    public update() {
        const selectedIds = editorEngine.getSelectedClipIds();
        
        if (selectedIds.length === 0) {
            if (this._lastRect) {
                console.log("[GizmoManager] Selection empty, clearing rect");
                this._lastRect = null;
            }
            return;
        }

        // KISS: Find the last selected clip that actually has a visible mesh
        let clipId: string | null = null;
        let clipMesh: THREE.Object3D | undefined;

        for (let i = selectedIds.length - 1; i >= 0; i--) {
            const id = selectedIds[i];
            const mesh = this.getClipMesh(id);
            if (mesh) {
                clipId = id;
                clipMesh = mesh;
                break;
            }
        }

        if (!clipId || !clipMesh) {
            if (this._lastRect) {
                console.log("[GizmoManager] No visible mesh found for any selected clip, clearing rect");
                this._lastRect = null;
            }
            return;
        }

        clipMesh.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(clipMesh);
        if (box.isEmpty()) { 
            console.warn("[GizmoManager] Box is empty for:", clipId);
            this._lastRect = null; 
            return; 
        }

        const cw = this.rendererDomElement.clientWidth;
        const ch = this.rendererDomElement.clientHeight;

        // Project all 8 corners of the 3D AABB to be safe
        const points = [
            new THREE.Vector3(box.min.x, box.min.y, box.min.z),
            new THREE.Vector3(box.max.x, box.min.y, box.min.z),
            new THREE.Vector3(box.min.x, box.max.y, box.min.z),
            new THREE.Vector3(box.max.x, box.max.y, box.min.z),
            new THREE.Vector3(box.min.x, box.min.y, box.max.z),
            new THREE.Vector3(box.max.x, box.min.y, box.max.z),
            new THREE.Vector3(box.min.x, box.max.y, box.max.z),
            new THREE.Vector3(box.max.x, box.max.y, box.max.z),
        ];

        const corners = points.map(p => {
            const ndc = p.project(this.camera);
            return {
                x: (ndc.x * 0.5 + 0.5) * cw,
                y: (1 - (ndc.y * 0.5 + 0.5)) * ch,
            };
        });

        const minX = Math.min(...corners.map(c => c.x));
        const minY = Math.min(...corners.map(c => c.y));
        const maxX = Math.max(...corners.map(c => c.x));
        const maxY = Math.max(...corners.map(c => c.y));

        const euler = new THREE.Euler().setFromRotationMatrix(clipMesh.matrixWorld, "XYZ");

        const rect = {
            x: minX, y: minY,
            width: maxX - minX, height: maxY - minY,
            rotation: euler.z,
        };

        // Debug Log (throttled or once)
        if (!this._lastRect || Math.abs(this._lastRect.width - rect.width) > 1) {
            console.log("[GizmoManager] Updated rect:", rect);
        }
        
        this._lastRect = rect;
    }

    public getScreenRect(): ScreenRect | null {
        return this._lastRect;
    }
}
