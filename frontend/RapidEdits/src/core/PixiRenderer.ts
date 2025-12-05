import { Application, Container, Sprite, Texture, VideoSource } from 'pixi.js';
import { editorEngine } from './EditorEngine';
import { TextureAllocator } from './renderer/TextureAllocator';
import type { Clip, Track } from '../types/Timeline';

export class PixiRenderer {
  private app: Application;
  private stage: Container;
  private container: HTMLElement;
  
  // Modules
  private allocator: TextureAllocator;
  private resizeObserver: ResizeObserver | null = null;

  // Scene Graph
  private clipSprites: Map<string, Sprite> = new Map();

  constructor(app: Application, container: HTMLElement) {
    this.app = app;
    this.stage = app.stage;
    this.container = container;
    this.allocator = new TextureAllocator();
  }

  public async init() {
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
    this.app.ticker.add(this.render.bind(this));
  }

  private render() {
    const currentTime = editorEngine.getCurrentTime();
    const tracks = editorEngine.getTracks();

    // 1. Visibility Logic
    const visibleClips: Clip[] = [];
    tracks.forEach((track: Track) => {
      if (track.type !== 'video' || track.isMuted) return;
      const clip = track.clips.find(c => 
        currentTime >= c.start && currentTime < (c.start + c.duration)
      );
      if (clip) visibleClips.push(clip);
    });

    // 2. Pruning
    const visibleClipIds = new Set(visibleClips.map(c => c.id));
    for (const [clipId, sprite] of this.clipSprites) {
      if (!visibleClipIds.has(clipId)) {
        this.stage.removeChild(sprite);
        this.clipSprites.delete(clipId);
      }
    }

    // 3. Rendering
    visibleClips.forEach(async (clip) => {
      let sprite = this.clipSprites.get(clip.id);

      if (!sprite) {
        sprite = new Sprite();
        sprite.anchor.set(0.5);
        sprite.texture = Texture.EMPTY; // Safe default
        this.stage.addChild(sprite);
        this.clipSprites.set(clip.id, sprite);

        // Async Load
        const texture = await this.allocator.getTexture(editorEngine.getAsset(clip.assetId)!);
        if (texture && sprite === this.clipSprites.get(clip.id)) {
           sprite.texture = texture;
           this.fitSprite(sprite, texture);
        }
      }

      // Sync Frame
      if (clip.type === 'video' && sprite.texture !== Texture.EMPTY) {
         this.syncVideoFrame(clip, sprite, currentTime);
      }
    });
  }

  private syncVideoFrame(clip: Clip, sprite: Sprite, globalTime: number) {
     const source = sprite.texture.source as VideoSource;
     // Type guard for VideoSource
     if (!source || !(source instanceof VideoSource)) return;
     
     const video = source.resource as HTMLVideoElement;
     if (!video) return;

     // A. Calculate Time
     const clipTime = globalTime - clip.start + clip.offset;

     // B. Seek if needed (Drift correction)
     if (Math.abs(video.currentTime - clipTime) > 0.15) {
        // Safety: Don't seek if we are already seeking to avoid "thrashing"
        if (!video.seeking) {
           video.currentTime = clipTime;
        }
     }

     // C. Playback State
     if (editorEngine.getIsPlaying()) {
        if (video.paused) video.play().catch(() => {});
     } else {
        if (!video.paused) video.pause();
     }

     // D. Texture Update (THE CRITICAL PART)
     // Only update if:
     // 1. Video has data (readyState >= 2)
     // 2. Video is NOT seeking (prevents black frame / wrong dimension / GL error during seek)
     // 3. Video dimensions are valid
     if (video.readyState >= 2 && !video.seeking && video.videoWidth > 0) {
         try {
             source.update();
         } catch (e) {
             // Suppress GL errors for this frame, try again next tick
         }
     }
  }

  private handleResize() {
     if (!this.container || !this.app || !this.app.renderer) return;
     this.app.renderer.resize(this.container.clientWidth, this.container.clientHeight);
     this.clipSprites.forEach(s => {
        if (s.texture !== Texture.EMPTY) this.fitSprite(s, s.texture);
     });
  }

  private fitSprite(sprite: Sprite, texture: Texture) {
     const w = this.app.screen.width;
     const h = this.app.screen.height;
     sprite.x = w / 2;
     sprite.y = h / 2;
     sprite.scale.set(Math.min(w / texture.width, h / texture.height));
  }

  public destroy() {
    this.resizeObserver?.disconnect();
    this.app.ticker.remove(this.render, this);
    this.allocator.destroy();
    this.clipSprites.clear();
  }
}