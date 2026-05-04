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

import { FadeInPlugin } from "./core/plugins/transitions/FadeInPlugin";
import { FadeOutPlugin } from "./core/plugins/transitions/FadeOutPlugin";
import { SlideUpPlugin } from "./core/plugins/transitions/SlideUpPlugin";
import { ZoomInPlugin } from "./core/plugins/transitions/ZoomInPlugin";
import { ZoomOutPlugin } from "./core/plugins/transitions/ZoomOutPlugin";
import { TransformPlugin } from "./core/plugins/inspector/TransformPlugin";
import { AppearancePlugin } from "./core/plugins/inspector/AppearancePlugin";
import { CropPlugin } from "./core/plugins/inspector/CropPlugin";
import { AudioPlugin } from "./core/plugins/inspector/AudioPlugin";
import { CursorZoomPlugin } from "./core/plugins/effects/CursorZoomPlugin";
import { useRecorder } from "./composables/useRecorder";
import SourcePicker from "./components/Recorder/SourcePicker.vue";
import RecordingToolbar from "./components/Recorder/RecordingToolbar.vue";
import StartupScreen from "./components/Project/StartupScreen.vue";
import { loadDefaultAssets } from "./core/utils/defaultAssetsLoader";

const themeStore = useThemeStore();
const { showPicker, setShowPicker } = useRecorder();

const isToolbarMode = ref(window.location.search.includes('mode=toolbar'));
const showStartup = ref(true);

// --- Timeline Resizer Logic ---
const DEFAULT_TIMELINE_HEIGHT = 288; // 288px = h-72
const MIN_TIMELINE_HEIGHT = 150;

const timelineHeight = ref(DEFAULT_TIMELINE_HEIGHT);
const isDraggingTimeline = ref(false);

const startTimelineDrag = (_e: MouseEvent) => {
    isDraggingTimeline.value = true;
    document.body.style.cursor = 'row-resize';
    document.addEventListener('mousemove', onTimelineDrag);
    document.addEventListener('mouseup', stopTimelineDrag);
};

const onTimelineDrag = (e: MouseEvent) => {
    if (!isDraggingTimeline.value) return;
    const newHeight = window.innerHeight - e.clientY;
    timelineHeight.value = Math.max(MIN_TIMELINE_HEIGHT, Math.min(newHeight, window.innerHeight * 0.8));
};

const stopTimelineDrag = () => {
    isDraggingTimeline.value = false;
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', onTimelineDrag);
    document.removeEventListener('mouseup', stopTimelineDrag);
};

// We don't have onUnmounted imported in this file yet, so let's just make sure cleanup is solid
// The window listeners are removed on mouse up anyway.

onMounted(async () => {
    updateFavicon("#3b82f6"); // Brand primary color
    themeStore.initTheme();

    // Load default assets
    loadDefaultAssets();

    console.log("[App] Starting plugin registration...");

    // Register Plugins
    const pluginsToRegister = [
        new TextPlugin(),
        new FadeInPlugin(),
        new FadeOutPlugin(),
        new SlideUpPlugin(),
        new ZoomInPlugin(),
        new ZoomOutPlugin(),
        new TransformPlugin(),
        new AppearancePlugin(),
        new CropPlugin(),
        new AudioPlugin(),
        new CursorZoomPlugin()
    ];

    pluginsToRegister.forEach(p => {
        try {
            pluginRegistry.register(p);
            console.log(`[App] ✅ Registered: ${p.getMetadata().id}`);
        } catch (e) {
            console.error(`[App] ❌ Failed to register ${p.getMetadata().id}:`, e);
        }
    });

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
        <StartupScreen :isOpen="showStartup" @started="showStartup = false" />

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
                    class="border-t border-canvas-border bg-canvas-light flex flex-col relative shrink-0"
                    :style="{ height: timelineHeight + 'px' }"
                >
                    <!-- Resizer Handle -->
                    <div 
                        class="absolute left-0 top-0 right-0 h-1 cursor-row-resize hover:bg-brand-primary/50 z-50 transition-colors"
                        :class="{ 'bg-brand-primary': isDraggingTimeline }"
                        @mousedown="startTimelineDrag"
                    ></div>
                    <Timeline />
                </div>
            </div>
        </div>
    </div>
    <div v-else>
        <RecordingToolbar />
    </div>
</template>
