import { ref, onUnmounted } from "vue";

export interface WhisperResult {
    text: string;
    chunks: {
        timestamp: [number, number];
        text: string;
    }[];
}

export function useWhisper() {
    const worker = ref<Worker | null>(null);
    const isModelLoading = ref(false);
    const isModelReady = ref(false);
    const isTranscribing = ref(false);
    const progress = ref(0);
    const statusMessage = ref("");
    const error = ref<string | null>(null);
    const result = ref<WhisperResult | null>(null);

    const initWorker = () => {
        if (!worker.value) {
            worker.value = new Worker(
                new URL("../workers/whisper.worker.ts", import.meta.url),
                {
                    type: "module",
                },
            );

            worker.value.onmessage = (event) => {
                const {
                    status,
                    message,
                    result: workerResult,
                    progress: workerProgress,
                } = event.data;

                if (status === "loading") {
                    isModelLoading.value = true;
                    statusMessage.value = message;
                } else if (status === "progress") {
                    // workerProgress is usually { status: 'progress', name: '...', file: '...', progress: 0-100, loaded: ..., total: ... }
                    if (workerProgress.status === "progress") {
                        progress.value = Math.round(
                            workerProgress.progress || 0,
                        );
                        statusMessage.value = `Downloading ${workerProgress.file}... ${progress.value}%`;
                    }
                } else if (status === "ready") {
                    isModelLoading.value = false;
                    isModelReady.value = true;
                    statusMessage.value = "Ready";
                    progress.value = 100;
                } else if (status === "complete") {
                    isTranscribing.value = false;
                    result.value = workerResult;
                } else if (status === "error") {
                    error.value = message;
                    isModelLoading.value = false;
                    isTranscribing.value = false;
                }
            };
        }
    };

    const downloadModel = () => {
        initWorker();
        if (isModelReady.value) return;

        error.value = null;
        worker.value?.postMessage({ type: "load" });
    };

    const transcribe = async (audioBlob: Blob | File) => {
        if (!isModelReady.value) {
            error.value = "Model not loaded. Please download the model first.";
            return;
        }

        isTranscribing.value = true;
        result.value = null;
        error.value = null;

        try {
            // Decode audio on main thread using AudioContext
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioContext = new (
                window.AudioContext || (window as any).webkitAudioContext
            )({
                sampleRate: 16000, // Force 16k sample rate context if possible, but decoding will match file
            });

            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            // We need 16kHz execution
            // If the decoded audio is not 16k, we need to resample or trust the worker pipeline handle raw data if properly tagged
            // However, transformers.js typically expects 16k input float32 array

            let audioData: Float32Array;

            if (audioBuffer.sampleRate === 16000) {
                audioData = audioBuffer.getChannelData(0); // Use first channel
            } else {
                // Resample to 16000
                const offlineContext = new OfflineAudioContext(
                    1,
                    audioBuffer.duration * 16000,
                    16000,
                );
                const source = offlineContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(offlineContext.destination);
                source.start(0);
                const resampledBuffer = await offlineContext.startRendering();
                audioData = resampledBuffer.getChannelData(0);
            }

            worker.value?.postMessage(
                {
                    type: "transcribe",
                    data: { audio: audioData },
                },
                [audioData.buffer],
            ); // Transferable

            // Close context to release resources
            if (audioContext.state !== "closed") {
                audioContext.close();
            }
        } catch (e: any) {
            error.value = "Audio decoding failed: " + e.message;
            isTranscribing.value = false;
        }
    };

    const clearResult = () => {
        result.value = null;
    };

    onUnmounted(() => {
        if (worker.value) {
            worker.value.terminate();
        }
    });

    return {
        isModelLoading,
        isModelReady,
        isTranscribing,
        progress,
        statusMessage,
        error,
        result,
        downloadModel,
        transcribe,
        clearResult,
    };
}
