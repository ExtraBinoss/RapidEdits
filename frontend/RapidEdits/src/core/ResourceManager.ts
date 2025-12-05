import type { Asset } from "../types/Media";

export class ResourceManager {
    private cache: Map<string, HTMLVideoElement | HTMLAudioElement> = new Map();

    public async getElement(
        asset: Asset,
    ): Promise<HTMLVideoElement | HTMLAudioElement> {
        if (this.cache.has(asset.id)) {
            return this.cache.get(asset.id)!;
        }

        let element: HTMLVideoElement | HTMLAudioElement;

        if (asset.type === "video") {
            const videoElement = document.createElement("video");
            // Important for PixiJS texture binding
            videoElement.crossOrigin = "anonymous";
            videoElement.playsInline = true;
            // We control loop manually via Engine
            videoElement.loop = false;
            videoElement.src = asset.url;
            // Preload - explicit load might conflict if Pixi also tries to load
            // videoElement.load();
            element = videoElement;
        } else if (asset.type === "audio") {
            element = new Audio(asset.url);
            element.crossOrigin = "anonymous";
        } else {
            // Image or other, not handled here for playback
            throw new Error("Unsupported asset type for ResourceManager");
        }

        this.cache.set(asset.id, element);
        return element;
    }

    public cleanup() {
        this.cache.forEach((el) => {
            el.pause();
            el.src = "";
            el.remove();
        });
        this.cache.clear();
    }
}

export const resourceManager = new ResourceManager();
