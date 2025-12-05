import { globalEventBus } from "./EventBus";
import Worker from "../workers/waveform.worker?worker";

export class WaveformGenerator {
    private audioContext: AudioContext;
    private audioBufferCache: Map<string, AudioBuffer> = new Map();
    private pendingRequests: Map<string, Promise<AudioBuffer>> = new Map();
    private worker: Worker;
    // Map URL to ID is tricky if we don't pass ID. Actually we need ID for the event.
    // We will update the signature to accept ID optionally or handle it.
    // For now we assume the caller handles the "visual" waiting state,
    // but the prompt asked for "global event". We need to propagate Asset ID.
    // But getWaveformSubset receives URL. We might need a reverse lookup or just pass ID.
    // Let's overload or chang signature.

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
     * Gets a subset of the waveform data for a specific time range.
     * @param url The audio file URL
     * @param startTime Start time in seconds
     * @param endTime End time in seconds
     * @param samples Number of data points to return for this range
     */
    public async getWaveformSubset(
        url: string,
        startTime: number,
        endTime: number,
        samples: number,
        assetId?: string, // Optional ID for events
    ): Promise<number[] | Float32Array> {
        try {
            if (assetId) {
                globalEventBus.emit({
                    type: "WAVEFORM_GENERATION_START",
                    payload: { assetId },
                });
            }

            const audioBuffer = await this.loadAudioBuffer(url);

            const totalDuration = audioBuffer.duration;
            // Clamp times
            const start = Math.max(0, startTime);
            const end = Math.min(totalDuration, endTime);

            if (start >= end) {
                if (assetId)
                    globalEventBus.emit({
                        type: "WAVEFORM_GENERATION_END",
                        payload: { assetId },
                    });
                return new Array(samples).fill(0);
            }

            const sampleRate = audioBuffer.sampleRate;
            const startSampleIndex = Math.floor(start * sampleRate);
            const endSampleIndex = Math.floor(end * sampleRate);
            // const totalSamplesInRange = endSampleIndex - startSampleIndex; // Not directly used in worker postMessage

            const rawData = audioBuffer.getChannelData(0); // Use first channel

            // Offload to Worker
            return new Promise((resolve) => {
                const handler = (e: MessageEvent) => {
                    this.worker.removeEventListener("message", handler);
                    if (assetId) {
                        globalEventBus.emit({
                            type: "WAVEFORM_GENERATION_END",
                            payload: { assetId },
                        });
                    }
                    resolve(e.data);
                };

                this.worker.addEventListener("message", handler);

                // Cloning... large buffers might be slow.
                // Ideally we should cache the Analysis Buffer on the worker side too,
                // or use SharedArrayBuffer. For now, let's see.
                // Actually, sending the WHOLE buffer every time is bad for 40min audio (400MB+).
                // We must slice meaningful data or use Transferable.
                // We can't transfer AudioBuffer's internal buffer easily without detaching.
                // Optimization: Only send the SLICE we need? No, we need to downsample the slice.
                // Actually the loop is what's slow, not the memory access.
                // WORKAROUND: Send only the slice of raw data needed for this view.

                // Sending a slice is better than sending 500MB.
                // Slice size = (endSample - startSample).
                // If visual window is 10s, that's 480k samples ~ 2MB. Fast.
                // BUT we lose the "peak finding" accuracy if we chop it?
                // No, we are subsetting anyway.

                // Actually, wait, getChannelData returns a Float32Array view? No, it returns the wrapper.
                // slice() creates a copy.

                // Let's slice the raw data here.
                // Wait... if we don't send channelData, worker can't read it.
                // If we slice it here: `rawData.slice(start, end)`, that operation is main-thread.
                // Slicing a 1GB array is not instant.

                // Better approach:
                // We keep the heavy lifting on the worker but we simply accept the clone cost for now,
                // OR we rely on the fact that structured clone of TypedArray is optimized.

                // Let's try sending the whole buffer reference.
                // NOTE: Struct clone of big array CAN be slow.
                // The prompt complained about "frame drop". Clone on main thread causes frame drop.

                // REFRESHED PLAN FOR PERFORMANCE:
                // Since we can't transfer the AudioBuffer's buffer (it kills the audio engine access maybe),
                // We will slice the relevant part (2-10MB) which is fast enough, and send that.
                // `rawData.subarray` creates a VIEW. sending a view copies only the view?
                // No, structured clone copies the underlying buffer if it's not transferred.
                // `rawData.slice` COPIES the memory.

                // We will use `slice` to create a smaller buffer (chunk) and transfer it.
                // 10s of audio = 480k floats * 4 bytes = ~2MB. Copying 2MB is instant (ms).

                const chunk = rawData.slice(startSampleIndex, endSampleIndex);
                this.worker.postMessage(
                    {
                        channelData: chunk,
                        startSampleIndex: 0, // Relative to chunk
                        endSampleIndex: chunk.length,
                        samples,
                    },
                    [chunk.buffer],
                ); // TRANSFER OWNERSHIP
            });
        } catch (e) {
            console.error("Waveform subset generation failed", e);
            if (assetId)
                globalEventBus.emit({
                    type: "WAVEFORM_GENERATION_END",
                    payload: { assetId },
                });
            return new Array(samples).fill(0);
        }
    }

    // Keep the old method for backward compatibility if needed, or redirect to subset
    public async getWaveform(
        url: string,
        samples: number = 100,
    ): Promise<number[]> {
        // Legacy
        return [];
    }
}

export const waveformGenerator = new WaveformGenerator();
