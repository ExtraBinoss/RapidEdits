<script setup lang="ts">
import { Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut, Scissors } from 'lucide-vue-next';
import { useProjectStore } from '../stores/projectStore';
import { useDragDrop } from '../composables/useDragDrop';
import Button from './UI/Button.vue';
import { ref } from 'vue';
import { storeToRefs } from 'pinia';

const store = useProjectStore();
const { tracks, currentTime, isPlaying } = storeToRefs(store);

// Pixels per second
const zoomLevel = ref(20); 

const formatTime = (seconds: number) => {
  const date = new Date(seconds * 1000);
  const mm = date.getUTCMinutes().toString().padStart(2, '0');
  const ss = date.getUTCSeconds().toString().padStart(2, '0');
  const ms = Math.floor(date.getUTCMilliseconds() / 10).toString().padStart(2, '0');
  return `${mm}:${ss}:${ms}`;
};

const { } = useDragDrop(() => {
  // Handle File Drop directly onto track (upload + add)
  // For now, focus on Internal Asset Drop which is handled differently
});

// Handle Internal Drag Drop (from Asset Library)
const handleTrackDrop = (e: DragEvent, trackId: number) => {
   e.preventDefault();
   const data = e.dataTransfer?.getData('application/json');
   if (data) {
      try {
         const assetData = JSON.parse(data);
         // Calculate start time based on drop X position
         const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
         const offsetX = e.clientX - rect.left;
         // Account for scroll? For now assume simple
         const startTime = Math.max(0, offsetX / zoomLevel.value);
         
         store.addClipToTimeline(assetData.id, trackId, startTime);
      } catch (err) {
         console.error('Invalid drop data', err);
      }
   }
};

const handleSeek = (e: MouseEvent) => {
   const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
   const offsetX = e.clientX - rect.left;
   const time = Math.max(0, offsetX / zoomLevel.value);
   store.seek(time);
};

const getClipStyle = (clip: any) => {
   return {
      left: `${clip.start * zoomLevel.value}px`,
      width: `${clip.duration * zoomLevel.value}px`,
   };
};

const getTrackColor = (type: string) => {
   switch(type) {
      case 'video': return 'bg-brand-primary/20 border-brand-primary/50 text-brand-primary';
      case 'audio': return 'bg-emerald-500/20 border-emerald-500/50 text-emerald-500';
      default: return 'bg-gray-500/20 border-gray-500/50';
   }
};
</script>

<template>
  <div class="flex flex-col h-full select-none">
    <!-- Timeline Toolbar -->
    <div class="h-10 border-b border-canvas-border flex items-center justify-between px-4 bg-canvas-light shrink-0">
      <div class="flex items-center gap-2">
         <Button variant="icon" size="sm" :icon="SkipBack" @click="store.seek(0)" />
         <Button variant="icon" size="sm" :icon="SkipForward" />
         <div class="h-4 w-[1px] bg-canvas-border mx-2"></div>
         <Button variant="ghost" size="sm" :icon="Scissors">Split</Button>
      </div>

      <div class="flex items-center gap-4">
          <span class="font-mono text-sm text-brand-accent">{{ formatTime(currentTime) }}</span>
          <Button 
            variant="secondary"
            class="rounded-full w-8 h-8 flex items-center justify-center"
            @click="store.togglePlayback"
          >
             <component :is="isPlaying ? Pause : Play" :size="14" fill="currentColor" />
          </Button>
      </div>

      <div class="flex items-center gap-2">
          <Button variant="icon" size="sm" :icon="ZoomOut" @click="zoomLevel = Math.max(5, zoomLevel - 5)" />
          <input type="range" v-model="zoomLevel" min="5" max="100" class="w-20 h-1 bg-canvas-border rounded-lg appearance-none cursor-pointer accent-brand-primary" />
          <Button variant="icon" size="sm" :icon="ZoomIn" @click="zoomLevel = Math.min(100, zoomLevel + 5)" />
      </div>
    </div>

    <!-- Timeline Area -->
    <div class="flex-1 flex min-h-0 overflow-hidden bg-canvas relative">
       <!-- Track Headers -->
       <div class="w-32 flex-shrink-0 border-r border-canvas-border bg-canvas-light z-20 flex flex-col pt-8 shadow-lg"> 
          <div v-for="track in tracks" :key="track.id" class="h-24 border-b border-canvas-border flex flex-col justify-center px-3 text-xs hover:bg-canvas-lighter transition-colors group">
             <span class="font-medium text-text-main mb-1">{{ track.name }}</span>
             <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <!-- Track controls placeholder -->
             </div>
          </div>
       </div>

       <!-- Tracks Scroll Area -->
       <div class="flex-1 overflow-auto relative custom-scrollbar">
          <!-- Ruler -->
          <div 
            class="h-8 sticky top-0 bg-canvas-light border-b border-canvas-border z-10 flex items-end pb-1 cursor-pointer hover:bg-canvas-lighter"
            @click="handleSeek"
            :style="{ minWidth: '2000px' }" 
          >
             <!-- Simple Ruler rendering -->
             <div class="absolute inset-0 flex">
                <div v-for="i in 50" :key="i" class="h-full border-l border-canvas-border/30 relative" :style="{ width: `${zoomLevel * 5}px` }">
                   <span class="absolute bottom-1 left-1 text-[9px] text-text-muted">{{ (i-1) * 5 }}s</span>
                </div>
             </div>
          </div>

          <!-- Playhead Line -->
          <div 
             class="absolute top-0 bottom-0 w-[1px] bg-red-500 z-30 pointer-events-none transition-none"
             :style="{ left: `${currentTime * zoomLevel}px` }"
          >
             <div class="w-3 h-3 -ml-1.5 bg-red-500 rotate-45 -mt-1.5 shadow-sm"></div>
          </div>

          <!-- Track Content -->
          <div class="relative min-w-[2000px]">
             <div 
               v-for="track in tracks" 
               :key="track.id" 
               class="h-24 border-b border-canvas-border/30 relative bg-canvas/20 transition-colors"
               @dragover.prevent
               @drop="handleTrackDrop($event, track.id)"
             >
                <!-- Clips -->
                <div 
                   v-for="clip in track.clips"
                   :key="clip.id"
                   class="absolute top-2 bottom-2 rounded overflow-hidden border border-opacity-30 group cursor-grab shadow-sm flex items-center px-2"
                   :class="getTrackColor(track.type)"
                   :style="getClipStyle(clip)"
                >
                   <span class="text-[10px] font-medium truncate w-full select-none">{{ clip.name }}</span>
                </div>
             </div>
          </div>
       </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  height: 10px;
  width: 10px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #0b0e14;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #2a3445;
  border-radius: 5px;
}
</style>