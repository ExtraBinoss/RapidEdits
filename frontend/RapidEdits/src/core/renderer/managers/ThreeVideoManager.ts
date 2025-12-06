import * as THREE from "three";
import { editorEngine } from "../../EditorEngine";
import type { Clip } from "../../../types/Timeline";

export class ThreeVideoManager {
    private getClipMesh: (clipId: string) => THREE.Object3D | undefined;

    constructor(getClipMesh: (clipId: string) => THREE.Object3D | undefined) {
        this.getClipMesh = getClipMesh;
    }

    public sync(
        visibleClips: Clip[],
        globalTime: number,
        isCaptureMode: boolean,
    ) {
        visibleClips.forEach((clip) => {
            if (clip.type === "video") {
                const mesh = this.getClipMesh(clip.id);
                if (mesh && mesh instanceof THREE.Mesh) {
                    this.syncVideoFrame(clip, mesh, globalTime, isCaptureMode);
                }
            }
        });
    }

    private syncVideoFrame(
        clip: Clip,
        mesh: THREE.Mesh,
        globalTime: number,
        isCaptureMode: boolean,
    ) {
        const material = mesh.material as THREE.MeshBasicMaterial;
        if (!material.map || !(material.map instanceof THREE.VideoTexture))
            return;

        const video = material.map.image as HTMLVideoElement;
        if (!video) return;

        if (!video.muted) video.muted = true;

        const clipTime = globalTime - clip.start + clip.offset;
        const threshold = editorEngine.getIsPlaying() ? 0.5 : 0.15;

        if (isCaptureMode) {
            if (Math.abs(video.currentTime - clipTime) > 0.01) {
                video.currentTime = clipTime;
            }
            if (!video.paused) video.pause();
            return;
        }

        const drift = Math.abs(video.currentTime - clipTime);
        if (drift > threshold) {
            if (!video.seeking) {
                // Drift correction
                video.currentTime = clipTime;
            }
        }

        if (editorEngine.getIsPlaying()) {
            if (video.paused) video.play().catch(() => {});
        } else {
            if (!video.paused) video.pause();
        }
    }

    public getActiveVideoElements(
        clipMeshes: Map<string, THREE.Object3D>,
    ): HTMLVideoElement[] {
        const videos: HTMLVideoElement[] = [];
        clipMeshes.forEach((mesh) => {
            if (mesh instanceof THREE.Mesh) {
                const mat = mesh.material as THREE.MeshBasicMaterial;
                if (mat.map && mat.map instanceof THREE.VideoTexture) {
                    const video = mat.map.image;
                    if (video instanceof HTMLVideoElement) {
                        videos.push(video);
                    }
                }
            }
        });
        return videos;
    }
}
