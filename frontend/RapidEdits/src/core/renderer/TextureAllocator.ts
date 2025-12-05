import { VideoSource, Texture, Assets } from 'pixi.js';
import { resourceManager } from '../ResourceManager';
import type { Asset } from '../../types/Media';

/**
 * Handles the robust creation and configuration of PixiJS Textures from Assets.
 * Enforces WebGL best practices for Video to avoid "Level of detail" errors.
 */
export class TextureAllocator {
  private textureCache: Map<string, Texture> = new Map();

  /**
   * Gets a safe, WebGL-compliant texture for the given asset.
   */
  public async getTexture(asset: Asset): Promise<Texture | null> {
    // 1. Check Cache
    if (this.textureCache.has(asset.id)) {
      const cached = this.textureCache.get(asset.id)!;
      if (!cached.destroyed) {
        return cached;
      }
      this.textureCache.delete(asset.id);
    }

    // 2. Allocate New
    try {
      let texture: Texture | null = null;

      if (asset.type === 'image') {
         texture = await this.createImageTexture(asset);
      } else if (asset.type === 'video') {
         texture = await this.createVideoTexture(asset);
      }

      if (texture) {
        this.textureCache.set(asset.id, texture);
      }
      return texture;

    } catch (err) {
      console.error(`Texture allocation failed for ${asset.name}`, err);
      return null;
    }
  }

  private async createImageTexture(asset: Asset): Promise<Texture> {
    return await Assets.load(asset.url);
  }

  private async createVideoTexture(asset: Asset): Promise<Texture | null> {
    const video = await resourceManager.getElement(asset) as HTMLVideoElement;

    // A. Strict Readiness Check
    // We need dimensions AND data.
    if (video.readyState < 2) { // HAVE_CURRENT_DATA
       await this.waitForVideoReady(video);
    }

    // B. Sanity Check
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    // C. Safety Delay for Frame 0
    // Browsers race condition: readyState=2 doesn't always mean texImage2D is happy immediately.
    if (video.currentTime === 0) {
        await new Promise(r => setTimeout(r, 20));
    }

    // D. Create Source with STRICT NPOT settings
    const source = new VideoSource({
        resource: video,
        autoPlay: false,
        autoGenerateMipmaps: false, // NEVER mipmap video
        alphaMode: 'premultiply-alpha-on-upload',
    });

    // E. Configure Style for WebGL 1/2 Compatibility
    source.style.addressMode = 'clamp-to-edge'; // Prevents wrapping errors
    source.style.scaleMode = 'linear'; // Prevents mipmap requirement

    const texture = new Texture({ source });

    // F. Prime the Texture
    // We attempt one update. If it fails, we discard the texture to prevent crashing the main loop.
    try {
       source.update();
    } catch (e) {
       console.warn('Failed to prime video texture', e);
       // Proceed anyway? Or return null? 
       // Usually safe to proceed, the loop will try again.
    }

    return texture;
  }

  private waitForVideoReady(video: HTMLVideoElement): Promise<void> {
    return new Promise((resolve) => {
      // If already ready by the time we get here
      if (video.readyState >= 2) return resolve();

      const onReady = () => {
         if (video.readyState >= 2) {
             video.removeEventListener('loadeddata', onReady);
             video.removeEventListener('canplay', onReady);
             resolve();
         }
      };
      video.addEventListener('loadeddata', onReady);
      video.addEventListener('canplay', onReady);
    });
  }

  public destroy() {
    this.textureCache.forEach(t => t.destroy());
    this.textureCache.clear();
  }
}
