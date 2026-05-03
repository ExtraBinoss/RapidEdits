import { editorEngine } from "../EditorEngine";
import { ThreeRenderer } from "../renderer/ThreeRenderer";
import { ResourceManager } from "../ResourceManager";
import { TextureAllocator } from "../renderer/textures/TextureAllocator";
import {
    Output,
    BufferTarget,
    Mp4OutputFormat,
    WebMOutputFormat,
    CanvasSource,
    AudioBufferSource,
} from "mediabunny";

export interface ExportConfig {
    width: number;
    height: number;
    fps: number;
    bitrate: number;
    format: "mp4" | "webm";
}

export class ExportService {
    private abortController: AbortController | null = null;

    async exportVideo(
        config: ExportConfig,
        onProgress: (progress: number, status: string, stats?: any) => void,
    ) {
        this.abortController = new AbortController();

        // 1. Setup Isolated Environment
        const exportResourceManager = new ResourceManager();
        const exportAllocator = new TextureAllocator(exportResourceManager);
        const exportCanvas = document.createElement("canvas");

        // Create Offscreen Renderer
        const renderer = new ThreeRenderer({
            canvas: exportCanvas,
            width: config.width,
            height: config.height,
            allocator: exportAllocator,
            isCaptureMode: true,
            pixelRatio: 1, // CRITICAL: Ensure we don't render at 2x/3x on retina screens
        });

        await renderer.init();

        try {
            // 2. Setup Mediabunny Output
            const target = new BufferTarget();
            const format =
                config.format === "mp4"
                    ? new Mp4OutputFormat()
                    : new WebMOutputFormat();

            const duration = this.getProjectDuration();
            if (duration <= 0) throw new Error("Timeline is empty");
            const tracks = editorEngine.getTracks();
            const totalFrames = Math.ceil(duration * config.fps);
            const frameDuration = 1 / config.fps;

            const output = new Output({
                target,
                format,
            });

            // Configure Video Source
            // Use 'avc' (H.264) for MP4 and 'vp9' for WebM
            const codec = config.format === "mp4" ? "avc" : "vp9";

            const videoSource = new CanvasSource(exportCanvas, {
                codec,
                bitrate: config.bitrate,
                // Some browsers/encoders benefit from these hints
                latencyMode: "quality", // We want quality for export
                hardwareAcceleration: "prefer-hardware",
            });

            // Add video track with specified FPS metadata
            output.addVideoTrack(videoSource, { frameRate: config.fps });

            // 2.5 Setup Audio Track
            onProgress(0, "Mixing Audio...");
            let audioSource: AudioBufferSource | null = null;
            let audioBuffer: AudioBuffer | null = null;
            
            try {
                audioBuffer = await this.mixAudio(duration, tracks);
                if (audioBuffer) {
                    const audioCodec = config.format === "mp4" ? "aac" : "opus";
                    audioSource = new AudioBufferSource({
                        codec: audioCodec,
                        bitrate: 128000,
                    });
                    output.addAudioTrack(audioSource);
                }
            } catch (err) {
                console.warn("Audio mixing failed, exporting without sound:", err);
            }

            await output.start();

            // 3. Rendering Loop
            onProgress(0, "Starting Rendering...");

            let lastYieldTime = performance.now();

            const stats = {
                prepare: 0,
                wait: 0,
                render: 0,
                encode: 0,
                total: 0,
                frameCount: 0
            };

            for (let i = 0; i < totalFrames; i++) {
                if (this.abortController.signal.aborted) {
                    throw new Error("Export Cancelled");
                }

                const frameStart = performance.now();
                const time = i * frameDuration;
                const renderTime = time + frameDuration * 0.5;

                // 1. Prepare Frame (Update positions, trigger seeks)
                const t1 = performance.now();
                const visibleClips = renderer.prepareFrame(renderTime, tracks);
                stats.prepare += performance.now() - t1;

                // 2. Wait for all resources in parallel
                const t2 = performance.now();
                await Promise.all([
                    renderer.waitForPendingLoads(),
                    this.waitForSeek(renderer)
                ]);
                stats.wait += performance.now() - t2;
                
                if (this.abortController.signal.aborted) throw new Error("Export Cancelled");

                // 3. Final Render (Actual GPU draw)
                const t3 = performance.now();
                renderer.renderOnly(visibleClips);
                stats.render += performance.now() - t3;

                // 4. Capture & Encode
                const t4 = performance.now();
                await videoSource.add(time, frameDuration);
                stats.encode += performance.now() - t4;

                stats.total += performance.now() - frameStart;
                stats.frameCount++;

                // Log every 30 frames
                if (i % 30 === 0 && i > 0) {
                    const avg = (ms: number) => (ms / stats.frameCount).toFixed(2);
                    console.log(`[Export] Frame ${i}/${totalFrames} | Avg: Prepare ${avg(stats.prepare)}ms, Wait ${avg(stats.wait)}ms, Render ${avg(stats.render)}ms, Encode ${avg(stats.encode)}ms`);
                }

                // 5. Yield occasionally to keep UI responsive
                const now = performance.now();
                if (now - lastYieldTime > 100) {
                    // Small breathing room for the decoder every 10 frames or so
                    const waitTime = i % 10 === 0 ? 10 : 0;
                    await new Promise((r) => setTimeout(r, waitTime));
                    lastYieldTime = now;
                }

                // Live stats for UI
                const avgWait = stats.wait / stats.frameCount;
                const avgRender = stats.render / stats.frameCount;
                const avgEncode = stats.encode / stats.frameCount;
                const currentFps = 1000 / (stats.total / stats.frameCount);

                onProgress(
                    Math.round((i / totalFrames) * 100),
                    `Rendering Frame ${i}/${totalFrames} (${currentFps.toFixed(1)} FPS)`,
                    {
                        wait: avgWait.toFixed(1) + "ms",
                        render: avgRender.toFixed(1) + "ms",
                        encode: avgEncode.toFixed(1) + "ms",
                        hardware: config.format === "mp4" ? "Prefer Hardware (AVC)" : "Prefer Hardware (VP9)",
                        codec: codec
                    }
                );
            }

            console.log(`[Export] Finished! Final Averages:`, {
                prepare: (stats.prepare / totalFrames).toFixed(2) + "ms",
                wait: (stats.wait / totalFrames).toFixed(2) + "ms",
                render: (stats.render / totalFrames).toFixed(2) + "ms",
                encode: (stats.encode / totalFrames).toFixed(2) + "ms",
                fps: (1000 / (stats.total / totalFrames)).toFixed(2)
            });

            // 4. Finalize
            onProgress(100, "Finalizing Encoding...");
            
            if (audioSource && audioBuffer) {
                await audioSource.add(audioBuffer);
            }

            await output.finalize();

            const mimeType =
                config.format === "mp4" ? "video/mp4" : "video/webm";
            if (!target.buffer) {
                throw new Error("Export failed: No output buffer generated");
            }
            const blob = new Blob([target.buffer], { type: mimeType });
            const filename = `rapid_edits_export_${Date.now()}.${config.format}`;
            this.downloadBlob(blob, filename);
            return filename;
        } catch (e: any) {
            console.error("Export Failed", e);
            throw e;
        } finally {
            // Cleanup
            renderer.destroy();
            exportResourceManager.cleanup();
        }
    }

    cancel() {
        this.abortController?.abort();
    }

    private downloadBlob(blob: Blob, filename: string) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    private getProjectDuration(): number {
        const tracks = editorEngine.getTracks();
        let maxTime = 0;
        tracks.forEach((track) => {
            track.clips.forEach((clip) => {
                const end = clip.start + clip.duration;
                if (end > maxTime) maxTime = end;
            });
        });
        return maxTime || 5;
    }

    private async mixAudio(duration: number, tracks: any[]): Promise<AudioBuffer | null> {
        const sampleRate = 44100;
        const numberOfChannels = 2;
        const offlineCtx = new OfflineAudioContext(
            numberOfChannels,
            Math.ceil(duration * sampleRate),
            sampleRate
        );

        let hasAudio = false;

        for (const track of tracks) {
            if (track.isMuted) continue;

            for (const clip of track.clips) {
                if (clip.type === "audio" || clip.type === "video") {
                    const asset = editorEngine.getAsset(clip.assetId);
                    if (!asset) continue;

                    try {
                        const response = await fetch(asset.url);
                        const arrayBuffer = await response.arrayBuffer();
                        const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);

                        const source = offlineCtx.createBufferSource();
                        source.buffer = audioBuffer;

                        const gain = offlineCtx.createGain();
                        gain.gain.value = clip.data?.volume ?? 1.0;

                        source.connect(gain);
                        gain.connect(offlineCtx.destination);

                        // Calculate timing
                        // clip.offset is where in the source file we start
                        // clip.start is where on the timeline we start
                        // clip.duration is how long the clip is on the timeline
                        
                        // We need to play the segment [offset, offset + duration]
                        // at time [start]
                        const startTime = clip.start;
                        const offset = clip.offset || 0;
                        const clipDuration = clip.duration;

                        source.start(startTime, offset, clipDuration);
                        hasAudio = true;
                    } catch (err) {
                        console.error(`Failed to mix audio for clip ${clip.id}:`, err);
                    }
                }
            }
        }

        if (!hasAudio) return null;

        return await offlineCtx.startRendering();
    }

    private async waitForSeek(renderer: ThreeRenderer): Promise<void> {
        const videos = renderer.getActiveVideoElements();
        if (videos.length === 0) return;

        const promises = videos.map((v) => {
            const video = v as HTMLVideoElement;
            
            // If already at target or not seeking, don't wait
            if (!video.seeking && video.readyState >= 2) {
                return Promise.resolve();
            }

            return new Promise<void>((resolve) => {
                let resolved = false;

                const onSeeked = () => {
                    if (!resolved) {
                        resolved = true;
                        video.removeEventListener("seeked", onSeeked);
                        resolve();
                    }
                };

                // Safety timeout to avoid getting stuck
                setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        video.removeEventListener("seeked", onSeeked);
                        resolve();
                    }
                }, 250); 

                video.addEventListener("seeked", onSeeked, { once: true });
            });
        });

        await Promise.all(promises);
    }
}

export const exportService = new ExportService();
