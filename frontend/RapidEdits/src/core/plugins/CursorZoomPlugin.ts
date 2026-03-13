import * as THREE from "three";
import { BasePlugin } from "./PluginInterface";
import type { Clip } from "../../types/Timeline";

export class CursorZoomPlugin extends BasePlugin {
    id = "effects.cursor_zoom";
    name = "Cursor & Smooth Zoom";
    type = "transition" as const;

    private cursorTexture: THREE.Texture | null = null;

    override async init() {
        const loader = new THREE.TextureLoader();
        this.cursorTexture = await loader.loadAsync("/src/assets/cursors/mac-pointer.svg");
    }

    createData() {
        return {
            enabled: true,
            cursorScale: 1.0,
            smoothZoom: true,
            zoomIntensity: 0.3,
            zoomDuration: 0.4,
            recordedData: [] as any[]
        };
    }

    override render(_clip: Clip): THREE.Object3D | null {
        if (!this.cursorTexture) return null;
        const geometry = new THREE.PlaneGeometry(32, 32);
        const material = new THREE.MeshBasicMaterial({
            map: this.cursorTexture,
            transparent: true,
            depthTest: false,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = "cursor";
        mesh.renderOrder = 999;
        const group = new THREE.Group();
        group.add(mesh);
        return group;
    }

    apply(
        clip: Clip,
        targets: THREE.Object3D[],
        _progress: number,
        time: number,
    ): void {
        const data = clip.data;
        if (!data || !data.enabled || !data.recordedData || data.recordedData.length === 0) return;

        const timeMs = (time - clip.start) * 1000;
        const points = data.recordedData;
        
        if (data.smoothZoom) {
            const durationMs = (data.zoomDuration || 0.4) * 1000;
            const recentClick = points.find((p: any) => 
                p.isClick && 
                p.t <= timeMs && 
                timeMs <= p.t + durationMs
            );

            let zoom = 1.0;
            let targetX = 0;
            let targetY = 0;

            if (recentClick) {
                const elapsed = timeMs - recentClick.t;
                const p = elapsed / durationMs;
                const ease = Math.sin(p * Math.PI); 
                zoom = 1.0 + (ease * (data.zoomIntensity || 0.3));
                targetX = (recentClick.x / 1920) * 2 - 1;
                targetY = -(recentClick.y / 1080) * 2 + 1;
            }

            targets.forEach(target => {
                if (target.name === "cursor" || target.children.some(c => c.name === "cursor")) return;
                target.scale.set(zoom, zoom, 1);
                if (recentClick) {
                    target.position.x -= targetX * (zoom - 1) * 500;
                    target.position.y -= targetY * (zoom - 1) * 500;
                }
            });
        }
    }

    override update(
        object: THREE.Object3D,
        clip: Clip,
        time: number,
        _frameDuration: number,
    ) {
        const data = clip.data;
        if (!data || !data.enabled || !data.recordedData || data.recordedData.length === 0) {
            object.visible = false;
            return;
        }

        object.visible = true;
        const cursorMesh = object.children[0] as THREE.Mesh;
        const timeMs = time * 1000;
        const points = data.recordedData;
        
        let point = points[0];
        for (let i = 0; i < points.length; i++) {
            if (points[i].t <= timeMs) {
                point = points[i];
            } else {
                break;
            }
        }

        const posX = (point.x / 1920) * 2 - 1;
        const posY = -(point.y / 1080) * 2 + 1;
        const feedback = point.isClick ? 0.8 : 1.0;

        object.position.set(posX * 500, posY * 500, 1000);
        cursorMesh.scale.set((data.cursorScale || 1) * feedback, (data.cursorScale || 1) * feedback, 1);
    }
}
