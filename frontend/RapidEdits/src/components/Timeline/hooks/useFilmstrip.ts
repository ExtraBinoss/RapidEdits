import { ref, watchEffect, type Ref } from "vue";
import { thumbnailGenerator } from "../../../core/generators/ThumbnailGenerator";

interface Thumbnail {
    id: string;
    url: string;
    time: number;
    loaded: boolean;
}

export function useFilmstrip(
    assetUrl: string,
    assetType: string,
    clipOffset: number,
    duration: number,
    containerWidth: Ref<number>,
    clipHeight: number = 96, // h-24 = 96px
) {
    const thumbnails = ref<Thumbnail[]>([]);
    const isLoading = ref(false);

    watchEffect(async (onCleanup) => {
        if (!assetUrl || containerWidth.value <= 0) return;

        let cancelled = false;
        onCleanup(() => {
            cancelled = true;
        });

        isLoading.value = true;

        // Calculate how many frames fit
        // Aspect ratio 16:9 approx => width = height * 1.77
        const thumbHeight = clipHeight;
        const thumbWidth = thumbHeight * 1.77;

        // Prevent division by zero or negative
        if (thumbWidth <= 0) return;

        const count = Math.ceil(containerWidth.value / thumbWidth);
        const step = duration / count;

        // Initialize placeholders
        const placeholders: Thumbnail[] = new Array(count)
            .fill(null)
            .map((_, i) => ({
                id: `pending-${Math.random()}-${i}`, // Unique temp ID
                url: "",
                time: clipOffset + i * step,
                loaded: false,
            }));

        thumbnails.value = placeholders;

        // If it's an image, just use the asset URL for all frames immediately
        if (assetType === "image") {
            thumbnails.value = placeholders.map((t) => ({
                ...t,
                url: assetUrl,
                loaded: true,
            }));
            isLoading.value = false;
            return;
        }

        try {
            for (let i = 0; i < count; i++) {
                if (cancelled) break;

                const relativeTime = Math.min(i * step, duration);
                const absoluteTime = clipOffset + relativeTime;
                // Avoid seeking to exactly 0 if possible as it can be buggy in some browsers
                // 0.05s is small enough to be "start" but safer than 0.0s for black frame issues
                const safeTime = absoluteTime === 0 ? 0.05 : absoluteTime;

                // Generate one by one to prioritize left-to-right
                const url = await thumbnailGenerator.generate(
                    assetUrl,
                    safeTime,
                    thumbWidth,
                    thumbHeight,
                );

                if (cancelled) break;

                // Update the specific index
                if (thumbnails.value[i]) {
                    thumbnails.value[i] = {
                        id: `${absoluteTime}`,
                        url,
                        time: absoluteTime,
                        loaded: true,
                    };
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            if (!cancelled) isLoading.value = false;
        }
    });

    return {
        thumbnails,
        isLoading,
    };
}
