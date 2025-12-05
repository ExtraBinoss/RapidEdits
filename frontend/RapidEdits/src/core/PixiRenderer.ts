import { Application, Container, Sprite, Texture, Assets, VideoSource } from 'pixi.js';
import { editorEngine } from '../core/EditorEngine';
import { resourceManager } from '../core/ResourceManager';
import type { Clip } from '../types/Timeline';

export class PixiRenderer {
  private app: Application;
  private stage: Container;
  
  // Visual Elements
  private clipSprites: Map<string, Sprite> = new Map();
  // Cache to prevent recreating Textures (and triggering Pixi setup logic) repeatedly
  private textureCache: Map<string, Texture> = new Map();

  constructor(app: Application) {
    this.app = app;
    this.stage = app.stage;
  }

  public async init() {
    this.app.ticker.add(this.render.bind(this));
  }

  private render() {
    const currentTime = editorEngine.getCurrentTime();
    const tracks = editorEngine.getTracks();

    // 1. Identify visible clips (Only VIDEO type tracks)
    const visibleClips: Clip[] = [];
    tracks.forEach(track => {
      if (track.type !== 'video' || track.isMuted) return;
      
      const clip = track.clips.find(c => 
        currentTime >= c.start && currentTime < (c.start + c.duration)
      );
      
      if (clip) visibleClips.push(clip);
    });

    // 2. Manage Sprites
    const currentClipIds = new Set(visibleClips.map(c => c.id));

    for (const [clipId, sprite] of this.clipSprites) {
      if (!currentClipIds.has(clipId)) {
        this.stage.removeChild(sprite);
        this.clipSprites.delete(clipId);
      }
    }

    visibleClips.forEach(async (clip) => {
      let sprite = this.clipSprites.get(clip.id);

      if (!sprite) {
        sprite = new Sprite();
        sprite.anchor.set(0.5);
        sprite.x = this.app.screen.width / 2;
        sprite.y = this.app.screen.height / 2;
        
        const texture = await this.getTextureForClip(clip);
        if (texture) {
           sprite.texture = texture;
           // Basic Aspect Fit
           const scale = Math.min(
              (this.app.screen.width) / texture.width,
              (this.app.screen.height) / texture.height
           );
           sprite.scale.set(scale);
        }

        this.stage.addChild(sprite);
        this.clipSprites.set(clip.id, sprite);
      }

      if (clip.type === 'video') {
        this.syncVideoFrame(clip, sprite, currentTime);
      }
    });
  }

  private async getTextureForClip(clip: Clip): Promise<Texture | null> {
    const asset = editorEngine.getAsset(clip.assetId);
    if (!asset) return null;

    // Return cached texture if available
    if (this.textureCache.has(asset.id)) {
        return this.textureCache.get(asset.id)!;
    }

    let texture: Texture | null = null;

    if (asset.type === 'image') {
        // Use Pixi Assets for images
       texture = await Assets.load(asset.url);
    }
    else if (asset.type === 'video') {
       const video = await resourceManager.getElement(asset) as HTMLVideoElement;
       
       // Wait for metadata to ensure dimensions are known
       if (video.readyState < 1) {
           await new Promise<void>((resolve) => {
               const onLoaded = () => {
                   video.removeEventListener('loadedmetadata', onLoaded);
                   resolve();
               };
               video.addEventListener('loadedmetadata', onLoaded);
           });
       }

       // Create a VideoSource explicitly to disable autoPlay
       const source = new VideoSource({
           resource: video,
           autoPlay: false, // We handle playback manually
       });

       texture = new Texture({ source });
    }

    if (texture) {
        this.textureCache.set(asset.id, texture);
    }
    return texture;
  }

  private async syncVideoFrame(clip: Clip, sprite: Sprite, globalTime: number) {
    const asset = editorEngine.getAsset(clip.assetId);
    if (!asset || asset.type !== 'video') return;

    // We only handle PLAY/PAUSE logic here for the texture update.
    // Muting/Volume is handled by AudioManager.
    try {
      const video = await resourceManager.getElement(asset) as HTMLVideoElement;
      const clipTime = globalTime - clip.start + clip.offset;

      if (Math.abs(video.currentTime - clipTime) > 0.15) {
          video.currentTime = clipTime;
      }
      
      // If Editor is playing, Video must play for texture to update
      if (editorEngine.getIsPlaying()) {
          if (video.paused) {
             const playPromise = video.play();
             if (playPromise !== undefined) {
                 playPromise.catch(() => {}); // Ignore AbortError from rapid playback toggles
             }
          }
      } else {
          if (!video.paused) video.pause();
      }
      
      // Force Pixi to update the texture from the video source this frame
      if (sprite.texture.source instanceof VideoSource) {
          sprite.texture.source.update();
      }
    } catch (e) {
       // Handle resource not ready
    }
  }
  
  public destroy() {
     this.app.ticker.remove(this.render, this);
     this.textureCache.forEach(t => t.destroy());
     this.textureCache.clear();
     // Resources cleaned up by Manager if needed, or let them persist
  }
}
