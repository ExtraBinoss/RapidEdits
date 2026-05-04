import { BasePlugin } from "../PluginInterface";
import type { TransitionPlugin } from "../PluginInterface";
import type { Clip } from "../../../types/Timeline";
import * as THREE from "three";
import {
    createPluginId,
    PluginCategory,
    type PluginPropertyDefinition,
    type PluginMetadata,
} from "../PluginTypes";

export class FadeInPlugin extends BasePlugin implements TransitionPlugin {
    private metadata: PluginMetadata = {
        id: createPluginId(PluginCategory.Transitions, "fade-in"),
        name: "Fade In",
        type: "transition",
        version: "1.0.0",
        description: "Gradually reveal clip from 0% to 100% opacity",
        isAttachedTransition: true,
        transitionSlot: "in",
    };

    getMetadata(): PluginMetadata {
        return this.metadata;
    }

    createData() {
        return {
            duration: 1.0,
            easing: "linear",
        };
    }

    getProperties(_clip: Clip): PluginPropertyDefinition[] {
        return [
            {
                label: "Duration",
                key: "duration",
                type: "slider",
                props: { min: 0.1, max: 5.0, step: 0.1 },
                defaultValue: 1.0,
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
    }

    render(): THREE.Object3D | null {
        return null;
    }

    apply(
        clip: Clip,
        targets: THREE.Object3D[],
        progress: number,
        _time: number,
    ): void {
        const data = clip.data || {};
        const easing = data.easing || "linear";

        // Calculate eased progress
        let alpha = progress;
        if (easing === "easeIn") alpha = progress * progress;
        else if (easing === "easeOut") alpha = progress * (2 - progress);
        else if (easing === "easeInOut") {
            alpha = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
        }

        const opacity = alpha;

        targets.forEach((target) => {
            target.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    const mats = Array.isArray(child.material) ? child.material : [child.material];
                    mats.forEach(m => {
                        if (!m.transparent) m.transparent = true;
                        m.opacity = opacity;
                        if (m instanceof THREE.ShaderMaterial && m.uniforms.opacity) {
                            m.uniforms.opacity.value = opacity;
                        }
                    });
                }
            });
        });
    }
}
