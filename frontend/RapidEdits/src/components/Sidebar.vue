<script setup lang="ts">
import { ref, computed } from 'vue';
import { useProjectStore } from '../stores/projectStore';
import { MediaType } from '../types/Media';
import { 
  Files, 
  Type, 
  Wand2, 
  Music, 
  Sticker, 
  SplitSquareHorizontal,
} from 'lucide-vue-next';
import Button from './UI/Button.vue';
import Tooltip from './UI/Tooltip.vue';
import FileDropZone from './UI/FileDropZone.vue';
import AssetCard from './Library/AssetCard.vue';

const activeTab = ref('media');
const store = useProjectStore();

const tabs = [
  { id: 'media', icon: Files, label: 'All Media' },
  { id: 'audio', icon: Music, label: 'Audio' },
  { id: 'text', icon: Type, label: 'Text' },
  { id: 'stickers', icon: Sticker, label: 'Stickers' },
  { id: 'effects', icon: Wand2, label: 'Effects' },
  { id: 'transitions', icon: SplitSquareHorizontal, label: 'Transitions' },
];

// Filter assets based on active tab
const filteredAssets = computed(() => {
  if (activeTab.value === 'audio') {
    return store.assets.filter((a: any) => a.type === MediaType.AUDIO);
  }
  if (activeTab.value === 'media') {
    // Show Videos and Images in 'Media', keep Audio separate usually, or everything
    return store.assets.filter((a: any) => a.type !== MediaType.UNKNOWN);
  }
  return [];
});
</script>

<template>
  <div class="w-80 bg-canvas-light border-r border-canvas-border flex flex-col shrink-0 z-10">
    <div class="flex flex-1 min-h-0">
      <!-- Icon Rail -->
      <div class="w-16 flex flex-col items-center py-4 gap-3 border-r border-canvas-border bg-canvas">
        <Tooltip 
          v-for="tab in tabs" 
          :key="tab.id" 
          :text="tab.label" 
          position="right"
        >
          <Button 
             variant="icon" 
             :icon="tab.icon" 
             :active="activeTab === tab.id"
             size="lg"
             @click="activeTab = tab.id"
          />
        </Tooltip>
      </div>

      <!-- Content Panel -->
      <div class="flex-1 flex flex-col min-w-0 bg-canvas-light">
        <div class="p-4 border-b border-canvas-border flex justify-between items-center">
          <h2 class="font-semibold text-text-main capitalize">{{ activeTab }}</h2>
          <span class="text-xs text-text-muted">{{ filteredAssets.length }} items</span>
        </div>
        
        <!-- Asset Library -->
        <div v-if="['media', 'audio'].includes(activeTab)" class="flex-1 flex flex-col overflow-hidden">
           <div class="p-4 overflow-y-auto flex-1 space-y-4">
              
              <FileDropZone />

              <!-- Grid -->
              <div class="grid grid-cols-2 gap-3">
                 <AssetCard 
                    v-for="asset in filteredAssets" 
                    :key="asset.id" 
                    :asset="asset"
                    @delete="store.deleteAsset"
                 />
              </div>

              <div v-if="filteredAssets.length === 0" class="text-center py-8 text-text-muted text-xs">
                 No assets found. Drop some files!
              </div>
           </div>
        </div>

        <div v-else class="flex-1 flex items-center justify-center text-text-muted text-sm">
           {{ activeTab }} content coming soon
        </div>
      </div>
    </div>
  </div>
</template>