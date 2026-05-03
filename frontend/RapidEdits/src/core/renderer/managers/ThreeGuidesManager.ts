import * as THREE from "three";

export interface SnapResult {
    snappedX: boolean;
    snappedY: boolean;
    x?: number;
    y?: number;
}

export class ThreeGuidesManager {
    private scene: THREE.Scene;
    private guidesGroup: THREE.Group;
    private lineMaterial: THREE.LineBasicMaterial;
    private dashMaterial: THREE.LineDashedMaterial;
    private textGroup: THREE.Group; 

    private threshold: number = 20; // Increased threshold

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.guidesGroup = new THREE.Group();
        this.guidesGroup.position.z = 1500; // Above most objects
        this.scene.add(this.guidesGroup);

        this.lineMaterial = new THREE.LineBasicMaterial({
            color: 0x4facfe, // Cyan/Blue for alignment
            transparent: true,
            opacity: 0.8,
        });

        this.dashMaterial = new THREE.LineDashedMaterial({
            color: 0xf6ad55, // Orange for distances
            dashSize: 10,
            gapSize: 5,
            transparent: true,
            opacity: 0.8,
        });

        this.textGroup = new THREE.Group();
        this.guidesGroup.add(this.textGroup);
    }

    public clear() {
        while (this.guidesGroup.children.length > 0) {
            const child = this.guidesGroup.children[0]!;
            if (child instanceof THREE.Line) {
                child.geometry.dispose();
            }
            this.guidesGroup.remove(child);
        }
    }

    /**
     * Calculates snap points and draws guides.
     * Returns the snapped position.
     */
    public snap(
        targetPos: THREE.Vector3,
        object: THREE.Object3D,
        allObjects: Map<string, THREE.Object3D>,
        projectWidth: number,
        projectHeight: number,
        excludeId?: string
    ): THREE.Vector3 {
        this.clear();

        const snappedPos = targetPos.clone();
        let snappedX = false;
        let snappedY = false;

        // 1. Get the geometry bounds once. 
        // Force update world matrix to get correct bounds
        object.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(object);
        const size = new THREE.Vector3();
        bounds.getSize(size);
        const currentCenter = new THREE.Vector3();
        bounds.getCenter(currentCenter);
        
        const centerOffset = new THREE.Vector3().subVectors(currentCenter, object.position);
        
        const halfW = size.x / 2;
        const halfH = size.y / 2;

        const snapPointsX: { val: number; type: 'center' | 'edge'; source: string }[] = [
            { val: 0, type: 'center', source: 'canvas' },
            { val: -projectWidth / 2, type: 'edge', source: 'canvas' },
            { val: projectWidth / 2, type: 'edge', source: 'canvas' },
        ];

        const snapPointsY: { val: number; type: 'center' | 'edge'; source: string }[] = [
            { val: 0, type: 'center', source: 'canvas' },
            { val: -projectHeight / 2, type: 'edge', source: 'canvas' },
            { val: projectHeight / 2, type: 'edge', source: 'canvas' },
        ];

        // Add other objects' bounds
        allObjects.forEach((other, id) => {
            if (id === excludeId) return;
            
            const otherBounds = new THREE.Box3().setFromObject(other);
            const otherCenter = new THREE.Vector3();
            otherBounds.getCenter(otherCenter);
            const otherSize = new THREE.Vector3();
            otherBounds.getSize(otherSize);

            snapPointsX.push({ val: otherCenter.x, type: 'center', source: id });
            snapPointsX.push({ val: otherCenter.x - otherSize.x / 2, type: 'edge', source: id });
            snapPointsX.push({ val: otherCenter.x + otherSize.x / 2, type: 'edge', source: id });

            snapPointsY.push({ val: otherCenter.y, type: 'center', source: id });
            snapPointsY.push({ val: otherCenter.y - otherSize.y / 2, type: 'edge', source: id });
            snapPointsY.push({ val: otherCenter.y + otherSize.y / 2, type: 'edge', source: id });
        });

        // X Snapping
        let bestDiffX = this.threshold;
        let snapXVal = 0;

        for (const pt of snapPointsX) {
            // Target Center (snappedPos.x + centerOffset.x) to point
            const dCenter = Math.abs((snappedPos.x + centerOffset.x) - pt.val);
            if (dCenter < bestDiffX) {
                bestDiffX = dCenter;
                snapXVal = pt.val;
                snappedPos.x = pt.val - centerOffset.x;
                snappedX = true;
            }
            // Target Left (snappedPos.x + centerOffset.x - halfW) to point
            const dLeft = Math.abs((snappedPos.x + centerOffset.x - halfW) - pt.val);
            if (dLeft < bestDiffX) {
                bestDiffX = dLeft;
                snapXVal = pt.val;
                snappedPos.x = pt.val - centerOffset.x + halfW;
                snappedX = true;
            }
            // Target Right (snappedPos.x + centerOffset.x + halfW) to point
            const dRight = Math.abs((snappedPos.x + centerOffset.x + halfW) - pt.val);
            if (dRight < bestDiffX) {
                bestDiffX = dRight;
                snapXVal = pt.val;
                snappedPos.x = pt.val - centerOffset.x - halfW;
                snappedX = true;
            }
        }
        if (snappedX) this.drawVerticalGuide(snapXVal, projectHeight);

        // Y Snapping
        let bestDiffY = this.threshold;
        let snapYVal = 0;

        for (const pt of snapPointsY) {
            // Target Center to point
            const dCenter = Math.abs((snappedPos.y + centerOffset.y) - pt.val);
            if (dCenter < bestDiffY) {
                bestDiffY = dCenter;
                snapYVal = pt.val;
                snappedPos.y = pt.val - centerOffset.y;
                snappedY = true;
            }
            // Target Bottom to point
            const dBottom = Math.abs((snappedPos.y + centerOffset.y - halfH) - pt.val);
            if (dBottom < bestDiffY) {
                bestDiffY = dBottom;
                snapYVal = pt.val;
                snappedPos.y = pt.val - centerOffset.y + halfH;
                snappedY = true;
            }
            // Target Top to point
            const dTop = Math.abs((snappedPos.y + centerOffset.y + halfH) - pt.val);
            if (dTop < bestDiffY) {
                bestDiffY = dTop;
                snapYVal = pt.val;
                snappedPos.y = pt.val - centerOffset.y - halfH;
                snappedY = true;
            }
        }
        if (snappedY) this.drawHorizontalGuide(snapYVal, projectWidth);

        // Distance visualization
        this.drawDistances(snappedPos, centerOffset, halfW, halfH, allObjects, excludeId);

        return snappedPos;
    }

    private drawDistances(
        snappedPos: THREE.Vector3,
        centerOffset: THREE.Vector3,
        halfW: number,
        halfH: number,
        allObjects: Map<string, THREE.Object3D>,
        excludeId?: string
    ) {
        const objCenter = new THREE.Vector3().addVectors(snappedPos, centerOffset);
        const objMin = new THREE.Vector3(objCenter.x - halfW, objCenter.y - halfH, 0);
        const objMax = new THREE.Vector3(objCenter.x + halfW, objCenter.y + halfH, 0);

        allObjects.forEach((other, id) => {
            if (id === excludeId) return;
            const otherBounds = new THREE.Box3().setFromObject(other);
            const otherCenter = new THREE.Vector3();
            otherBounds.getCenter(otherCenter);

            const threshold = 10;
            if (Math.abs(objCenter.x - otherCenter.x) < threshold) {
                const y1 = objCenter.y > otherCenter.y ? otherBounds.max.y : otherBounds.min.y;
                const y2 = objCenter.y > otherCenter.y ? objMin.y : objMax.y;
                if (Math.abs(y1 - y2) > 2) {
                    this.drawDistanceLine(new THREE.Vector3(objCenter.x, y1, 0), new THREE.Vector3(objCenter.x, y2, 0));
                }
            }
            if (Math.abs(objCenter.y - otherCenter.y) < threshold) {
                const x1 = objCenter.x > otherCenter.x ? otherBounds.max.x : otherBounds.min.x;
                const x2 = objCenter.x > otherCenter.x ? objMin.x : objMax.x;
                if (Math.abs(x1 - x2) > 2) {
                    this.drawDistanceLine(new THREE.Vector3(x1, objCenter.y, 0), new THREE.Vector3(x2, objCenter.y, 0));
                }
            }
        });
    }

    private drawDistanceLine(p1: THREE.Vector3, p2: THREE.Vector3) {
        const points = [p1, p2];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, this.dashMaterial);
        line.computeLineDistances();
        this.guidesGroup.add(line);

        // Ticks at ends
        this.drawTick(p1, p1.x === p2.x ? 'h' : 'v');
        this.drawTick(p2, p1.x === p2.x ? 'h' : 'v');
    }

    private drawTick(p: THREE.Vector3, dir: 'h' | 'v') {
        const size = 10;
        const points = dir === 'h' 
            ? [new THREE.Vector3(p.x - size, p.y, 0), new THREE.Vector3(p.x + size, p.y, 0)]
            : [new THREE.Vector3(p.x, p.y - size, 0), new THREE.Vector3(p.x, p.y + size, 0)];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, this.lineMaterial);
        this.guidesGroup.add(line);
    }

    private drawVerticalGuide(x: number, height: number) {
        const points = [
            new THREE.Vector3(x, -height / 2, 0),
            new THREE.Vector3(x, height / 2, 0),
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, this.lineMaterial);
        this.guidesGroup.add(line);
    }

    private drawHorizontalGuide(y: number, width: number) {
        const points = [
            new THREE.Vector3(-width / 2, y, 0),
            new THREE.Vector3(width / 2, y, 0),
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, this.lineMaterial);
        this.guidesGroup.add(line);
    }

    public dispose() {
        this.clear();
        this.scene.remove(this.guidesGroup);
        this.lineMaterial.dispose();
    }
}
