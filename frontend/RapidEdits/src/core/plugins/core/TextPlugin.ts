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
 * Supports system fonts and advanced 3D stacking extrusion.
 */
export class TextPlugin extends BasePlugin {
    private static systemFonts: { label: string; value: string }[] = [];
    private static fontDataMap: Map<string, any> = new Map();
    private static isFontsLoading = false;
    private static blobUrls: Map<string, string> = new Map();

    private metadata: PluginMetadata = {
        id: createPluginId(PluginCategory.Core, "text"),
        name: "Text 3D",
        type: "object",
        version: "1.4.0",
        description: "High-quality text with Troika and system fonts",
        isTrackDroppable: true,
    };

    getMetadata(): PluginMetadata {
        return this.metadata;
    }

    async init() {
        if (TextPlugin.systemFonts.length === 0 && !TextPlugin.isFontsLoading) {
            TextPlugin.isFontsLoading = true;
            try {
                // @ts-ignore
                if ('queryLocalFonts' in window) {
                    // @ts-ignore
                    const fonts = await window.queryLocalFonts();
                    TextPlugin.systemFonts = fonts.map((f: any) => {
                        TextPlugin.fontDataMap.set(f.family, f);
                        return {
                            label: f.fullName,
                            value: f.family
                        };
                    }).sort((a: any, b: any) => a.label.localeCompare(b.label));
                }
            } catch (e) {
                console.warn("Failed to fetch local fonts:", e);
            } finally {
                const defaults = [
                    { label: "Arial", value: "Arial" },
                    { label: "Helvetica", value: "Helvetica" },
                    { label: "Times New Roman", value: "Times New Roman" },
                    { label: "Courier New", value: "Courier New" },
                ];
                
                if (TextPlugin.systemFonts.length === 0) {
                    TextPlugin.systemFonts = defaults;
                }
                
                TextPlugin.isFontsLoading = false;
            }
        }
    }

    private async getFontUrl(family: string): Promise<string> {
        if (TextPlugin.blobUrls.has(family)) {
            return TextPlugin.blobUrls.get(family)!;
        }

        const fontData = TextPlugin.fontDataMap.get(family);
        if (fontData && typeof fontData.blob === 'function') {
            try {
                const blob = await fontData.blob();
                const url = URL.createObjectURL(blob);
                TextPlugin.blobUrls.set(family, url);
                return url;
            } catch (e) {
                console.error("Failed to get font blob for", family, e);
            }
        }
        return family;
    }

    createData() {
        return {
            text: "TEXT 3D",
            fontFamily: "Arial",
            fontSize: 60,
            color: "#ffffff",
            depthColor: "#3b82f6",
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            is3D: true,
            depth: 10,
            autoFit: false,
            textAlign: "center",
        };
    }

    getProperties(): PluginPropertyDefinition[] {
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
                options: TextPlugin.systemFonts,
            },
            {
                label: "Appearance",
                key: "sep1",
                type: "divider",
            },
            {
                label: "Size",
                key: "fontSize",
                type: "slider",
                props: { min: 1, max: 200, step: 1 },
            },
            {
                label: "Color",
                key: "color",
                type: "color",
            },
            {
                label: "Alignment",
                key: "textAlign",
                type: "select",
                options: [
                    { label: "Left", value: "left" },
                    { label: "Center", value: "center" },
                    { label: "Right", value: "right" },
                ]
            },
            {
                label: "Transform",
                key: "sep2",
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
                label: "3D Extrusion",
                key: "sep3",
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
                label: "System",
                key: "sep4",
                type: "divider",
            },
            {
                label: "Filmstrip Auto-Fit",
                key: "autoFit",
                type: "boolean",
            },
        ];
    }

    render(clip: Clip): THREE.Object3D | null {
        const data = clip.data || this.createData();
        const group = new THREE.Group();

        // Create main face
        const mainText = this.createLayer(data, data.color, 0);
        group.add(mainText);

        // Metadata
        group.userData.isSelectable = true;
        group.userData.clipId = clip.id;
        group.userData.lastState = JSON.parse(JSON.stringify(data));
        group.userData.layers = [mainText];

        this.syncLayers(group, data);
        this.updateTransform(group, data);

        return group;
    }

    private createLayer(data: any, color: string, z: number): any {
        const textObj = new Text();
        textObj.text = data.text;
        textObj.fontSize = data.fontSize;
        textObj.color = color;
        textObj.textAlign = data.textAlign || "center";
        textObj.anchorX = "center";
        textObj.anchorY = "middle";
        textObj.position.z = z;
        
        this.getFontUrl(data.fontFamily).then(url => {
            textObj.font = url;
            textObj.sync();
        });

        textObj.sync();
        return textObj;
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
            const z = isMain ? 0.05 : -i * 1.5; // Stacking step
            const color = isMain ? data.color : data.depthColor;
            
            let layer = layers[i];
            if (!layer) {
                layer = this.createLayer(data, color, z);
                layers.push(layer);
                group.add(layer);
            }

            // Sync properties
            layer.text = data.text;
            layer.fontSize = data.fontSize;
            layer.color = color;
            layer.textAlign = data.textAlign || "center";
            layer.position.z = z;
            
            // Check if font changed
            if (layer.userData.lastFont !== data.fontFamily) {
                this.getFontUrl(data.fontFamily).then(url => {
                    layer.font = url;
                    layer.sync();
                });
                layer.userData.lastFont = data.fontFamily;
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
            prevData.text !== data.text ||
            prevData.textAlign !== data.textAlign ||
            prevData.fontFamily !== data.fontFamily ||
            prevData.fontSize !== data.fontSize ||
            prevData.color !== data.color ||
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
