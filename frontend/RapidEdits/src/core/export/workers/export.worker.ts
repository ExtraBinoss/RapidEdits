// export.worker.ts

interface WorkerConfig {
    width: number;
    height: number;
    fps: number;
    bitrate?: number;
    format?: string;
    sessionId: string;
    apiUrl: string;
}

let encoder: VideoEncoder | null = null;
let chunkBuffer: Uint8Array[] = [];
let bufferSize = 0;
const FLUSH_THRESHOLD = 5 * 1024 * 1024; // 5MB
let config: WorkerConfig | null = null;

self.onmessage = async (e: MessageEvent) => {
    const { type, payload } = e.data;

    switch (type) {
        case "init":
            await initEncoder(payload);
            break;
        case "encode":
            if (encoder) {
                const { frame, keyFrame } = payload;
                try {
                    encoder.encode(frame, { keyFrame });
                    frame.close();
                } catch (err) {
                    console.error("Worker encode error", err);
                    self.postMessage({ type: "error", error: String(err) });
                }
            } else {
                // If encoder isn't ready and we received a frame, we must close it to avoid leaks
                if (payload.frame) payload.frame.close();
            }
            break;
        case "close":
            if (encoder) {
                await encoder.flush();
                await flushBuffer();
                encoder.close();
                encoder = null;
                self.postMessage({ type: "done" });
            }
            break;
    }
};

async function initEncoder(cfg: WorkerConfig) {
    config = cfg;
    const isWebM = config.format === "webm";
    const codec = isWebM ? "vp09.00.31.08" : "avc1.4d002a"; // Main Profile 4.2

    chunkBuffer = [];
    bufferSize = 0;

    encoder = new VideoEncoder({
        output: (chunk, _metadata) => {
            const buffer = new Uint8Array(chunk.byteLength);
            chunk.copyTo(buffer);
            chunkBuffer.push(buffer);
            bufferSize += buffer.byteLength;

            if (bufferSize > FLUSH_THRESHOLD) {
                flushBuffer();
            }
        },
        error: (e) => {
            console.error("Worker Encoder Error", e);
            self.postMessage({ type: "error", error: e.message });
        },
    });

    const encConfig: VideoEncoderConfig = {
        codec,
        width: config.width,
        height: config.height,
        bitrate: config.bitrate || 15_000_000,
        framerate: config.fps,
    };

    if (!isWebM) {
        encConfig.avc = { format: "annexb" };
    }

    try {
        const support = await VideoEncoder.isConfigSupported(encConfig);
        if (!support.supported) {
            throw new Error("Codec config not supported: " + codec);
        }
        encoder.configure(encConfig);
        self.postMessage({ type: "initialized" });
    } catch (e: any) {
        self.postMessage({ type: "error", error: e.message });
    }
}

async function flushBuffer() {
    if (!config || chunkBuffer.length === 0) return;

    // Snapshot buffer
    const chunks = [...chunkBuffer];
    chunkBuffer = [];
    bufferSize = 0;

    const totalLength = chunks.reduce((acc, val) => acc + val.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const c of chunks) {
        combined.set(c, offset);
        offset += c.length;
    }

    // Upload (fire and forget / async)
    // We don't await this strictly in the encoder flow unless closing,
    // but better to ensure order if we were rigorous.
    // However, JS non-blocking fetch means we might race.
    // BUT since this is a worker, we can just await it since we want to clear memory.
    // The main thread is not blocked.
    try {
        await fetch(`${config.apiUrl}/render/append/${config.sessionId}`, {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: new Blob([combined]),
        });
        self.postMessage({ type: "progress", bytes: totalLength });
    } catch (e: any) {
        console.error("Upload failed", e);
        self.postMessage({
            type: "error",
            error: "Upload failed: " + e.message,
        });
    }
}

export {};
