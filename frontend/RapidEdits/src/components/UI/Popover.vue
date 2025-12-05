<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const isOpen = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const contentRef = ref<HTMLElement | null>(null);
const coords = ref({ top: 0, left: 0 });

const props = withDefaults(defineProps<{
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}>(), {
  position: 'bottom-right'
});

const toggle = () => {
  if (isOpen.value) {
    close();
  } else {
    open();
  }
};

const open = () => {
  isOpen.value = true;
  setTimeout(updatePosition, 0);
};

const close = () => {
  isOpen.value = false;
};

const updatePosition = () => {
  if (!triggerRef.value || !contentRef.value) return;
  const triggerRect = triggerRef.value.getBoundingClientRect();
  const contentRect = contentRef.value.getBoundingClientRect();
  const gap = 8;

  let top = triggerRect.bottom + gap;
  let left = triggerRect.right - contentRect.width; // Default bottom-right alignment

  if (props.position === 'bottom-left') {
    left = triggerRect.left;
  }
  
  // Add more logic for collision detection if needed
  coords.value = { top, left };
};

// Click outside to close
const handleClickOutside = (event: MouseEvent) => {
  if (
    triggerRef.value && 
    !triggerRef.value.contains(event.target as Node) &&
    contentRef.value && 
    !contentRef.value.contains(event.target as Node)
  ) {
    close();
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  window.addEventListener('resize', updatePosition);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('resize', updatePosition);
});
</script>

<template>
  <div class="relative inline-block">
    <div ref="triggerRef" @click="toggle">
      <slot name="trigger" :isOpen="isOpen"></slot>
    </div>

    <Teleport to="body">
      <Transition 
        enter-active-class="transition duration-100 ease-out"
        enter-from-class="transform scale-95 opacity-0"
        enter-to-class="transform scale-100 opacity-100"
        leave-active-class="transition duration-75 ease-in"
        leave-from-class="transform scale-100 opacity-100"
        leave-to-class="transform scale-95 opacity-0"
      >
        <div 
          v-if="isOpen"
          ref="contentRef"
          class="fixed z-40 min-w-[200px] bg-canvas-light border border-canvas-border rounded-lg shadow-2xl p-1"
          :style="{ top: `${coords.top}px`, left: `${coords.left}px` }"
        >
          <slot name="content" :close="close"></slot>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
