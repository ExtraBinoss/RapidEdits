import type { Asset } from "./Media";
import type { PluginId } from "../core/plugins/PluginTypes";

export const TrackType = {
    VIDEO: "video",
    AUDIO: "audio",
    TEXT: "text",
    IMAGE: "image",
    CUSTOM: "custom",
} as const;

export type TrackTypeValue = (typeof TrackType)[keyof typeof TrackType];


/**
 * Track: a horizontal container for clips on the timeline.
 *
 * Tracks can be of different types (video, audio, text, custom) and
 * each can contain multiple clips positioned along the time axis.
 */
export interface Track {
    id: number;
    name: string;
    type: TrackTypeValue;
    isMuted: boolean;
    isLocked: boolean;
    clips: Clip[];
    color?: string;
}

export const ClipKind = {
    MEDIA: "media",
    PLUGIN: "plugin",
} as const;

export type ClipKindValue = (typeof ClipKind)[keyof typeof ClipKind];

/**
 * Clip: a segment of time on a track.
 *
 * Clips can be of two kinds:
 * 1. Media clips: contain video/audio/image assets
 * 2. Plugin clips: use a plugin to generate or modify content
 */
export interface Clip {
    id: string;
    assetId: string;
    trackId: number; // 1, 2, 3...
    name: string;
    start: number; // Start time on timeline (seconds)
    duration: number; // Duration of the clip (seconds)
    offset: number; // Start time within the source media (seconds)
    kind: ClipKindValue;
    /**
     * Type identifier: either a media type or a plugin ID.
     * Media types: "video" | "audio" | "image"
     * Plugin types: PluginId (e.g. "core.text", "effects.cursor_zoom")
     */
    type: Asset["type"] | PluginId | string;
    groupId?: string;
    speed?: number;
    /**
     * Plugin-specific or custom data.
     */
    data?: Record<string, any>;
}

/**
 * Helper type guard to check if a clip is a plugin clip.
 */
export function isPluginClip(clip: Clip): boolean {
    return clip.kind === ClipKind.PLUGIN;
}

/**
 * Helper type guard to check if a clip is a media clip.
 */
export function isMediaClip(clip: Clip): boolean {
    return clip.kind === ClipKind.MEDIA;
}
