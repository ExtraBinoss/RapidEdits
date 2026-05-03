import { MediaType } from "../../types/Media";
import { editorEngine } from "../EditorEngine";

export const DEFAULT_ASSETS = {
    audio: [
        "Schrandy-Cash-Out-_NCS-Release_.ogg",
        "TWISTED_-STM_-kellapsage_-glossier-ISORIA-_NCS-Release_.ogg",
        "youthé-stuckinmyhead_-_NCS-Release_.ogg",
    ],
    image: [
        "Clione.jpg",
        "gnou.jpg",
        "nodl_logo.jpg",
        "papillon_monarque.jpg",
    ],
    video: [
        "cat_candle.webm",
        "jellyfish.webm",
        "pinguin.webm",
    ],
};

export async function loadDefaultAssets() {
    console.log("[DefaultAssetsLoader] Loading default assets...");
    
    const promises: Promise<any>[] = [];

    // Load Audio
    DEFAULT_ASSETS.audio.forEach((filename) => {
        promises.push(
            editorEngine.assetSystem.addRemoteAsset(
                `/defaultAssets/audio/${filename}`,
                filename,
                MediaType.AUDIO
            )
        );
    });

    // Load Images
    DEFAULT_ASSETS.image.forEach((filename) => {
        promises.push(
            editorEngine.assetSystem.addRemoteAsset(
                `/defaultAssets/image/${filename}`,
                filename,
                MediaType.IMAGE
            )
        );
    });

    // Load Videos
    DEFAULT_ASSETS.video.forEach((filename) => {
        promises.push(
            editorEngine.assetSystem.addRemoteAsset(
                `/defaultAssets/video/${filename}`,
                filename,
                MediaType.VIDEO
            )
        );
    });

    await Promise.all(promises);
    console.log("[DefaultAssetsLoader] ✅ Default assets loaded.");
}
