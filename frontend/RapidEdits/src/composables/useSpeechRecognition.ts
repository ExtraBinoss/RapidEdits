import { ref, onUnmounted } from "vue";

export interface SpeechResult {
    transcript: string;
    confidence: number;
    isFinal: boolean;
    timestamp: number; // Relative start time in seconds
    endTimestamp?: number; // Relative end time in seconds
}

export interface UseSpeechRecognitionOptions {
    lang?: string;
    continuous?: boolean;
    interimResults?: boolean;
}

export function useSpeechRecognition(
    options: UseSpeechRecognitionOptions = {},
) {
    const isListening = ref(false);
    const error = ref<string | null>(null);
    const results = ref<SpeechResult[]>([]);
    const interimResult = ref<string>("");
    const detectedLanguage = ref<string>(options.lang || "en-US");

    let recognition: any = null;
    let startTime = 0;

    const initialize = () => {
        if (
            !("webkitSpeechRecognition" in window) &&
            !("SpeechRecognition" in window)
        ) {
            error.value =
                "Speech recognition is not supported in this browser.";
            return false;
        }

        const SpeechRecognition =
            (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = detectedLanguage.value;
        recognition.continuous = options.continuous ?? true;
        recognition.interimResults = options.interimResults ?? true;

        recognition.onstart = () => {
            isListening.value = true;
            error.value = null;
            startTime = Date.now();
        };

        recognition.onerror = (event: any) => {
            if (event.error === "no-speech") {
                // Ignore no-speech errors usually, or handle gracefully
                return;
            }
            error.value = event.error;
            isListening.value = false;
        };

        recognition.onend = () => {
            isListening.value = false;
        };

        recognition.onresult = (event: any) => {
            let finalTranscript = "";
            let currentInterim = "";

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const result = event.results[i];
                const transcript = result[0].transcript;

                if (result.isFinal) {
                    finalTranscript += transcript;
                    // Approximate timing since Web Speech API doesn't give word-level timestamps easily
                    // We mark the "end" of this phrase as "now".
                    // For more precision, we'd need to use the token timestamps if available (often not in standard API)
                    const endTime = (Date.now() - startTime) / 1000;
                    // The start time of this specific segment is harder to know exactly without the API providing it,
                    // but we can estimate it based on the previous end time or just use the current time minus duration.
                    // A simple approximation:
                    const durationEstimate = transcript.length * 0.05; // Rough estimate

                    results.value.push({
                        transcript: transcript.trim(),
                        confidence: result[0].confidence,
                        isFinal: true,
                        timestamp: Math.max(0, endTime - durationEstimate),
                        endTimestamp: endTime,
                    });
                } else {
                    currentInterim += transcript;
                }
            }

            interimResult.value = currentInterim;
        };

        return true;
    };

    const start = () => {
        if (!recognition) {
            if (!initialize()) return;
        }
        if (isListening.value) return;

        // Update lang if changed
        if (recognition && recognition.lang !== detectedLanguage.value) {
            recognition.lang = detectedLanguage.value;
        }

        try {
            recognition.start();
        } catch (e) {
            // Sometimes it throws if already started
            console.error(e);
        }
    };

    const stop = () => {
        if (!recognition) return;
        recognition.stop();
        isListening.value = false;
    };

    const clearResults = () => {
        results.value = [];
        interimResult.value = "";
    };

    const setLanguage = (lang: string) => {
        detectedLanguage.value = lang;
        if (recognition) {
            recognition.lang = lang;
        }
    };

    onUnmounted(() => {
        if (recognition) {
            recognition.stop();
        }
    });

    return {
        isListening,
        error,
        results,
        interimResult,
        detectedLanguage,
        start,
        stop,
        clearResults,
        setLanguage,
    };
}
