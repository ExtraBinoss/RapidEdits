import type { Clip } from "../../types/Timeline";
import * as THREE from "three";
import type { FilmstripConfig, PluginId } from "./PluginTypes";

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

    // Vue component for the properties panel
    propertiesComponent: any;
}

export abstract class BasePlugin implements IPlugin {
    abstract id: string;
    abstract name: string;
    abstract type: "object" | "effect" | "transition";
    abstract propertiesComponent: any;

    async init(): Promise<void> {}

    abstract createData(): Record<string, any>;

    abstract render(clip: Clip): THREE.Object3D | null;

    update(
        object: THREE.Object3D,
        clip: Clip,
        time: number,
        frameDuration: number,
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

    getFilmstripConfig(clip: Clip): FilmstripConfig {
        return {};
    }
}
