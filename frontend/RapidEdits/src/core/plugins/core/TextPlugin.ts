import { BasePlugin } from "../PluginInterface";
import type { Clip } from "../../../types/Timeline";
import * as THREE from "three";
// @ts-ignore
import { Text } from "troika-three-text";

import {
    createPluginId,
    PluginCategory,
    type FilmstripConfig,
    type PluginPropertyDefinition,
    type PluginMetadata,
} from "../PluginTypes";

/**
 * Text 3D Plugin: renders stylized text using Troika-three-text.
 * Supports system fonts and advanced 3D stacking extrusion with tapering and glow.
 */
export class TextPlugin extends BasePlugin {
    private static systemFamilies: { label: string; value: string }[] = [];
    private static fontsByFamily: Map<string, any[]> = new Map();
    private static isFontsLoading = false;
    private static blobUrls: Map<string, string> = new Map();

    private metadata: PluginMetadata = {
        id: createPluginId(PluginCategory.Core, "text"),
        name: "Text 3D",
        type: "object",
        version: "1.6.0",
        description: "Advanced 3D text with dynamic font weight and style selection",
        isTrackDroppable: true,
    };

    getMetadata(): PluginMetadata {
        return this.metadata;
    }

    async init() {
        if (TextPlugin.systemFamilies.length === 0 && !TextPlugin.isFontsLoading) {
            TextPlugin.isFontsLoading = true;
            try {
                // @ts-ignore
                if ('queryLocalFonts' in window) {
                    // @ts-ignore
                    const fonts = await window.queryLocalFonts();
                    fonts.forEach((f: any) => {
                        if (!TextPlugin.fontsByFamily.has(f.family)) {
                            TextPlugin.fontsByFamily.set(f.family, []);
                        }
                        TextPlugin.fontsByFamily.get(f.family)!.push(f);
                    });

                    TextPlugin.systemFamilies = Array.from(TextPlugin.fontsByFamily.keys()).map(family => ({
                        label: family,
                        value: family
                    })).sort((a, b) => a.label.localeCompare(b.label));
                }
            } catch (e) {
                console.warn("Failed to fetch local fonts:", e);
            } finally {
                const defaults = ["Arial", "Helvetica", "Times New Roman", "Courier New"];
                if (TextPlugin.systemFamilies.length === 0) {
                    TextPlugin.systemFamilies = defaults.map(f => ({ label: f, value: f }));
                }
                TextPlugin.isFontsLoading = false;
            }
        }
    }

    private async getFontUrl(family: string, weight?: number, style?: string): Promise<string> {
        const key = `${family}-${weight}-${style}`;
        if (TextPlugin.blobUrls.has(key)) {
            return TextPlugin.blobUrls.get(key)!;
        }

        const familyFonts = TextPlugin.fontsByFamily.get(family);
        if (familyFonts) {
            // Try to find exact match
            let bestMatch = familyFonts.find(f => f.weight === weight && f.style === style);
            // Fallback to closest weight if style matches
            if (!bestMatch) bestMatch = familyFonts.find(f => f.style === style);
            // Fallback to first font in family
            if (!bestMatch) bestMatch = familyFonts[0];

            if (bestMatch && typeof bestMatch.blob === 'function') {
                try {
                    const blob = await bestMatch.blob();
                    const url = URL.createObjectURL(blob);
                    TextPlugin.blobUrls.set(key, url);
                    return url;
                } catch (e) {
                    console.error("Failed to get font blob for", family, e);
                }
            }
        }
        return family;
    }

    createData() {
        return {
            text: "3D STYLE",
            fontFamily: "Arial",
            fontWeight: 400,
            fontStyle: "normal",
            fontSize: 60,
            color: "#ffffff",
            depthColor: "#3b82f6",
            emissiveIntensity: 0.2,
            outlineWidth: 0,
            outlineColor: "#000000",
            letterSpacing: 0,
            lineHeight: 1.2,
            curveRadius: 0,
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            is3D: true,
            depth: 10,
            taper: 0,
            autoFit: false,
            textAlign: "center",
        };
    }

    getProperties(data?: any): PluginPropertyDefinition[] {
        const selectedFamily = data?.fontFamily || "Arial";
        const familyFonts = TextPlugin.fontsByFamily.get(selectedFamily) || [];

        // Get unique weights for the selected family
        const weights = Array.from(new Set(familyFonts.map(f => f.weight)))
            .sort((a, b) => a - b)
            .map(w => ({ label: this.getWeightLabel(w), value: w }));

        // Get unique styles for the selected family
        const styles = Array.from(new Set(familyFonts.map(f => f.style)))
            .map(s => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s }));

        return [
            {
                label: "Content",
                key: "text",
                type: "long-text",
                props: { rows: 2, placeholder: "Enter text..." },
            },
            {
                label: "Font Family",
                key: "fontFamily",
                type: "select",
                options: TextPlugin.systemFamilies,
            },
            {
                label: "Weight",
                key: "fontWeight",
                type: "select",
                options: weights.length > 0 ? weights : [{ label: "Normal", value: 400 }],
                showIf: () => weights.length > 1,
            },
            {
                label: "Style",
                key: "fontStyle",
                type: "select",
                options: styles.length > 0 ? styles : [{ label: "Normal", value: "normal" }],
                showIf: () => styles.length > 1,
            },
            {
                label: "Typography",
                key: "sep_typo",
                type: "divider",
            },
            {
                label: "Size",
                key: "fontSize",
                type: "slider",
                props: { min: 1, max: 200, step: 1 },
            },
            {
                label: "Letter Spacing",
                key: "letterSpacing",
                type: "slider",
                props: { min: -0.1, max: 0.5, step: 0.01 },
            },
            {
                label: "Line Height",
                key: "lineHeight",
                type: "slider",
                props: { min: 0.5, max: 3, step: 0.1 },
            },
            {
                label: "Curve",
                key: "curveRadius",
                type: "slider",
                props: { min: -500, max: 500, step: 10 },
            },
            {
                label: "Appearance",
                key: "sep_app",
                type: "divider",
            },
            {
                label: "Color",
                key: "color",
                type: "color",
            },
            {
                label: "Glow Intensity",
                key: "emissiveIntensity",
                type: "slider",
                props: { min: 0, max: 2, step: 0.1 },
            },
            {
                label: "Outline Width",
                key: "outlineWidth",
                type: "slider",
                props: { min: 0, max: 20, step: 1 },
            },
            {
                label: "Outline Color",
                key: "outlineColor",
                type: "color",
            },
            {
                label: "3D Extrusion",
                key: "sep_3d",
                type: "divider",
            },
            {
                label: "Enable 3D",
                key: "is3D",
                type: "boolean",
            },
            {
                label: "Depth Length",
                key: "depth",
                type: "slider",
                props: { min: 0, max: 30, step: 1 },
                showIf: (data: any) => data.is3D,
            },
            {
                label: "Extrusion Color",
                key: "depthColor",
                type: "color",
                showIf: (data: any) => data.is3D,
            },
            {
                label: "Depth Taper",
                key: "taper",
                type: "slider",
                props: { min: -1, max: 1, step: 0.05 },
                showIf: (data: any) => data.is3D,
            },
            {
                label: "Transform",
                key: "sep_trans",
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
        ];
    }

    private getWeightLabel(weight: number): string {
        const weights: Record<number, string> = {
            100: "Thin",
            200: "Extra Light",
            300: "Light",
            400: "Normal",
            500: "Medium",
            600: "Semi Bold",
            700: "Bold",
            800: "Extra Bold",
            900: "Black",
        };
        return weights[weight] || `Weight ${weight}`;
    }

    render(clip: Clip): THREE.Object3D | null {
        const data = clip.data || this.createData();
        const group = new THREE.Group();

        // Metadata
        group.userData.isSelectable = true;
        group.userData.clipId = clip.id;
        group.userData.lastState = JSON.parse(JSON.stringify(data));
        group.userData.layers = [];

        this.syncLayers(group, data);
        this.updateTransform(group, data);

        return group;
    }

    private createLayer(data: any, color: string, z: number): any {
        const textObj = new Text();
        textObj.anchorX = "center";
        textObj.anchorY = "middle";
        textObj.position.z = z;
        this.updateLayerProperties(textObj, data, color);
        
        this.getFontUrl(data.fontFamily, data.fontWeight, data.fontStyle).then(url => {
            textObj.font = url;
            textObj.sync();
        });

        textObj.sync();
        return textObj;
    }

    private updateLayerProperties(layer: any, data: any, color: string) {
        layer.text = data.text;
        layer.fontSize = data.fontSize;
        layer.color = color;
        layer.textAlign = data.textAlign || "center";
        layer.letterSpacing = data.letterSpacing || 0;
        layer.lineHeight = data.lineHeight || 1.2;
        layer.curveRadius = data.curveRadius || 0;
        
        // Advanced material props for glow
        layer.materialProps = {
            emissive: new THREE.Color(color),
            emissiveIntensity: data.emissiveIntensity || 0,
        };

        // Outline
        layer.outlineWidth = (data.outlineWidth || 0) * 0.01 * data.fontSize;
        layer.outlineColor = data.outlineColor || "#000000";
    }

    private syncLayers(group: THREE.Group, data: any) {
        const layers = group.userData.layers as any[];
        const depth = data.is3D ? Math.floor(data.depth || 0) : 0;
        
        // Remove extra layers
        while (layers.length > depth + 1) {
            const layer = layers.pop();
            group.remove(layer);
            layer.dispose && layer.dispose();
        }

        // Update existing layers and add missing ones
        for (let i = 0; i <= depth; i++) {
            const isMain = i === 0;
            const z = isMain ? 0.05 : -i * 1.5; 
            const color = isMain ? data.color : data.depthColor;
            
            let layer = layers[i];
            if (!layer) {
                layer = this.createLayer(data, color, z);
                layers.push(layer);
                group.add(layer);
            }

            this.updateLayerProperties(layer, data, color);
            layer.position.z = z;

            // Apply taper effect
            if (data.is3D && data.taper !== 0) {
                const s = 1 + (i * data.taper * 0.05);
                layer.scale.set(s, s, 1);
            } else {
                layer.scale.set(1, 1, 1);
            }
            
            // Check if font changed
            const fontKey = `${data.fontFamily}-${data.fontWeight}-${data.fontStyle}`;
            if (layer.userData.lastFontKey !== fontKey) {
                this.getFontUrl(data.fontFamily, data.fontWeight, data.fontStyle).then(url => {
                    layer.font = url;
                    layer.sync();
                });
                layer.userData.lastFontKey = fontKey;
            }

            layer.sync();
        }
    }

    update(
        object: THREE.Object3D,
        clip: Clip,
        _time: number,
        _frameDuration: number,
    ): void {
        const group = object as THREE.Group;
        const data = clip.data;
        if (!data) return;

        const prevData = group.userData.lastState;
        
        const needsFullSync = !prevData || 
            prevData.is3D !== data.is3D || 
            prevData.depth !== data.depth || 
            prevData.taper !== data.taper ||
            prevData.text !== data.text ||
            prevData.textAlign !== data.textAlign ||
            prevData.fontFamily !== data.fontFamily ||
            prevData.fontWeight !== data.fontWeight ||
            prevData.fontStyle !== data.fontStyle ||
            prevData.fontSize !== data.fontSize ||
            prevData.letterSpacing !== data.letterSpacing ||
            prevData.lineHeight !== data.lineHeight ||
            prevData.curveRadius !== data.curveRadius ||
            prevData.color !== data.color ||
            prevData.emissiveIntensity !== data.emissiveIntensity ||
            prevData.outlineWidth !== data.outlineWidth ||
            prevData.outlineColor !== data.outlineColor ||
            prevData.depthColor !== data.depthColor;

        if (needsFullSync) {
            this.syncLayers(group, data);
        }

        group.userData.lastState = JSON.parse(JSON.stringify(data));
        this.updateTransform(group, data);
    }

    updateTransform(group: THREE.Object3D, data: any) {
        group.position.set(data.position.x, data.position.y, data.position.z);
        group.rotation.set(
            THREE.MathUtils.degToRad(data.rotation.x),
            THREE.MathUtils.degToRad(data.rotation.y),
            THREE.MathUtils.degToRad(data.rotation.z)
        );
        group.scale.set(data.scale.x, data.scale.y, data.scale.z);
    }

    getFilmstripConfig(clip: Clip): FilmstripConfig {
        const data = clip.data || this.createData();
        return {
            backgroundColor: "#000000",
            disableAutoFit: !data.autoFit,
            fixedSceneWidth: 1920,
        };
    }
}
