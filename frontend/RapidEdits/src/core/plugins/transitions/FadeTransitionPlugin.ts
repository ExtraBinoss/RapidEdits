import { BasePlugin, type TransitionPlugin } from "../PluginInterface";
import type { Clip } from "../../../types/Timeline";
import * as THREE from "three";
import {
    createPluginId,
    PluginCategory,
    type PluginPropertyDefinition,
} from "../PluginTypes";

export class FadeTransitionPlugin
    extends BasePlugin
    implements TransitionPlugin
{
    id = createPluginId(PluginCategory.Transitions, "fade");
    name = "Fade / Dissolve";
    type = "transition" as const;

    properties: PluginPropertyDefinition[] = [
        {
            label: "Fade Type",
            key: "fadeType",
            type: "select",
            options: [
                { label: "Fade In (0% -> 100%)", value: "in" },
                { label: "Fade Out (100% -> 0%)", value: "out" },
                { label: "Cross Dissolve", value: "cross" }, // Acts like opacity over time
            ],
            defaultValue: "in",
        },
        {
            label: "Easing",
            key: "easing",
            type: "select",
            options: [
                { label: "Linear", value: "linear" },
                { label: "Ease In", value: "easeIn" },
                { label: "Ease Out", value: "easeOut" },
                { label: "Ease In Out", value: "easeInOut" },
            ],
            defaultValue: "linear",
        },
    ];

    createData() {
        return {
            fadeType: "in",
            easing: "linear",
        };
    }

    // Transitions usually don't render their own mesh, they affect others.
    // However, if we wanted a "black" overlay, we could render a plane here.
    // But for "Fade In" (reveal), we want to modify the CLIP'S material opacity.
    render(_clip: Clip): THREE.Object3D | null {
        return null; // No visual representation on its own track in the scene (ghost)
    }

    apply(
        clip: Clip,
        targets: THREE.Object3D[],
        progress: number,
        _time: number,
    ): void {
        const data = clip.data || this.createData();
        const fadeType = data.fadeType || "in";
        const easing = data.easing || "linear";

        // Easing function
        let alpha = progress;
        switch (easing) {
            case "easeIn":
                alpha = progress * progress;
                break;
            case "easeOut":
                alpha = progress * (2 - progress);
                break;
            case "easeInOut":
                alpha =
                    progress < 0.5
                        ? 2 * progress * progress
                        : -1 + (4 - 2 * progress) * progress;
                break;
            case "linear":
            default:
                alpha = progress;
                break;
        }

        // Calculate final opacity multiplier
        let opacity = 1.0;
        if (fadeType === "in") {
            opacity = alpha;
        } else if (fadeType === "out") {
            opacity = 1.0 - alpha;
        } else if (fadeType === "cross") {
            // "Cross" usually implies mixing between two clips.
            // When applied to a SINGLE overlapping clip as an overlay, it acts as a modifier.
            // If we want "Cross Dissolve" between two clips on the SAME track, that's a different architecture.
            // For now, let's treat "Cross" as "Opacity from 0->1" or just let user decide.
            // Actually, standard "Dissolve" on a clip usually reveals it.
            // Let's treat it same as fade in for now, or maybe linear opacity.
            opacity = alpha;
        }

        // Apply to targets
        targets.forEach((target) => {
            target.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    const materials = Array.isArray(child.material)
                        ? child.material
                        : [child.material];

                    materials.forEach((mat) => {
                        // Ensure transparent is true so opacity works
                        if (!mat.transparent) {
                            mat.transparent = true;
                            mat.needsUpdate = true;
                        }

                        // We MULTIPLY opacity so we don't override other fades
                        mat.opacity = opacity;
                    });
                }
            });
        });
    }
}
