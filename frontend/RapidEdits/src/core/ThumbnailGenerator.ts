interface ThumbnailRequest {
    id: string; // Unique ID for the request (e.g. "assetId-timestamp")
    url: string;
    timestamp: number;
    resolve: (data: string) => void;
    reject: (err: any) => void;
}

export class ThumbnailGenerator {
    private video: HTMLVideoElement;
    private canvas: OffscreenCanvas;
    private ctx: OffscreenCanvasRenderingContext2D;
    private queue: ThumbnailRequest[] = [];
    private isProcessing: boolean = false;
    private cache: Map<string, string> = new Map();

    constructor() {
        this.video = document.createElement("video");
        this.video.crossOrigin = "anonymous";
        this.video.muted = true;
        this.video.preload = "auto";
        
        // Hidden canvas for drawing
        this.canvas = new OffscreenCanvas(160, 90); // 16:9 small thumbnail
        this.ctx = this.canvas.getContext("2d", { willReadFrequently: true })!;
    }

    public async generate(url: string, timestamp: number, width: number = 160, height: number = 90): Promise<string> {
        const id = `${url}-${timestamp.toFixed(2)}-${width}x${height}`;
        
        if (this.cache.has(id)) {
            return this.cache.get(id)!;
        }

        return new Promise((resolve, reject) => {
            this.queue.push({ id, url, timestamp, resolve, reject });
            this.processQueue();
        });
    }

    private async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;
        const request = this.queue.shift()!;

        try {
            // Check if we need to load a new source
            if (this.video.src !== request.url) {
                this.video.src = request.url;
                await new Promise((resolve) => {
                    this.video.onloadedmetadata = resolve;
                });
            }

            // Seek
            this.video.currentTime = request.timestamp;
            await new Promise((resolve) => {
                // "seeked" event is more reliable than just waiting
                const onSeeked = () => {
                    this.video.removeEventListener("seeked", onSeeked);
                    resolve(true);
                };
                this.video.addEventListener("seeked", onSeeked);
            });

            // Draw
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            
            // Extract
            const blob = await this.canvas.convertToBlob({ type: "image/jpeg", quality: 0.7 });
            const dataUrl = URL.createObjectURL(blob); // Using ObjectURL is faster than base64 for caching
            
            this.cache.set(request.id, dataUrl);
            request.resolve(dataUrl);

        } catch (error) {
            console.error("Thumbnail generation failed", error);
            request.reject(error);
        } finally {
            this.isProcessing = false;
            // Process next with a yield to main thread
            setTimeout(() => this.processQueue(), 0);
        }
    }
}

export const thumbnailGenerator = new ThumbnailGenerator();
