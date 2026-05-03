/**
 * Plugin contract: generalized, strongly-typed interfaces for all plugin types.
 *
 * A plugin is a reusable unit of functionality that can:
 * - Define its own data schema (createData)
 * - Expose configurable properties (properties)
 * - Render itself or modify targets (render/apply)
 * - Update state over time (update)
 * - Provide metadata for introspection (getMetadata)
 */

import type { Clip } from "../../types/Timeline";
import * as THREE from "three";
import type {
    FilmstripConfig,
    PluginPropertyDefinition,
    PluginMetadata,
    PluginId,
} from "./PluginTypes";

/**
 * Base interface for all plugins.
 * Plugins must implement metadata, data creation, and lifecycle hooks.
 */
export interface IPlugin {
    /**
     * Unique identifier for this plugin.
     * Branded type ensures it follows the pattern: category.name
     */
    getMetadata(): PluginMetadata;

    /**
     * Initialize the plugin (load assets, setup state, etc).
     * Called once when the plugin is registered.
     */
    init(): Promise<void>;

    /**
     * Create the default data object for a new clip of this plugin type.
     * The shape of this object defines what properties can be configured.
     */
    createData(): Record<string, any>;

    /**
     * Properties schema for UI generation.
     * Each property corresponds to a key in createData.
     */
    getProperties?(data?: any): PluginPropertyDefinition[] | undefined;

    /**
     * Render: create or return the THREE.Object3D for this clip.
     * For objects: return the mesh to be added to the scene.
     * For effects/transitions: may return null (they modify targets instead).
     */
    render(clip: Clip): THREE.Object3D | null;

    /**
     * Update: called every frame to animate/transform the object.
     * @param object The THREE.Object3D created by render
     * @param clip The clip data
     * @param time Relative time within the clip (0 to duration)
     * @param frameDuration Duration of one frame (1/60)
     */
    update(
        object: THREE.Object3D,
        clip: Clip,
        time: number,
        frameDuration: number,
    ): void;

    /**
     * Optional: get config for thumbnail/filmstrip generation.
     */
    getFilmstripConfig?(clip: Clip): FilmstripConfig;
}

/**
 * Object plugins: create content (text, shapes, images, video).
 * They render a mesh and update it over time.
 * Can be dropped onto a track.
 */
export interface ObjectPlugin extends IPlugin {
    /**
     * Object plugins have type "object" in metadata.
     * This is enforced at registration time.
     */
}

/**
 * Effect plugins: modify target clips (blur, glow, zoom, etc).
 * They do not render their own mesh, but apply transformations to targets.
 * Typically cannot be dropped directly on a track (they apply to existing clips).
 */
export interface EffectPlugin extends IPlugin {
    /**
     * Apply the effect to target objects.
     * @param clip The effect clip (contains properties/settings)
     * @param targets The THREE.Object3D targets this effect applies to
     * @param time Relative time within the effect clip
     * @param totalTime Absolute time in the timeline
     */
    apply(
        clip: Clip,
        targets: THREE.Object3D[],
        time: number,
        totalTime: number,
    ): void;
}

/**
 * Transition plugins: blend or reveal between clips.
 * They apply time-based transformations to targets during a transition window.
 */
export interface TransitionPlugin extends IPlugin {
    /**
     * Apply the transition effect to target objects.
     * @param clip The transition clip (contains properties like duration, easing)
     * @param targets The THREE.Object3D objects this transition affects
     * @param progress Normalized progress of the transition (0 to 1)
     * @param time Absolute time in the timeline
     */
    apply(
        clip: Clip,
        targets: THREE.Object3D[],
        progress: number,
        time: number,
    ): void;
}

/**
 * Base class for plugin implementations.
 * Provides default implementations for common patterns.
 */
export abstract class BasePlugin implements IPlugin {
    /**
     * Plugins must define their metadata.
     * Use this to return static metadata about the plugin.
     */
    abstract getMetadata(): PluginMetadata;

    /**
     * Default: no initialization required.
     */
    async init(): Promise<void> {}

    /**
     * Each plugin must define what data it uses.
     */
    abstract createData(): Record<string, any>;

    /**
     * Optional: define properties for the UI.
     * Return undefined if this plugin has no configurable properties.
     */
    getProperties?(data?: any): PluginPropertyDefinition[] | undefined {
        return undefined;
    }

    /**
     * Default: object plugins return null (no self-render).
     * Override to render a mesh.
     */
    render(_clip: Clip): THREE.Object3D | null {
        return null;
    }

    /**
     * Default: apply position/rotation/scale from clip.data.
     * Override for custom behavior.
     */
    update(
        object: THREE.Object3D,
        clip: Clip,
        _time: number,
        _frameDuration: number,
    ): void {
        const data = clip.data;
        if (!data) return;

        if (data.position) {
            object.position.set(
                data.position.x ?? 0,
                data.position.y ?? 0,
                data.position.z ?? 0,
            );
        }
        if (data.rotation) {
            object.rotation.set(
                data.rotation.x ?? 0,
                data.rotation.y ?? 0,
                data.rotation.z ?? 0,
            );
        }
        if (data.scale) {
            object.scale.set(
                data.scale.x ?? 1,
                data.scale.y ?? 1,
                data.scale.z ?? 1,
            );
        }
    }

    /**
     * Optional filmstrip config.
     */
    getFilmstripConfig(_clip: Clip): FilmstripConfig {
        return {};
    }
}
