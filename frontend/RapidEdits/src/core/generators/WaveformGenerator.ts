import { globalEventBus } from "../events/EventBus";
import Worker from "../../workers/waveform.worker?worker";

export class WaveformGenerator {
    private audioContext: AudioContext;
    private audioBufferCache: Map<string, AudioBuffer> = new Map();
    private pendingRequests: Map<string, Promise<AudioBuffer>> = new Map();
    private worker: Worker;

    constructor() {
        this.audioContext = new (
            window.AudioContext || (window as any).webkitAudioContext
        )();
        this.worker = new Worker();
    }

    /**
     * Loads and caches the AudioBuffer for a given URL.
     */
    public async loadAudioBuffer(url: string): Promise<AudioBuffer> {
        if (this.audioBufferCache.has(url)) {
            return this.audioBufferCache.get(url)!;
        }

        if (this.pendingRequests.has(url)) {
            return this.pendingRequests.get(url)!;
        }

        const request = fetch(url)
            .then((response) => response.arrayBuffer())
            .then((arrayBuffer) =>
                this.audioContext.decodeAudioData(arrayBuffer),
            )
            .then((audioBuffer) => {
                this.audioBufferCache.set(url, audioBuffer);
                this.pendingRequests.delete(url);
                return audioBuffer;
            })
            .catch((err) => {
                this.pendingRequests.delete(url);
                throw err;
            });

        this.pendingRequests.set(url, request);
        return request;
    }

    /**
     * Requests waveform generation in chunks.
     * Emits events as progress is made.
     */
    public async requestWaveform(
        url: string,
        assetId: string,
        totalSamples: number,
    ): Promise<void> {
        try {
            globalEventBus.emit({
                type: "WAVEFORM_GENERATION_START",
                payload: { assetId },
            });

            const audioBuffer = await this.loadAudioBuffer(url);
            const totalDuration = audioBuffer.duration;
            const rawData = audioBuffer.getChannelData(0);
            const sampleRate = audioBuffer.sampleRate;

            // Config
            const CHUNK_DURATION = 60; // Process 60s at a time
            let currentTime = 0;

            const processNextChunk = () => {
                if (currentTime >= totalDuration) {
                    globalEventBus.emit({
                        type: "WAVEFORM_GENERATION_END",
                        payload: { assetId },
                    });
                    return;
                }

                const endTime = Math.min(
                    currentTime + CHUNK_DURATION,
                    totalDuration,
                );
                const startSample = Math.floor(currentTime * sampleRate);
                const endSample = Math.floor(endTime * sampleRate);

                // Calculate how many visual samples (peaks) belong to this chunk
                // proportion = (chunkDuration / totalDuration)
                const chunkDuration = endTime - currentTime;
                const chunkSamples = Math.ceil(
                    (chunkDuration / totalDuration) * totalSamples,
                );

                // Slice buffer (Transferable optimization)
                const chunkRaw = rawData.slice(startSample, endSample);

                const workerHandler = (e: MessageEvent) => {
                    this.worker.removeEventListener("message", workerHandler);

                    globalEventBus.emit({
                        type: "WAVEFORM_CHUNK_GENERATED",
                        payload: {
                            assetId,
                            start: currentTime,
                            end: endTime,
                            data: e.data, // Float32Array from worker
                        },
                    });

                    currentTime = endTime;
                    // Yield to main thread with a small delay to prevent UI freeze
                    setTimeout(processNextChunk, 100);
                };

                this.worker.addEventListener("message", workerHandler);
                this.worker.postMessage(
                    {
                        channelData: chunkRaw,
                        startSampleIndex: 0,
                        endSampleIndex: chunkRaw.length,
                        samples: chunkSamples,
                    },
                    [chunkRaw.buffer],
                ); // Transfer buffer to avoid copy cost
            };

            processNextChunk();
        } catch (e) {
            console.error("Waveform generation failed", e);
            globalEventBus.emit({
                type: "WAVEFORM_GENERATION_END",
                payload: { assetId },
            });
        }
    }
}

export const waveformGenerator = new WaveformGenerator();
