import type { Asset } from "./Media";

export interface Clip {
    id: string;
    assetId: string;
    trackId: number; // 1, 2, 3...
    name: string;
    start: number; // Start time on timeline (seconds)
    duration: number; // Duration of the clip (seconds)
    offset: number; // Start time within the source media (seconds)
    type: Asset["type"] | string; // 'string' allows for custom plugin types
    groupId?: string;
    speed?: number;
    data?: Record<string, any>; // Flexible data store for plugins (e.g. text content, color, position)
}

export interface Track {
    id: number;
    name: string;
    type: "video" | "audio" | "text" | "image" | "custom";
    isMuted: boolean;
    isLocked: boolean;
    clips: Clip[];
}
