export interface RecordedCursorPoint {
    t: number;      // Temps relatif au début de l'enregistrement (ms)
    x: number;      // Position X absolue sur l'écran
    y: number;      // Position Y absolue sur l'écran
    isClick: boolean;
    type: string;   // 'default', 'handpointing', etc.
}

export interface RecordingResult {
    blob: Blob;
    cursorData: RecordedCursorPoint[];
}
