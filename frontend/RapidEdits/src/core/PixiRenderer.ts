import { Application, Container, Sprite, Texture, VideoSource, Assets } from 'pixi.js';
import { editorEngine } from './EditorEngine';
import { resourceManager } from './ResourceManager';
import type { Clip } from '../types/Timeline';

/**
 * Manages the visual representation of the timeline using PixiJS.
 * Completely rewritten for robustness against WebGL video errors.
 */
export class PixiRenderer {
  private app: Application;
  private stage: Container;
  private container: HTMLElement;
  
  // State
  private clipSprites: Map<string, Sprite> = new Map();
  private textureCache: Map<string, Texture> = new Map();
  private resizeObserver: ResizeObserver | null = null;

  constructor(app: Application, container: HTMLElement) {
    this.app = app;
    this.stage = app.stage;
    this.container = container;
  }

  public async init() {
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
    this.app.ticker.add(this.render.bind(this));
  }

  private render() {
    const currentTime = editorEngine.getCurrentTime();
    const tracks = editorEngine.getTracks();

    // 1. Visible Clips Logic
    const visibleClips: Clip[] = [];
    tracks.forEach(track => {
      if (track.type !== 'video' || track.isMuted) return;
      const clip = track.clips.find(c => 
        currentTime >= c.start && currentTime < (c.start + c.duration)
      );
      if (clip) visibleClips.push(clip);
    });

    // 2. Cleanup
    const visibleClipIds = new Set(visibleClips.map(c => c.id));
    for (const [clipId, sprite] of this.clipSprites) {
      if (!visibleClipIds.has(clipId)) {
        this.stage.removeChild(sprite);
        this.clipSprites.delete(clipId);
      }
    }

    // 3. Render
    visibleClips.forEach(async (clip) => {
      let sprite = this.clipSprites.get(clip.id);

      // Initialize Sprite
      if (!sprite) {
        sprite = new Sprite();
        sprite.anchor.set(0.5);
        // Start with empty/transparent texture to prevent 0x0 uploads
        sprite.texture = Texture.EMPTY; 
        this.stage.addChild(sprite);
        this.clipSprites.set(clip.id, sprite);

        try {
          const texture = await this.loadSafeTexture(clip);
          if (texture) {
             sprite.texture = texture;
             this.fitSpriteToScreen(sprite, texture);
          }
        } catch (err) {
          console.error(`Texture load failed for ${clip.id}`, err);
        }
      }

      // Sync
      if (clip.type === 'video' && sprite.texture !== Texture.EMPTY) {
        this.syncVideo(clip, sprite, currentTime);
      }
    });
  }

  /**
   * Safely loads a texture, guaranteeing strictly valid WebGL parameters
   * before the texture is ever returned to the render loop.
   */
  private async loadSafeTexture(clip: Clip): Promise<Texture | null> {
    const asset = editorEngine.getAsset(clip.assetId);
    if (!asset) return null;

    // Cache Hit
    if (this.textureCache.has(asset.id)) {
      const cached = this.textureCache.get(asset.id)!;
      if (!cached.destroyed) return cached;
      this.textureCache.delete(asset.id);
    }

    if (asset.type === 'image') {
       const t = await Assets.load(asset.url);
       this.textureCache.set(asset.id, t);
       return t;
    }

    if (asset.type === 'video') {
       const video = await resourceManager.getElement(asset) as HTMLVideoElement;

       // 1. Wait for Data (Strict)
       // We wait for HAVE_CURRENT_DATA (2) to ensure dimensions are real
       if (video.readyState < 2) {
           await new Promise<void>(resolve => {
               const fn = () => {
                   if (video.readyState >= 2) {
                       video.removeEventListener('canplay', fn);
                       video.removeEventListener('loadeddata', fn);
                       resolve();
                   }
               };
               video.addEventListener('canplay', fn);
               video.addEventListener('loadeddata', fn);
           });
       }

       // 2. Double Check Dimensions
       if (video.videoWidth === 0 || video.videoHeight === 0) return null;

       // 3. Create VideoSource with Aggressive NPOT Safety
       const source = new VideoSource({
           resource: video,
           autoPlay: false,
           autoGenerateMipmaps: false, // CRITICAL for NPOT
           alphaMode: 'premultiply-alpha-on-upload'
       });
       
       // 4. Enforce Address Mode (Clamping) BEFORE Texture creation
       source.style.addressMode = 'clamp-to-edge';
       source.style.scaleMode = 'linear';

       // 5. Create Texture
       const texture = new Texture({ source });
       
       // 6. Force an initial update to populate the GPU buffer correctly
       // while we know dimensions are good.
       try {
           source.update();
       } catch (e) {
           console.warn('Initial texture update failed', e);
       }

       this.textureCache.set(asset.id, texture);
       return texture;
    }

    return null;
  }

  private async syncVideo(clip: Clip, sprite: Sprite, globalTime: number) {
    const asset = editorEngine.getAsset(clip.assetId);
    if (!asset || asset.type !== 'video') return;

    const video = (sprite.texture.source as VideoSource).resource as HTMLVideoElement;
    if (!video) return;

    // Time Sync
    const clipTime = globalTime - clip.start + clip.offset;
    const diff = Math.abs(video.currentTime - clipTime);
    
    // Seek if drifted
    if (diff > 0.15) {
       video.currentTime = clipTime;
    }

    // Play/Pause State
    if (editorEngine.getIsPlaying()) {
       if (video.paused) video.play().catch(() => {});
    } else {
       if (!video.paused) video.pause();
    }

    // Render Update
    // Only update if we have data.
    if (video.readyState >= 2) {
       const source = sprite.texture.source as VideoSource;
       // Safety: Update only if source is valid
       if (source && !source.destroyed) {
           source.update();
       }
    }
  }

  private handleResize() {
    if (!this.container || !this.app || !this.app.renderer) return;
    this.app.renderer.resize(this.container.clientWidth, this.container.clientHeight);
    this.clipSprites.forEach(s => {
       if (s.texture && s.texture !== Texture.EMPTY) this.fitSpriteToScreen(s, s.texture);
    });
  }

  private fitSpriteToScreen(sprite: Sprite, texture: Texture) {
     const w = this.app.screen.width;
     const h = this.app.screen.height;
     sprite.x = w / 2;
     sprite.y = h / 2;
     sprite.scale.set(Math.min(w / texture.width, h / texture.height));
  }
  
  public destroy() {
     this.resizeObserver?.disconnect();
     this.app.ticker.remove(this.render, this);
     this.textureCache.forEach(t => t.destroy());
     this.clipSprites.clear();
  }
}