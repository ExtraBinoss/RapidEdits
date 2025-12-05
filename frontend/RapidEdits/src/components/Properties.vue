<script setup lang="ts">
import { Sliders, Move } from "lucide-vue-next";
</script>

<template>
  <div
    class="w-72 bg-gray-900 border-l border-gray-800 flex flex-col shrink-0 z-10 overflow-y-auto"
  >
    <div class="p-4 border-b border-gray-800">
      <h3 class="text-sm font-semibold text-white flex items-center gap-2">
        <Sliders :size="16" class="text-gemini-primary" />
        Properties
      </h3>
    </div>

    <!-- Transform Section -->
    <div class="p-4 border-b border-gray-800 space-y-4">
      <div
        class="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider"
      >
        <Move :size="12" />
        Transform
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1">
          <label class="text-xs text-gray-500">Scale</label>
          <div
            class="flex items-center bg-gray-950 rounded border border-gray-700 px-2 py-1 hover:border-gemini-primary focus-within:border-gemini-primary transition-colors"
          >
            <span class="text-xs text-gray-500 mr-2">X</span>
            <input
              type="number"
              value="100"
              class="w-full bg-transparent text-sm text-white outline-none appearance-none"
            />
            <span class="text-xs text-gray-600">%</span>
          </div>
        </div>
        <div class="space-y-1">
          <label class="text-xs text-gray-500 opacity-0">Scale</label>
          <div
            class="flex items-center bg-gray-950 rounded border border-gray-700 px-2 py-1"
          >
            <span class="text-xs text-gray-500 mr-2">Y</span>
            <input
              type="number"
              value="100"
              class="w-full bg-transparent text-sm text-white outline-none appearance-none"
            />
            <span class="text-xs text-gray-600">%</span>
          </div>
        </div>
      </div>

      <div class="space-y-1">
        <label class="text-xs text-gray-500">Position</label>
        <div class="grid grid-cols-2 gap-3">
          <div
            class="flex items-center bg-gray-950 rounded border border-gray-700 px-2 py-1"
          >
            <span class="text-xs text-gray-500 mr-2">X</span>
            <input
              type="number"
              value="960"
              class="w-full bg-transparent text-sm text-white outline-none appearance-none"
            />
          </div>
          <div
            class="flex items-center bg-gray-950 rounded border border-gray-700 px-2 py-1"
          >
            <span class="text-xs text-gray-500 mr-2">Y</span>
            <input
              type="number"
              value="540"
              class="w-full bg-transparent text-sm text-white outline-none appearance-none"
            />
          </div>
        </div>
      </div>

      <div class="space-y-1">
        <label class="text-xs text-gray-500">Rotation</label>
        <div
          class="flex items-center bg-gray-950 rounded border border-gray-700 px-2 py-1"
        >
          <span class="text-xs text-gray-500 mr-2">°</span>
          <input
            type="number"
            value="0"
            class="w-full bg-transparent text-sm text-white outline-none appearance-none"
          />
        </div>
      </div>
    </div>

    <!-- Opacity Section -->
    <div class="p-4 border-b border-gray-800 space-y-4">
      <div class="flex items-center justify-between">
        <label
          class="text-xs font-semibold text-gray-400 uppercase tracking-wider"
          >Opacity</label
        >
        <span class="text-xs text-gray-300">100%</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value="100"
        class="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-gemini-primary"
      />
    </div>

    <div class="p-4 text-xs text-gray-600 text-center mt-auto">
      Select a clip to edit properties
    </div>
  </div>
</template>
