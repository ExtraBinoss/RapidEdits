<script setup lang="ts">
import Header from "./components/Header.vue";
import Sidebar from "./components/Sidebar.vue";
import Timeline from "./components/Timeline/Timeline.vue";
import Preview from "./components/Preview/Preview.vue";
import Properties from "./components/Properties.vue";
import { onMounted, ref } from "vue";
import { updateFavicon } from "./utils/faviconUtils";
import { useThemeStore } from "./stores/themeStore";
import { TextPlugin } from "./core/plugins/core/TextPlugin";
import { pluginRegistry } from "./core/plugins/PluginRegistry";

import { FadeTransitionPlugin } from "./core/plugins/transitions/FadeTransitionPlugin";
import { CursorZoomPlugin } from "./core/plugins/effects/CursorZoomPlugin";
import { useRecorder } from "./composables/useRecorder";
import SourcePicker from "./components/Recorder/SourcePicker.vue";
import RecordingToolbar from "./components/Recorder/RecordingToolbar.vue";
import { loadDefaultAssets } from "./core/utils/defaultAssetsLoader";

const themeStore = useThemeStore();
const { showPicker, setShowPicker } = useRecorder();

const isToolbarMode = ref(window.location.search.includes('mode=toolbar'));

onMounted(async () => {
    updateFavicon("#3b82f6"); // Brand primary color
    themeStore.initTheme();

    // Load default assets
    loadDefaultAssets();

    console.log("[App] Starting plugin registration...");

    // Register Core Plugins
    // The new registry validates metadata and types at registration time
    try {
        console.log("[App] Creating TextPlugin instance...");
        const textPlugin = new TextPlugin();
        console.log("[App] TextPlugin metadata:", textPlugin.getMetadata());
        pluginRegistry.register(textPlugin);
        console.log("[App] ✅ TextPlugin registered");
    } catch (e) {
        console.error("[App] ❌ Failed to register TextPlugin:", e);
    }

    try {
        console.log("[App] Creating FadeTransitionPlugin instance...");
        const fadePlugin = new FadeTransitionPlugin();
        console.log("[App] FadeTransitionPlugin metadata:", fadePlugin.getMetadata());
        pluginRegistry.register(fadePlugin);
        console.log("[App] ✅ FadeTransitionPlugin registered");
    } catch (e) {
        console.error("[App] ❌ Failed to register FadeTransitionPlugin:", e);
    }

    try {
        console.log("[App] Creating CursorZoomPlugin instance...");
        const cursorPlugin = new CursorZoomPlugin();
        console.log("[App] CursorZoomPlugin metadata:", cursorPlugin.getMetadata());
        pluginRegistry.register(cursorPlugin);
        console.log("[App] ✅ CursorZoomPlugin registered");
    } catch (e) {
        console.error("[App] ❌ Failed to register CursorZoomPlugin:", e);
    }

    // Log any registration errors (e.g., duplicate IDs, failed init)
    setTimeout(() => {
        const errors = pluginRegistry.getErrors();
        if (errors.length > 0) {
            console.error("[App] Plugin registration errors:", errors);
        } else {
            console.log("[App] ✅ All plugins registered successfully");
        }
    }, 500);
});
</script>

<template>
    <div
        v-if="!isToolbarMode"
        class="flex flex-col h-screen w-full bg-canvas text-text-main font-sans overflow-hidden"
    >
        <div v-if="showPicker" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md">
           <SourcePicker @close="setShowPicker(false)" />
        </div>
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
    </div>
    <div v-else>
        <RecordingToolbar />
    </div>
</template>
