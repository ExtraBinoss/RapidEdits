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
    const transcriptionProgress = ref(0); // Transcription percentage (0-100)
    const statusMessage = ref("");
    const error = ref<string | null>(null);
    const result = ref<WhisperResult | null>(null);

    const initWorker = () => {
        if (!worker.value) {
            worker.value = new WhisperWorker();

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
                    transcriptionProgress.value = 100;
                    result.value = workerResult;
                } else if (status === "transcribing-progress") {
                    // event.data.data contains { timestamp: [start, end], text }
                    const { timestamp } = event.data.data;
                    if (timestamp && totalDuration > 0) {
                        const endTime = timestamp[1];
                        // Calculate percentage
                        transcriptionProgress.value = Math.min(
                            Math.round((endTime / totalDuration) * 100),
                            99,
                        );
                        statusMessage.value = `Transcribing... ${transcriptionProgress.value}%`;
                    }
                } else if (status === "transcribing-debug") {
                    console.log("Worker DEBUG:", event.data.data);
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

    // Store duration to calculate progress
    let totalDuration = 0;

    const transcribe = async (
        audioBlob: Blob | File,
        language: string = "fr",
    ) => {
        if (!isModelReady.value) {
            error.value = "Model not loaded. Please download the model first.";
            return;
        }

        isTranscribing.value = true;
        transcriptionProgress.value = 0;
        statusMessage.value = "Preparing audio...";
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
            totalDuration = audioBuffer.duration; // Store duration
            console.log("Decoded audio details:", {
                channels: audioBuffer.numberOfChannels,
                length: audioBuffer.length,
                sampleRate: audioBuffer.sampleRate,
                duration: audioBuffer.duration,
            });

            // Check if source buffer has data
            const sourceData = audioBuffer.getChannelData(0);
            const sourceNonZeros = sourceData.some((x) => x !== 0);
            console.log("Source buffer has data:", sourceNonZeros);

            let audioData: Float32Array;

            if (audioBuffer.sampleRate === 16000) {
                console.log("Using direct decoded buffer (16kHz)");
                audioData = audioBuffer.getChannelData(0); // Use first channel
            } else {
                console.log(
                    "Resampling from " + audioBuffer.sampleRate + " to 16000",
                );
                // Resample to 16000
                const offlineContext = new OfflineAudioContext(
                    1,
                    Math.ceil(audioBuffer.duration * 16000), // ceil to ensure we fit
                    16000,
                );
                const source = offlineContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(offlineContext.destination);
                source.start(0);
                const resampledBuffer = await offlineContext.startRendering();
                audioData = resampledBuffer.getChannelData(0);
                console.log(
                    "Resampling complete. New length:",
                    audioData.length,
                );
            }

            const hasData = audioData.some((x) => x !== 0);
            console.log("Final audioData has data:", hasData);
            if (!hasData && sourceNonZeros) {
                console.error("Data lost during resampling!");
            }

            console.log("audioData", audioData);
            const langCode = language.split("-")[0] || "fr";
            console.log("Starting transcription with language:", langCode);

            worker.value?.postMessage({
                type: "transcribe",
                data: {
                    audio: audioData,
                    language: langCode,
                },
            }); // Removed transferables to be safe for now, copying is fine for <100MB
            console.log("Transcribing...");
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
        transcriptionProgress,
    };
}
