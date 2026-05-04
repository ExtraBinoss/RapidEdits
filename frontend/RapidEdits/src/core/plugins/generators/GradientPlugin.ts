import { BasePlugin } from "../PluginInterface";
import type { Clip } from "../../../types/Timeline";
import * as THREE from "three";
import {
    createPluginId,
    PluginCategory,
    type PluginMetadata,
    type PluginPropertyDefinition,
} from "../PluginTypes";
import { Palette } from "lucide-vue-next";

export class GradientPlugin extends BasePlugin {
    private metadata: PluginMetadata = {
        id: createPluginId(PluginCategory.Core, "gradient"),
        name: "Gradient",
        type: "object",
        version: "1.0.0",
        description: "Dynamic linear or radial gradient background",
        icon: Palette,
        isTrackDroppable: true,
    };

    getMetadata(): PluginMetadata {
        return this.metadata;
    }

    createData() {
        return {
            gradient: {
                stops: [
                    { id: '1', position: 0, color: '#4facfe', alpha: 1 },
                    { id: '2', position: 1, color: '#00f2fe', alpha: 1 },
                ]
            },
            type: "linear", // "linear" | "radial"
            angle: 0,
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1920, y: 1080, z: 1 },
        };
    }

    getProperties(_clip: Clip): PluginPropertyDefinition[] {
        return [
            {
                label: "Gradient Editor",
                key: "sep_gradient",
                type: "divider",
            },
            {
                label: "Colors",
                key: "gradient",
                type: "gradient",
            },
            {
                label: "Configuration",
                key: "sep_config",
                type: "divider",
            },
            {
                label: "Type",
                key: "type",
                type: "select",
                options: [
                    { label: "Linear", value: "linear" },
                    { label: "Radial", value: "radial" },
                ],
            },
            {
                label: "Angle",
                key: "angle",
                type: "slider",
                props: { min: 0, max: 360, step: 1 },
                showIf: (data: any) => data.type === "linear",
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
            uniform vec3 colors[8];
            uniform float alphas[8];
            uniform float positions[8];
            uniform int numStops;
            uniform float type; // 0 for linear, 1 for radial
            uniform float angle;
            varying vec2 vUv;

            void main() {
                float f = 0.0;
                if (type < 0.5) {
                    // Linear
                    float rad = radians(angle);
                    vec2 dir = vec2(cos(rad), sin(rad));
                    // Re-center UV to rotate around middle
                    f = dot(vUv - 0.5, dir) + 0.5;
                } else {
                    // Radial
                    f = distance(vUv, vec2(0.5)) * 2.0;
                }
                
                f = clamp(f, 0.0, 1.0);

                // Manual mix between stops
                vec3 finalColor = colors[0];
                float finalAlpha = alphas[0];

                for (int i = 0; i < 7; i++) {
                    if (i >= numStops - 1) break;
                    
                    float pos1 = positions[i];
                    float pos2 = positions[i+1];
                    
                    if (f >= pos1 && f <= pos2) {
                        float t = (f - pos1) / (pos2 - pos1);
                        finalColor = mix(colors[i], colors[i+1], t);
                        finalAlpha = mix(alphas[i], alphas[i+1], t);
                    } else if (f > pos2) {
                        finalColor = colors[i+1];
                        finalAlpha = alphas[i+1];
                    }
                }

                gl_FragColor = vec4(finalColor, finalAlpha);
            }
        `;
    }

    private getUniforms(data: any) {
        const stops = data.gradient?.stops || [];
        const numStops = Math.min(stops.length, 8);
        
        const colors = new Array(8).fill(new THREE.Color());
        const alphas = new Array(8).fill(1.0);
        const positions = new Array(8).fill(0.0);

        stops.forEach((stop: any, i: number) => {
            if (i < 8) {
                colors[i] = new THREE.Color(stop.color);
                alphas[i] = stop.alpha ?? 1.0;
                positions[i] = stop.position;
            }
        });

        return {
            colors: { value: colors },
            alphas: { value: alphas },
            positions: { value: positions },
            numStops: { value: numStops },
            type: { value: data.type === "linear" ? 0.0 : 1.0 },
            angle: { value: data.angle || 0 },
        };
    }

    render(clip: Clip): THREE.Object3D | null {
        const data = clip.data || this.createData();
        const geometry = new THREE.PlaneGeometry(1, 1);
        
        const material = new THREE.ShaderMaterial({
            uniforms: this.getUniforms(data),
            vertexShader: this.getVertexShader(),
            fragmentShader: this.getFragmentShader(),
            transparent: true,
            side: THREE.DoubleSide,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.isSelectable = true;
        mesh.userData.clipId = clip.id;
        
        return mesh;
    }

    update(object: THREE.Object3D, clip: Clip): void {
        const mesh = object as THREE.Mesh;
        const data = clip.data;
        if (!data) return;

        const material = mesh.material as THREE.ShaderMaterial;
        const newUniforms = this.getUniforms(data);
        
        // Update uniforms
        Object.keys(newUniforms).forEach(key => {
            (material.uniforms as any)[key].value = (newUniforms as any)[key].value;
        });
    }
}
