import { BasePlugin } from "../PluginInterface";
import {
    createPluginId,
    PluginCategory,
    type PluginPropertyDefinition,
    type PluginMetadata,
} from "../PluginTypes";

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

    getProperties(_data?: any): PluginPropertyDefinition[] {
        // Only show for media clips (or any clip that has position/scale/rotation data)
        // Actually, we can just return the properties and let the UI decide if it wants to show it.
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
