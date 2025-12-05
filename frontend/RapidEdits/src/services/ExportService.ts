/**
 * Service to handle video exporting.
 * Currently uses the MediaRecorder API for client-side recording.
 * For more advanced encoding (like precise frame rendering), we would use ffmpeg.wasm.
 */
export class ExportService {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  /**
   * Starts recording the provided canvas.
   * @param canvas The canvas element to record (e.g., PixiJS view)
   */
  startRecording(canvas: HTMLCanvasElement) {
    const stream = canvas.captureStream(30); // Record at 30 FPS
    // Prefer VP9 or H.264 if available
    const mimeTypes = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8", 
        "video/mp4" // Not supported in all browsers via MediaRecorder
    ];
    
    let selectedType = "";
    for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
            selectedType = type;
            break;
        }
    }

    if (!selectedType) {
        console.error("No supported video mime type found.");
        return;
    }

    this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedType,
        videoBitsPerSecond: 5000000 // 5 Mbps
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.start();
    console.log(`Recording started with ${selectedType}`);
  }

  /**
   * Stops recording and triggers a download of the video file.
   */
  async stopRecording(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) return resolve();

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, {
          type: this.mediaRecorder?.mimeType || "video/webm"
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = `rapid-edit-${Date.now()}.webm`; // Default to webm
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);

        this.recordedChunks = [];
        this.mediaRecorder = null;
        resolve();
      };

      this.mediaRecorder.stop();
      console.log("Recording stopped");
    });
  }
}

export const exportService = new ExportService();
