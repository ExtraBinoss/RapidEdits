import { v4 as uuidv4 } from 'uuid';
import { globalEventBus } from './EventBus';
import { MediaType, type Asset, type MediaTypeValue } from '../types/Media';

/**
 * The Core Logic Engine.
 * This contains the pure business logic, detached from Vue's reactivity.
 * It allows for easier testing and future WebSocket integration.
 */
export class EditorEngine {
  private assets: Map<string, Asset> = new Map();

  constructor() {
    console.log('Editor Engine Initialized');
  }

  public async addAsset(file: File): Promise<Asset> {
    const type = this.determineMediaType(file.type);
    const url = URL.createObjectURL(file);
    
    // Generate Thumbnail (Placeholder logic for now)
    // In a real app, we'd use a hidden video element or canvas to snap a frame
    
    const asset: Asset = {
      id: uuidv4(),
      file,
      url,
      name: file.name,
      type,
      size: file.size,
      createdAt: Date.now(),
    };

    this.assets.set(asset.id, asset);
    
    // Emit Event
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

  public getAssets(): Asset[] {
    return Array.from(this.assets.values());
  }

  private determineMediaType(mimeType: string): MediaTypeValue {
    if (mimeType.startsWith('video/')) return MediaType.VIDEO;
    if (mimeType.startsWith('audio/')) return MediaType.AUDIO;
    if (mimeType.startsWith('image/')) return MediaType.IMAGE;
    return MediaType.UNKNOWN;
  }
}

export const editorEngine = new EditorEngine();
