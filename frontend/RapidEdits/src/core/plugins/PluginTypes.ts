/**
 * Plugin system: strict type-safe identities and contracts
 */

export const PluginCategory = {
    Core: "core",
    Effects: "effects",
    Transitions: "transitions",
} as const;

export type PluginCategory =
    (typeof PluginCategory)[keyof typeof PluginCategory];

/**
 * Branded type for plugin IDs.
 * Ensures IDs follow the pattern: category.name
 * All plugin IDs must be created through createPluginId helper.
 */
export type PluginId = string & { readonly __brand: "PluginId" };

/**
 * Create a strongly-typed plugin ID.
 * @param category One of "core" | "effects" | "transitions"
 * @param name The plugin name (lowercase, hyphen-separated)
 * @returns A branded PluginId that is safe to use in type-safe lookups
 */
export function createPluginId(
    category: PluginCategory,
    name: string,
): PluginId {
    const id = `${category}.${name}` as PluginId;
    return id;
}

/**
 * Plugin metadata for introspection and discovery.
 * Enables the UI and runtime to understand plugin capabilities without instantiation.
 */
export interface PluginMetadata {
    /** Unique plugin identifier */
    id: PluginId;
    /** Human-readable name */
    name: string;
    /** Category: "object" | "effect" | "transition" */
    type: "object" | "effect" | "transition";
    /** Version for future migration support */
    version: string;
    /** Short description */
    description?: string;
    /** Icon (URL, SVG string, or Vue component) */
    icon?: any;
    /** Can this plugin be dragged directly onto a track? (default: true for objects, false for effects/transitions) */
    isTrackDroppable?: boolean;
    /** Can this plugin be attached to other clips as a transition? */
    isAttachedTransition?: boolean;
    /** For attached transitions, which slot does it occupy? "in" | "out" | "any" */
    transitionSlot?: "in" | "out" | "any";
    /** Should this plugin's properties be shown globally for all applicable clips? */
    isGlobalInspector?: boolean;
    /** Rendering priority for global inspectors (lower = higher up) */
    priority?: number;
    /** Dependencies on other plugins, if any */
    dependencies?: PluginId[];
    /** Default data for initialization */
    defaultData?: any;
}

/**
 * Property definition for plugin data schema.
 * Each property connects to a key in the plugin's data object.
 * Supports nested paths and conditional rendering.
 */
export interface PluginPropertyDefinition {
    /** Display label in UI */
    label: string;
    /** Path to data field, e.g., "fontSize" or "position.x" */
    key: string;
    /** Property type determines rendering component */
    type: PluginPropertyType;
    /** Default value if not set */
    defaultValue?: any;
    /** HTML/component props like min, max, step, placeholder */
    props?: Record<string, any>;
    /** For select type: available options */
    options?: { label: string; value: any }[];
    /** Conditional visibility based on clip data */
    showIf?: (data: any) => boolean;
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
    | "vector2"
    | "vector3"
    | "vector4"
    | "select"
    | "long-text"
    | "slider"
    | "divider";

/**
 * Quick Actions: Small floating UI for contextual edits.
 * Displayed near selection handles.
 */
export interface QuickActionDefinition {
    id: string;
    label: string;
    icon: any; // Lucide component or similar
    /** The properties to show in the popover when this action is clicked */
    properties: PluginPropertyDefinition[];
}
