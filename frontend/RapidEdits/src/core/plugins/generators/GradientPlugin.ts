import { BasePlugin } from "../PluginInterface";
import type { Clip } from "../../../types/Timeline";
import * as THREE from "three";
import { EffectComposer, RenderPass, HalftonePass } from "three-stdlib";
import {
    createPluginId,
    PluginCategory,
    type PluginMetadata,
    type PluginPropertyDefinition,
} from "../PluginTypes";
import { Palette } from "lucide-vue-next";
import { editorEngine } from "../../EditorEngine";

type GradientHalftoneData = {
    enabled?: boolean;
    shape?: number;
    radius?: number;
    rotateR?: number;
    rotateG?: number;
    rotateB?: number;
    scatter?: number;
    blending?: number;
    blendingMode?: number;
    greyscale?: number | boolean;
    disable?: number | boolean;
};

type GradientPostFxData = {
    enabled?: boolean;
    halftone?: GradientHalftoneData;
};

type RuntimeEntry = {
    sourceScene: THREE.Scene;
    sourceCamera: THREE.OrthographicCamera;
    sourceMesh: THREE.Mesh;
    composer: EffectComposer;
    halftonePass: HalftonePass;
    outputTexture: THREE.Texture;
    outputMaterial: THREE.MeshBasicMaterial;
    width: number;
    height: number;
    lastSeenFrame: number;
};

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

    private runtimeByClipId: Map<string, RuntimeEntry> = new Map();
    private frameTick = 0;

    getMetadata(): PluginMetadata {
        return this.metadata;
    }

    createData() {
        return {
            gradient: {
                stops: [
                    { id: "1", position: 0, color: "#4facfe", alpha: 1 },
                    { id: "2", position: 1, color: "#00f2fe", alpha: 1 },
                ],
                type: "linear",
                angle: 0,
                origin: { x: 0.5, y: 0.2 },
                destination: { x: 0.5, y: 0.8 },
                speed: 0,
                noise: 0,
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
            postFx: {
                enabled: false,
                halftone: {
                    enabled: false,
                    shape: 1,
                    radius: 4,
                    rotateR: 15,
                    rotateG: 30,
                    rotateB: 45,
                    scatter: 0,
                    blending: 1,
                    blendingMode: 1,
                    greyscale: 0,
                    disable: 0,
                },
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
                ],
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
                },
            },
            {
                label: "Manual Offset",
                key: "gradient.offset",
                type: "number",
                props: {
                    min: -10,
                    max: 10,
                    step: 0.01,
                },
            },
            {
                label: "Halftone / Post FX",
                key: "sep_halftone",
                type: "divider",
            },
            {
                label: "Enable Post FX",
                key: "postFx.enabled",
                type: "boolean",
                defaultValue: false,
            },
            {
                label: "Enable Halftone",
                key: "postFx.halftone.enabled",
                type: "boolean",
                defaultValue: false,
                showIf: (data) => Boolean(data?.postFx?.enabled),
            },
            {
                label: "Shape",
                key: "postFx.halftone.shape",
                type: "select",
                defaultValue: 1,
                options: [
                    { label: "Dot", value: 1 },
                    { label: "Ellipse", value: 2 },
                    { label: "Line", value: 3 },
                    { label: "Square", value: 4 },
                ],
                showIf: (data) => Boolean(data?.postFx?.enabled && data?.postFx?.halftone?.enabled),
            },
            {
                label: "Radius",
                key: "postFx.halftone.radius",
                type: "number",
                defaultValue: 4,
                props: { min: 1, max: 25, step: 0.1 },
                showIf: (data) => Boolean(data?.postFx?.enabled && data?.postFx?.halftone?.enabled),
            },
            {
                label: "Rotate R (deg)",
                key: "postFx.halftone.rotateR",
                type: "number",
                defaultValue: 15,
                props: { min: 0, max: 90, step: 1 },
                showIf: (data) => Boolean(data?.postFx?.enabled && data?.postFx?.halftone?.enabled),
            },
            {
                label: "Rotate G (deg)",
                key: "postFx.halftone.rotateG",
                type: "number",
                defaultValue: 30,
                props: { min: 0, max: 90, step: 1 },
                showIf: (data) => Boolean(data?.postFx?.enabled && data?.postFx?.halftone?.enabled),
            },
            {
                label: "Rotate B (deg)",
                key: "postFx.halftone.rotateB",
                type: "number",
                defaultValue: 45,
                props: { min: 0, max: 90, step: 1 },
                showIf: (data) => Boolean(data?.postFx?.enabled && data?.postFx?.halftone?.enabled),
            },
            {
                label: "Scatter",
                key: "postFx.halftone.scatter",
                type: "number",
                defaultValue: 0,
                props: { min: 0, max: 1, step: 0.01 },
                showIf: (data) => Boolean(data?.postFx?.enabled && data?.postFx?.halftone?.enabled),
            },
            {
                label: "Blending",
                key: "postFx.halftone.blending",
                type: "number",
                defaultValue: 1,
                props: { min: 0, max: 1, step: 0.01 },
                showIf: (data) => Boolean(data?.postFx?.enabled && data?.postFx?.halftone?.enabled),
            },
            {
                label: "Blend Mode",
                key: "postFx.halftone.blendingMode",
                type: "select",
                defaultValue: 1,
                options: [
                    { label: "Linear", value: 1 },
                    { label: "Multiply", value: 2 },
                    { label: "Add", value: 3 },
                    { label: "Lighter", value: 4 },
                    { label: "Darker", value: 5 },
                ],
                showIf: (data) => Boolean(data?.postFx?.enabled && data?.postFx?.halftone?.enabled),
            },
            {
                label: "Greyscale",
                key: "postFx.halftone.greyscale",
                type: "boolean",
                defaultValue: false,
                showIf: (data) => Boolean(data?.postFx?.enabled && data?.postFx?.halftone?.enabled),
            },
            {
                label: "Disable Pass",
                key: "postFx.halftone.disable",
                type: "boolean",
                defaultValue: false,
                showIf: (data) => Boolean(data?.postFx?.enabled && data?.postFx?.halftone?.enabled),
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
                },
            },
            {
                label: "Noise Speed",
                key: "gradient.noiseSpeed",
                type: "number",
                props: {
                    min: 0,
                    max: 10,
                    step: 0.1,
                },
            },
            {
                label: "Noise Scale",
                key: "gradient.noiseScale",
                type: "number",
                props: {
                    min: 0.1,
                    max: 10,
                    step: 0.1,
                },
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
            uniform float wrapMode; // 0: repeat, 1: mirror, 2: clamp
            varying vec2 vUv;

            float random (vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
            }

            void main() {
                vec2 uv = vUv;
                float t = time + globalTime;

                if (noiseStrength > 0.01) {
                    float noiseT = t * noiseSpeed * 0.1;
                    vec2 noiseUv = uv * noiseScale;
                    uv.x += (random(vec2(noiseUv.y, noiseT)) - 0.5) * noiseStrength * 0.1;
                    uv.y += (random(vec2(noiseUv.x, noiseT)) - 0.5) * noiseStrength * 0.1;
                }

                float f = 0.0;
                float shift = (t * gradientSpeed * 0.2) + offset;

                if (type < 0.5) {
                    vec2 dir = destination - origin;
                    float l2 = dot(dir, dir);
                    if (l2 < 0.0001) {
                        f = 0.0;
                    } else {
                        f = dot(uv - origin, dir) / l2;
                    }
                } else {
                    float dist = distance(uv, origin);
                    float radius = distance(origin, destination);
                    f = radius < 0.0001 ? 0.0 : dist / radius;
                }

                f -= shift;

                if (wrapMode < 0.5) {
                    f = fract(f);
                } else if (wrapMode < 1.5) {
                    f = abs(mod(f - 1.0, 2.0) - 1.0);
                } else {
                    f = clamp(f, 0.0, 1.0);
                }

                vec3 finalColor = colors[0];
                float finalAlpha = alphas[0];

                for (int i = 0; i < 7; i++) {
                    if (i >= numStops - 1) break;

                    float pos1 = positions[i];
                    float pos2 = positions[i+1];

                    if (f >= pos1 && f <= pos2) {
                        float t2 = (f - pos1) / max(0.0001, (pos2 - pos1));
                        finalColor = mix(colors[i], colors[i+1], t2);
                        finalAlpha = mix(alphas[i], alphas[i+1], t2);
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

        const colors = Array.from({ length: 8 }, () => new THREE.Color(0xffffff));
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
            origin: {
                value: new THREE.Vector2(g.origin?.x ?? 0.5, 1.0 - (g.origin?.y ?? 0.2)),
            },
            destination: {
                value: new THREE.Vector2(
                    g.destination?.x ?? 0.5,
                    1.0 - (g.destination?.y ?? 0.8),
                ),
            },
            time: { value: 0.0 },
            globalTime: { value: 0.0 },
            gradientSpeed: { value: g.gradientSpeed ?? 0.0 },
            offset: { value: g.offset ?? 0.0 },
            noiseStrength: { value: g.noiseStrength ?? 0.0 },
            noiseSpeed: { value: g.noiseSpeed ?? 0.0 },
            noiseScale: { value: g.noiseScale ?? 1.0 },
            wrapMode: {
                value: g.wrapMode === "mirror" ? 1.0 : g.wrapMode === "clamp" ? 2.0 : 0.0,
            },
        };
    }

    private createRendererRuntime(clip: Clip): RuntimeEntry | null {
        const renderer = editorEngine.getRenderer()?.sceneManager.renderer;
        if (!renderer) return null;

        const data = clip.data || this.createData();
        const scaleX = Math.max(1, Math.round(data.scale?.x ?? 1920));
        const scaleY = Math.max(1, Math.round(data.scale?.y ?? 1080));

        const sourceScene = new THREE.Scene();
        const sourceCamera = new THREE.OrthographicCamera(
            -scaleX / 2,
            scaleX / 2,
            scaleY / 2,
            -scaleY / 2,
            0.1,
            10,
        );
        sourceCamera.position.z = 1;

        const sourceMaterial = new THREE.ShaderMaterial({
            uniforms: this.getUniforms(data),
            vertexShader: this.getVertexShader(),
            fragmentShader: this.getFragmentShader(),
            transparent: true,
            side: THREE.DoubleSide,
        });

        const sourceMesh = new THREE.Mesh(new THREE.PlaneGeometry(scaleX, scaleY), sourceMaterial);
        sourceScene.add(sourceMesh);

        const rt = new THREE.WebGLRenderTarget(scaleX, scaleY, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
        });
        rt.texture.colorSpace = THREE.SRGBColorSpace;

        const composer = new EffectComposer(renderer, rt);
        composer.renderToScreen = false;

        const renderPass = new RenderPass(sourceScene, sourceCamera);
        const halftonePass = new HalftonePass(scaleX, scaleY, {
            shape: 1,
            radius: 4,
            rotateR: Math.PI / 12,
            rotateG: (Math.PI / 12) * 2,
            rotateB: (Math.PI / 12) * 3,
            scatter: 0,
            blending: 1,
            blendingMode: 1,
            greyscale: 0,
            disable: 0,
        });

        composer.addPass(renderPass);
        composer.addPass(halftonePass);

        const outputTexture = composer.readBuffer.texture;
        outputTexture.colorSpace = THREE.SRGBColorSpace;

        const outputMaterial = new THREE.MeshBasicMaterial({
            map: outputTexture,
            transparent: true,
            side: THREE.DoubleSide,
        });

        return {
            sourceScene,
            sourceCamera,
            sourceMesh,
            composer,
            halftonePass,
            outputTexture,
            outputMaterial,
            width: scaleX,
            height: scaleY,
            lastSeenFrame: this.frameTick,
        };
    }

    private ensureRuntime(clip: Clip): RuntimeEntry | null {
        const existing = this.runtimeByClipId.get(clip.id);
        const data = clip.data || this.createData();
        const desiredW = Math.max(1, Math.round(data.scale?.x ?? 1920));
        const desiredH = Math.max(1, Math.round(data.scale?.y ?? 1080));

        if (existing && existing.width === desiredW && existing.height === desiredH) {
            existing.lastSeenFrame = this.frameTick;
            return existing;
        }

        if (existing) {
            this.disposeRuntimeEntry(existing);
            this.runtimeByClipId.delete(clip.id);
        }

        const created = this.createRendererRuntime(clip);
        if (!created) return null;
        this.runtimeByClipId.set(clip.id, created);
        return created;
    }

    private disposeRuntimeEntry(entry: RuntimeEntry): void {
        const mat = entry.sourceMesh.material;
        if (mat instanceof THREE.Material) mat.dispose();
        entry.sourceMesh.geometry.dispose();
        entry.halftonePass.dispose();
        entry.composer.renderTarget1.dispose();
        entry.composer.renderTarget2.dispose();
        entry.outputMaterial.dispose();
    }

    private cleanupStaleRuntimes(): void {
        const tracks = editorEngine.getTracks();
        const aliveClipIds = new Set<string>();
        tracks.forEach((t) => t.clips.forEach((c) => aliveClipIds.add(c.id)));

        for (const [clipId, entry] of this.runtimeByClipId.entries()) {
            const staleByTimeline = !aliveClipIds.has(clipId);
            const staleByFrame = this.frameTick - entry.lastSeenFrame > 240;
            if (staleByTimeline || staleByFrame) {
                this.disposeRuntimeEntry(entry);
                this.runtimeByClipId.delete(clipId);
            }
        }
    }

    private applyHalftoneParams(pass: HalftonePass, clip: Clip): void {
        const data = clip.data || {};
        const postFx = (data.postFx || {}) as GradientPostFxData;
        const halftone = (postFx.halftone || {}) as GradientHalftoneData;

        const enabled = Boolean(postFx.enabled && halftone.enabled);

        pass.uniforms.shape.value = halftone.shape ?? 1;
        pass.uniforms.radius.value = halftone.radius ?? 4;
        pass.uniforms.rotateR.value = THREE.MathUtils.degToRad(halftone.rotateR ?? 15);
        pass.uniforms.rotateG.value = THREE.MathUtils.degToRad(halftone.rotateG ?? 30);
        pass.uniforms.rotateB.value = THREE.MathUtils.degToRad(halftone.rotateB ?? 45);
        pass.uniforms.scatter.value = halftone.scatter ?? 0;
        pass.uniforms.blending.value = halftone.blending ?? 1;
        pass.uniforms.blendingMode.value = halftone.blendingMode ?? 1;
        const greyscale = typeof halftone.greyscale === "number"
            ? halftone.greyscale
            : (halftone.greyscale ? 1 : 0);
        const disableValue = typeof halftone.disable === "number"
            ? halftone.disable
            : (halftone.disable ? 1 : 0);
        pass.uniforms.greyscale.value = greyscale;
        pass.uniforms.disable.value = !enabled ? 1 : disableValue;
    }

    render(clip: Clip): THREE.Object3D | null {
        const runtime = this.ensureRuntime(clip);
        if (!runtime) return null;

        // Keep a unit plane for scene placement. Clip scale is applied by ThreeClipManager.
        const outputMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            runtime.outputMaterial,
        );
        outputMesh.userData.isSelectable = true;
        outputMesh.userData.clipId = clip.id;
        return outputMesh;
    }

    update(object: THREE.Object3D, clip: Clip, relativeTime: number): void {
        this.frameTick += 1;
        if (this.frameTick % 120 === 0) {
            this.cleanupStaleRuntimes();
        }

        const runtime = this.ensureRuntime(clip);
        if (!runtime) return;

        const mesh = object as THREE.Mesh;
        const data = clip.data || this.createData();
        const g = data.gradient || {};
        const stops = g.stops || [];

        const sourceMaterial = runtime.sourceMesh.material as THREE.ShaderMaterial;
        sourceMaterial.uniforms.time.value = relativeTime;
        sourceMaterial.uniforms.globalTime.value = performance.now() * 0.001;
        sourceMaterial.uniforms.gradientSpeed.value = g.gradientSpeed ?? 0.0;
        sourceMaterial.uniforms.offset.value = g.offset ?? 0.0;
        sourceMaterial.uniforms.noiseStrength.value = g.noiseStrength ?? 0.0;
        sourceMaterial.uniforms.noiseSpeed.value = g.noiseSpeed ?? 0.0;
        sourceMaterial.uniforms.noiseScale.value = g.noiseScale ?? 1.0;
        sourceMaterial.uniforms.type.value = (g.type || "linear") === "linear" ? 0.0 : 1.0;
        sourceMaterial.uniforms.numStops.value = Math.min(stops.length, 8);
        sourceMaterial.uniforms.wrapMode.value =
            g.wrapMode === "mirror" ? 1.0 : g.wrapMode === "clamp" ? 2.0 : 0.0;

        if (g.origin) {
            sourceMaterial.uniforms.origin.value.set(g.origin.x, 1.0 - g.origin.y);
        }
        if (g.destination) {
            sourceMaterial.uniforms.destination.value.set(
                g.destination.x,
                1.0 - g.destination.y,
            );
        }

        const colors = sourceMaterial.uniforms.colors.value;
        const alphas = sourceMaterial.uniforms.alphas.value;
        const positions = sourceMaterial.uniforms.positions.value;

        for (let i = 0; i < 8; i++) {
            const stop = stops[i];
            if (stop) {
                colors[i].set(stop.color);
                alphas[i] = stop.alpha ?? 1.0;
                positions[i] = stop.position;
            }
        }

        this.applyHalftoneParams(runtime.halftonePass, clip);
        runtime.composer.render();
        // Composer swaps read/write buffers each frame (ping-pong).
        // Rebind the output map to avoid frame-to-frame texture flipping/flicker.
        runtime.outputMaterial.map = runtime.composer.readBuffer.texture;
        runtime.outputMaterial.needsUpdate = true;

        if (mesh.material !== runtime.outputMaterial) {
            mesh.material = runtime.outputMaterial;
        }

        runtime.lastSeenFrame = this.frameTick;
    }
}
