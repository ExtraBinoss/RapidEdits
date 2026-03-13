<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { Monitor, Camera, Mic, Play, ChevronRight } from 'lucide-vue-next';
import { useRecorder } from '../../composables/useRecorder';
import Button from '../UI/Button/Button.vue';
import Switch from '../UI/Switch/Switch.vue';

const { 
  sources, 
  fetchSources, 
  selectedSource, 
  useCamera, 
  useMic, 
  startRecording,
  recordingSystem,
  setSource,
  setCamera,
  setMic
} = useRecorder();

const cameraPreview = ref<HTMLVideoElement | null>(null);

onMounted(async () => {
  await fetchSources();
});

// Update camera preview when toggled
watch(useCamera, async (val) => {
  if (val) {
    try {
      const stream = await recordingSystem.startCamera();
      if (cameraPreview.value) {
        cameraPreview.value.srcObject = stream;
      }
    } catch (e) {
      console.error('Camera failed', e);
    }
  } else {
    recordingSystem.stopCamera();
    if (cameraPreview.value) {
      cameraPreview.value.srcObject = null;
    }
  }
});

onUnmounted(() => {
  recordingSystem.stopCamera();
});

const handleStart = () => {
  startRecording();
  emit('close');
};

const emit = defineEmits(['close']);
</script>

<template>
  <div class="flex flex-col h-[600px] w-[900px] bg-canvas-light rounded-2xl overflow-hidden border border-canvas-border shadow-2xl glass-effect">
    <!-- Header -->
    <div class="px-6 py-4 border-b border-canvas-border flex items-center justify-between bg-canvas/50">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-brand-primary/10 rounded-lg">
          <Monitor class="w-5 h-5 text-brand-primary" />
        </div>
        <div>
          <h2 class="text-lg font-bold text-text-main">Record Studio</h2>
          <p class="text-xs text-text-muted">Select your source and configure devices</p>
        </div>
      </div>
      <button @click="emit('close')" class="p-2 hover:bg-canvas rounded-full transition-colors">
        <span class="sr-only">Close</span>
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Main Content -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Left: Source List -->
      <div class="w-72 border-r border-canvas-border flex flex-col bg-canvas/30">
        <div class="p-4 overflow-y-auto flex-1 space-y-2">
          <div 
             v-for="source in sources" 
             :key="source.id"
             @click="setSource(source)"
             class="group relative flex flex-col gap-2 p-2 rounded-xl border-2 transition-all cursor-pointer overflow-hidden"
             :class="[
               selectedSource?.id === source.id 
                 ? 'border-brand-primary bg-brand-primary/5 shadow-lg shadow-brand-primary/10' 
                 : 'border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10'
             ]"
          >
            <img :src="source.thumbnail.toDataURL()" class="w-full aspect-video object-cover rounded-lg mb-2 shadow-sm" />
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium truncate pr-2 text-text-main">{{ source.name }}</span>
              <ChevronRight v-if="selectedSource?.id === source.id" class="w-3 h-3 text-brand-primary" />
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Preview & Settings -->
      <div class="flex-1 flex flex-col p-6 bg-canvas/10">
        <!-- Preview Window -->
        <div class="flex-1 relative rounded-2xl bg-black shadow-inner overflow-hidden border border-white/5 group">
          <div v-if="selectedSource" class="absolute inset-0 flex items-center justify-center">
             <img :src="selectedSource.thumbnail.toDataURL()" class="w-full h-full object-contain opacity-50 blur-sm" />
             <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
             <div class="z-10 text-center">
               <div class="w-16 h-16 bg-brand-primary rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-primary/20">
                 <Monitor class="w-8 h-8 text-white" />
               </div>
               <p class="text-sm font-medium text-white">{{ selectedSource.name }}</p>
               <p class="text-xs text-text-muted mt-1">Ready to stream</p>
             </div>
          </div>
          
          <!-- Facecam Overlay Preview -->
          <div v-if="useCamera" class="absolute bottom-4 right-4 w-32 aspect-video bg-canvas-dark rounded-lg border-2 border-brand-primary shadow-xl overflow-hidden flex items-center justify-center">
             <video ref="cameraPreview" autoplay playsinline muted class="w-full h-full object-cover"></video>
          </div>

          <!-- Status Badge -->
          <div class="absolute top-4 left-4 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
            <span class="text-[10px] uppercase tracking-wider font-bold text-white">Live Link</span>
          </div>
        </div>

        <!-- Controls -->
        <div class="mt-6 flex items-center justify-between">
          <div class="flex items-center gap-6">
            <!-- Camera Toggle -->
             <div class="flex flex-col gap-2">
                <span class="text-xs text-text-muted font-medium flex items-center gap-1">
                  <Camera class="w-3 h-3" /> Camera
                </span>
                <div class="flex items-center gap-2">
                  <Switch :modelValue="useCamera" @update:modelValue="setCamera" />
                  <span class="text-xs text-text-main">{{ useCamera ? 'On' : 'Off' }}</span>
                </div>
             </div>

             <div class="h-8 w-px bg-canvas-border"></div>

             <!-- Mic Toggle -->
             <div class="flex flex-col gap-2">
                <span class="text-xs text-text-muted font-medium flex items-center gap-1">
                  <Mic class="w-3 h-3" /> Microphone
                </span>
                <div class="flex items-center gap-2">
                  <Switch :modelValue="useMic" @update:modelValue="setMic" />
                  <span class="text-xs text-text-main">{{ useMic ? 'On' : 'Off' }}</span>
                </div>
             </div>
          </div>

          <Button variant="primary" size="lg" :icon="Play" @click="handleStart" class="px-8 !rounded-xl shadow-xl shadow-brand-primary/20">
            Start Recording
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.glass-effect {
  backdrop-filter: blur(20px);
  background: rgba(var(--color-canvas), 0.85);
}

/* Custom Scrollbar */
::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--color-canvas-border);
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--color-brand-primary);
}
</style>
