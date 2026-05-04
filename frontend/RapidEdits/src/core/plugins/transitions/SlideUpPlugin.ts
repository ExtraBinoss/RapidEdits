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

export class SlideUpPlugin extends BasePlugin implements TransitionPlugin {
    private metadata: PluginMetadata = {
        id: createPluginId(PluginCategory.Transitions, "slide-up"),
        name: "Slide Up",
        type: "transition",
        version: "1.0.0",
        description: "Slide clip upwards into or out of frame",
        isAttachedTransition: true,
        transitionSlot: "any",
    };

    getMetadata(): PluginMetadata {
        return this.metadata;
    }

    createData() {
        return {
            duration: 1.0,
            easing: "easeOut",
            distance: 500,
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
                label: "Distance",
                key: "distance",
                type: "number",
                props: { min: 0, max: 2000, step: 10 },
                defaultValue: 500,
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
        const distance = data.distance ?? 500;
        const slot = clip.data?.__slot || "in"; // Internal hint passed by ClipManager

        let t = progress;
        if (easing === "easeIn") t = progress * progress;
        else if (easing === "easeOut") t = progress * (2 - progress);
        else if (easing === "easeInOut") {
            t = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
        }

        const f = slot === "in" ? t : 1.0 - t;
        const offset = -distance * (1.0 - f);

        targets.forEach((target) => {
            target.position.y += offset;
            
            // Basic opacity fade for smoothness
            const opacity = slot === "in" ? progress : 1.0 - progress;
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
