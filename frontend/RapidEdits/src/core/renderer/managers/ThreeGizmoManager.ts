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
 * Gets the screen-space rect for the selected clip.
 * Supports rotation by projecting local corners and computing the unrotated dimensions.
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
            this._lastRect = null;
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

        if (!clipMesh) {
            this._lastRect = null;
            return;
        }

        clipMesh.updateMatrixWorld(true);

        // 1. Get the screen-space center
        const worldCenter = new THREE.Vector3();
        clipMesh.getWorldPosition(worldCenter);
        const screenCenter = worldCenter.clone().project(this.camera);

        const cw = this.rendererDomElement.clientWidth;
        const ch = this.rendererDomElement.clientHeight;

        const centerX = (screenCenter.x * 0.5 + 0.5) * cw;
        const centerY = (1 - (screenCenter.y * 0.5 + 0.5)) * ch;

        // 2. Extract rotation directly from matrix columns (more robust for non-uniform scale)
        const te = clipMesh.matrixWorld.elements;
        // The angle of the local X axis (Col 0) in world space
        // We use Math.atan2(y, x)
        const rotationZ = Math.atan2(te[1], te[0]);

        // 3. Get the logical size in world units by projecting unrotated local axes
        // We create a temporary matrix that has the same scale but NO rotation
        const worldScale = new THREE.Vector3();
        clipMesh.getWorldScale(worldScale);
        
        // Project a horizontal and vertical segment of the object's size
        const halfW = worldScale.x / 2;
        const halfH = worldScale.y / 2;

        // We project two points that represent the "width" axis in screen space
        // but we do it WITHOUT the rotation to get the base pixel size.
        // Actually, projecting WITH rotation and taking the length is correct 
        // because an Orthographic camera doesn't distort lengths during rotation.
        const rightPoint = new THREE.Vector3(0.5, 0, 0).applyMatrix4(clipMesh.matrixWorld);
        const topPoint = new THREE.Vector3(0, 0.5, 0).applyMatrix4(clipMesh.matrixWorld);
        
        const projCenter = worldCenter.clone().project(this.camera);
        const projRight = rightPoint.project(this.camera);
        const projTop = topPoint.project(this.camera);

        // Pixel distance from center to edge
        const pixelWidthHalf = Math.sqrt(
            Math.pow((projRight.x - projCenter.x) * cw * 0.5, 2) + 
            Math.pow((projRight.y - projCenter.y) * ch * 0.5, 2)
        );
        const pixelHeightHalf = Math.sqrt(
            Math.pow((projTop.x - projCenter.x) * cw * 0.5, 2) + 
            Math.pow((projTop.y - projCenter.y) * ch * 0.5, 2)
        );

        this._lastRect = {
            x: centerX - pixelWidthHalf,
            y: centerY - pixelHeightHalf,
            width: pixelWidthHalf * 2,
            height: pixelHeightHalf * 2,
            rotation: -rotationZ, // Negate for CSS
        };
    }

    public getScreenRect(): ScreenRect | null {
        return this._lastRect;
    }
}
