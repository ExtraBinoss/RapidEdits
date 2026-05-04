import { BasePlugin } from "../PluginInterface";
import {
    createPluginId,
    PluginCategory,
    type PluginPropertyDefinition,
    type PluginMetadata,
} from "../PluginTypes";
import { Volume2 } from "lucide-vue-next";

import type { Clip } from "../../../types/Timeline";

export class AudioPlugin extends BasePlugin {
    private metadata: PluginMetadata = {
        id: createPluginId(PluginCategory.Core, "audio-inspector"),
        name: "Audio",
        type: "object",
        version: "1.0.0",
        isGlobalInspector: true,
        priority: 100, // Show at the bottom for video clips, first for audio clips
        icon: Volume2
    };

    getMetadata(): PluginMetadata {
        return this.metadata;
    }

    createData() {
        return {
            volume: 1.0,
            pan: 0,
            pitch: 1.0,
            normalization: false,
        };
    }

    getProperties(clip: Clip): PluginPropertyDefinition[] | undefined {
        // Only show for audio clips or video clips (which usually have sound)
        if (clip.type !== "audio" && clip.type !== "video") return undefined;

        return [
            {
                label: "Volume",
                key: "volume",
                type: "slider",
                props: { min: 0, max: 2, step: 0.01 },
                defaultValue: 1.0,
            },
            {
                label: "Normalization",
                key: "normalization",
                type: "boolean",
                defaultValue: false,
            },
            {
                label: "Pitch",
                key: "pitch",
                type: "slider",
                props: { min: 0.5, max: 2, step: 0.01 },
                defaultValue: 1.0,
            },
            {
                label: "Pan",
                key: "pan",
                type: "slider",
                props: { min: -1, max: 1, step: 0.01 },
                defaultValue: 0,
            },
        ];
    }
}
