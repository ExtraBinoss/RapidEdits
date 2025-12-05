<script setup lang="ts">
import { Play, SkipBack, SkipForward, ZoomIn, ZoomOut, Scissors, Pause } from 'lucide-vue-next';
import { ref } from 'vue';
import Button from './UI/Button.vue';
import Tooltip from './UI/Tooltip.vue';

const isPlaying = ref(false);
const currentTime = ref("00:00:00");

const tracks = [
  { id: 1, name: 'Video 1', type: 'video', color: 'bg-blue-500/20 border-blue-500/50' },
  { id: 2, name: 'Audio 1', type: 'audio', color: 'bg-green-500/20 border-green-500/50' },
  { id: 3, name: 'Effect', type: 'effect', color: 'bg-purple-500/20 border-purple-500/50' },
];
</script>

<template>
  <div class="flex flex-col h-full select-none">
    <!-- Timeline Toolbar -->
    <div class="h-10 border-b border-canvas-border flex items-center justify-between px-4 bg-canvas-light">
      <div class="flex items-center gap-2">
         <Tooltip text="Undo" position="top">
            <Button variant="icon" size="sm" :icon="SkipBack" />
         </Tooltip>
         <Tooltip text="Redo" position="top">
            <Button variant="icon" size="sm" :icon="SkipForward" />
         </Tooltip>

         <div class="h-4 w-[1px] bg-canvas-border mx-2"></div>
         
         <Button variant="ghost" size="sm" :icon="Scissors">Split</Button>
      </div>

      <!-- Center Player Controls -->
      <div class="flex items-center gap-4">
          <span class="font-mono text-sm text-brand-accent">{{ currentTime }}</span>
          <Button 
            variant="secondary"
            size="icon"
            class="rounded-full w-8 h-8 !p-0 flex items-center justify-center"
            @click="isPlaying = !isPlaying"
          >
             <component :is="isPlaying ? Pause : Play" :size="14" :fill="isPlaying ? 'currentColor' : 'currentColor'" />
          </Button>
      </div>

      <!-- Zoom Controls -->
      <div class="flex items-center gap-2">
          <Button variant="icon" size="sm" :icon="ZoomOut" />
          <input type="range" class="w-20 h-1 bg-canvas-border rounded-lg appearance-none cursor-pointer accent-brand-primary" />
          <Button variant="icon" size="sm" :icon="ZoomIn" />
      </div>
    </div>

    <!-- Timeline Area -->
    <div class="flex-1 flex min-h-0 overflow-hidden bg-canvas relative">
       <!-- Track Headers -->
       <div class="w-32 flex-shrink-0 border-r border-canvas-border bg-canvas-light z-10 flex flex-col pt-8"> 
          <div v-for="track in tracks" :key="track.id" class="h-24 border-b border-canvas-border flex items-center px-3 text-xs text-text-muted hover:text-text-main hover:bg-canvas-lighter transition-colors">
             {{ track.name }}
          </div>
       </div>

       <!-- Tracks Scroll Area -->
       <div class="flex-1 overflow-auto relative">
          <!-- Ruler -->
          <div class="h-8 sticky top-0 bg-canvas-light border-b border-canvas-border z-10 flex items-end pb-1">
             <div class="w-full h-1/2 flex justify-between px-2 text-[10px] text-text-muted font-mono relative">
                <span v-for="i in 20" :key="i" class="border-l border-canvas-border h-full pl-1">{{ i * 5 }}s</span>
             </div>
          </div>

          <!-- Playhead Line -->
          <div class="absolute top-0 bottom-0 left-[200px] w-[1px] bg-red-500 z-20 pointer-events-none">
             <div class="w-3 h-3 -ml-1.5 bg-red-500 rotate-45 -mt-1.5"></div>
          </div>

          <!-- Track Content -->
          <div class="relative min-w-[1000px]">
             <div v-for="track in tracks" :key="track.id" class="h-24 border-b border-canvas-border/50 relative bg-canvas/30">
                <!-- Dummy Clip -->
                <div 
                   class="absolute top-2 bottom-2 left-[100px] w-[300px] rounded-md border border-opacity-20 overflow-hidden group cursor-pointer"
                   :class="track.color"
                >
                   <div class="w-full h-full opacity-50 group-hover:opacity-80 transition-opacity"></div>
                   <span class="absolute left-2 top-1 text-[10px] font-medium text-white/90 truncate max-w-full p-1 shadow-sm">{{ track.name }}_clip_01.mp4</span>
                </div>
             </div>
          </div>
       </div>
    </div>
  </div>
</template>