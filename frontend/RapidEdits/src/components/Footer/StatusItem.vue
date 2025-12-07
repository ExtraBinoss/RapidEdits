<script setup lang="ts">
import { computed } from "vue";
import { Loader2, CheckCircle, AlertCircle, Activity } from "lucide-vue-next";
import type { Job } from "../../composables/useJobSystem";

const props = defineProps<{
    job: Job;
}>();

const emit = defineEmits(["click"]);

const icon = computed(() => {
    switch (props.job.status) {
        case "running":
            return Loader2;
        case "success":
            return CheckCircle;
        case "error":
            return AlertCircle;
        default:
            return Activity;
    }
});

const statusColor = computed(() => {
    switch (props.job.status) {
        case "running":
            return "text-brand-primary";
        case "success":
            return "text-green-500";
        case "error":
            return "text-red-500";
        default:
            return "text-text-muted";
    }
});
</script>

<template>
    <button
        class="flex items-center gap-2 px-3 py-1 text-xs hover:bg-canvas-light transition-colors rounded relative overflow-hidden group"
        @click="emit('click')"
    >
        <!-- Shine effect for new/running jobs -->
        <div
            v-if="job.status === 'running'"
            class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-[100%] animate-[shine_2s_infinite]"
        ></div>

        <component
            :is="icon"
            class="w-3.5 h-3.5"
            :class="[statusColor, { 'animate-spin': job.status === 'running' }]"
        />
        <span class="text-text-main font-medium truncate max-w-[150px]">
            {{ job.title }}
        </span>
        <span v-if="job.status === 'running'" class="text-text-muted">
            {{ job.progress }}%
        </span>
    </button>
</template>

<style scoped>
@keyframes shine {
    100% {
        transform: translateX(100%);
    }
}
</style>
