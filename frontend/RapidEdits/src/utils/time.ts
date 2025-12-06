export const formatTime = (seconds: number) => {
    const date = new Date(seconds * 1000);
    const mm = date.getUTCMinutes().toString().padStart(2, "0");
    const ss = date.getUTCSeconds().toString().padStart(2, "0");
    const ms = Math.floor(date.getUTCMilliseconds() / 10)
        .toString()
        .padStart(2, "0");
    return `${mm}:${ss}:${ms}`;
};

export const formatDuration = (seconds?: number) => {
    if (!seconds) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
};
