<script setup lang="ts">
import { Play, SkipBack, SkipForward, ZoomIn, ZoomOut, Scissors } from 'lucide-vue-next';
import { ref } from 'vue';

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
    <div class="h-10 border-b border-gray-800 flex items-center justify-between px-4 bg-gray-900">
      <div class="flex items-center gap-4">
         <div class="flex items-center gap-1">
            <button class="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white" title="Undo">
               <SkipBack :size="16" />
            </button>
             <button class="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white" title="Redo">
               <SkipForward :size="16" />
            </button>
         </div>
         <div class="h-4 w-[1px] bg-gray-700"></div>
         <button class="flex items-center gap-2 text-xs text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-gray-800">
            <Scissors :size="14" />
            <span>Split</span>
         </button>
      </div>

      <!-- Center Player Controls -->
      <div class="flex items-center gap-4">
          <span class="font-mono text-sm text-gemini-primary">{{ currentTime }}</span>
          <button 
            class="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black hover:bg-gray-200 transition-colors"
            @click="isPlaying = !isPlaying"
          >
             <Play :size="14" :fill="isPlaying ? 'black' : 'transparent'" class="ml-0.5" />
          </button>
      </div>

      <!-- Zoom Controls -->
      <div class="flex items-center gap-2">
          <button class="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white"><ZoomOut :size="14"/></button>
          <input type="range" class="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
          <button class="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white"><ZoomIn :size="14"/></button>
      </div>
    </div>

    <!-- Timeline Area -->
    <div class="flex-1 flex min-h-0 overflow-hidden bg-gray-950 relative">
       <!-- Track Headers -->
       <div class="w-32 flex-shrink-0 border-r border-gray-800 bg-gray-900 z-10 flex flex-col pt-8"> <!-- pt-8 for ruler offset -->
          <div v-for="track in tracks" :key="track.id" class="h-24 border-b border-gray-800 flex items-center px-3 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-850 transition-colors">
             {{ track.name }}
          </div>
       </div>

       <!-- Tracks Scroll Area -->
       <div class="flex-1 overflow-auto relative">
          <!-- Ruler -->
          <div class="h-8 sticky top-0 bg-gray-900 border-b border-gray-800 z-10 flex items-end pb-1">
             <div class="w-full h-1/2 flex justify-between px-2 text-[10px] text-gray-500 font-mono relative">
                <span v-for="i in 20" :key="i" class="border-l border-gray-700 h-full pl-1">{{ i * 5 }}s</span>
             </div>
          </div>

          <!-- Playhead Line -->
          <div class="absolute top-0 bottom-0 left-[200px] w-[1px] bg-red-500 z-20 pointer-events-none">
             <div class="w-3 h-3 -ml-1.5 bg-red-500 rotate-45 -mt-1.5"></div>
          </div>

          <!-- Track Content -->
          <div class="relative min-w-[1000px]"> <!-- Force width for scroll -->
             <div v-for="track in tracks" :key="track.id" class="h-24 border-b border-gray-800/50 relative bg-gray-900/30">
                <!-- Dummy Clip -->
                <div 
                   class="absolute top-2 bottom-2 left-[100px] w-[300px] rounded-md border border-opacity-20 overflow-hidden group cursor-pointer"
                   :class="track.color"
                >
                   <div class="w-full h-full opacity-50 group-hover:opacity-80 transition-opacity"></div>
                   <span class="absolute left-2 top-1 text-[10px] font-medium text-white/70 truncate max-w-full p-1">{{ track.name }}_clip_01.mp4</span>
                </div>
             </div>
          </div>
       </div>
    </div>
  </div>
</template>
