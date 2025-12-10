import type { Clip } from "../../types/Timeline";
import * as THREE from "three";
import type { FilmstripConfig, PluginPropertyDefinition } from "./PluginTypes";

export interface IPlugin {
    id: string; // Now we encourage using createPluginId helper, but string is fine for flexibility
    name: string;
    type: "object" | "effect" | "transition";
    icon?: any; // Component or string

    // Initialize the plugin (load assets etc)
    init(): Promise<void>;

    // Create the default data for a new clip of this type
    createData(): Record<string, any>;

    // Render logic: Create the ThreeJS object for this clip
    render(clip: Clip): THREE.Object3D | null;

    // Update logic: Called every frame to update the object (animate props)
    update(
        object: THREE.Object3D,
        clip: Clip,
        time: number,
        frameDuration: number,
    ): void;

    // Get configuration for the filmstrip thumbnail generation
    getFilmstripConfig?(clip: Clip): FilmstripConfig;

    // Vue component for the properties panel (Optional if properties is defined)
    propertiesComponent?: any;

    // Data-driven properties definition
    properties?: PluginPropertyDefinition[];

    // Can this plugin be dropped directly onto a track? (Default: true)
    isTrackDroppable?: boolean;
}

export interface TransitionPlugin extends IPlugin {
    type: "transition";
    /**
     * Apply the transition effect to target objects.
     * @param clip The transition clip itself (contains properties like duration, easing)
     * @param targets The ThreeJS objects (video/text/image meshes) this transition affects
     * @param progress The normalized progress of the transition (0 to 1) based on clip time
     * @param time The absolute time in the timeline (optional)
     */
    apply(
        clip: Clip,
        targets: THREE.Object3D[],
        progress: number,
        time: number,
    ): void;
}

export abstract class BasePlugin implements IPlugin {
    abstract id: string;
    abstract name: string;
    abstract type: "object" | "effect" | "transition";
    propertiesComponent?: any;
    properties?: PluginPropertyDefinition[];

    async init(): Promise<void> {}

    abstract createData(): Record<string, any>;

    // Default render returns null for transitions/effects as they don't have their own mesh usually.
    // But they CAN have a mesh if they self-render (like a particle overlay).
    render(_clip: Clip): THREE.Object3D | null {
        return null;
    }

    update(
        object: THREE.Object3D,
        clip: Clip,
        _time: number,
        _frameDuration: number,
    ): void {
        // Default update logic (can be overridden)
        if (clip.data?.position) {
            object.position.set(
                clip.data.position.x || 0,
                clip.data.position.y || 0,
                clip.data.position.z || 0,
            );
        }
        if (clip.data?.rotation) {
            object.rotation.set(
                clip.data.rotation.x || 0,
                clip.data.rotation.y || 0,
                clip.data.rotation.z || 0,
            );
        }
        if (clip.data?.scale) {
            object.scale.set(
                clip.data.scale.x || 1,
                clip.data.scale.y || 1,
                clip.data.scale.z || 1,
            );
        }
    }

    getFilmstripConfig(_clip: Clip): FilmstripConfig {
        return {};
    }
}
