<script setup lang="ts">
import Header from "./components/Header.vue";
import Sidebar from "./components/Sidebar.vue";
import Timeline from "./components/Timeline/Timeline.vue";
import Preview from "./components/Preview/Preview.vue";
import Properties from "./components/Properties.vue";
import { onMounted } from "vue";
import { updateFavicon } from "./utils/faviconUtils";
import { useThemeStore } from "./stores/themeStore";
import { TextPlugin } from "./core/plugins/core/TextPlugin";
import { pluginRegistry } from "./core/plugins/PluginRegistry";
import StatusBar from "./components/Footer/StatusBar.vue";

const themeStore = useThemeStore();

onMounted(() => {
    updateFavicon("#3b82f6"); // Brand primary color
    themeStore.initTheme();

    // Register Core Plugins
    pluginRegistry.register(new TextPlugin());
});
</script>

<template>
    <div
        class="flex flex-col h-screen w-full bg-canvas text-text-main font-sans overflow-hidden"
    >
        <!-- Top Header -->
        <Header />

        <!-- Main Content Area -->
        <div class="flex flex-1 overflow-hidden">
            <!-- Left Sidebar (Assets) -->
            <Sidebar />

            <!-- Center Workspace -->
            <div class="flex-1 flex flex-col min-w-0 bg-canvas">
                <!-- Upper Workspace: Preview & Properties -->
                <div class="flex flex-1 min-h-0">
                    <!-- Preview Area (PixiJS) -->
                    <div
                        class="flex-1 relative bg-black/40 flex items-center justify-center overflow-hidden p-4"
                    >
                        <Preview />
                    </div>

                    <!-- Right Sidebar (Properties) -->
                    <Properties />
                </div>

                <!-- Bottom: Timeline -->
                <div
                    class="h-72 border-t border-canvas-border bg-canvas-light flex flex-col"
                >
                    <Timeline />
                </div>
            </div>
        </div>

        <!-- System Status Bar -->
        <StatusBar />
    </div>
</template>
