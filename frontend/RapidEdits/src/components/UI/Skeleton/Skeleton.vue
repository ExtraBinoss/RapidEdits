<script setup lang="ts">
interface Props {
  width?: string;
  height?: string;
  borderRadius?: string;
  circle?: boolean;
  variant?: 'default' | 'subtle' | 'dark';
}

withDefaults(defineProps<Props>(), {
  width: '100%',
  height: '1rem',
  borderRadius: '0.5rem',
  circle: false,
  variant: 'default'
});
</script>

<template>
  <div 
    class="skeleton" 
    :class="[
        `skeleton-${variant}`,
        { 'is-circle': circle }
    ]"
    :style="{
      width,
      height,
      borderRadius: circle ? '50%' : borderRadius
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
  border: 1px solid var(--color-canvas-border, rgba(255, 255, 255, 0.05));
}

.skeleton-subtle {
  background: rgba(255, 255, 255, 0.03);
  border: none;
}

.skeleton-dark {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.03);
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
    rgba(255, 255, 255, 0.06) 50%,
    rgba(255, 255, 255, 0.03) 60%,
    transparent 100%
  );
  animation: shimmer 2s infinite linear;
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
  background: #f1f5f9;
  border-color: #e2e8f0;
}

:root.light .shimmer {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(0, 0, 0, 0.02) 40%,
    rgba(0, 0, 0, 0.04) 50%,
    rgba(0, 0, 0, 0.02) 60%,
    transparent 100%
  );
}
</style>
