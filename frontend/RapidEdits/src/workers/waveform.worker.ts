// waveform.worker.ts

self.onmessage = (e: MessageEvent) => {
    const { channelData, startSampleIndex, endSampleIndex, samples } = e.data;

    if (!channelData || samples <= 0) {
        self.postMessage([]);
        return;
    }

    try {
        const totalSamplesInRange = endSampleIndex - startSampleIndex;
        if (totalSamplesInRange <= 0) {
            self.postMessage(new Array(samples).fill(0));
            return;
        }

        const step = Math.max(1, Math.floor(totalSamplesInRange / samples));
        const result = new Float32Array(samples); // Use TypedArray for performance

        // Optimized Peak Finding Loop
        for (let i = 0; i < samples; i++) {
            const sampleStart = startSampleIndex + i * step;
            let max = 0;
            const scanSize = Math.min(step, 100);

            for (let j = 0; j < scanSize; j++) {
                const idx = sampleStart + j;
                if (idx < channelData.length) {
                    const val = Math.abs(channelData[idx]);
                    if (val > max) max = val;
                }
            }
            result[i] = max;
        }

        self.postMessage(result);
    } catch (err) {
        console.error("Worker processing failed", err);
        self.postMessage([]);
    }
};
