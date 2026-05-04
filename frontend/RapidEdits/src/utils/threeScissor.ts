import * as THREE from "three";

export interface ScissorBox {
    left: number;
    bottom: number;
    width: number;
    height: number;
}

function clampRectToBounds(target: DOMRect, bounds: DOMRect) {
    const left = Math.max(target.left, bounds.left);
    const right = Math.min(target.right, bounds.right);
    const top = Math.max(target.top, bounds.top);
    const bottom = Math.min(target.bottom, bounds.bottom);

    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);

    return { left, right, top, bottom, width, height };
}

export function computeScissorBoxFromElements(
    targetEl: HTMLElement,
    canvasEl: HTMLCanvasElement
): ScissorBox | null {
    const targetRect = targetEl.getBoundingClientRect();
    const canvasRect = canvasEl.getBoundingClientRect();
    const visible = clampRectToBounds(targetRect, canvasRect);

    if (visible.width <= 0 || visible.height <= 0) return null;

    const leftCss = visible.left - canvasRect.left;
    const topCss = visible.top - canvasRect.top;
    const rightCss = leftCss + visible.width;
    const bottomCssFromTop = topCss + visible.height;

    // Pixel-stable edges to avoid subpixel drift across tiles/scroll.
    const left = Math.floor(leftCss);
    const right = Math.ceil(rightCss);
    const top = Math.floor(topCss);
    const bottomFromTop = Math.ceil(bottomCssFromTop);
    const width = Math.max(0, right - left);
    const height = Math.max(0, bottomFromTop - top);
    if (width <= 0 || height <= 0) return null;

    const bottom = Math.floor(canvasRect.height - bottomFromTop);

    return { left, bottom, width, height };
}

export function applyScissorBox(renderer: THREE.WebGLRenderer, box: ScissorBox): void {
    renderer.setViewport(
        box.left,
        box.bottom,
        box.width,
        box.height
    );
    renderer.setScissor(
        box.left,
        box.bottom,
        box.width,
        box.height
    );
}

