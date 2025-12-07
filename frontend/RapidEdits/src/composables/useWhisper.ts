import { ref, onUnmounted } from "vue";

export interface WhisperResult {
    text: string;
    chunks: {
        timestamp: [number, number];
        text: string;
    }[];
}

import WhisperWorker from "../workers/whisper.worker?worker";

export function useWhisper() {
    const worker = ref<Worker | null>(null);
    const isModelLoading = ref(false);
    const isModelReady = ref(false);
    const isTranscribing = ref(false);
    const progress = ref(0); // Download progress
    const transcriptionProgress = ref(0); // Transcription percentage (0-100) - Less relevant with streaming but kept
    const statusMessage = ref("");
    const error = ref<string | null>(null);
    const result = ref<WhisperResult | null>(null);
    const tokensPerSecond = ref<number | string>(0);
    const device = ref<"webgpu" | "cpu">("webgpu"); // Default to WebGPU
    const model = ref<string>("onnx-community/whisper-base"); // Default to Whisper Base
    const audioDetails = ref<{
        channels: number;
        length: number;
        sampleRate: number;
        duration: number;
    } | null>(null);

    const initWorker = () => {
        if (!worker.value) {
            worker.value = new WhisperWorker();

            worker.value.onmessage = (event) => {
                const {
                    status,
                    message,
                    result: workerResult,
                    progress: workerProgress,
                    data,
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
                    transcriptionProgress.value = 100;
                    // Standardize result
                    result.value = {
                        text: workerResult.text || workerResult[0]?.text || "",
                        chunks: [], // Moonshine might not return timestamps/chunks in the same way immediately
                    };
                    statusMessage.value = "Transcription Complete";
                } else if (status === "transcribing-progress") {
                    // data contains { text, tps }
                    if (data) {
                        result.value = {
                            text: data.text,
                            chunks: [],
                        };
                        tokensPerSecond.value = data.tps;
                        statusMessage.value = `Transcribing... (${data.tps} tokens/s)`;
                    }
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
        worker.value?.postMessage({
            type: "load",
            data: { device: device.value, model: model.value },
        });
    };

    // Store duration to calculate progress
    // let totalDuration = 0;

    const transcribe = async (
        audioBlob: Blob | File,
        language: string = "auto", // Default to auto detection
    ) => {
        if (!isModelReady.value) {
            error.value = "Model not loaded. Please download the model first.";
            return;
        }

        isTranscribing.value = true;
        transcriptionProgress.value = 0;
        tokensPerSecond.value = 0;
        statusMessage.value = "Preparing audio...";
        result.value = null;
        error.value = null;

        try {
            // Decode audio on main thread using AudioContext
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioContext = new (
                window.AudioContext || (window as any).webkitAudioContext
            )({
                sampleRate: 16000,
            });

            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            // totalDuration = audioBuffer.duration;
            audioDetails.value = {
                channels: audioBuffer.numberOfChannels,
                length: audioBuffer.length,
                sampleRate: audioBuffer.sampleRate,
                duration: audioBuffer.duration,
            };
            console.log("Decoded audio details:", audioDetails.value);

            let audioData: Float32Array;

            if (audioBuffer.sampleRate === 16000) {
                audioData = audioBuffer.getChannelData(0);
            } else {
                // Resample if needed (though context was forced 16k)
                const offlineContext = new OfflineAudioContext(
                    1,
                    Math.ceil(audioBuffer.duration * 16000),
                    16000,
                );
                const source = offlineContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(offlineContext.destination);
                source.start(0);
                const resampledBuffer = await offlineContext.startRendering();
                audioData = resampledBuffer.getChannelData(0);
            }

            let sanitizedLanguage = language;
            if (language !== "auto" && language.includes("-")) {
                sanitizedLanguage = language.split("-")[0] || language;
            }

            worker.value?.postMessage({
                type: "transcribe",
                data: {
                    audio: audioData,
                    language: sanitizedLanguage,
                    device: device.value,
                    model: model.value,
                },
            });
            console.log("Transcribing with language:", sanitizedLanguage);

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
        tokensPerSecond.value = 0;
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
        tokensPerSecond,
        downloadModel,
        transcribe,
        clearResult,
        transcriptionProgress,
        device,
        model,
        audioDetails,
    };
}
