import * as THREE from "three";
import { resourceManager } from "../../ResourceManager";
import { ResourceManager } from "../../ResourceManager";
import type { Asset } from "../../../types/Media";

export class TextureAllocator {
    private textureCache: Map<string, THREE.Texture> = new Map();
    private textureLoader = new THREE.TextureLoader();
    private resourceManager: ResourceManager;

    constructor(manager?: ResourceManager) {
        this.resourceManager = manager || resourceManager;
    }

    public async getTexture(asset: Asset): Promise<THREE.Texture | null> {
        // 1. Check Cache
        if (this.textureCache.has(asset.id)) {
            return this.textureCache.get(asset.id)!;
        }

        try {
            let texture: THREE.Texture | null = null;

            if (asset.type === "image") {
                texture = await this.createImageTexture(asset);
            } else if (asset.type === "video") {
                texture = await this.createVideoTexture(asset);
            }

            if (texture) {
                // Optimize for 2D/Video usage
                // USE LINEAR to avoid Chrome/Mac sRGB decode lag
                texture.colorSpace = THREE.LinearSRGBColorSpace;
                this.textureCache.set(asset.id, texture);
            }
            return texture;
        } catch (err) {
            console.error(`Texture allocation failed for ${asset.name}`, err);
            return null;
        }
    }

    private async createImageTexture(asset: Asset): Promise<THREE.Texture> {
        const texture = await this.textureLoader.loadAsync(asset.url);
        // Images are usually NPOT, so set filters to Linear
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        return texture;
    }

    private async createVideoTexture(
        asset: Asset,
    ): Promise<THREE.Texture | null> {
        const video = (await this.resourceManager.getElement(
            asset,
        )) as HTMLVideoElement;

        // Robustness: Wait for dimensions
        if (video.readyState < 2) {
            await new Promise<void>((resolve) => {
                const fn = () => {
                    if (video.readyState >= 2) {
                        video.removeEventListener("loadeddata", fn);
                        resolve();
                    }
                };
                video.addEventListener("loadeddata", fn);
            });
        }

        // Safety delay for frame 0 to ensure WebGL context catches up
        if (video.currentTime === 0) {
            await new Promise((r) => setTimeout(r, 20));
        }

        const texture = new THREE.VideoTexture(video);

        // CRITICAL for NPOT Videos in WebGL:
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.format = THREE.RGBAFormat;

        return texture;
    }

    public destroy() {
        this.textureCache.forEach((t) => t.dispose());
        this.textureCache.clear();
    }
}
