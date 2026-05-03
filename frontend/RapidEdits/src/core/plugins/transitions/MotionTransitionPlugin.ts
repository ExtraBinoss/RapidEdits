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

/**
 * Motion Transition Plugin.
 * 
 * Applies movement and scale-based transitions.
 */
export class MotionTransitionPlugin extends BasePlugin implements TransitionPlugin {
    private metadata: PluginMetadata = {
        id: createPluginId(PluginCategory.Transitions, "motion"),
        name: "Motion",
        type: "transition",
        version: "1.0.0",
        description: "Slide, Zoom, and Elastic transitions",
        isTrackDroppable: true,
    };

    getMetadata(): PluginMetadata {
        return this.metadata;
    }

    createData() {
        return {
            motionType: "slide-up",
            easing: "easeOut",
        };
    }

    getProperties(data?: any): PluginPropertyDefinition[] {
        void data;
        return [
            {
                label: "Motion Type",
                key: "motionType",
                type: "select",
                options: [
                    { label: "Slide Up", value: "slide-up" },
                    { label: "Slide Down", value: "slide-down" },
                    { label: "Slide Left", value: "slide-left" },
                    { label: "Slide Right", value: "slide-right" },
                    { label: "Zoom In", value: "zoom-in" },
                    { label: "Zoom Out", value: "zoom-out" },
                    { label: "Elastic In", value: "elastic-in" },
                ],
                defaultValue: "slide-up",
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
                    { label: "Elastic", value: "elastic" },
                ],
                defaultValue: "easeOut",
            },
        ];
    }

    render(_clip: Clip): THREE.Object3D | null {
        return null;
    }

    apply(
        clip: Clip,
        targets: THREE.Object3D[],
        progress: number,
        _time: number,
    ): void {
        const data = clip.data || {};
        const motionType = data.motionType || "slide-up";
        const fadeType = data.fadeType || "in"; // provided by ClipManager
        const easing = data.easing || "easeOut";

        // 1. Calculate Easing
        let t = progress;
        if (easing === "elastic") {
            t = this.elasticOut(progress);
        } else if (easing === "easeIn") {
            t = progress * progress;
        } else if (easing === "easeOut") {
            t = progress * (2 - progress);
        } else if (easing === "easeInOut") {
            t = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
        }

        // 2. Calculate Transform Modifiers
        const offset = new THREE.Vector3(0, 0, 0);
        const scaleMult = new THREE.Vector3(1, 1, 1);
        let opacity = 1.0;

        const isFadeIn = fadeType === "in";
        // Effective factor: 0 -> 1 for In, 1 -> 0 for Out
        const f = isFadeIn ? t : 1.0 - t;
        
        // Base opacity fade always applied for smoothness
        opacity = isFadeIn ? progress : 1.0 - progress;

        switch (motionType) {
            case "slide-up":
                offset.y = -500 * (1.0 - f);
                break;
            case "slide-down":
                offset.y = 500 * (1.0 - f);
                break;
            case "slide-left":
                offset.x = 500 * (1.0 - f);
                break;
            case "slide-right":
                offset.x = -500 * (1.0 - f);
                break;
            case "zoom-in":
                scaleMult.setScalar(0.5 + 0.5 * f);
                break;
            case "zoom-out":
                scaleMult.setScalar(1.5 - 0.5 * f);
                break;
            case "elastic-in":
                const et = isFadeIn ? this.elasticOut(progress) : this.elasticOut(1.0 - progress);
                scaleMult.setScalar(et);
                opacity = isFadeIn ? Math.min(1.0, progress * 2) : Math.min(1.0, (1.0 - progress) * 2);
                break;
        }

        // 3. Apply to targets
        targets.forEach((target) => {
            target.position.add(offset);
            target.scale.multiply(scaleMult);
            
            target.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    const mats = Array.isArray(child.material) ? child.material : [child.material];
                    mats.forEach(m => {
                        if (!m.transparent) {
                            m.transparent = true;
                        }
                        
                        m.opacity = opacity;

                        // Sync uniform for ShaderMaterials (Videos/Images)
                        if (m instanceof THREE.ShaderMaterial && m.uniforms.opacity) {
                            m.uniforms.opacity.value = opacity;
                        }
                    });
                }
            });
        });
    }

    private elasticOut(t: number): number {
        return Math.sin(-13.0 * (t + 1.0) * Math.PI / 2) * Math.pow(2.0, -10.0 * t) + 1.0;
    }
}
