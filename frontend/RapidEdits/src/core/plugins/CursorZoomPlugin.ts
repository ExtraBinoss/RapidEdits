import * as THREE from "three";
import { BasePlugin } from "./PluginInterface";
import type { Clip } from "../../types/Timeline";
import type { PluginPropertyDefinition } from "./PluginTypes";
import type { RecordedCursorPoint } from "../../types/Recording";

export class CursorZoomPlugin extends BasePlugin {
    id = "effects.cursor_zoom";
    name = "Cursor & Smooth Zoom";
    type = "effect" as const;

    private textures: Map<string, THREE.Texture> = new Map();
    private isInitialized: boolean = false;

    properties: PluginPropertyDefinition[] = [
        { label: "Cursor Scale", key: "cursorScale", type: "slider", props: { min: 0.1, max: 3.0, step: 0.1 }, defaultValue: 1.0 },
        { label: "Smooth Zoom", key: "smoothZoom", type: "boolean", defaultValue: true },
        { label: "Zoom Intensity", key: "zoomIntensity", type: "slider", props: { min: 0, max: 1.0, step: 0.05 }, defaultValue: 0.3 },
        { label: "Zoom Duration", key: "zoomDuration", type: "slider", props: { min: 0.1, max: 2.0, step: 0.1 }, defaultValue: 0.4 },
        { label: "Debug Mode", key: "debug", type: "boolean", defaultValue: false }
    ];

    override async init() {
        if (this.isInitialized) return;
        const loader = new THREE.TextureLoader();
        const cursorNames = [
            "beachball", "busy", "cell", "contextualmenu", "copy", "cross", "default",
            "handgrabbing", "handopen", "handpointing", "help", "makealias", "move",
            "notallowed", "poof", "resize northsouth", "resizedown", "resizeeast",
            "resizeleft", "resizeleftright", "resizenorth", "resizenortheast",
            "resizenortheastsouthwest", "resizenorthsouth", "resizenorthwest",
            "resizenorthwestsoutheast", "resizeright", "resizesouth", "resizesoutheast",
            "resizesouthwest", "resizeup", "resizeupdown", "resizewest", "resizewesteast",
            "screenshotselection", "screenshotwindow", "textcursor", "textcursorvertical",
            "zoomin", "zoomout"
        ];
        
        console.log(`[CursorZoomPlugin] Starting texture loading for ${cursorNames.length} cursors...`);

        const results = await Promise.allSettled(cursorNames.map(async (name) => {
            const fileName = name.includes(' ') ? encodeURIComponent(name) : name;
            const url = `/macOsCursors/${fileName}.svg`;
            const tex = await loader.loadAsync(url);
            tex.colorSpace = THREE.SRGBColorSpace;
            this.textures.set(name, tex);
            return name;
        }));

        const successCount = results.filter(r => r.status === 'fulfilled').length;
        console.log(`[CursorZoomPlugin] Loaded ${successCount}/${cursorNames.length} cursor textures.`);
        this.isInitialized = true;
    }

    createData() {
        return {
            enabled: true,
            cursorScale: 1.0,
            smoothZoom: true,
            zoomIntensity: 0.3,
            zoomDuration: 0.4,
            recordedData: [] as RecordedCursorPoint[]
        };
    }

    override render(_clip: Clip): THREE.Object3D | null {
        // We create a persistent group and mesh. 
        // Initial texture might be null but update() will fix it.
        const geometry = new THREE.PlaneGeometry(32, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = "cursor_mesh";
        mesh.renderOrder = 99999;
        
        const group = new THREE.Group();
        group.name = "cursor_group";
        group.add(mesh);
        return group;
    }

    apply(
        clip: Clip,
        targets: THREE.Object3D[],
        time: number,
        _totalTime: number,
    ): void {
        const data = clip.data;
        if (!data || !data.enabled || !data.recordedData || data.recordedData.length === 0) return;

        const timeMs = time * 1000;
        const points = data.recordedData as RecordedCursorPoint[];
        
        if (data.smoothZoom) {
            const durationMs = (data.zoomDuration || 0.4) * 1000;
            const recentClick = points.find((p) => 
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
                
                targetX = (recentClick.x / recentClick.screenWidth) * 2 - 1;
                targetY = -(recentClick.y / recentClick.screenHeight) * 2 + 1;
            }

            targets.forEach(target => {
                if (target.name === "cursor_group" || target.name === "cursor_mesh") return;
                
                // Use baseScale if available to avoid resetting to 1x1
                const baseScale = target.userData.baseScale as THREE.Vector3 || new THREE.Vector3(1, 1, 1);
                target.scale.set(baseScale.x * zoom, baseScale.y * zoom, 1);

                if (recentClick) {
                    // Coordinates in our Three workspace are based on 1920x1080 if using default size
                    // We need to move the target in the opposite direction of the click to keep it centered
                    target.position.x = -targetX * (zoom - 1) * 960;
                    target.position.y = -targetY * (zoom - 1) * 540;
                } else {
                    const basePos = target.userData.basePosition as THREE.Vector3 || new THREE.Vector3(0, 0, 0);
                    target.position.x = basePos.x;
                    target.position.y = basePos.y;
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

        if (data.debug && Math.random() < 0.01) {
            console.log(`[CursorZoomPlugin] Update active. Points: ${data.recordedData.length}, Time: ${time.toFixed(2)}`);
        }

        object.visible = true;
        
        const cursorMesh = object.name === "cursor_mesh" 
            ? object as THREE.Mesh 
            : (object.children.find(c => c.name === "cursor_mesh") as THREE.Mesh);
            
        if (!cursorMesh) {
            if (data.debug && Math.random() < 0.01) console.warn("[CursorZoomPlugin] cursor_mesh not found!");
            return;
        }

        const timeMs = time * 1000;
        const points = data.recordedData as RecordedCursorPoint[];
        
        if (points.length === 0) return;

        let point: RecordedCursorPoint = points[0]!;
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            if (p && p.t <= timeMs) {
                point = p;
            } else if (p && p.t > timeMs) {
                break;
            }
        }

        if (!point) return;

        if (this.isInitialized) {
            const type = point.type || 'default';
            const tex = this.textures.get(type) || this.textures.get('default');
            const material = cursorMesh.material as THREE.MeshBasicMaterial;
            
            if (tex && material.map !== tex) {
                material.map = tex;
                material.needsUpdate = true;
            }
        } else if (data.debug && Math.random() < 0.01) {
            console.log("[CursorZoomPlugin] Waiting for texture initialization...");
        }

        // Normalize using recorded screen size
        const posX = (point.x / point.screenWidth) * 2 - 1;
        const posY = -(point.y / point.screenHeight) * 2 + 1;
        const feedback = point.isClick ? 0.8 : 1.0;

        object.position.x = posX * 960;
        object.position.y = posY * 540;
        
        cursorMesh.scale.set((data.cursorScale || 1.0) * feedback, (data.cursorScale || 1.0) * feedback, 1);
        
        if (data.debug && Math.random() < 0.05) {
            const mat = cursorMesh.material as THREE.MeshBasicMaterial;
            console.log(`[CursorZoomPlugin] Pos: ${object.position.x.toFixed(0)},${object.position.y.toFixed(0)} | Scale: ${cursorMesh.scale.x.toFixed(2)} | Texture: ${mat.map ? 'Ready' : 'Missing'}`);
        }
    }
}
