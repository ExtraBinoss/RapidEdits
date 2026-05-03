/**
 * Plugin Registry: type-safe, manifest-driven plugin registration and lookup.
 *
 * The registry maintains a single source of truth for all plugins.
 * It enforces type safety at registration and lookup time.
 */

import type {
    IPlugin,
    ObjectPlugin,
    EffectPlugin,
    TransitionPlugin,
} from "./PluginInterface";
import type { PluginId, PluginMetadata } from "./PluginTypes";
import { reactive } from "vue";
import { globalEventBus } from "../events/EventBus";
import { EditorEventType } from "../../types/Media";

interface RegistrationError {
    pluginId: PluginId;
    error: string;
    timestamp: number;
}

/**
 * Type-safe plugin registry.
 * Maintains plugins indexed by ID with metadata introspection.
 */
class PluginRegistry {
    private plugins: Map<PluginId, IPlugin> = new Map();
    private metadata: Map<PluginId, PluginMetadata> = new Map();
    private errors: RegistrationError[] = [];

    public state = reactive({
        availablePlugins: [] as IPlugin[],
        draggedPlugin: null as IPlugin | null,
    });

    /**
     * Register a plugin instance.
     * Validates that the plugin's metadata type matches its interface.
     */
    register(plugin: IPlugin): void {
        const metadata = plugin.getMetadata();
        const id = metadata.id;

        if (this.plugins.has(id)) {
            const error = `Plugin ${id} already registered`;
            console.warn(`[PluginRegistry] ${error}`);
            this.recordError(id, error);
            return;
        }

        // Type validation: ensure plugin implements the right interface
        this._validatePluginType(plugin, metadata);

        console.log(`[PluginRegistry] Registering ${id} (${metadata.type})`);

        this.plugins.set(id, plugin);
        this.metadata.set(id, metadata);
        this.state.availablePlugins.push(plugin);

        // Initialize plugin asynchronously, capture errors
        plugin.init().catch((err) => {
            const error = `Initialization failed: ${err.message}`;
            console.error(`[PluginRegistry] Plugin ${id} failed to init:`, err);
            this.recordError(id, error);
            globalEventBus.emit({
                type: EditorEventType.SHOW_FEEDBACK,
                payload: {
                    icon: "AlertTriangle",
                    text: `Plugin ${metadata.name} failed to load.`,
                },
            });
            // Plugin is still registered but in failed state; runtime will handle null checks
        });
    }

    /**
     * Generic typed lookup.
     * @param id Plugin ID
     * @returns Plugin instance or undefined
     */
    get(id: PluginId): IPlugin | undefined {
        return this.plugins.get(id);
    }

    /**
     * Type-safe lookup returning ObjectPlugin or undefined.
     */
    getObject(id: PluginId): ObjectPlugin | undefined {
        const plugin = this.plugins.get(id);
        if (plugin && this._isObjectPlugin(plugin)) {
            return plugin;
        }
        return undefined;
    }

    /**
     * Type-safe lookup returning EffectPlugin or undefined.
     */
    getEffect(id: PluginId): EffectPlugin | undefined {
        const plugin = this.plugins.get(id);
        if (plugin && this._isEffectPlugin(plugin)) {
            return plugin;
        }
        return undefined;
    }

    /**
     * Type-safe lookup returning TransitionPlugin or undefined.
     */
    getTransition(id: PluginId): TransitionPlugin | undefined {
        const plugin = this.plugins.get(id);
        if (plugin && this._isTransitionPlugin(plugin)) {
            return plugin;
        }
        return undefined;
    }

    /**
     * Get plugin metadata without instantiation.
     */
    getMetadata(id: PluginId): PluginMetadata | undefined {
        return this.metadata.get(id);
    }

    /**
     * Get all registered plugins.
     */
    getAll(): IPlugin[] {
        return Array.from(this.plugins.values());
    }

    /**
     * Get plugins of a specific type.
     */
    getPluginsByType(type: "object" | "effect" | "transition"): IPlugin[] {
        return this.getAll().filter((p) => {
            const meta = this.metadata.get(p.getMetadata().id);
            return meta?.type === type;
        });
    }

    /**
     * Check if a plugin exists.
     */
    has(id: PluginId): boolean {
        return this.plugins.has(id);
    }

    /**
     * Get all registration errors.
     */
    getErrors(): RegistrationError[] {
        return [...this.errors];
    }

    /**
     * Clear errors (e.g., for UI state reset).
     */
    clearErrors(): void {
        this.errors = [];
    }

    // --- State management for drag & drop ---

    setDraggedPlugin(plugin: IPlugin) {
        this.state.draggedPlugin = plugin;
    }

    clearDraggedPlugin() {
        this.state.draggedPlugin = null;
    }

    // --- Private helpers ---

    private _validatePluginType(
        plugin: IPlugin,
        metadata: PluginMetadata,
    ): void {
        // Validate that the plugin's metadata type matches its actual interface
        // This is checked at registration time to fail fast
        const hasApply = typeof (plugin as any).apply === "function";

        if (metadata.type === "object" && hasApply) {
            console.warn(
                `[PluginRegistry] Plugin ${metadata.id} claims type 'object' but has apply method`,
            );
        }
        if (
            (metadata.type === "effect" || metadata.type === "transition") &&
            !hasApply
        ) {
            console.warn(
                `[PluginRegistry] Plugin ${metadata.id} claims type '${metadata.type}' but lacks apply method`,
            );
        }
    }

    private recordError(pluginId: PluginId, error: string): void {
        this.errors.push({
            pluginId,
            error,
            timestamp: Date.now(),
        });
    }

    private _isObjectPlugin(plugin: IPlugin): plugin is ObjectPlugin {
        const meta = this.metadata.get(plugin.getMetadata().id);
        return meta?.type === "object";
    }

    private _isEffectPlugin(plugin: IPlugin): plugin is EffectPlugin {
        const meta = this.metadata.get(plugin.getMetadata().id);
        return meta?.type === "effect";
    }

    private _isTransitionPlugin(plugin: IPlugin): plugin is TransitionPlugin {
        const meta = this.metadata.get(plugin.getMetadata().id);
        return meta?.type === "transition";
    }
}

export const pluginRegistry = new PluginRegistry();
