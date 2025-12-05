/**
 * PixiRenderer
 * Bridges the pure EditorEngine state with the PixiJS Application.
 * Handles video resource management and rendering loop.
 */
import { Application, Container, Sprite, Texture, Assets } from 'pixi.js';
import { editorEngine } from '../core/EditorEngine';
import type { Clip } from '../types/Timeline';

export class PixiRenderer {
  private app: Application;
  private stage: Container;
  
  // Resource Cache
  // Map assetId -> HTMLVideoElement (for videos) or Texture (for images)
  private videoCache: Map<string, HTMLVideoElement> = new Map();
  private textureCache: Map<string, Texture> = new Map();

  // Visual Elements
  private clipSprites: Map<string, Sprite> = new Map();

  constructor(app: Application) {
    this.app = app;
    this.stage = app.stage;
  }

  public async init() {
    // Start Render Loop
    this.app.ticker.add(this.render.bind(this));
  }

  private render() {
    const currentTime = editorEngine.getCurrentTime();
    const tracks = editorEngine.getTracks();

    // 1. Identify visible clips
    const visibleClips: Clip[] = [];
    tracks.forEach(track => {
      if (track.isMuted) return; // Skip muted tracks for visual rendering? Maybe not, separate 'visible' flag needed later.
      
      // For now, simple loop. Optimized: use binary search or interval tree.
      const clip = track.clips.find(c => 
        currentTime >= c.start && currentTime < (c.start + c.duration)
      );
      
      if (clip) visibleClips.push(clip);
    });

    // 2. Manage Sprites (Create/Update/Remove)
    const currentClipIds = new Set(visibleClips.map(c => c.id));

    // Remove old sprites
    for (const [clipId, sprite] of this.clipSprites) {
      if (!currentClipIds.has(clipId)) {
        this.stage.removeChild(sprite);
        this.clipSprites.delete(clipId);
        // If it's a video, pause it? 
        // Optimization: We need to map Clip -> Asset -> VideoElement
      }
    }

    // Create/Update sprites
    visibleClips.forEach(async (clip) => {
      let sprite = this.clipSprites.get(clip.id);

      if (!sprite) {
        // Initialize new Sprite
        sprite = new Sprite();
        sprite.anchor.set(0.5);
        sprite.x = this.app.screen.width / 2;
        sprite.y = this.app.screen.height / 2;
        
        // Scale to fit (Simple aspect fit)
        // We need to load the texture
        const texture = await this.getTextureForClip(clip);
        if (texture) {
           sprite.texture = texture;
           const scale = Math.min(
              (this.app.screen.width * 0.9) / texture.width,
              (this.app.screen.height * 0.9) / texture.height
           );
           sprite.scale.set(scale);
        }

        this.stage.addChild(sprite);
        this.clipSprites.set(clip.id, sprite);
      }

      // Sync Video Time
      if (clip.type === 'video') {
        this.syncVideoFrame(clip, currentTime);
        // Mark texture as dirty if needed? Pixi 8 handles video textures well usually.
      }
    });
  }

  private async getTextureForClip(clip: Clip): Promise<Texture | null> {
    const asset = editorEngine.getAsset(clip.assetId);
    if (!asset) return null;

    if (asset.type === 'image') {
       if (!this.textureCache.has(asset.id)) {
          const texture = await Assets.load(asset.url);
          this.textureCache.set(asset.id, texture);
       }
       return this.textureCache.get(asset.id)!;
    }
    else if (asset.type === 'video') {
       let video = this.videoCache.get(asset.id);
       if (!video) {
          video = document.createElement('video');
          video.crossOrigin = 'anonymous';
          video.src = asset.url;
          video.muted = true; // Mute for now to allow autoplay policy
          video.loop = true; // Logic handled by render loop, but safe fallback
          await video.play().then(() => video!.pause()); // Preload
          this.videoCache.set(asset.id, video);
       }
       
       // Return a texture wrapping this video
       // Note: Pixi 8 simplifies this.
       return Texture.from(video); 
    }

    return null;
  }

  private syncVideoFrame(clip: Clip, globalTime: number) {
    const asset = editorEngine.getAsset(clip.assetId);
    if (!asset || asset.type !== 'video') return;

    const video = this.videoCache.get(asset.id);
    if (video) {
       const clipTime = globalTime - clip.start + clip.offset;
       // Only update if significant drift to avoid stuttering
       if (Math.abs(video.currentTime - clipTime) > 0.1) {
          video.currentTime = clipTime;
       }
       
       if (editorEngine.getIsPlaying()) {
          if (video.paused) video.play();
       } else {
          if (!video.paused) video.pause();
       }
    }
  }
  
  public destroy() {
     // Cleanup
     this.app.ticker.remove(this.render, this);
     this.videoCache.forEach(v => {
        v.pause();
        v.removeAttribute('src');
        v.load();
     });
     this.videoCache.clear();
     // Textures are managed by Pixi Assets cache usually, but good to be safe
  }
}
