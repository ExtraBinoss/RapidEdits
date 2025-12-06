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
                // Use "Xenova/whisper-base" for better accuracy and multi-language support.
                this.instance = await pipeline(
                    "automatic-speech-recognition",
                    "Xenova/whisper-base",
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
            console.log("Worker: Starting transcription...");
            const transcriber = await WhisperWorker.getInstance(() => {});
            console.log("Worker: Transcriber instance ready.");

            // output: { text: "...", chunks: [...] }
            const result = await transcriber(audio, {
                language: data.language || "en",
                chunk_length_s: 30,
                stride_length_s: 5,
                return_timestamps: true,
                temperature: 0,
                repetition_penalty: 1.2,
                no_repeat_ngram_size: 3,
                condition_on_previous_text: false, // Helps prevent loop propagation
                callback_function: (item: any) => {
                    // console.log("Worker: callback_function item:", item);
                    // item might be an array or object. It often contains Tensors which are not clonable.

                    let bestBeam;
                    if (Array.isArray(item)) {
                        bestBeam = item[0];
                    } else {
                        bestBeam = item;
                    }

                    if (bestBeam && bestBeam.timestamp) {
                        // Only send serializable data
                        const debugData = {
                            text: bestBeam.text,
                            timestamp: bestBeam.timestamp,
                        };

                        self.postMessage({
                            status: "transcribing-debug",
                            data: debugData,
                        });

                        self.postMessage({
                            status: "transcribing-progress",
                            data: {
                                timestamp: bestBeam.timestamp,
                                text: bestBeam.text,
                            },
                        });
                    }
                },
            });

            console.log("Worker: Transcription complete", result);

            // Result might also contain tensors, we should sanitize it or trust the pipeline returns plain objects for the final result
            // Usually pipeline result is plain JS object/array.
            self.postMessage({ status: "complete", result });
        } catch (err: any) {
            console.error("Worker: Transcription error", err);
            self.postMessage({ status: "error", message: err.message });
        } finally {
            WhisperWorker.processing = false;
        }
    }
});
