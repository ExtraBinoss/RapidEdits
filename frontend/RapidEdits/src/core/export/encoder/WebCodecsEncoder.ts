import type { ExportBackend } from "../api/ExportBackend";

export class WebCodecsEncoder {
    private encoder: VideoEncoder;
    private chunkBuffer: Uint8Array[] = [];
    private bufferSize = 0;
    private readonly FLUSH_THRESHOLD = 5 * 1024 * 1024; // 5MB

    private backend: ExportBackend;
    private sessionId: string;
    private config: {
        width: number;
        height: number;
        fps: number;
        bitrate?: number;
    };

    constructor(
        backend: ExportBackend,
        sessionId: string,
        config: {
            width: number;
            height: number;
            fps: number;
            bitrate?: number;
        },
    ) {
        this.backend = backend;
        this.sessionId = sessionId;
        this.config = config;

        this.encoder = new VideoEncoder({
            output: (chunk) => this.handleChunk(chunk),
            error: (e) => {
                console.error("Encoder error", e);
                // We might want to rethrow or emit this
            },
        });

        this.configure();
    }

    private configure() {
        const isWebM = (this.config as any).format === "webm";

        // Codec Strings
        // H.264 High Profile Level 5.2: avc1.640034
        // VP9 Profile 0 Level 3.1: vp09.00.31.08 (standard for web)
        const codec = isWebM ? "vp09.00.31.08" : "avc1.640034";

        const config: VideoEncoderConfig = {
            codec,
            width: this.config.width,
            height: this.config.height,
            bitrate: this.config.bitrate || 15_000_000,
            framerate: this.config.fps,
        };

        if (!isWebM) {
            // AVC specific config
            config.avc = { format: "annexb" };
        }

        this.encoder.configure(config);
    }

    private handleChunk(chunk: EncodedVideoChunk) {
        const buffer = new Uint8Array(chunk.byteLength);
        chunk.copyTo(buffer);
        this.chunkBuffer.push(buffer);
        this.bufferSize += buffer.byteLength;
    }

    public async encodeFrame(frame: VideoFrame, keyFrame: boolean) {
        this.encoder.encode(frame, { keyFrame });

        if (this.bufferSize > this.FLUSH_THRESHOLD) {
            await this.flush();
        }
    }

    public async flush() {
        if (this.chunkBuffer.length === 0) return;

        const totalLength = this.chunkBuffer.reduce(
            (acc, val) => acc + val.length,
            0,
        );
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of this.chunkBuffer) {
            combined.set(chunk, offset);
            offset += chunk.length;
        }

        // Upload
        await this.backend.appendChunk(this.sessionId, combined);

        // Reset
        this.chunkBuffer = [];
        this.bufferSize = 0;
    }

    public async close() {
        await this.encoder.flush();
        await this.flush(); // Upload remaining
        this.encoder.close();
    }
}
