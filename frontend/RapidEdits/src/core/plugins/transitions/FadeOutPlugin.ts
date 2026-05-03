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

export class FadeOutPlugin extends BasePlugin implements TransitionPlugin {
    private metadata: PluginMetadata = {
        id: createPluginId(PluginCategory.Transitions, "fade-out"),
        name: "Fade Out",
        type: "transition",
        version: "1.0.0",
        description: "Gradually hide clip from 100% to 0% opacity",
        isAttachedTransition: true,
        transitionSlot: "out",
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

    getProperties(): PluginPropertyDefinition[] {
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

        // Calculate eased progress (0 -> 1)
        let alpha = progress;
        if (easing === "easeIn") alpha = progress * progress;
        else if (easing === "easeOut") alpha = progress * (2 - progress);
        else if (easing === "easeInOut") {
            alpha = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
        }

        // Fade Out: 1 -> 0
        const opacity = 1.0 - alpha;

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
