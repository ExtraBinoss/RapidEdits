import { BasePlugin } from "../PluginInterface";
import {
    createPluginId,
    PluginCategory,
    type PluginPropertyDefinition,
    type PluginMetadata,
} from "../PluginTypes";

import type { Clip } from "../../../types/Timeline";

export class CropPlugin extends BasePlugin {
    private metadata: PluginMetadata = {
        id: createPluginId(PluginCategory.Core, "crop"),
        name: "Crop",
        type: "object",
        version: "1.0.0",
        isGlobalInspector: true,
        priority: 30,
    };

    getMetadata(): PluginMetadata {
        return this.metadata;
    }

    createData() {
        return {
            crop: { left: 0, right: 0, top: 0, bottom: 0 },
        };
    }

    getProperties(clip: Clip): PluginPropertyDefinition[] | undefined {
        // Crop only for video/image, not text or audio
        if (clip.type === "audio" || clip.type.includes("text")) return undefined;

        return [
            {
                label: "Left",
                key: "crop.left",
                type: "slider",
                props: { min: 0, max: 1, step: 0.01 },
                defaultValue: 0,
            },
            {
                label: "Right",
                key: "crop.right",
                type: "slider",
                props: { min: 0, max: 1, step: 0.01 },
                defaultValue: 0,
            },
            {
                label: "Top",
                key: "crop.top",
                type: "slider",
                props: { min: 0, max: 1, step: 0.01 },
                defaultValue: 0,
            },
            {
                label: "Bottom",
                key: "crop.bottom",
                type: "slider",
                props: { min: 0, max: 1, step: 0.01 },
                defaultValue: 0,
            },
        ];
    }
}
