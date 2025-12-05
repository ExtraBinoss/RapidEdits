<script setup lang="ts">
import { useProjectStore } from '../../stores/projectStore';
import { useDragDrop } from '../../composables/useDragDrop';
import { UploadCloud } from 'lucide-vue-next';

const store = useProjectStore();

const { isDragging, events } = useDragDrop((files) => {
  store.uploadFiles(files);
});

const handleManualUpload = (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (input.files) {
    store.uploadFiles(input.files);
  }
};
</script>

<template>
  <div 
    class="w-full border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-3 transition-all duration-200 relative overflow-hidden"
    :class="[
      isDragging 
        ? 'border-brand-primary bg-brand-primary/10' 
        : 'border-canvas-border hover:border-brand-primary/50 hover:bg-canvas-lighter'
    ]"
    v-on="events"
  >
    <input 
      type="file" 
      multiple 
      class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
      @change="handleManualUpload"
    />
    
    <div class="p-4 rounded-full bg-canvas-light border border-canvas-border transition-transform duration-200" :class="{ 'scale-110': isDragging }">
       <UploadCloud :size="24" :class="isDragging ? 'text-brand-primary' : 'text-text-muted'" />
    </div>
    
    <div class="text-center px-4 pb-4">
      <p class="text-sm font-medium text-text-main" :class="{ 'text-brand-accent': isDragging }">
        {{ isDragging ? 'Drop files here' : 'Click or Drag media' }}
      </p>
      <p class="text-xs text-text-muted mt-1">Video, Audio, Images</p>
    </div>
  </div>
</template>
