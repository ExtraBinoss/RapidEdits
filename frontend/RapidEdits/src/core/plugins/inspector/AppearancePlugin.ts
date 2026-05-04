import { BasePlugin } from "../PluginInterface";
import type { Clip } from "../../../types/Timeline";
import {
    createPluginId,
    PluginCategory,
    type PluginPropertyDefinition,
    type PluginMetadata,
    type QuickActionDefinition,
} from "../PluginTypes";
import { SquareRoundCorner } from "lucide-vue-next";

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

    getProperties(clip: Clip): PluginPropertyDefinition[] | undefined {
        // Appearance properties are for visual clips
        if (clip.type === "audio") return undefined;

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

    getQuickActions(clip: Clip): QuickActionDefinition[] | undefined {
        // Rounding contextual actions: hide for text and audio
        if (clip.type === "audio" || clip.type.includes("text")) return undefined;

        return [
            {
                id: "rounding",
                label: "Rounding",
                icon: SquareRoundCorner,
                properties: [
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
                ],
            },
        ];
    }
}
