import { BasePlugin } from "../PluginInterface";
import type { Clip } from "../../../types/Timeline";
import * as THREE from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import {
    FontLoader,
    type Font,
} from "three/examples/jsm/loaders/FontLoader.js";

import {
    createPluginId,
    PluginCategory,
    PluginType,
    type FilmstripConfig,
    type PluginPropertyDefinition,
} from "../PluginTypes";

export class TextPlugin extends BasePlugin {
    id = createPluginId(PluginCategory.Core, "text");
    name = "Text 3D";
    type = "object" as const; // Satisfies IPlugin 'type'
    // Subtype information is encoded in ID or can be added if needed
    // propertiesComponent = null; // No longer used, using schema below

    properties: PluginPropertyDefinition[] = [
        {
            label: "Content",
            key: "text",
            type: "long-text",
            props: { rows: 2, placeholder: "Enter text..." },
        },
        {
            label: "Appearance",
            key: "sep1",
            type: "divider",
        },
        {
            label: "Size",
            key: "fontSize",
            type: "slider",
            props: { min: 1, max: 200, step: 1 },
        },
        {
            label: "Color",
            key: "color",
            type: "color",
        },
        {
            label: "Transform",
            key: "sep2",
            type: "divider",
        },
        {
            label: "Position",
            key: "position",
            type: "vector3",
        },
        {
            label: "3D Settings",
            key: "sep3",
            type: "divider",
        },
        {
            label: "3D Extrusion",
            key: "is3D",
            type: "boolean",
        },
        {
            label: "Depth",
            key: "depth",
            type: "slider",
            props: { min: 1, max: 50, step: 1 },
            showIf: (data: any) => data.is3D,
        },
        {
            label: "System",
            key: "sep4",
            type: "divider",
        },
        {
            label: "Filmstrip Auto-Fit",
            key: "autoFit",
            type: "boolean",
        },
    ];

    private font: Font | null = null;
    private loader = new FontLoader();
    private loadError = false;

    async init() {
        // Load a default font
        // In a real app, we might want to load this from a local asset or URL
        try {
            this.font = await this.loader.loadAsync(
                "https://threejs.org/examples/fonts/helvetiker_regular.typeface.json",
            );
        } catch (e) {
            console.error("Failed to load default font", e);
            this.loadError = true;
        }
    }

    createData() {
        return {
            text: "New Text",
            fontSize: 50,
            color: "#ffffff",
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            is3D: false,
            depth: 5,
            autoFit: false,
        };
    }

    render(clip: Clip): THREE.Object3D | null {
        if (!this.font) {
            if (this.loadError) {
                // Fallback geometry if font failed
                const geometry = new THREE.BoxGeometry(100, 50, 10);
                const material = new THREE.MeshBasicMaterial({
                    color: 0xff0000,
                });
                return new THREE.Mesh(geometry, material);
            }
            return null;
        }

        const data = clip.data || this.createData();

        const geometry = new TextGeometry(data.text, {
            font: this.font,
            size: data.fontSize,
            depth: data.is3D ? data.depth : 0,
            curveSegments: 12,
            bevelEnabled: data.is3D,
            bevelThickness: 1,
            bevelSize: 0.5,
            bevelOffset: 0,
            bevelSegments: 3,
        });

        // Center the text geometry
        geometry.computeBoundingBox();
        const xMid =
            -0.5 * (geometry.boundingBox!.max.x - geometry.boundingBox!.min.x);
        const yMid =
            -0.5 * (geometry.boundingBox!.max.y - geometry.boundingBox!.min.y);
        geometry.translate(xMid, yMid, 0);

        const material = new THREE.MeshBasicMaterial({ color: data.color });
        const mesh = new THREE.Mesh(geometry, material);

        this.updateTransform(mesh, data);

        return mesh;
    }

    update(
        object: THREE.Object3D,
        clip: Clip,
        time: number,
        frameDuration: number,
    ): void {
        const mesh = object as THREE.Mesh;
        const data = clip.data;
        if (!data || !this.font) return;

        // Check if geometry needs rebuild (text, size, depth changed)
        // This is expensive, so we should ideally check dirty flags or compare values
        // For prototype, we rebuild if text differs
        // A better way: store previous state in userData
        const prevData = mesh.userData.lastState;

        const needsRebuild =
            !prevData ||
            prevData.text !== data.text ||
            prevData.fontSize !== data.fontSize ||
            prevData.is3D !== data.is3D ||
            prevData.depth !== data.depth;

        if (needsRebuild) {
            mesh.geometry.dispose();
            const geometry = new TextGeometry(data.text, {
                font: this.font,
                size: data.fontSize,
                depth: data.is3D ? data.depth : 0,
                curveSegments: 12,
                bevelEnabled: data.is3D,
                bevelThickness: 1,
                bevelSize: 0.5,
                bevelOffset: 0,
                bevelSegments: 3,
            });
            // Center again
            geometry.computeBoundingBox();
            const xMid =
                -0.5 *
                (geometry.boundingBox!.max.x - geometry.boundingBox!.min.x);
            const yMid =
                -0.5 *
                (geometry.boundingBox!.max.y - geometry.boundingBox!.min.y);
            geometry.translate(xMid, yMid, 0);

            mesh.geometry = geometry;

            mesh.userData.lastState = { ...data };
        }

        // Update Material
        if (
            (mesh.material as THREE.MeshBasicMaterial).color.getHexString() !==
            new THREE.Color(data.color).getHexString()
        ) {
            (mesh.material as THREE.MeshBasicMaterial).color.set(data.color);
        }

        this.updateTransform(mesh, data);
    }

    updateTransform(mesh: THREE.Object3D, data: any) {
        mesh.position.set(data.position.x, data.position.y, data.position.z);
        // mesh.rotation.set(data.rotation.x, data.rotation.y, data.rotation.z); // TODO: Convert deg to rad if needed
        mesh.scale.set(data.scale.x, data.scale.y, data.scale.z);
    }

    getFilmstripConfig(clip: Clip): FilmstripConfig {
        const data = clip.data || this.createData();
        return {
            backgroundColor: "#1e293b", // Slate-800 to contrast with white text
            disableAutoFit: !data.autoFit,
            fixedSceneWidth: 1920, // Full HD reference canvas
        };
    }
}
