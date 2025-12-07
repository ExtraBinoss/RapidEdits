import { pipeline, TextStreamer } from "@huggingface/transformers";

// Skip local model checks for now to avoid FS errors in browser env if not configured
// env.allowLocalModels = false;
// env.useBrowserCache = true;

class WhisperWorker {
    static instance: any = null;
    static processing = false;

    static async getInstance(progress_callback: (progress: any) => void) {
        if (this.instance === null) {
            try {
                this.instance = await pipeline(
                    "automatic-speech-recognition",
                    "onnx-community/moonshine-base-ONNX",
                    {
                        device: "webgpu", // Prefer WebGPU
                        progress_callback,
                    },
                );
            } catch (e) {
                console.error(
                    "Failed to load model on WebGPU, falling back to CPU",
                    e,
                );
                // Fallback attempt without device assumption (defaults to wasm/cpu usually)
                try {
                    this.instance = await pipeline(
                        "automatic-speech-recognition",
                        "onnx-community/moonshine-base-ONNX",
                        {
                            progress_callback,
                        },
                    );
                } catch (e2) {
                    console.error("Failed to load model on CPU fallback", e2);
                    throw e2;
                }
            }
        }
        return this.instance;
    }
}

self.addEventListener("message", async (event) => {
    const { type, data } = event.data;

    if (type === "load") {
        try {
            self.postMessage({
                status: "loading",
                message: "Loading Moonshine model (WebGPU)...",
            });
            await WhisperWorker.getInstance((progress: any) => {
                self.postMessage({ status: "progress", progress });
            });
            self.postMessage({ status: "ready", message: "Model loaded" });
        } catch (err: any) {
            self.postMessage({ status: "error", message: err.message });
        }
    } else if (type === "transcribe") {
        const { audio } = data;

        if (WhisperWorker.processing) {
            self.postMessage({
                status: "error",
                message: "Already processing",
            });
            return;
        }
        WhisperWorker.processing = true;

        try {
            console.log("Worker: Starting transcription...");
            const transcriber = await WhisperWorker.getInstance(() => {});

            let startTime = performance.now();
            let tokenCount = 0;
            let currentText = "";

            // Custom streamer to capture partial results
            const streamer = new TextStreamer(transcriber.tokenizer, {
                skip_prompt: true,
                skip_special_tokens: true,
                callback_function: (text: string) => {
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

            const result = await transcriber(audio, {
                streamer,
            });

            console.log("Worker: Transcription complete", result);
            self.postMessage({ status: "complete", result });
        } catch (err: any) {
            console.error("Worker: Transcription error", err);
            self.postMessage({ status: "error", message: err.message });
        } finally {
            WhisperWorker.processing = false;
        }
    }
});
