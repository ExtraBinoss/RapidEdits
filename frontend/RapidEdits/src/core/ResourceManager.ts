import type { Asset } from "../types/Media";

export class ResourceManager {
    private cache: Map<string, HTMLVideoElement | HTMLAudioElement> = new Map();

    public async getElement(
        asset: Asset,
        variant?: string,
    ): Promise<HTMLVideoElement | HTMLAudioElement> {
        const cacheKey = variant ? `${asset.id}:${variant}` : asset.id;

        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        let element: HTMLVideoElement | HTMLAudioElement;

        if (asset.type === "video") {
            // If we specifically want an audio variant of a video, try using Audio element first for efficiency?
            // Some browsers support <audio src="video.mp4">.
            // However, sticking to video element is safer for codec support.
            const videoElement = document.createElement("video");
            videoElement.crossOrigin = "anonymous";
            videoElement.playsInline = true;
            videoElement.loop = false;
            videoElement.src = asset.url;

            // If this is an audio variant, maybe we don't need to decode video tracks?
            // Unfortunately HTMLMediaElement doesn't give granular control easily.

            element = videoElement;
        } else if (asset.type === "audio") {
            element = new Audio(asset.url);
            element.crossOrigin = "anonymous";
        } else {
            throw new Error("Unsupported asset type for ResourceManager");
        }

        this.cache.set(cacheKey, element);
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
