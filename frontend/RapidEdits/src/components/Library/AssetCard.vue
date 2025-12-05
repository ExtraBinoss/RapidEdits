<script setup lang="ts">
import { computed } from 'vue';
import { Video, Music, Image as ImageIcon, Trash2 } from 'lucide-vue-next';
import type { Asset } from '../../types/Media';
import { MediaType } from '../../types/Media';

const props = defineProps<{
  asset: Asset;
}>();

const emit = defineEmits<{
  (e: 'delete', id: string): void
}>();

const typeIcon = computed(() => {
  switch (props.asset.type) {
    case MediaType.VIDEO: return Video;
    case MediaType.AUDIO: return Music;
    case MediaType.IMAGE: return ImageIcon;
    default: return Video;
  }
});

const typeColor = computed(() => {
  switch (props.asset.type) {
    case MediaType.VIDEO: return 'bg-brand-primary';
    case MediaType.AUDIO: return 'bg-green-600';
    case MediaType.IMAGE: return 'bg-purple-600';
    default: return 'bg-gray-600';
  }
});

const formatDuration = (seconds?: number) => {
   if (!seconds) return '';
   const m = Math.floor(seconds / 60);
   const s = Math.floor(seconds % 60);
   return `${m}:${s.toString().padStart(2, '0')}`;
}

const onDragStart = (e: DragEvent) => {
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify({
       id: props.asset.id,
       type: props.asset.type,
       duration: props.asset.duration
    }));
    // Also Copy text for simple drops
    e.dataTransfer.setData('text/plain', props.asset.id);
  }
};
</script>

<template>
  <div 
    class="group relative aspect-square bg-canvas-lighter rounded-lg overflow-hidden border border-transparent hover:border-brand-primary transition-all cursor-grab active:cursor-grabbing"
    draggable="true"
    @dragstart="onDragStart"
  >
    <!-- Preview Image/Placeholder -->
    <div v-if="asset.type === MediaType.AUDIO" class="w-full h-full flex items-center justify-center bg-gradient-to-br from-canvas-light to-canvas">
       <Music :size="32" class="text-text-muted opacity-50" />
    </div>
    <img 
      v-else 
      :src="asset.url" 
      class="w-full h-full object-cover opacity-75 group-hover:opacity-100 transition-opacity"
      loading="lazy"
    />

    <!-- Hover Actions -->
    <div class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
       <button 
         @click.stop="emit('delete', asset.id)"
         class="p-1 rounded bg-black/60 text-white hover:bg-red-500/80 transition-colors"
       >
          <Trash2 :size="12" />
       </button>
    </div>

    <!-- Metadata Overlay -->
    <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2 pt-6 pointer-events-none">
       <div class="text-xs font-medium text-white truncate mb-0.5">{{ asset.name }}</div>
       <div class="flex items-center justify-between">
          <span class="text-[10px] text-gray-300">{{ formatDuration(asset.duration) }}</span>
          
          <!-- Type Icon Badge -->
          <div 
            class="flex items-center justify-center w-5 h-5 rounded-full text-white shadow-sm"
            :class="typeColor"
          >
             <component :is="typeIcon" :size="10" />
          </div>
       </div>
    </div>
  </div>
</template>