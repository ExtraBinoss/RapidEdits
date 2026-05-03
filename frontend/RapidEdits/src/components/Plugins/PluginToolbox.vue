<template>
    <div
        class="fixed left-[72px] top-[50%] -translate-y-1/2 z-30 flex flex-col gap-2 pointer-events-none"
    >
        <!-- Plugin Buttons -->
        <div
            class="pointer-events-auto flex flex-col gap-2 bg-gray-900/90 backdrop-blur border border-gray-700 p-2 rounded-lg shadow-xl"
        >
            <div
                v-for="plugin in plugins"
                :key="plugin.id"
                class="group relative"
            >
                <button
                    @click="addPlugin(plugin)"
                    class="p-2 rounded-md hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                    :title="plugin.name"
                >
                    <component
                        :is="plugin.icon || DefaultIcon"
                        class="w-5 h-5"
                    />
                </button>

                <!-- Tooltip -->
                <div
                    class="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-800 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none"
                >
                    {{ plugin.name }}
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { pluginRegistry } from "../../core/plugins/PluginRegistry";
import type { IPlugin } from "../../core/plugins/PluginInterface";
import { editorEngine } from "../../core/EditorEngine";
import { Box as DefaultIcon } from "lucide-vue-next";
import { ClipKind } from "../../types/Timeline";

const plugins = computed(() => {
    return pluginRegistry.state.availablePlugins
        .map((p) => p.getMetadata())
        .filter((m) => m.type === "object");
});

const addPlugin = (pluginMeta: any) => {
    const plugin = pluginRegistry.get(pluginMeta.id);
    if (!plugin) return;

    const track = editorEngine.addTrack("custom");

    // Generate a unique ID for the asset
    const assetId = crypto.randomUUID();

    // Register Virtual Asset
    editorEngine.assetSystem.registerAsset({
        id: assetId,
        name: pluginMeta.name,
        type: "text", // Use text type to avoid texture allocation attempts
        url: "",
        size: 0,
        createdAt: Date.now(),
        duration: 5,
    });

    // Add to timeline using Batch to ensure atomic creation with correct Kind/Type
    // This prevents the renderer from trying to treat it as a Media clip for even a single frame
    editorEngine.addClipsBatch([
        {
            assetId: assetId,
            trackId: track.id,
            start: editorEngine.getCurrentTime(),
            extraData: {
                kind: ClipKind.PLUGIN,
                type: pluginMeta.id,
                name: pluginMeta.name,
                data: plugin.createData(),
                duration: 5,
            },
        },
    ]);
};
</script>
