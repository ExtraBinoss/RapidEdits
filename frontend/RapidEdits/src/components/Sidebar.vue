<script setup lang="ts">
import { ref } from 'vue';
import { 
  Files, 
  Type, 
  Wand2, 
  Music, 
  Sticker, 
  SplitSquareHorizontal,
} from 'lucide-vue-next';

const activeTab = ref('media');

const tabs = [
  { id: 'media', icon: Files, label: 'Media' },
  { id: 'audio', icon: Music, label: 'Audio' },
  { id: 'text', icon: Type, label: 'Text' },
  { id: 'stickers', icon: Sticker, label: 'Stickers' },
  { id: 'effects', icon: Wand2, label: 'Effects' },
  { id: 'transitions', icon: SplitSquareHorizontal, label: 'Transitions' },
];
</script>

<template>
  <div class="w-80 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 z-10">
    <div class="flex flex-1 min-h-0">
      <!-- Icon Rail -->
      <div class="w-16 flex flex-col items-center py-4 gap-4 border-r border-gray-800 bg-gray-950">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          @click="activeTab = tab.id"
          class="flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200 w-14 group relative"
          :class="activeTab === tab.id ? 'text-gemini-primary bg-gray-800' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'"
        >
          <component :is="tab.icon" :size="20" stroke-width="2" />
          <span class="text-[10px] font-medium">{{ tab.label }}</span>
          
          <!-- Active Indicator -->
          <div v-if="activeTab === tab.id" class="absolute left-0 top-2 bottom-2 w-0.5 bg-gemini-primary rounded-full"></div>
        </button>
      </div>

      <!-- Content Panel -->
      <div class="flex-1 flex flex-col min-w-0 bg-gray-900">
        <div class="p-4 border-b border-gray-800">
          <h2 class="font-semibold text-white capitalize">{{ activeTab }}</h2>
        </div>
        
        <!-- Media Import Area (Placeholder) -->
        <div v-if="activeTab === 'media'" class="p-4 flex flex-col gap-4 overflow-y-auto">
          <button class="w-full py-8 border-2 border-dashed border-gray-700 hover:border-gemini-primary hover:bg-gemini-primary/5 rounded-lg flex flex-col items-center justify-center gap-2 transition-all group text-gray-500 hover:text-gemini-primary">
            <div class="p-3 bg-gray-800 rounded-full group-hover:bg-gemini-primary/10 transition-colors">
              <Files :size="24" />
            </div>
            <span class="text-sm font-medium">Import Media</span>
          </button>

          <div class="grid grid-cols-2 gap-2">
             <div class="aspect-video bg-gray-800 rounded-md overflow-hidden relative group cursor-pointer border border-transparent hover:border-gemini-primary">
               <img src="https://picsum.photos/200/300" class="w-full h-full object-cover opacity-50 group-hover:opacity-80 transition-opacity" />
               <span class="absolute bottom-1 right-1 text-[10px] bg-black/70 px-1 rounded">00:15</span>
             </div>
             <div class="aspect-video bg-gray-800 rounded-md overflow-hidden relative group cursor-pointer border border-transparent hover:border-gemini-primary">
                <div class="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800"></div>
                <span class="absolute bottom-1 right-1 text-[10px] bg-black/70 px-1 rounded">00:05</span>
             </div>
          </div>
        </div>

        <div v-else class="flex-1 flex items-center justify-center text-gray-600 text-sm">
           {{ activeTab }} content coming soon
        </div>
      </div>
    </div>
  </div>
</template>
