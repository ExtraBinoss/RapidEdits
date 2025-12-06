export class ExportBackend {
    private apiUrl: string;

    constructor(apiUrl: string = "http://localhost:4001") {
        this.apiUrl = apiUrl;
    }

    public async initSession(config: {
        width: number;
        height: number;
        fps: number;
        format: string;
    }): Promise<string> {
        const res = await fetch(`${this.apiUrl}/render/init`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(config),
        });
        if (!res.ok) throw new Error("Failed to init session");
        const data = await res.json();
        return data.sessionId;
    }

    public async appendChunk(
        sessionId: string,
        chunk: Uint8Array,
    ): Promise<void> {
        const res = await fetch(`${this.apiUrl}/render/append/${sessionId}`, {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: new Blob([chunk as any]),
        });
        if (!res.ok) throw new Error("Failed to append chunk");
    }

    public async finishSession(sessionId: string): Promise<void> {
        const res = await fetch(`${this.apiUrl}/render/finish/${sessionId}`, {
            method: "POST",
        });
        if (!res.ok) throw new Error("Failed to finish session");
    }

    public async getStatus(sessionId: string): Promise<{
        status: "uploading" | "processing" | "done" | "error";
        progress: number;
        error?: string;
    }> {
        const res = await fetch(`${this.apiUrl}/render/status/${sessionId}`);
        if (!res.ok) throw new Error("Failed to get status");
        return await res.json();
    }

    public getDownloadUrl(sessionId: string): string {
        return `${this.apiUrl}/render/download/${sessionId}`;
    }
}
