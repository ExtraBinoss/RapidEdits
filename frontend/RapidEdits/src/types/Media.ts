export const MediaType = {
    VIDEO: "video",
    AUDIO: "audio",
    IMAGE: "image",
    TEXT: "text",
    UNKNOWN: "unknown",
} as const;

export type MediaTypeValue = (typeof MediaType)[keyof typeof MediaType];

export interface Asset {
    id: string;
    file?: File;
    url: string; // Blob URL for preview
    name: string;
    type: MediaTypeValue;
    size: number;
    thumbnail?: string; // For videos/images
    duration?: number; // For video/audio
    createdAt: number;
}

export const EditorEventType = {
    ASSET_ADDED: "ASSET_ADDED",
    ASSET_LOADED: "ASSET_LOADED",
    WAVEFORM_GENERATION_START: "WAVEFORM_GENERATION_START",
    WAVEFORM_GENERATION_END: "WAVEFORM_GENERATION_END",
    WAVEFORM_CHUNK_GENERATED: "WAVEFORM_CHUNK_GENERATED",
    ASSET_REMOVED: "ASSET_REMOVED",
    PROJECT_LOADED: "PROJECT_LOADED",
    TIMELINE_UPDATED: "TIMELINE_UPDATED",
    PLAYBACK_TIME_UPDATED: "PLAYBACK_TIME_UPDATED",
    VOLUME_CHANGED: "VOLUME_CHANGED",
    PLAYBACK_TOGGLED: "PLAYBACK_TOGGLED",
    SHOW_FEEDBACK: "SHOW_FEEDBACK",
    AMBIENT_COLOR_UPDATE: "AMBIENT_COLOR_UPDATE",
    SELECTION_CHANGED: "SELECTION_CHANGED",
    CLIP_SPLIT: "CLIP_SPLIT",
    TOOL_CHANGED: "TOOL_CHANGED",
    PLUGIN_PROPERTY_CHANGED: "PLUGIN_PROPERTY_CHANGED",
    RECORDING_STATE_CHANGED: "RECORDING_STATE_CHANGED",
    RECORDING_SOURCES_UPDATED: "RECORDING_SOURCES_UPDATED",
    RECORDING_SETTINGS_UPDATED: "RECORDING_SETTINGS_UPDATED",
    RECORDING_FINISHED: "RECORDING_FINISHED",
} as const;

export type EditorEventTypeValue =
    (typeof EditorEventType)[keyof typeof EditorEventType];

export type EditorEvent =
    | { type: typeof EditorEventType.ASSET_ADDED; payload: Asset }
    | { type: typeof EditorEventType.ASSET_LOADED; payload: Asset }
    | {
          type: typeof EditorEventType.WAVEFORM_GENERATION_START;
          payload: { assetId: string };
      }
    | {
          type: typeof EditorEventType.WAVEFORM_GENERATION_END;
          payload: { assetId: string; error?: string };
      }
    | {
          type: typeof EditorEventType.WAVEFORM_CHUNK_GENERATED;
          payload: {
              assetId: string;
              start: number;
              end: number;
              data: Float32Array;
          };
      }
    | { type: typeof EditorEventType.ASSET_REMOVED; payload: string }
    | { type: typeof EditorEventType.PROJECT_LOADED; payload: void }
    | { type: typeof EditorEventType.TIMELINE_UPDATED; payload: void }
    | { type: typeof EditorEventType.PLAYBACK_TIME_UPDATED; payload: number }
    | { type: typeof EditorEventType.VOLUME_CHANGED; payload: number }
    | { type: typeof EditorEventType.PLAYBACK_TOGGLED; payload: boolean }
    | {
          type: typeof EditorEventType.SHOW_FEEDBACK;
          payload: { icon: string; text?: string };
      }
    | { type: typeof EditorEventType.AMBIENT_COLOR_UPDATE; payload: string }
    | { type: typeof EditorEventType.SELECTION_CHANGED; payload: string[] }
    | {
          type: typeof EditorEventType.CLIP_SPLIT;
          payload: {
              originalClipId: string;
              newClipId: string;
              splitTime: number;
              trackId: number;
          };
      }
    | { type: typeof EditorEventType.TOOL_CHANGED; payload: "select" | "razor" }
    | {
          type: typeof EditorEventType.PLUGIN_PROPERTY_CHANGED;
          payload: { clipId: string };
      }
    | { type: typeof EditorEventType.RECORDING_STATE_CHANGED; payload: boolean }
    | { type: typeof EditorEventType.RECORDING_SOURCES_UPDATED; payload: any[] }
    | { type: typeof EditorEventType.RECORDING_SETTINGS_UPDATED; payload: any }
    | {
          type: typeof EditorEventType.RECORDING_FINISHED;
          payload: { blob: Blob; cursorData: any[] };
      };
