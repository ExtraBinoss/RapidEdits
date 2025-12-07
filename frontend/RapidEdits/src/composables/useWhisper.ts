import { ref } from "vue";
import { useJobSystem } from "./useJobSystem";

export interface WhisperResult {
    text: string;
    chunks: {
        timestamp: [number, number];
        text: string;
    }[];
}

import WhisperWorker from "../workers/whisper.worker?worker";

// Singleton State
const worker = ref<Worker | null>(null);
const isModelLoading = ref(false);
const isModelReady = ref(false);
const isTranscribing = ref(false);
const progress = ref(0);
const transcriptionProgress = ref(0);
const statusMessage = ref("");
const error = ref<string | null>(null);
const result = ref<WhisperResult | null>(null);
const tokensPerSecond = ref<number | string>(0);
const device = ref<"webgpu" | "cpu">("webgpu");
const model = ref<string>("Xenova/whisper-base");
const audioDetails = ref<{
    channels: number;
    length: number;
    sampleRate: number;
    duration: number;
} | null>(null);
// Current active job ID to link UI actions if needed, though mostly handled internally now
const currentJobId = ref<string | null>(null);

export function useWhisper() {
    const { addJob, updateJob, removeJob } = useJobSystem();

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
                    if (currentJobId.value) {
                        updateJob(currentJobId.value, {
                            details: `Loading Model: ${message}`,
                        });
                    }
                } else if (status === "progress") {
                    if (workerProgress.status === "progress") {
                        progress.value = Math.round(
                            workerProgress.progress || 0,
                        );
                        statusMessage.value = `Downloading ${workerProgress.file}... ${progress.value}%`;
                        if (currentJobId.value) {
                            updateJob(currentJobId.value, {
                                details: statusMessage.value,
                            });
                        }
                    }
                } else if (status === "ready") {
                    isModelLoading.value = false;
                    isModelReady.value = true;
                    statusMessage.value = "Ready";
                    progress.value = 100;
                } else if (status === "complete") {
                    isTranscribing.value = false;
                    transcriptionProgress.value = 100;
                    result.value = {
                        text: workerResult.text || workerResult[0]?.text || "",
                        chunks: workerResult.chunks || [],
                    };
                    statusMessage.value = "Transcription Complete";

                    if (currentJobId.value) {
                        updateJob(currentJobId.value, {
                            status: "success",
                            progress: 100,
                            details: `Completed (${result.value?.chunks.length} segments)`,
                        });
                        currentJobId.value = null;
                    }
                } else if (status === "stopped") {
                    isTranscribing.value = false;
                    statusMessage.value = "Transcription stopped";
                    if (currentJobId.value) {
                        // Mark as error/cancelled in job system so it stays visible as stopped
                        updateJob(currentJobId.value, {
                            status: "error",
                            error: "Stopped by user",
                        });
                        currentJobId.value = null;
                    }
                } else if (status === "transcribing-progress") {
                    if (data) {
                        // Optimistic update of text
                        result.value = {
                            text: data.text,
                            chunks: [],
                        };
                        tokensPerSecond.value = data.tps;
                        statusMessage.value = `Transcribing... ${data.tps} t/s`;

                        // Calculate percentage based on current audio duration
                        let pct = 0;
                        if (audioDetails.value?.duration && data.timestamp) {
                            // data.timestamp is pair [start, end] of latest chunk, or just end time number
                            const currentSeconds = Array.isArray(data.timestamp)
                                ? data.timestamp[1]
                                : data.timestamp;
                            if (currentSeconds) {
                                pct = Math.min(
                                    100,
                                    Math.round(
                                        (currentSeconds /
                                            audioDetails.value.duration) *
                                            100,
                                    ),
                                );
                            }
                        }
                        transcriptionProgress.value = pct;

                        if (currentJobId.value) {
                            updateJob(currentJobId.value, {
                                progress: pct,
                                details: `Transcribing... (${pct}%) - ${Math.round(data.tps)} t/s`,
                            });
                        }
                    }
                } else if (status === "error") {
                    error.value = message;
                    isModelLoading.value = false;
                    isTranscribing.value = false;
                    if (currentJobId.value) {
                        updateJob(currentJobId.value, {
                            status: "error",
                            error: message,
                        });
                        currentJobId.value = null;
                    }
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

    const stop = () => {
        if (isTranscribing.value && worker.value) {
            worker.value.postMessage({ type: "stop" });
            statusMessage.value = "Stopping...";
        }
    };

    const transcribe = async (
        audioBlob: Blob | File,
        language: string = "auto",
        start?: number,
        end?: number,
    ) => {
        initWorker(); // Ensure worker exists
        if (!isModelReady.value) {
            // Logic to auto-download could go here, but for now we error
            error.value = "Model not loaded. Please download the model first.";
            return;
        }

        isTranscribing.value = true;
        transcriptionProgress.value = 0;
        tokensPerSecond.value = 0;
        statusMessage.value = "Preparing audio...";

        result.value = null;
        error.value = null;

        // Start Job
        const filename = (audioBlob as File).name || "Audio File";
        currentJobId.value = addJob({
            type: "transcription",
            title: `Transcribing ${filename}`,
            details: "Preparing...",
            cancel: stop,
        });

        try {
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioContext = new (
                window.AudioContext || (window as any).webkitAudioContext
            )({
                sampleRate: 16000,
            });

            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            audioDetails.value = {
                channels: audioBuffer.numberOfChannels,
                length: audioBuffer.length,
                sampleRate: audioBuffer.sampleRate,
                duration: audioBuffer.duration,
            };

            // Slice audio if start/end provided
            let finalBuffer = audioBuffer;
            if (start !== undefined || end !== undefined) {
                const s = start || 0;
                const e = end || audioBuffer.duration;
                // Update duration for progress calculation to match the SLICE
                audioDetails.value.duration = e - s;

                const startSample = Math.floor(s * audioBuffer.sampleRate);
                const endSample = Math.floor(e * audioBuffer.sampleRate);
                const len = endSample - startSample;

                if (len > 0) {
                    const slicedCtx = new OfflineAudioContext(
                        audioBuffer.numberOfChannels,
                        len,
                        audioBuffer.sampleRate,
                    );
                    const source = slicedCtx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(slicedCtx.destination);
                    source.start(0, s, e - s);
                    finalBuffer = await slicedCtx.startRendering();
                }
            }

            let audioData: Float32Array;

            if (finalBuffer.sampleRate === 16000) {
                audioData = finalBuffer.getChannelData(0);
            } else {
                const offlineContext = new OfflineAudioContext(
                    1,
                    Math.ceil(finalBuffer.duration * 16000),
                    16000,
                );
                const source = offlineContext.createBufferSource();
                source.buffer = finalBuffer;
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

            if (audioContext.state !== "closed") {
                audioContext.close();
            }
        } catch (e: any) {
            error.value = "Audio decoding failed: " + e.message;
            isTranscribing.value = false;
            if (currentJobId.value) {
                updateJob(currentJobId.value, {
                    status: "error",
                    error: error.value || "Unknown error",
                });
                currentJobId.value = null;
            }
        }
    };

    const clearResult = () => {
        result.value = null;
        tokensPerSecond.value = 0;
    };

    const terminate = () => {
        if (worker.value) {
            worker.value.terminate();
            worker.value = null;
            isModelReady.value = false;
        }
    };

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
        stop,
        clearResult,
        transcriptionProgress,
        device,
        model,
        audioDetails,
        terminate,
    };
}
