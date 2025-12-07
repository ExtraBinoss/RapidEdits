import { pipeline, TextStreamer, env } from "@huggingface/transformers";

// Skip local model checks for now to avoid FS errors in browser env if not configured
// env.allowLocalModels = false;
// env.useBrowserCache = true;

class WhisperWorker {
    static instance: any = null;
    static processing = false;
    static stopping = false;
    static currentDevice: "webgpu" | "cpu" | null = null;
    static currentModel: string | null = null;

    static async getInstance(
        progress_callback: (progress: any) => void,
        device: "webgpu" | "cpu" = "webgpu",
        modelId: string = "onnx-community/whisper-base",
    ) {
        // If device changed or no instance or model changed, create new one
        if (
            this.instance === null ||
            this.currentDevice !== device ||
            this.currentModel !== modelId
        ) {
            if (this.instance) {
                await this.resetInstance();
            }

            try {
                // If WebGPU requested, check support
                if (device === "webgpu") {
                    if (!(navigator as any).gpu) {
                        throw new Error("WebGPU not available");
                    }
                }

                this.instance = await pipeline(
                    "automatic-speech-recognition",
                    modelId,
                    {
                        device: device === "webgpu" ? "webgpu" : "wasm",
                        progress_callback,
                    },
                );
                this.currentDevice = device;
                this.currentModel = modelId;
                console.log(
                    `WhisperWorker: Loaded model ${modelId} with ${device}`,
                );
            } catch (e) {
                console.error(`Failed to load model on ${device}`, e);
                // If WebGPU failed, try fallback if it was the requested one?
                // For explicit selection, maybe we should just error out?
                // But for robustness, if they selected WebGPU and it crashes, maybe fallback?
                // Let's implement fallback only if it was WebGPU
                if (device === "webgpu") {
                    console.warn("Falling back to CPU...");
                    return this.getInstance(progress_callback, "cpu", modelId);
                }
                throw e;
            }
        }
        return this.instance;
    }

    static async resetInstance() {
        if (this.instance && typeof this.instance.dispose === "function") {
            try {
                await this.instance.dispose();
            } catch (e) {
                console.warn("Retrying instance disposal failed", e);
            }
        }
        this.instance = null;
        this.currentDevice = null;
        this.currentModel = null;
    }
}

self.addEventListener("message", async (event) => {
    const { type, data } = event.data;

    if (type === "stop") {
        WhisperWorker.stopping = true;
        return;
    }

    if (type === "load") {
        const { device, model } = data || {};
        try {
            self.postMessage({
                status: "loading",
                message: `Loading ${model || "Whisper Base"} model (${device || "webgpu"})...`,
            });
            await WhisperWorker.getInstance(
                (progress: any) => {
                    self.postMessage({ status: "progress", progress });
                },
                device || "webgpu",
                model || "onnx-community/whisper-base",
            );
            self.postMessage({ status: "ready", message: "Model loaded" });
        } catch (err: any) {
            self.postMessage({ status: "error", message: err.message });
        }
    } else if (type === "transcribe") {
        const { audio, device, model, language } = data;

        if (WhisperWorker.processing) {
            self.postMessage({
                status: "error",
                message: "Already processing",
            });
            return;
        }
        WhisperWorker.processing = true;
        WhisperWorker.stopping = false;

        try {
            console.log(
                `Worker: Starting transcription on ${device}... Audio length: ${audio.length} samples. Language: ${language || "auto"}`,
            );
            const loadStart = performance.now();
            const transcriber = await WhisperWorker.getInstance(
                () => {},
                device || "webgpu",
                model || "onnx-community/whisper-base",
            );
            const loadEnd = performance.now();
            console.log(
                `Worker: Model loaded/retrieved in ${(loadEnd - loadStart).toFixed(2)}ms`,
            );

            let startTime = performance.now();
            let tokenCount = 0;
            let currentText = "";

            // Custom streamer to capture partial results
            const streamer = new TextStreamer(transcriber.tokenizer, {
                skip_prompt: true,
                skip_special_tokens: true,
                callback_function: (text: string) => {
                    if (WhisperWorker.stopping) {
                        throw new Error("Aborted");
                    }
                    tokenCount++;
                    currentText += text;
                    const elapsed = (performance.now() - startTime) / 1000;
                    const tps = elapsed > 0 ? tokenCount / elapsed : 0;

                    self.postMessage({
                        status: "transcribing-progress",
                        data: {
                            text: currentText,
                            tps: tps.toFixed(2),
                        },
                    });
                },
            });

            console.log("Worker: invoking transcriber()...");

            // Generate config
            const generate_kwargs: any = {
                streamer,
                chunk_length_s: 30, // Standard Whisper chunk size
                stride_length_s: 5, // Overlap
                return_timestamps: "word",
            };

            // Set language if provided
            if (language && language !== "auto") {
                generate_kwargs.language = language;
                generate_kwargs.task = "transcribe";
            }

            const result = await transcriber(audio, generate_kwargs);

            const totalElapsed = (performance.now() - startTime) / 1000;
            console.log(
                `Worker: Transcription complete in ${totalElapsed.toFixed(2)}s.`,
                result,
            );
            self.postMessage({ status: "complete", result });
        } catch (err: any) {
            if (err.message === "Aborted") {
                console.log("Worker: Transcription aborted.");
                self.postMessage({ status: "stopped", message: "Transcription stopped by user." });
            } else {
                console.error("Worker: Transcription error", err);

                // Auto fallback if we were on WebGPU and it crashed during exec
                if (device === "webgpu" || !device) {
                    self.postMessage({
                        status: "error",
                        message:
                            "WebGPU Error: " +
                            err.message +
                            ". Try switching to CPU.",
                    });
                } else {
                    self.postMessage({ status: "error", message: err.message });
                }
            }
        } finally {
            WhisperWorker.processing = false;
            WhisperWorker.stopping = false;
        }
    }
});
