import { BasePlugin } from "../PluginInterface";
import {
    createPluginId,
    PluginCategory,
    type PluginPropertyDefinition,
    type PluginMetadata,
} from "../PluginTypes";

export class AppearancePlugin extends BasePlugin {
    private metadata: PluginMetadata = {
        id: createPluginId(PluginCategory.Core, "appearance"),
        name: "Appearance",
        type: "object",
        version: "1.0.0",
        isGlobalInspector: true,
        priority: 20,
    };

    getMetadata(): PluginMetadata {
        return this.metadata;
    }

    createData() {
        return {
            opacity: 1,
            borderRadius: 0,
            edgeSoftness: 0,
        };
    }

    getProperties(_data?: any): PluginPropertyDefinition[] {
        return [
            {
                label: "Opacity",
                key: "opacity",
                type: "slider",
                props: { min: 0, max: 1, step: 0.01 },
                defaultValue: 1,
            },
            {
                label: "Round Edges",
                key: "borderRadius",
                type: "slider",
                props: { min: 0, max: 1, step: 0.01 },
                defaultValue: 0,
            },
            {
                label: "Edge Softness",
                key: "edgeSoftness",
                type: "slider",
                props: { min: 0, max: 1, step: 0.01 },
                defaultValue: 0,
            },
        ];
    }
}
