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
                ],
                type: "linear",
                angle: 0,
                origin: { x: 0.5, y: 0.2 },
                destination: { x: 0.5, y: 0.8 },
                speed: 0, // legacy
                noise: 0, // legacy
                gradientSpeed: 0,
                noiseStrength: 0,
                noiseSpeed: 0,
                noiseScale: 1.0,
                offset: 0,
                halftoneStrength: 0,
                halftoneSize: 10,
                halftoneAngle: 45,
                wrapMode: "repeat",
            },
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1920, y: 1080, z: 1 },
        };
    }

    getProperties(_clip: Clip): PluginPropertyDefinition[] {
        return [
            {
                label: "Colors",
                key: "gradient",
                type: "gradient",
            },
            {
                label: "Wrap Mode",
                key: "gradient.wrapMode",
                type: "select",
                options: [
                    { label: "Repeat", value: "repeat" },
                    { label: "Mirror", value: "mirror" },
                    { label: "Clamp", value: "clamp" },
                ]
            },
            {
                label: "Gradient Settings",
                key: "sep_grad",
                type: "divider",
            },
            {
                label: "Animation Speed",
                key: "gradient.gradientSpeed",
                type: "number",
                props: {
                    min: -20,
                    max: 20,
                    step: 0.1,
                }
            },
            {
                label: "Manual Offset",
                key: "gradient.offset",
                type: "number",
                props: {
                    min: -10,
                    max: 10,
                    step: 0.01,
                }
            },
            {
                label: "Halftone / Stylization",
                key: "sep_halftone",
                type: "divider",
            },
            {
                label: "Halftone Strength",
                key: "gradient.halftoneStrength",
                type: "number",
                props: {
                    min: 0,
                    max: 1,
                    step: 0.01,
                }
            },
            {
                label: "Halftone Size",
                key: "gradient.halftoneSize",
                type: "number",
                props: {
                    min: 1,
                    max: 100,
                    step: 0.5,
                }
            },
            {
                label: "Halftone Angle",
                key: "gradient.halftoneAngle",
                type: "number",
                props: {
                    min: 0,
                    max: 90,
                    step: 1,
                }
            },
            {
                label: "Distortion (Noise)",
                key: "sep_noise",
                type: "divider",
            },
            {
                label: "Noise Strength",
                key: "gradient.noiseStrength",
                type: "number",
                props: {
                    min: 0,
                    max: 5,
                    step: 0.01,
                }
            },
            {
                label: "Noise Speed",
                key: "gradient.noiseSpeed",
                type: "number",
                props: {
                    min: 0,
                    max: 10,
                    step: 0.1,
                }
            },
            {
                label: "Noise Scale",
                key: "gradient.noiseScale",
                type: "number",
                props: {
                    min: 0.1,
                    max: 10,
                    step: 0.1,
                }
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
            uniform float type;
            uniform vec2 origin;
            uniform vec2 destination;
            uniform float time;
            uniform float globalTime;
            uniform float gradientSpeed;
            uniform float offset;
            uniform float noiseStrength;
            uniform float noiseSpeed;
            uniform float noiseScale;
            uniform float halftoneStrength;
            uniform float halftoneSize;
            uniform float halftoneAngle;
            uniform float wrapMode; // 0: repeat, 1: mirror, 2: clamp
            varying vec2 vUv;

            float random (vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
            }

            // --- Official Three.js Halftone Shader Math ---
            float hypot(float x, float y) { return sqrt(x*x + y*y); }
            
            float distanceToDotRadius(float channel, vec2 coord, vec2 p, float angle, float rad_max) {
                float dist = hypot(coord.x - p.x, coord.y - p.y);
                float rad = pow(abs(channel), 1.125) * rad_max;
                return rad - dist;
            }

            struct Cell { vec2 p1, p2, p3, p4; };

            Cell getReferenceCell(vec2 p, float grid_angle, float step) {
                Cell c;
                vec2 n = vec2(cos(grid_angle), sin(grid_angle));
                float threshold = step * 0.5;
                float dot_normal = n.x * p.x + n.y * p.y;
                float dot_line = -n.y * p.x + n.x * p.y;
                vec2 offset = vec2(n.x * dot_normal, n.y * dot_normal);
                float offset_normal = mod(hypot(offset.x, offset.y), step);
                float normal_dir = (dot_normal < 0.0) ? 1.0 : -1.0;
                float normal_scale = ((offset_normal < threshold) ? -offset_normal : step - offset_normal) * normal_dir;
                float offset_line = mod(hypot((p.x - offset.x), (p.y - offset.y)), step);
                float line_dir = (dot_line < 0.0) ? 1.0 : -1.0;
                float line_scale = ((offset_line < threshold) ? -offset_line : step - offset_line) * line_dir;
                c.p1 = vec2(p.x - n.x * normal_scale + n.y * line_scale, p.y - n.y * normal_scale - n.x * line_scale);
                float normal_step = normal_dir * ((offset_normal < threshold) ? step : -step);
                float line_step = line_dir * ((offset_line < threshold) ? step : -step);
                c.p2 = c.p1 - n * normal_step;
                c.p3 = c.p1 + vec2(n.y, -n.x) * line_step;
                c.p4 = c.p1 - n * normal_step + vec2(n.y, -n.x) * line_step;
                return c;
            }

            void main() {
                vec2 uv = vUv;
                
                // Unified time for animations
                float t = time + globalTime;

                // Noise distortion
                if (noiseStrength > 0.01) {
                    float noiseT = t * noiseSpeed * 0.1;
                    vec2 noiseUv = uv * noiseScale;
                    uv.x += (random(vec2(noiseUv.y, noiseT)) - 0.5) * noiseStrength * 0.1;
                    uv.y += (random(vec2(noiseUv.x, noiseT)) - 0.5) * noiseStrength * 0.1;
                }

                float f = 0.0;
                
                // Animation shift
                float shift = (t * gradientSpeed * 0.2) + offset;
                
                if (type < 0.5) {
                    // Linear
                    vec2 dir = destination - origin;
                    float l2 = dot(dir, dir);
                    if (l2 < 0.0001) {
                        f = 0.0;
                    } else {
                        f = dot(uv - origin, dir) / l2;
                    }
                } else {
                    // Radial
                    float dist = distance(uv, origin);
                    float radius = distance(origin, destination);
                    f = radius < 0.0001 ? 0.0 : dist / radius;
                }
                
                // Apply shift
                f -= shift;

                // Wrap logic
                if (wrapMode < 0.5) {
                    f = fract(f);
                } else if (wrapMode < 1.5) {
                    f = abs(mod(f - 1.0, 2.0) - 1.0);
                } else {
                    f = clamp(f, 0.0, 1.0);
                }

                // Halftone effect (Official Library Math)
                if (halftoneStrength > 0.01) {
                    vec2 p = uv * 1000.0; // scale for dots
                    float angle = halftoneAngle * 0.0174533;
                    Cell cell = getReferenceCell(p, angle, halftoneSize * 2.0);
                    float aa = (halftoneSize < 2.5) ? halftoneSize * 0.5 : 1.25;
                    float d1 = distanceToDotRadius(f, cell.p1, p, angle, halftoneSize);
                    float d2 = distanceToDotRadius(f, cell.p2, p, angle, halftoneSize);
                    float d3 = distanceToDotRadius(f, cell.p3, p, angle, halftoneSize);
                    float d4 = distanceToDotRadius(f, cell.p4, p, angle, halftoneSize);
                    float dotRes = clamp(d1/aa, 0.0, 1.0) + clamp(d2/aa, 0.0, 1.0) + clamp(d3/aa, 0.0, 1.0) + clamp(d4/aa, 0.0, 1.0);
                    f = mix(f, clamp(dotRes, 0.0, 1.0), halftoneStrength);
                }

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
        const g = data.gradient || {};
        const stops = g.stops || [];
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
            type: { value: (g.type || "linear") === "linear" ? 0.0 : 1.0 },
            origin: { value: new THREE.Vector2(g.origin?.x ?? 0.5, 1.0 - (g.origin?.y ?? 0.2)) },
            destination: { value: new THREE.Vector2(g.destination?.x ?? 0.5, 1.0 - (g.destination?.y ?? 0.8)) },
            time: { value: 0.0 },
            globalTime: { value: 0.0 },
            gradientSpeed: { value: g.gradientSpeed ?? 0.0 },
            offset: { value: g.offset ?? 0.0 },
            noiseStrength: { value: g.noiseStrength ?? 0.0 },
            noiseSpeed: { value: g.noiseSpeed ?? 0.0 },
            noiseScale: { value: g.noiseScale ?? 1.0 },
            halftoneStrength: { value: g.halftoneStrength ?? 0.0 },
            halftoneSize: { value: g.halftoneSize ?? 10.0 },
            halftoneAngle: { value: g.halftoneAngle ?? 45.0 },
            wrapMode: { value: (g.wrapMode === "mirror" ? 1.0 : g.wrapMode === "clamp" ? 2.0 : 0.0) },
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

    update(object: THREE.Object3D, clip: Clip, relativeTime: number): void {
        const mesh = object as THREE.Mesh;
        const data = clip.data;
        if (!data) return;

        const material = mesh.material as THREE.ShaderMaterial;
        const g = data.gradient || {};
        const stops = g.stops || [];
        
        // Update basic uniforms
        material.uniforms.time.value = relativeTime;
        material.uniforms.globalTime.value = performance.now() * 0.001;
        
        material.uniforms.gradientSpeed.value = g.gradientSpeed ?? 0.0;
        material.uniforms.offset.value = g.offset ?? 0.0;
        material.uniforms.noiseStrength.value = g.noiseStrength ?? 0.0;
        material.uniforms.noiseSpeed.value = g.noiseSpeed ?? 0.0;
        material.uniforms.noiseScale.value = g.noiseScale ?? 1.0;
        
        material.uniforms.halftoneStrength.value = g.halftoneStrength ?? 0.0;
        material.uniforms.halftoneSize.value = g.halftoneSize ?? 10.0;
        material.uniforms.halftoneAngle.value = g.halftoneAngle ?? 45.0;
        
        material.uniforms.type.value = (g.type || "linear") === "linear" ? 0.0 : 1.0;
        material.uniforms.numStops.value = Math.min(stops.length, 8);
        
        if (g.origin) material.uniforms.origin.value.set(g.origin.x, 1.0 - g.origin.y);
        if (g.destination) material.uniforms.destination.value.set(g.destination.x, 1.0 - g.destination.y);
        
        material.uniforms.wrapMode.value = (g.wrapMode === "mirror" ? 1.0 : g.wrapMode === "clamp" ? 2.0 : 0.0);

        // Update arrays
        const colors = material.uniforms.colors.value;
        const alphas = material.uniforms.alphas.value;
        const positions = material.uniforms.positions.value;

        for (let i = 0; i < 8; i++) {
            const stop = stops[i];
            if (stop) {
                colors[i].set(stop.color);
                alphas[i] = stop.alpha ?? 1.0;
                positions[i] = stop.position;
            }
        }
    }
}
