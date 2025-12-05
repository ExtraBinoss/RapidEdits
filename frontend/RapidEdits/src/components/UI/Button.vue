<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';

interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  icon?: Component;
  label?: string;
  active?: boolean;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'secondary',
  size: 'md',
  active: false,
  loading: false,
});

const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 disabled:opacity-50 disabled:cursor-not-allowed';

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'primary':
      return 'bg-brand-gradient text-white shadow-lg shadow-brand-primary/20 hover:brightness-110 border border-transparent';
    case 'secondary':
      return 'bg-canvas-lighter text-text-main border border-canvas-border hover:bg-canvas-border hover:text-white';
    case 'ghost':
      return 'bg-transparent text-text-muted hover:text-white hover:bg-canvas-light';
    case 'icon':
      return props.active 
        ? 'bg-brand-primary/20 text-brand-accent' 
        : 'bg-transparent text-text-muted hover:text-white hover:bg-canvas-lighter';
    default:
      return '';
  }
});

const sizeClasses = computed(() => {
  if (props.variant === 'icon') {
    switch (props.size) {
      case 'sm': return 'p-1.5';
      case 'md': return 'p-2';
      case 'lg': return 'p-3';
    }
  }
  
  switch (props.size) {
    case 'sm': return 'px-2 py-1 text-xs gap-1.5';
    case 'md': return 'px-4 py-1.5 text-sm gap-2';
    case 'lg': return 'px-6 py-2 text-base gap-2.5';
    default: return '';
  }
});
</script>

<template>
  <button :class="[baseClasses, variantClasses, sizeClasses]">
    <component 
      v-if="icon" 
      :is="icon" 
      :size="size === 'sm' ? 14 : size === 'lg' ? 20 : 16" 
      :class="{ 'animate-spin': loading }"
    />
    <span v-if="$slots.default || label">
      <slot>{{ label }}</slot>
    </span>
  </button>
</template>
