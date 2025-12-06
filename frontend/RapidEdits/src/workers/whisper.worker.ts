import { pipeline, env } from "@xenova/transformers";

// Skip local model checks for now to avoid FS errors in browser env if not configured
env.allowLocalModels = false;
env.useBrowserCache = true;

class WhisperWorker {
    static instance: any = null;
    static processing = false;

    static async getInstance(progress_callback: Function) {
        if (this.instance === null) {
            try {
                // Use "openai/whisper-tiny" for faster download/inference in browser.
                // "Xenova/whisper-tiny" is the quantized version typically used.
                this.instance = await pipeline(
                    "automatic-speech-recognition",
                    "Xenova/whisper-tiny",
                    {
                        progress_callback,
                    },
                );
            } catch (e) {
                console.error("Failed to load model", e);
                throw e;
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
                message: "Loading model...",
            });
            await WhisperWorker.getInstance((progress: any) => {
                self.postMessage({ status: "progress", progress });
            });
            self.postMessage({ status: "ready", message: "Model loaded" });
        } catch (err: any) {
            self.postMessage({ status: "error", message: err.message });
        }
    } else if (type === "transcribe") {
        const { audio } = data; // Expecting AudioBlob or similar

        if (WhisperWorker.processing) {
            self.postMessage({
                status: "error",
                message: "Already processing",
            });
            return;
        }
        WhisperWorker.processing = true;

        try {
            const transcriber = await WhisperWorker.getInstance(() => {});

            // output: { text: "...", chunks: [...] }
            const result = await transcriber(audio, {
                chunk_length_s: 30,
                stride_length_s: 5,
                return_timestamps: true,
                callback_function: (_item: any) => {
                    // streaming callbacks if supported by the pipeline wrapper in future
                    // self.postMessage({ status: 'partial', result: item });
                },
            });

            self.postMessage({ status: "complete", result });
        } catch (err: any) {
            self.postMessage({ status: "error", message: err.message });
        } finally {
            WhisperWorker.processing = false;
        }
    }
});
