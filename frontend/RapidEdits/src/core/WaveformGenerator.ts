export class WaveformGenerator {
    private audioContext: AudioContext;
    private cache: Map<string, number[]> = new Map();

    constructor() {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    public async getWaveform(url: string, samples: number = 100): Promise<number[]> {
        const cacheKey = `${url}-${samples}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            const rawData = audioBuffer.getChannelData(0); // Use first channel
            const blockSize = Math.floor(rawData.length / samples);
            const filteredData = [];

            for (let i = 0; i < samples; i++) {
                const start = blockSize * i;
                let sum = 0;
                for (let j = 0; j < blockSize; j++) {
                    sum += Math.abs(rawData[start + j] || 0);
                }
                filteredData.push(sum / blockSize);
            }

            // Normalize
            const multiplier = Math.pow(Math.max(...filteredData), -1);
            const normalized = filteredData.map(n => n * multiplier);

            this.cache.set(cacheKey, normalized);
            return normalized;
        } catch (e) {
            console.error("Waveform generation failed", e);
            return [];
        }
    }
}

export const waveformGenerator = new WaveformGenerator();
