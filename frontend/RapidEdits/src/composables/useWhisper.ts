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

        // Convert Blob/File to generic AudioContext compatible format or just pass URL?
        // transformers.js pipelines usually accept URLs or AudioArrays.
        // Easiest is to create a URL.
        const url = URL.createObjectURL(audioBlob);

        worker.value?.postMessage({
            type: "transcribe",
            data: { audio: url },
        });
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
