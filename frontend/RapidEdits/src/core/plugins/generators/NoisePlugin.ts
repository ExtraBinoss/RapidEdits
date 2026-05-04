import { BasePlugin } from "../PluginInterface";
import type { Clip } from "../../../types/Timeline";
import * as THREE from "three";
import {
    createPluginId,
    PluginCategory,
    type PluginMetadata,
    type PluginPropertyDefinition,
} from "../PluginTypes";
import { Wind } from "lucide-vue-next";

export class NoisePlugin extends BasePlugin {
    private metadata: PluginMetadata = {
        id: createPluginId(PluginCategory.Core, "noise"),
        name: "Noise Generator",
        type: "object",
        version: "1.0.0",
        description: "Animated procedural noise background",
        icon: Wind,
        isTrackDroppable: true,
    };

    getMetadata(): PluginMetadata {
        return this.metadata;
    }

    createData() {
        return {
            color1: "#1e293b",
            color2: "#3b82f6",
            noiseScale: 3.0,
            speed: 0.5,
            brightness: 1.0,
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1920, y: 1080, z: 1 },
        };
    }

    getProperties(_clip: Clip): PluginPropertyDefinition[] {
        return [
            {
                label: "Colors",
                key: "sep_colors",
                type: "divider",
            },
            {
                label: "Base Color",
                key: "color1",
                type: "color",
            },
            {
                label: "Noise Color",
                key: "color2",
                type: "color",
            },
            {
                label: "Configuration",
                key: "sep_config",
                type: "divider",
            },
            {
                label: "Noise Scale",
                key: "noiseScale",
                type: "slider",
                props: { min: 0.1, max: 20, step: 0.1 },
            },
            {
                label: "Animation Speed",
                key: "speed",
                type: "slider",
                props: { min: 0, max: 5, step: 0.1 },
            },
            {
                label: "Brightness",
                key: "brightness",
                type: "slider",
                props: { min: 0, max: 2, step: 0.1 },
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
            uniform vec3 color1;
            uniform vec3 color2;
            uniform float time;
            uniform float scale;
            uniform float brightness;
            varying vec2 vUv;

            // Simple 2D Noise
            float hash(vec2 p) {
                p = fract(p * vec2(123.34, 456.21));
                p += dot(p, p + 45.32);
                return fract(p.x * p.y);
            }

            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                float a = hash(i);
                float b = hash(i + vec2(1.0, 0.0));
                float c = hash(i + vec2(0.0, 1.0));
                float d = hash(i + vec2(1.0, 1.0));
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
            }

            void main() {
                vec2 p = vUv * scale;
                float n = noise(p + time);
                
                // Add some layers
                n += 0.5 * noise(p * 2.0 - time * 0.5);
                n += 0.25 * noise(p * 4.0 + time * 0.2);
                n /= 1.75;

                vec3 finalColor = mix(color1, color2, n) * brightness;
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;
    }

    render(clip: Clip): THREE.Object3D | null {
        const data = clip.data || this.createData();
        const geometry = new THREE.PlaneGeometry(1, 1);
        
        const material = new THREE.ShaderMaterial({
            uniforms: {
                color1: { value: new THREE.Color(data.color1) },
                color2: { value: new THREE.Color(data.color2) },
                time: { value: 0 },
                scale: { value: data.noiseScale },
                brightness: { value: data.brightness },
            },
            vertexShader: this.getVertexShader(),
            fragmentShader: this.getFragmentShader(),
            side: THREE.DoubleSide,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.isSelectable = true;
        mesh.userData.clipId = clip.id;
        
        return mesh;
    }

    update(object: THREE.Object3D, clip: Clip, time: number): void {
        const mesh = object as THREE.Mesh;
        const data = clip.data;
        if (!data) return;

        const material = mesh.material as THREE.ShaderMaterial;
        material.uniforms.color1.value.set(data.color1);
        material.uniforms.color2.value.set(data.color2);
        material.uniforms.scale.value = data.noiseScale;
        material.uniforms.brightness.value = data.brightness;
        
        // Use global time for animation
        material.uniforms.time.value = time * (data.speed || 0.5);
    }
}
