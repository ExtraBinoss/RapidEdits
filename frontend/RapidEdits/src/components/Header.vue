<script setup lang="ts">
import { Download, Settings } from 'lucide-vue-next';
</script>

<template>
  <header class="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 shrink-0 z-10">
    <!-- Logo Area -->
    <div class="flex items-center gap-2">
      <div class="w-8 h-8 rounded bg-gradient-to-br from-gemini-primary to-gemini-secondary flex items-center justify-center text-white font-bold shadow-lg shadow-gemini-primary/20">
        RE
      </div>
      <span class="text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
        RapidEdits
      </span>
    </div>

    <!-- Center Project Info -->
    <div class="hidden md:flex items-center gap-4 text-sm text-gray-400 bg-gray-850 px-4 py-1.5 rounded-full border border-gray-800">
      <span class="hover:text-white cursor-pointer transition-colors">Untitled Project</span>
      <span class="text-gray-700">|</span>
      <span class="text-xs">1920x1080 • 30fps</span>
    </div>

    <!-- Right Actions -->
    <div class="flex items-center gap-3">
      <button class="p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors" title="Settings">
        <Settings :size="18" />
      </button>
      
      <button class="flex items-center gap-2 bg-gradient-to-r from-gemini-primary to-gemini-secondary hover:brightness-110 text-white px-4 py-1.5 rounded-md text-sm font-semibold shadow-lg shadow-gemini-primary/20 transition-all transform active:scale-95">
        <Download :size="16" />
        <span>Export</span>
      </button>
    </div>
  </header>
</template>
