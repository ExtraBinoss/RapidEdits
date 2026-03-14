import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { BasePlugin } from "./PluginInterface";
import type { Clip } from "../../types/Timeline";
import type { PluginPropertyDefinition } from "./PluginTypes";
import type { RecordedCursorPoint } from "../../types/Recording";

export class CursorZoomPlugin extends BasePlugin {
    id = "effects.cursor_zoom";
    name = "Cursor & Smooth Zoom";
    type = "effect" as const;

    private cursorGroups: Map<string, THREE.Group> = new Map();
    private isInitialized: boolean = false;

    properties: PluginPropertyDefinition[] = [
        { label: "Cursor Scale", key: "cursorScale", type: "slider", props: { min: 0.1, max: 10.0, step: 0.1 }, defaultValue: 1.0 },
        { label: "Smooth Zoom", key: "smoothZoom", type: "boolean", defaultValue: true },
        { label: "Zoom Intensity", key: "zoomIntensity", type: "slider", props: { min: 0, max: 1.0, step: 0.05 }, defaultValue: 0.3 },
        { label: "Zoom Duration", key: "zoomDuration", type: "slider", props: { min: 0.1, max: 2.0, step: 0.1 }, defaultValue: 0.4 },
        { label: "Mirror X", key: "mirrorX", type: "boolean", defaultValue: false },
        { label: "Invert Y", key: "invertY", type: "boolean", defaultValue: false },
        { label: "Debug Mode", key: "debug", type: "boolean", defaultValue: true }
    ];

    override async init() {
        if (this.isInitialized) return;
        const loader = new SVGLoader();
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
        
        console.log(`[CursorZoomPlugin] Starting SVGLoader for ${cursorNames.length} cursors...`);

        await Promise.allSettled(cursorNames.map(async (name) => {
            const fileName = name.includes(' ') ? encodeURIComponent(name) : name;
            const url = `/macOsCursors/${fileName}.svg`;
            
            try {
                // Pre-process SVG to remove url() references from styles/attributes which crash Three's SVGLoader
                const svgText = await (await fetch(url)).text();
                // Replace any fill="url(...)" with fill="#ffffff" directly in the raw SVG text
                const finalSvgText = svgText.replace(/fill="url\([^)]+\)"/g, 'fill="#dddddd"');
                
                const data = loader.parse(finalSvgText);
                const paths = data.paths;
                const group = new THREE.Group();

                for (let i = 0; i < paths.length; i++) {
                    const path = paths[i];
                    const fillColor = (path as any).userData?.style.fill;
                    
                    if (fillColor !== undefined && fillColor !== 'none') {
                        let finalColor = new THREE.Color().setStyle("#ffffff");
                        if (typeof fillColor === 'string') {
                            if (fillColor.startsWith('url(') || fillColor === 'currentColor' || fillColor === 'inherit') {
                                finalColor = new THREE.Color(0xdddddd); 
                            } else {
                                try {
                                    finalColor = new THREE.Color().setStyle(fillColor);
                                } catch (err) {
                                    // Silent catch
                                }
                            }
                        } else if (typeof fillColor === 'number') {
                            finalColor = new THREE.Color(fillColor);
                        }

                        const material = new THREE.MeshBasicMaterial({
                            color: finalColor,
                            transparent: true,
                            opacity: (path as any).userData?.style.fillOpacity ?? 1,
                            depthWrite: false,
                            side: THREE.DoubleSide
                        });

                        const shapes = SVGLoader.createShapes(path as any);
                        for (let j = 0; j < shapes.length; j++) {
                            const geometry = new THREE.ShapeGeometry(shapes[j]);
                            const mesh = new THREE.Mesh(geometry, material);
                            group.add(mesh);
                        }
                    }
                }

                // Normalization: SVG Y is inverted.
                group.scale.set(0.18, -0.18, 1); 
                this.cursorGroups.set(name, group);
            } catch (e) {
                console.error(`[CursorZoomPlugin] Failed to load SVG: ${name}`, e);
            }
        }));

        this.isInitialized = true;
    }

    createData() {
        return {
            enabled: true,
            cursorScale: 1.0,
            smoothZoom: true,
            zoomIntensity: 0.3,
            zoomDuration: 0.4,
            mirrorX: false,
            invertY: false,
            debug: true,
            recordedData: [] as RecordedCursorPoint[]
        };
    }

    override render(_clip: Clip): THREE.Object3D | null {
        const group = new THREE.Group();
        group.name = "cursor_group";
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
                
                if (data.mirrorX) targetX = -targetX;
                if (data.invertY) targetY = -targetY;
            }

            targets.forEach(target => {
                const isCursor = target.name === "cursor_group" || target.name === "cursor_mesh";
                
                // For zooming videos/images, we want to zoom related to their actual size, 
                // but move them relative to the viewport size so they stay centered under the cursor point natively.
                let rW = target.userData.logicalWidth || 1920;
                let rH = target.userData.logicalHeight || 1080;

                const halfW = rW / 2;
                const halfH = rH / 2;

                if (!isCursor) {
                    // Les clips vidéo zooment normalement
                    // Fallback at rW, rH if no baseScale
                    const baseScale = target.userData.baseScale as THREE.Vector3 || new THREE.Vector3(rW, rH, 1);
                    target.scale.set(baseScale.x * zoom, baseScale.y * zoom, 1);
                }

                if (recentClick) {
                    // La vidéo ET le curseur doivent se déplacer pour rester synchronisés
                    // On déplace le mesh pour que le point cliqué (targetX, targetY) soit au centre
                    const basePos = target.userData.basePosition as THREE.Vector3 || new THREE.Vector3(0, 0, 0);
                    target.position.x = basePos.x - targetX * (zoom - 1) * halfW;
                    target.position.y = basePos.y - targetY * (zoom - 1) * halfH;
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

        object.visible = true;
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
            const targetGroup = this.cursorGroups.get(type) || this.cursorGroups.get('default');
            
            if (targetGroup) {
                if (object.children.length === 0 || object.userData.currentType !== type) {
                    object.clear();
                    const clone = targetGroup.clone();
                    object.add(clone);
                    object.userData.currentType = type;
                }
            }
        }

        let posX = (point.x / point.screenWidth) * 2 - 1;
        let posY = -(point.y / point.screenHeight) * 2 + 1;
        
        if (data.mirrorX) posX = -posX;
        if (data.invertY) posY = -posY;

        let rW = 1920;
        let rH = 1080;
        if (object.userData.logicalWidth) {
            rW = object.userData.logicalWidth;
            rH = object.userData.logicalHeight;
        }

        const halfW = rW / 2;
        const halfH = rH / 2;

        const finalX = posX * halfW;
        const finalY = posY * halfH;

        object.position.x = finalX;
        object.position.y = finalY;
        
        object.userData.basePosition = new THREE.Vector3(finalX, finalY, object.position.z);

        const feedback = point.isClick ? 0.8 : 1.0;
        const scale = (data.cursorScale || 1.0) * feedback;
        object.scale.set(scale, scale, 1);
    }
}
