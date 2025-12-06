export const PluginCategory = {
    Core: "core",
    Effects: "effects",
    Transitions: "transitions",
} as const;

export type PluginCategory =
    (typeof PluginCategory)[keyof typeof PluginCategory];

export const PluginType = {
    Text: "text",
    Image: "image",
    Video: "video",
} as const;

export type PluginType = (typeof PluginType)[keyof typeof PluginType];

export type PluginId = `${PluginCategory}.${string}`;

export function createPluginId(
    category: PluginCategory,
    name: string,
): PluginId {
    return `${category}.${name}`;
}

export interface FilmstripConfig {
    /**
     * Background color for the filmstrip thumbnail.
     * Useful for text or transparent objects.
     */
    backgroundColor?: number | string;

    /**
     * Padding factor for the camera auto-fit.
     * Default is 1.2
     */
    cameraPadding?: number;

    /**
     * Field of view size override (if using Orthographic, this affects zoom)
     */
    zoom?: number;

    /**
     * If true, uses a perspective camera instead of orthographic
     */
    usePerspective?: boolean;
}
