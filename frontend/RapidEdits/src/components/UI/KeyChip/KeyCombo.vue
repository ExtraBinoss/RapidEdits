<script setup lang="ts">
import KeyChip from "./KeyChip.vue";

defineProps<{
    keys: string[];
}>();
</script>

<template>
    <div class="inline-flex items-center gap-1">
        <template v-for="(key, index) in keys" :key="index">
            <KeyChip :char="key" />
            <span v-if="index < keys.length - 1" class="text-xs text-text-muted"
                >+</span
            >
        </template>
    </div>
</template>
