import { BasePlugin } from "../PluginInterface";
import type { Clip } from "../../../types/Timeline";
import * as THREE from "three";
import {
    createPluginId,
    PluginCategory,
    type PluginMetadata,
    type PluginPropertyDefinition,
} from "../PluginTypes";
import { Square } from "lucide-vue-next";

export class SolidColorPlugin extends BasePlugin {
    private metadata: PluginMetadata = {
        id: createPluginId(PluginCategory.Core, "solid-color"),
        name: "Solid Color",
        type: "object",
        version: "1.0.0",
        description: "A simple solid color background or shape",
        icon: Square,
        isTrackDroppable: true,
    };

    getMetadata(): PluginMetadata {
        return this.metadata;
    }

    createData() {
        return {
            color: "#3b82f6",
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1920, y: 1080, z: 1 },
        };
    }

    getProperties(_clip: Clip): PluginPropertyDefinition[] {
        return [
            {
                label: "Appearance",
                key: "sep_appearance",
                type: "divider",
            },
            {
                label: "Color",
                key: "color",
                type: "color",
            },
            {
                label: "Transform",
                key: "sep_transform",
                type: "divider",
            },
            {
                label: "Position",
                key: "position",
                type: "vector3",
            },
            {
                label: "Rotation",
                key: "rotation",
                type: "vector3",
            },
            {
                label: "Scale",
                key: "scale",
                type: "vector3",
            },
        ];
    }

    render(clip: Clip): THREE.Object3D | null {
        const data = clip.data || this.createData();
        const geometry = new THREE.PlaneGeometry(1, 1);
        const material = new THREE.MeshBasicMaterial({
            color: data.color || "#ffffff",
            side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geometry, material);

        mesh.userData.isSelectable = true;
        mesh.userData.clipId = clip.id;
        
        return mesh;
    }

    update(object: THREE.Object3D, clip: Clip): void {
        const mesh = object as THREE.Mesh;
        const data = clip.data;
        if (!data) return;

        const material = mesh.material as THREE.MeshBasicMaterial;
        if (material.color.getHex() !== new THREE.Color(data.color).getHex()) {
            material.color.set(data.color);
        }
    }
}
