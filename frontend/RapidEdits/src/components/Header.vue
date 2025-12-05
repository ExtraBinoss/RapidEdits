<script setup lang="ts">
import { Download, Settings, FileVideo } from 'lucide-vue-next';
import Button from './UI/Button.vue';
import Tooltip from './UI/Tooltip.vue';
import Popover from './UI/Popover.vue';
</script>

<template>
  <header class="h-14 bg-canvas-light border-b border-canvas-border flex items-center justify-between px-4 shrink-0 z-20">
    <!-- Logo Area -->
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded bg-brand-gradient flex items-center justify-center text-white font-bold shadow-lg shadow-brand-primary/20">
        RE
      </div>
      <span class="text-lg font-bold tracking-tight text-text-main">
        RapidEdits
      </span>
    </div>

    <!-- Center Project Info -->
    <div class="hidden md:flex items-center gap-4 text-sm text-text-muted bg-canvas px-4 py-1.5 rounded-full border border-canvas-border hover:border-brand-primary/30 transition-colors group">
      <span class="group-hover:text-text-main cursor-pointer transition-colors">Untitled Project</span>
      <span class="text-canvas-border">|</span>
      <span class="text-xs">1920x1080 • 30fps</span>
    </div>

    <!-- Right Actions -->
    <div class="flex items-center gap-3">
      <Tooltip text="Settings" position="bottom">
        <Button variant="icon" :icon="Settings" />
      </Tooltip>
      
      <Popover position="bottom-right">
        <template #trigger>
          <Button variant="primary" :icon="Download">Export</Button>
        </template>
        
        <template #content="{ close }">
           <div class="flex flex-col gap-1">
              <div class="px-3 py-2 text-xs font-bold text-text-muted uppercase tracking-wider">Export Options</div>
              
              <button class="flex items-center gap-2 px-3 py-2 text-sm text-text-main hover:bg-canvas-lighter rounded transition-colors text-left">
                 <FileVideo :size="16" class="text-brand-accent" />
                 <div class="flex flex-col">
                    <span>Video (MP4)</span>
                    <span class="text-[10px] text-text-muted">High Quality • H.264</span>
                 </div>
              </button>
               <button class="flex items-center gap-2 px-3 py-2 text-sm text-text-main hover:bg-canvas-lighter rounded transition-colors text-left">
                 <FileVideo :size="16" class="text-brand-secondary" />
                 <div class="flex flex-col">
                    <span>WebM</span>
                    <span class="text-[10px] text-text-muted">Efficient • VP9</span>
                 </div>
              </button>

              <div class="h-[1px] bg-canvas-border my-1"></div>

              <button @click="close" class="flex items-center gap-2 px-3 py-2 text-xs text-text-muted hover:text-text-main hover:bg-canvas-lighter rounded transition-colors text-left">
                Cancel
              </button>
           </div>
        </template>
      </Popover>
    </div>
  </header>
</template>