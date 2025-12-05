export const MediaType = {
  VIDEO: 'video',
  AUDIO: 'audio',
  IMAGE: 'image',
  UNKNOWN: 'unknown'
} as const;

export type MediaTypeValue = typeof MediaType[keyof typeof MediaType];

export interface Asset {
  id: string;
  file: File;
  url: string; // Blob URL for preview
  name: string;
  type: MediaTypeValue;
  size: number;
  thumbnail?: string; // For videos/images
  duration?: number; // For video/audio
  createdAt: number;
}

export type EditorEvent = 
  | { type: 'ASSET_ADDED', payload: Asset }
  | { type: 'ASSET_REMOVED', payload: string } // ID
  | { type: 'PROJECT_LOADED', payload: void }
  | { type: 'TIMELINE_UPDATED', payload: void }
  | { type: 'PLAYBACK_TIME_UPDATED', payload: number }
  | { type: 'VOLUME_CHANGED', payload: number } // 0-100
  | { type: 'PLAYBACK_TOGGLED', payload: boolean }
  | { type: 'SHOW_FEEDBACK', payload: { icon: string, text?: string } };
