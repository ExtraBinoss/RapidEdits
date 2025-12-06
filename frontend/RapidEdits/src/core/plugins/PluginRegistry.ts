import type { IPlugin } from "./PluginInterface";
import { reactive } from "vue";

class PluginRegistry {
    private plugins: Map<string, IPlugin> = new Map();
    public state = reactive({
        availablePlugins: [] as IPlugin[]
    });

    register(plugin: IPlugin) {
        if (this.plugins.has(plugin.id)) {
            console.warn(`Plugin ${plugin.id} already registered.`);
            return;
        }
        console.log(`[PluginRegistry] Registering ${plugin.id}`);
        this.plugins.set(plugin.id, plugin);
        this.state.availablePlugins.push(plugin);
        plugin.init();
    }

    get(id: string): IPlugin | undefined {
        return this.plugins.get(id);
    }

    getAll(): IPlugin[] {
        return Array.from(this.plugins.values());
    }

    getPluginsByType(type: "object" | "effect" | "transition"): IPlugin[] {
        return this.getAll().filter(p => p.type === type);
    }
}

export const pluginRegistry = new PluginRegistry();
