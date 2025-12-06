import { ref, watch, onUnmounted } from "vue";
import { pluginRegistry } from "../../../core/plugins/PluginRegistry";
import type { Clip } from "../../../types/Timeline";
import { globalEventBus } from "../../../core/events/EventBus";
import { PluginThumbnailRenderer } from "../utils/PluginThumbnailRenderer";

export function usePluginFilmstrip(
    clipGetter: () => Clip,
    widthRef: { value: number },
) {
    // console.log("[Filmstrip] Hook Mounted", clipGetter().id);
    const thumbnails = ref<{ id: number; url: string; loaded: boolean }[]>([]);
    const version = ref(0);

    // Listen for property changes from the plugin properties panel
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handlePropertyChange = (payload: any) => {
        const currentClip = clipGetter();
        if (payload?.clipId === currentClip.id) {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            debounceTimer = setTimeout(() => {
                version.value++;
                debounceTimer = null;
            }, 500);
        }
    };

    globalEventBus.on("PLUGIN_PROPERTY_CHANGED", handlePropertyChange);

    onUnmounted(() => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        globalEventBus.off("PLUGIN_PROPERTY_CHANGED", handlePropertyChange);
    });

    watch(
        () => [
            widthRef.value,
            clipGetter().type,
            version.value,
            // We can also watch clipGetter().id to reset if clip changes
            clipGetter().id,
        ],
        async (newVal, oldVal, onCleanup) => {
            const [newWidth, newType, newVersion, newId] = newVal;
            const [oldWidth, oldType, oldVersion, oldId] = oldVal || [];

            // Prevent spurious triggers
            if (
                newWidth === oldWidth &&
                newType === oldType &&
                newVersion === oldVersion &&
                newId === oldId
            ) {
                return;
            }

            const clip = clipGetter();
            const plugin = pluginRegistry.get(clip.type);
            if (!plugin) return;

            // If width is 0, don't bother yet
            if (!widthRef.value) return;

            const containerWidth = widthRef.value;
            // Standard thumbnail size
            const thumbHeight = 96;
            const thumbWidth = thumbHeight * 1.77;
            const count = Math.max(1, Math.ceil(containerWidth / thumbWidth));

            // Reset thumbnails with placeholders
            thumbnails.value = Array.from({ length: count }, (_, i) => ({
                id: i,
                url: "",
                loaded: false,
            }));

            // Cancel rendering if effect is cleaned up
            let cancelRender: (() => void) | null = null;

            // Start generation
            cancelRender =
                PluginThumbnailRenderer.getInstance().generateFilmstrip({
                    clip,
                    plugin,
                    width: thumbWidth, // Render at reduced resolution for performance
                    height: thumbHeight,
                    count,
                    onFrame: (index, url) => {
                        // Update state carefully
                        const newThumbs = [...thumbnails.value];
                        if (newThumbs[index]) {
                            newThumbs[index] = { id: index, url, loaded: true };
                            thumbnails.value = newThumbs;
                        }
                    },
                });

            onCleanup(() => {
                if (cancelRender) cancelRender();
            });
        },
        // Removed deep: true as we are watching primitives
    );

    return { thumbnails };
}
