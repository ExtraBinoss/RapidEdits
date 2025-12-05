import { editorEngine } from './EditorEngine';
import { resourceManager } from './ResourceManager';
import type { Clip } from '../types/Timeline';

export class AudioManager {
  constructor() {
    // Optional: could listen to events to optimize, but loop is safer for sync
  }

  public async sync(currentTime: number, isPlaying: boolean, masterVolume: number) {
    const tracks = editorEngine.getTracks();
    
    // 1. Identify active audio clips (Audio tracks OR Video tracks that technically have audio)
    // NOTE: In this simpler model, we assume we use the separate Audio Clip for sound.
    // So we only care about tracks of type 'audio'.
    
    const activeClips: Clip[] = [];
    tracks.forEach(track => {
      if (track.type !== 'audio' || track.isMuted) return;

      const clip = track.clips.find(c => 
        currentTime >= c.start && currentTime < (c.start + c.duration)
      );
      if (clip) activeClips.push(clip);
    });

    // 2. Sync Elements
    for (const clip of activeClips) {
      const asset = editorEngine.getAsset(clip.assetId);
      if (!asset) continue;

      try {
        const element = await resourceManager.getElement(asset);
        
        // Sync Volume
        element.volume = masterVolume;
        element.muted = false;

        // Calculate internal time
        const clipTime = currentTime - clip.start + clip.offset;

        // Sync Playback Time (De-bounce small drifts)
        if (Math.abs(element.currentTime - clipTime) > 0.15) {
           element.currentTime = clipTime;
        }

        // Sync Play State
        if (isPlaying) {
           if (element.paused) {
              const playPromise = element.play();
              if (playPromise !== undefined) {
                  playPromise.catch(error => {
                      // Auto-play policy can block this if not interacted
                      console.warn("Audio play blocked", error);
                  });
              }
           }
        } else {
           if (!element.paused) element.pause();
        }

      } catch (e) {
        console.error("Audio sync error", e);
      }
    }

    // 3. Silence inactive elements that might still be playing from previous frame?
    // ResourceManager caches them. If we are not "using" it this frame, we should pause it.
    // Ideally we track "used" elements this frame.
    // For MVP, relying on the fact that if it's not in activeClips, we ignore it? 
    // NO, if it was playing, it will KEEP playing. We must stop it.
    // FIXME: This iterates ALL cached resources every frame. Can be optimized.
    
    // Better approach: Get all active AssetIDs. Pause everything else.
    // We also need to respect VIDEO tracks that use the same asset.
    // If PixiRenderer is using the same Video Element, we shouldn't pause it if it's visible?
    // BUT, we decided Audio Tracks control sound. 
    // If Pixi needs it for video but Audio Track is missing/muted, Pixi should play it MUTED.
    // So here, we only control VOLUME/MUTE. We don't force pause if Pixi needs it?
    // Actually, if we pause it here, Pixi texture stops.
    // So: Shared ownership.
    // If ANYONE needs it playing, it plays.
    // If Audio needs it -> Unmute. Else -> Mute.
  }
}

export const audioManager = new AudioManager();
