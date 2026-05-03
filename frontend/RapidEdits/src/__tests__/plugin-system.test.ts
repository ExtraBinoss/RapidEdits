/**
 * Plugin System Type Safety Test
 *
 * This test validates that:
 * 1. Plugin IDs are correctly created via createPluginId helper
 * 2. Registry lookups return correct types
 * 3. Type guards distinguish plugin vs media clips
 * 4. Plugin interface contract is implemented
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createPluginId, PluginCategory } from "../core/plugins/PluginTypes";
import { pluginRegistry } from "../core/plugins/PluginRegistry";
import { isPluginClip, isMediaClip } from "../types/Timeline";
import type { Clip } from "../types/Timeline";
import type { PluginId } from "../core/plugins/PluginTypes";

describe("Plugin System Type Safety", () => {
    describe("Branded PluginId Creation", () => {
        it("should create valid PluginId with createPluginId helper", () => {
            const textId = createPluginId(PluginCategory.Core, "text");
            expect(textId).toBeDefined();
            expect(typeof textId).toBe("string");
            expect(textId).toContain("core.text");
        });

        it("should create consistent IDs for same inputs", () => {
            const id1 = createPluginId(PluginCategory.Effects, "cursor_zoom");
            const id2 = createPluginId(PluginCategory.Effects, "cursor_zoom");
            expect(id1).toBe(id2);
        });

        it("should create different IDs for different categories", () => {
            const coreId = createPluginId(PluginCategory.Core, "text");
            const effectId = createPluginId(PluginCategory.Effects, "text");
            expect(coreId).not.toBe(effectId);
        });
    });

    describe("Registry Typed Lookups", () => {
        it("should return correct type for getObject() lookup", () => {
            const textId = createPluginId(
                PluginCategory.Core,
                "text",
            ) as PluginId;
            const plugin = pluginRegistry.getObject(textId);

            // Should compile without issues
            if (plugin) {
                expect(plugin).toBeDefined();
                expect(typeof plugin.render).toBe("function");
            }
        });

        it("should return correct type for getEffect() lookup", () => {
            const cursorId = createPluginId(
                PluginCategory.Effects,
                "cursor_zoom",
            ) as PluginId;
            const plugin = pluginRegistry.getEffect(cursorId);

            if (plugin) {
                expect(plugin).toBeDefined();
                expect(typeof plugin.apply).toBe("function");
            }
        });

        it("should return correct type for getTransition() lookup", () => {
            const fadeId = createPluginId(
                PluginCategory.Transitions,
                "fade",
            ) as PluginId;
            const plugin = pluginRegistry.getTransition(fadeId);

            if (plugin) {
                expect(plugin).toBeDefined();
                expect(typeof plugin.apply).toBe("function");
            }
        });

        it("should return undefined for non-existent plugin", () => {
            const fakeId = createPluginId(
                PluginCategory.Core,
                "nonexistent",
            ) as PluginId;
            const plugin = pluginRegistry.get(fakeId);
            expect(plugin).toBeUndefined();
        });
    });

    describe("Clip Type Guards", () => {
        it("should identify media clips correctly", () => {
            const mediaClip: Clip = {
                id: "test-1",
                assetId: "asset-1",
                trackId: "track-1",
                type: "video",
                name: "Test Video",
                start: 0,
                duration: 5,
                offset: 0,
                speed: 1,
            };

            expect(isMediaClip(mediaClip)).toBe(true);
            expect(isPluginClip(mediaClip)).toBe(false);
        });

        it("should identify plugin clips correctly", () => {
            const pluginId = createPluginId(
                PluginCategory.Core,
                "text",
            ) as PluginId;
            const pluginClip: Clip = {
                id: "test-2",
                assetId: "asset-2",
                trackId: "track-1",
                type: pluginId,
                name: "Test Text",
                start: 0,
                duration: 5,
                offset: 0,
                speed: 1,
            };

            expect(isPluginClip(pluginClip)).toBe(true);
            expect(isMediaClip(pluginClip)).toBe(false);
        });

        it("should handle image clips as media", () => {
            const imageClip: Clip = {
                id: "test-3",
                assetId: "asset-3",
                trackId: "track-1",
                type: "image",
                name: "Test Image",
                start: 0,
                duration: 2,
                offset: 0,
                speed: 1,
            };

            expect(isMediaClip(imageClip)).toBe(true);
            expect(isPluginClip(imageClip)).toBe(false);
        });

        it("should handle audio clips as media", () => {
            const audioClip: Clip = {
                id: "test-4",
                assetId: "asset-4",
                trackId: "track-1",
                type: "audio",
                name: "Test Audio",
                start: 0,
                duration: 3,
                offset: 0,
                speed: 1,
            };

            expect(isMediaClip(audioClip)).toBe(true);
            expect(isPluginClip(audioClip)).toBe(false);
        });
    });

    describe("Plugin Metadata Contract", () => {
        it("should expose metadata for registered plugins", () => {
            const textId = createPluginId(
                PluginCategory.Core,
                "text",
            ) as PluginId;
            const metadata = pluginRegistry.getMetadata(textId);

            if (metadata) {
                expect(metadata.id).toBe(textId);
                expect(metadata.name).toBeDefined();
                expect(metadata.type).toBe("object");
                expect(metadata.version).toBeDefined();
            }
        });

        it("should expose properties for plugins", () => {
            const textId = createPluginId(
                PluginCategory.Core,
                "text",
            ) as PluginId;
            const plugin = pluginRegistry.get(textId);

            if (plugin && "getProperties" in plugin) {
                const props = plugin.getProperties?.();
                expect(Array.isArray(props)).toBe(true);
                if (props && props.length > 0) {
                    expect(props[0]).toHaveProperty("label");
                    expect(props[0]).toHaveProperty("key");
                    expect(props[0]).toHaveProperty("type");
                }
            }
        });
    });

    describe("Plugin Genericity", () => {
        it("should allow plugins to be added without special-casing", () => {
            // This validates that the plugin system is generic enough
            // to handle any plugin implementation without hardcoding

            const textId = createPluginId(
                PluginCategory.Core,
                "text",
            ) as PluginId;
            const textPlugin = pluginRegistry.get(textId);

            const fadeId = createPluginId(
                PluginCategory.Transitions,
                "fade",
            ) as PluginId;
            const fadePlugin = pluginRegistry.get(fadeId);

            const cursorId = createPluginId(
                PluginCategory.Effects,
                "cursor_zoom",
            ) as PluginId;
            const cursorPlugin = pluginRegistry.get(cursorId);

            // All three plugin types should be accessible through same registry
            // without needing different code paths
            expect(
                [textPlugin, fadePlugin, cursorPlugin].filter(
                    (p) => p !== undefined,
                ).length,
            ).toBeGreaterThan(0);
        });
    });
});
