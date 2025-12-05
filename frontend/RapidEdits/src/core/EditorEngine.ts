import { v4 as uuidv4 } from 'uuid';
import { globalEventBus } from './EventBus';
import { MediaType, type Asset, type MediaTypeValue } from '../types/Media';
import type { Track, Clip } from '../types/Timeline';

export class EditorEngine {
  private assets: Map<string, Asset> = new Map();
  private tracks: Track[] = [];
  
  // Playback State
  private currentTime: number = 0;
  private isPlaying: boolean = false;
  private playbackInterval: number | null = null;

  constructor() {
    console.log('Editor Engine Initialized');
    this.initializeTracks();
  }

  private initializeTracks() {
    this.tracks = [
      { id: 1, name: 'Video 1', type: 'video', isMuted: false, isLocked: false, clips: [] },
      { id: 2, name: 'Audio 1', type: 'audio', isMuted: false, isLocked: false, clips: [] },
      { id: 3, name: 'Overlay', type: 'video', isMuted: false, isLocked: false, clips: [] },
    ];
  }

  // --- Asset Management ---

  public async addAsset(file: File): Promise<Asset> {
    const type = this.determineMediaType(file.type);
    const url = URL.createObjectURL(file);
    
    // Basic duration detection for Video/Audio
    let duration = 0;
    if (type === MediaType.VIDEO || type === MediaType.AUDIO) {
       duration = await this.getMediaDuration(url);
    } else {
       duration = 5; // Default 5s for images
    }

    const asset: Asset = {
      id: uuidv4(),
      file,
      url,
      name: file.name,
      type,
      size: file.size,
      duration,
      createdAt: Date.now(),
    };

    this.assets.set(asset.id, asset);
    globalEventBus.emit({ type: 'ASSET_ADDED', payload: asset });
    return asset;
  }

  public removeAsset(id: string) {
    if (this.assets.has(id)) {
      const asset = this.assets.get(id);
      if (asset?.url) {
        URL.revokeObjectURL(asset.url);
      }
      this.assets.delete(id);
      globalEventBus.emit({ type: 'ASSET_REMOVED', payload: id });
    }
  }

  public getAsset(id: string): Asset | undefined {
    return this.assets.get(id);
  }

  // --- Timeline Management ---

  public getTracks(): Track[] {
    return this.tracks;
  }

  public addClip(assetId: string, trackId: number, startTime: number) {
    const asset = this.assets.get(assetId);
    if (!asset) return;

    const track = this.tracks.find(t => t.id === trackId);
    if (!track) return;

    // Create Clip
    const clip: Clip = {
      id: uuidv4(),
      assetId: asset.id,
      trackId: track.id,
      name: asset.name,
      start: startTime,
      duration: asset.duration || 5,
      offset: 0,
      type: asset.type
    };

    track.clips.push(clip);
    // Sort clips by start time
    track.clips.sort((a, b) => a.start - b.start);

    globalEventBus.emit({ type: 'TIMELINE_UPDATED', payload: undefined });
  }

  // --- Playback Controls ---

  public togglePlayback() {
    this.isPlaying = !this.isPlaying;
    if (this.isPlaying) {
      const fps = 30;
      const interval = 1000 / fps;
      let lastTime = performance.now();

      this.playbackInterval = window.setInterval(() => {
        const now = performance.now();
        const delta = (now - lastTime) / 1000;
        lastTime = now;
        
        this.currentTime += delta;
        globalEventBus.emit({ type: 'PLAYBACK_TIME_UPDATED', payload: this.currentTime });
      }, interval);
    } else {
      if (this.playbackInterval) {
        clearInterval(this.playbackInterval);
        this.playbackInterval = null;
      }
    }
  }

  public seek(time: number) {
    this.currentTime = Math.max(0, time);
    globalEventBus.emit({ type: 'PLAYBACK_TIME_UPDATED', payload: this.currentTime });
  }

  public getCurrentTime(): number {
    return this.currentTime;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  // --- Helpers ---

  private determineMediaType(mimeType: string): MediaTypeValue {
    if (mimeType.startsWith('video/')) return MediaType.VIDEO;
    if (mimeType.startsWith('audio/')) return MediaType.AUDIO;
    if (mimeType.startsWith('image/')) return MediaType.IMAGE;
    return MediaType.UNKNOWN;
  }

  private getMediaDuration(url: string): Promise<number> {
    return new Promise((resolve) => {
      const element = document.createElement('video');
      element.preload = 'metadata';
      element.onloadedmetadata = () => {
        resolve(element.duration);
        element.remove();
      };
      element.onerror = () => {
         resolve(0);
         element.remove();
      };
      element.src = url;
    });
  }
}

export const editorEngine = new EditorEngine();