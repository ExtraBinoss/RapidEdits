import { BasePlugin } from "../PluginInterface";
import type { Clip } from "../../../types/Timeline";
import * as THREE from "three";
import {
    createPluginId,
    PluginCategory,
    type PluginMetadata,
    type PluginPropertyDefinition,
} from "../PluginTypes";
import { Sparkles } from "lucide-vue-next";

export class ShaderBackgroundPlugin extends BasePlugin {
    private metadata: PluginMetadata = {
        id: createPluginId(PluginCategory.Core, "shader-bg"),
        name: "Shader Decorator",
        type: "object",
        version: "1.0.0",
        description: "Beautiful animated shader backgrounds and decorators",
        icon: Sparkles,
        isTrackDroppable: true,
    };

    getMetadata(): PluginMetadata {
        return this.metadata;
    }

    createData() {
        return {
            preset: "waves",
            color: "#6366f1",
            speed: 1.0,
            intensity: 1.0,
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1920, y: 1080, z: 1 },
        };
    }

    getProperties(_clip: Clip): PluginPropertyDefinition[] {
        return [
            {
                label: "Effect",
                key: "sep_effect",
                type: "divider",
            },
            {
                label: "Preset",
                key: "preset",
                type: "select",
                options: [
                    { label: "Ocean Waves", value: "waves" },
                    { label: "Cosmic Plasma", value: "plasma" },
                    { label: "Cyber Grid", value: "grid" },
                    { label: "Flowing Lines", value: "lines" },
                ],
            },
            {
                label: "Primary Color",
                key: "color",
                type: "color",
            },
            {
                label: "Animation Speed",
                key: "speed",
                type: "slider",
                props: { min: 0, max: 3, step: 0.1 },
            },
            {
                label: "Intensity",
                key: "intensity",
                type: "slider",
                props: { min: 0.1, max: 5, step: 0.1 },
            },
            {
                label: "Transform",
                key: "sep_transform",
                type: "divider",
            },
            {
                label: "Position",
                key: "position",
                type: "vector3",
            },
            {
                label: "Rotation",
                key: "rotation",
                type: "vector3",
            },
            {
                label: "Scale",
                key: "scale",
                type: "vector3",
            },
        ];
    }

    private getVertexShader() {
        return `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
    }

    private getFragmentShader() {
        return `
            uniform vec3 color;
            uniform float time;
            uniform float intensity;
            uniform float preset; // 0: waves, 1: plasma, 2: grid, 3: lines
            varying vec2 vUv;

            void main() {
                vec2 uv = vUv;
                vec3 finalColor = vec3(0.0);

                if (preset < 0.5) {
                    // Waves
                    float w = sin(uv.x * 10.0 + time) * 0.1;
                    w += sin(uv.x * 20.0 - time * 1.2) * 0.05;
                    float line = smoothstep(0.02, 0.0, abs(uv.y - 0.5 - w));
                    finalColor = color * line * intensity;
                    // Add background glow
                    finalColor += color * (1.0 - abs(uv.y - 0.5 - w)) * 0.2 * intensity;
                } 
                else if (preset < 1.5) {
                    // Plasma
                    float v1 = sin(uv.x * 10.0 + time);
                    float v2 = sin(10.0 * (uv.x * sin(time / 2.0) + uv.y * cos(time / 3.0)) + time);
                    float cx = uv.x + 0.5 * sin(time / 5.0);
                    float cy = uv.y + 0.5 * cos(time / 3.0);
                    float v3 = sin(sqrt(100.0 * (cx * cx + cy * cy) + 1.0) + time);
                    float v = v1 + v2 + v3;
                    finalColor = color * sin(v * intensity);
                }
                else if (preset < 2.5) {
                    // Grid
                    vec2 g = fract(uv * 10.0 * intensity);
                    float grid = smoothstep(0.05, 0.0, min(g.x, g.y)) + smoothstep(0.95, 1.0, max(g.x, g.y));
                    finalColor = color * grid * (0.5 + 0.5 * sin(time + uv.x * 5.0));
                }
                else {
                    // Lines
                    float l = sin(uv.y * 50.0 * intensity + time * 5.0);
                    l = smoothstep(0.5, 0.6, l);
                    finalColor = color * l * intensity * uv.x;
                }

                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;
    }

    render(clip: Clip): THREE.Object3D | null {
        const data = clip.data || this.createData();
        const geometry = new THREE.PlaneGeometry(1, 1);
        
        const material = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(data.color) },
                time: { value: 0 },
                intensity: { value: data.intensity },
                preset: { value: this.getPresetValue(data.preset) },
            },
            vertexShader: this.getVertexShader(),
            fragmentShader: this.getFragmentShader(),
            side: THREE.DoubleSide,
            transparent: true,
            blending: THREE.AdditiveBlending,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.isSelectable = true;
        mesh.userData.clipId = clip.id;
        
        return mesh;
    }

    private getPresetValue(preset: string): number {
        switch (preset) {
            case "waves": return 0.0;
            case "plasma": return 1.0;
            case "grid": return 2.0;
            case "lines": return 3.0;
            default: return 0.0;
        }
    }

    update(object: THREE.Object3D, clip: Clip, time: number): void {
        const mesh = object as THREE.Mesh;
        const data = clip.data;
        if (!data) return;

        const material = mesh.material as THREE.ShaderMaterial;
        material.uniforms.color.value.set(data.color);
        material.uniforms.intensity.value = data.intensity;
        material.uniforms.preset.value = this.getPresetValue(data.preset);
        material.uniforms.time.value = time * (data.speed || 1.0);
    }
}
