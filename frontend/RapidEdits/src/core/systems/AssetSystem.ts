import { v4 as uuidv4 } from "uuid";
import { globalEventBus } from "../events/EventBus";
import { MediaType, type Asset, type MediaTypeValue } from "../../types/Media";

export class AssetSystem {
    private assets: Map<string, Asset> = new Map();

    public async addAsset(file: File): Promise<Asset> {
        const type = this.determineMediaType(file.type);
        const url = URL.createObjectURL(file);

        let duration = 0;
        if (type === MediaType.VIDEO || type === MediaType.AUDIO) {
            duration = await this.getMediaDuration(url);
        } else {
            duration = 5;
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
        globalEventBus.emit({ type: "ASSET_ADDED", payload: asset });
        return asset;
    }

    public removeAsset(id: string) {
        if (this.assets.has(id)) {
            const asset = this.assets.get(id);
            if (asset?.url) URL.revokeObjectURL(asset.url);
            this.assets.delete(id);
            globalEventBus.emit({ type: "ASSET_REMOVED", payload: id });
        }
    }

    public getAsset(id: string): Asset | undefined {
        return this.assets.get(id);
    }

    public getAllAssets(): Asset[] {
        return Array.from(this.assets.values());
    }

    // --- Helpers ---

    private determineMediaType(mimeType: string): MediaTypeValue {
        if (mimeType.startsWith("video/")) return MediaType.VIDEO;
        if (mimeType.startsWith("audio/")) return MediaType.AUDIO;
        if (mimeType.startsWith("image/")) return MediaType.IMAGE;
        return MediaType.UNKNOWN;
    }

    private getMediaDuration(url: string): Promise<number> {
        return new Promise((resolve) => {
            const element = document.createElement("video");
            element.preload = "metadata";

            const timeout = setTimeout(() => {
                console.warn("Metadata load timed out for:", url);
                resolve(0);
                element.remove();
            }, 3000);

            element.onloadedmetadata = () => {
                clearTimeout(timeout);
                if (element.duration === Infinity) {
                    console.warn("Duration is Infinity for:", url);
                    resolve(0);
                } else {
                    resolve(element.duration);
                }
                element.remove();
            };

            element.onerror = () => {
                clearTimeout(timeout);
                console.error("Failed to load metadata:", element.error, url);
                resolve(0);
                element.remove();
            };

            element.src = url;
        });
    }
}
