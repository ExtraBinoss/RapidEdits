<script setup lang="ts">
interface Props {
  width?: string;
  height?: string;
  borderRadius?: string;
}

withDefaults(defineProps<Props>(), {
  width: '100%',
  height: '1rem',
  borderRadius: '0.5rem'
});
</script>

<template>
  <div 
    class="skeleton" 
    :style="{
      width,
      height,
      borderRadius
    }"
  >
    <div class="shimmer"></div>
  </div>
</template>

<style scoped>
.skeleton {
  position: relative;
  overflow: hidden;
  background: var(--color-canvas-lighter, #1e2532);
  border: 1px solid var(--color-canvas-border, #2a3445);
}

.shimmer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.03) 40%,
    rgba(255, 255, 255, 0.08) 50%,
    rgba(255, 255, 255, 0.03) 60%,
    transparent 100%
  );
  animation: shimmer 1.8s infinite linear;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

:root.light .skeleton {
  background: var(--color-canvas-lighter, #e2e8f0);
  border: 1px solid var(--color-canvas-border, #cbd5e1);
}

:root.light .shimmer {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(0, 0, 0, 0.02) 40%,
    rgba(0, 0, 0, 0.05) 50%,
    rgba(0, 0, 0, 0.02) 60%,
    transparent 100%
  );
}
</style>
