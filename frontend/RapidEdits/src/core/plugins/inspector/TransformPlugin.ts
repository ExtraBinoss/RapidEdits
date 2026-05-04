import { BasePlugin } from "../PluginInterface";
import {
    createPluginId,
    PluginCategory,
    type PluginPropertyDefinition,
    type PluginMetadata,
} from "../PluginTypes";

import type { Clip } from "../../../types/Timeline";

export class TransformPlugin extends BasePlugin {
    private metadata: PluginMetadata = {
        id: createPluginId(PluginCategory.Core, "transform"),
        name: "Transform",
        type: "object",
        version: "1.0.0",
        isGlobalInspector: true,
        priority: 10,
    };

    getMetadata(): PluginMetadata {
        return this.metadata;
    }

    createData() {
        return {
            position: { x: 0, y: 0 },
            rotation: { z: 0 },
            scale: { x: 1, y: 1 },
        };
    }

    getProperties(clip: Clip): PluginPropertyDefinition[] | undefined {
        // Transform is for visual clips (video/image), Text has its own 3D transform controls
        if (clip.type === "audio" || clip.type.includes("text")) return undefined;

        return [
            {
                label: "Position",
                key: "position",
                type: "vector2",
                defaultValue: { x: 0, y: 0 },
            },
            {
                label: "Rotation",
                key: "rotation.z",
                type: "slider",
                props: { min: -Math.PI, max: Math.PI, step: 0.01 },
                defaultValue: 0,
            },
            {
                label: "Scale",
                key: "scale",
                type: "vector2",
                defaultValue: { x: 1, y: 1 },
            },
        ];
    }
}
