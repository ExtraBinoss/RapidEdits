<script setup lang="ts">
import { Sliders, Move } from "lucide-vue-next";
</script>

<template>
    <div
        class="w-72 bg-canvas-light border-l border-canvas-border flex flex-col shrink-0 z-10 overflow-y-auto"
    >
        <div class="p-4 border-b border-canvas-border">
            <h3
                class="text-sm font-semibold text-text-main flex items-center gap-2"
            >
                <Sliders :size="16" class="text-brand-primary" />
                Properties
            </h3>
        </div>

        <!-- Transform Section -->
        <div class="p-4 border-b border-canvas-border space-y-4">
            <div
                class="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wider"
            >
                <Move :size="12" />
                Transform
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1">
                    <label class="text-xs text-text-muted">Scale</label>
                    <div
                        class="flex items-center bg-canvas rounded border border-canvas-border px-2 py-1 hover:border-brand-primary focus-within:border-brand-primary transition-colors"
                    >
                        <span class="text-xs text-text-muted mr-2">X</span>
                        <input
                            type="number"
                            value="100"
                            class="w-full bg-transparent text-sm text-text-main outline-none appearance-none"
                        />
                        <span class="text-xs text-text-muted">%</span>
                    </div>
                </div>
                <div class="space-y-1">
                    <label class="text-xs text-text-muted opacity-0"
                        >Scale</label
                    >
                    <div
                        class="flex items-center bg-canvas rounded border border-canvas-border px-2 py-1"
                    >
                        <span class="text-xs text-text-muted mr-2">Y</span>
                        <input
                            type="number"
                            value="100"
                            class="w-full bg-transparent text-sm text-text-main outline-none appearance-none"
                        />
                        <span class="text-xs text-text-muted">%</span>
                    </div>
                </div>
            </div>

            <div class="space-y-1">
                <label class="text-xs text-text-muted">Position</label>
                <div class="grid grid-cols-2 gap-3">
                    <div
                        class="flex items-center bg-canvas rounded border border-canvas-border px-2 py-1"
                    >
                        <span class="text-xs text-text-muted mr-2">X</span>
                        <input
                            type="number"
                            value="960"
                            class="w-full bg-transparent text-sm text-text-main outline-none appearance-none"
                        />
                    </div>
                    <div
                        class="flex items-center bg-canvas rounded border border-canvas-border px-2 py-1"
                    >
                        <span class="text-xs text-text-muted mr-2">Y</span>
                        <input
                            type="number"
                            value="540"
                            class="w-full bg-transparent text-sm text-text-main outline-none appearance-none"
                        />
                    </div>
                </div>
            </div>

            <div class="space-y-1">
                <label class="text-xs text-text-muted">Rotation</label>
                <div
                    class="flex items-center bg-canvas rounded border border-canvas-border px-2 py-1"
                >
                    <span class="text-xs text-text-muted mr-2">°</span>
                    <input
                        type="number"
                        value="0"
                        class="w-full bg-transparent text-sm text-text-main outline-none appearance-none"
                    />
                </div>
            </div>
        </div>

        <!-- Opacity Section -->
        <div class="p-4 border-b border-canvas-border space-y-4">
            <div class="flex items-center justify-between">
                <label
                    class="text-xs font-semibold text-text-muted uppercase tracking-wider"
                    >Opacity</label
                >
                <span class="text-xs text-text-muted">100%</span>
            </div>
            <input
                type="range"
                min="0"
                max="100"
                value="100"
                class="w-full h-1 bg-canvas-border rounded-lg appearance-none cursor-pointer accent-brand-primary"
            />
        </div>

        <div class="p-4 text-xs text-text-muted text-center mt-auto">
            Select a clip to edit properties
        </div>
    </div>
</template>
