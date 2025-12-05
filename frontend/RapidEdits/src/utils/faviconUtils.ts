export const updateFavicon = async (color: string = "#3b82f6") => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Wait for font to load to ensure it draws correctly
    try {
        await document.fonts.load('900 64px "Gliker"');
    } catch (e) {
        console.warn("Font loading failed for favicon, using fallback", e);
    }

    // Draw background (optional, but requested "logo of our app")
    // Currently the logo in header is text on a gradient.
    // Let's just draw the text "RE" nicely.

    // Clear
    ctx.clearRect(0, 0, 64, 64);

    // Draw Text
    ctx.font = '900 48px "Gliker", sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Center is 32, 32. Slightly offset y might be needed visually.
    ctx.fillText("RE", 32, 36);

    const link =
        (document.querySelector("link[rel*='icon']") as HTMLLinkElement) ||
        document.createElement("link");
    link.type = "image/png";
    link.rel = "icon";
    link.href = canvas.toDataURL("image/png");

    const head = document.getElementsByTagName("head")[0];
    if (head) {
        head.appendChild(link);
    }
};
