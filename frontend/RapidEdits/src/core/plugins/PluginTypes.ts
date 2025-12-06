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

    /**
     * If true, disable auto-fitting the camera to the object.
     * Use with fixedSceneWidth to show relative scale.
     */
    disableAutoFit?: boolean;

    /**
     * The width of the scene in world units to capture.
     * Required if disableAutoFit is true.
     * Default might be 1920.
     */
    fixedSceneWidth?: number;
}

export type PluginPropertyType =
    | "text"
    | "number"
    | "color"
    | "boolean"
    | "vector3"
    | "select"
    | "long-text";

export interface PluginPropertyDefinition {
    label: string;
    key: string; // path to data e.g. "fontSize" or "position" (for vector3 it takes the object)
    type: PluginPropertyType;
    defaultValue?: any;
    props?: Record<string, any>; // HTML props like min, max, step, placeholder
    options?: { label: string; value: any }[]; // For select type
    showIf?: (data: any) => boolean; // Conditional rendering
}
