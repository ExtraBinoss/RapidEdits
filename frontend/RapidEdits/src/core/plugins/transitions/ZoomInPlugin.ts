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

export class ZoomInPlugin extends BasePlugin implements TransitionPlugin {
    private metadata: PluginMetadata = {
        id: createPluginId(PluginCategory.Transitions, "zoom-in"),
        name: "Zoom In",
        type: "transition",
        version: "1.0.0",
        description: "Zoom clip into frame from center",
        isAttachedTransition: true,
        transitionSlot: "in",
    };

    getMetadata(): PluginMetadata {
        return this.metadata;
    }

    createData() {
        return {
            duration: 1.0,
            easing: "easeOut",
            startScale: 0.5,
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
                label: "Start Scale",
                key: "startScale",
                type: "slider",
                props: { min: 0, max: 1, step: 0.05 },
                defaultValue: 0.5,
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
                defaultValue: "easeOut",
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
        const easing = data.easing || "easeOut";
        const startScale = data.startScale ?? 0.5;

        let t = progress;
        if (easing === "easeIn") t = progress * progress;
        else if (easing === "easeOut") t = progress * (2 - progress);
        else if (easing === "easeInOut") {
            t = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
        }

        const scale = startScale + (1.0 - startScale) * t;

        targets.forEach((target) => {
            target.scale.multiplyScalar(scale);
            
            // Opacity fade
            const opacity = progress;
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
