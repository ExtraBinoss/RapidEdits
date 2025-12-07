<script setup lang="ts">
import { computed } from "vue";
import { useJobSystem, type Job } from "../../composables/useJobSystem";
import Popover from "../UI/Overlay/Popover.vue";
import Button from "../UI/Button/Button.vue";
import {
    Activity,
    Loader2,
    CheckCircle,
    AlertCircle,
    Trash2,
    X,
} from "lucide-vue-next";

const { activeJobs, finishedJobs, removeJob } = useJobSystem();

const hasActiveJobs = computed(() => activeJobs.value.length > 0);
const latestJob = computed(
    () =>
        activeJobs.value[activeJobs.value.length - 1] ||
        finishedJobs.value[finishedJobs.value.length - 1],
);

const statusIcon = computed(() => {
    if (activeJobs.value.length > 0) return Loader2;
    if (finishedJobs.value.length > 0) {
        const last = finishedJobs.value[finishedJobs.value.length - 1];
        if (last && last.status === "error") return AlertCircle;
        if (last && last.status === "success") return CheckCircle;
    }
    return Activity;
});

const statusColor = computed(() => {
    if (activeJobs.value.length > 0) return "text-brand-primary";
    const last = finishedJobs.value[finishedJobs.value.length - 1];
    if (last?.status === "error") return "text-red-500";
    return "text-text-muted";
});

const clearFinished = () => {
    finishedJobs.value.forEach((j) => removeJob(j.id));
};

const cancelJob = (job: Job) => {
    job.cancel?.();
    removeJob(job.id);
};
</script>

<template>
    <Popover position="bottom-right">
        <template #trigger>
            <div class="relative">
                <Button
                    variant="ghost"
                    class="relative group h-9 px-3 border border-transparent hover:border-canvas-border transition-all"
                >
                    <!-- Status Icon & Label -->
                    <div class="flex items-center gap-2">
                        <component
                            :is="statusIcon"
                            class="w-4 h-4"
                            :class="[
                                statusColor,
                                { 'animate-spin': hasActiveJobs },
                            ]"
                        />

                        <div
                            v-if="hasActiveJobs || latestJob"
                            class="flex flex-col items-start text-xs hidden md:flex"
                        >
                            <span
                                class="font-medium text-text-main max-w-[120px] truncate leading-tight"
                            >
                                {{ latestJob?.title || "Background Tasks" }}
                            </span>
                            <span
                                v-if="hasActiveJobs"
                                class="text-[10px] text-text-muted leading-tight"
                            >
                                {{ latestJob?.details || "Running..." }}
                            </span>
                        </div>
                    </div>

                    <!-- Ambient Progress Bar (Bottom Border) -->
                    <div
                        v-if="hasActiveJobs"
                        class="absolute bottom-0 left-0 h-[2px] bg-canvas-dark w-full overflow-hidden rounded-b-md"
                    >
                        <div
                            class="h-full bg-gradient-to-r from-brand-secondary to-brand-primary transition-all duration-300 relative"
                            :style="{ width: `${latestJob?.progress || 0}%` }"
                        >
                            <div
                                class="absolute inset-0 bg-white/30 animate-[shine_1.5s_infinite]"
                            ></div>
                        </div>
                    </div>
                </Button>

                <!-- Notification Dot for finished jobs -->
                <span
                    v-if="finishedJobs.length > 0 && !hasActiveJobs"
                    class="absolute top-1 right-1 w-2 h-2 bg-brand-primary rounded-full border border-canvas shadow-sm"
                ></span>
            </div>
        </template>

        <template #content>
            <div
                class="w-80 p-0 bg-canvas-light rounded-lg shadow-xl border border-canvas-border overflow-hidden"
            >
                <!-- Header -->
                <div
                    class="p-3 border-b border-canvas-border flex justify-between items-center bg-canvas-darker/50"
                >
                    <h3
                        class="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-2"
                    >
                        <Activity class="w-3 h-3 text-brand-primary" />
                        Tasks
                    </h3>
                    <button
                        v-if="finishedJobs.length > 0"
                        class="text-[10px] text-text-muted hover:text-red-400 flex items-center gap-1 transition-colors"
                        @click="clearFinished"
                    >
                        <Trash2 class="w-3 h-3" /> Clear All
                    </button>
                </div>

                <!-- Empty State -->
                <div
                    v-if="activeJobs.length === 0 && finishedJobs.length === 0"
                    class="flex flex-col items-center justify-center py-8 text-text-muted"
                >
                    <CheckCircle class="w-8 h-8 opacity-20 mb-2" />
                    <span class="text-xs italic">All systems operational</span>
                </div>

                <!-- Job List -->
                <div class="max-h-[300px] overflow-y-auto">
                    <!-- Active List -->
                    <div
                        v-for="job in activeJobs"
                        :key="job.id"
                        class="p-3 border-b border-canvas-border last:border-0 bg-canvas/30"
                    >
                        <div class="flex justify-between items-start mb-2">
                            <div class="flex-1 min-w-0 mr-2">
                                <div
                                    class="text-xs font-semibold text-text-main truncate"
                                    :title="job.title"
                                >
                                    {{ job.title }}
                                </div>
                                <div
                                    class="text-[10px] text-text-muted truncate"
                                >
                                    {{ job.details }}
                                </div>
                            </div>
                            <button
                                @click="cancelJob(job)"
                                class="text-text-muted hover:text-red-500 transition-colors p-1"
                                title="Cancel"
                            >
                                <X class="w-3 h-3" />
                            </button>
                        </div>

                        <!-- Modern Progress Bar -->
                        <div
                            class="relative h-1.5 w-full bg-canvas-dark rounded-full overflow-hidden"
                        >
                            <div
                                class="absolute inset-y-0 left-0 bg-gradient-to-r from-brand-secondary to-brand-primary transition-all duration-300 rounded-full"
                                :style="{ width: `${job.progress}%` }"
                            >
                                <div
                                    class="absolute inset-0 bg-white/20 animate-[shine_2s_infinite]"
                                ></div>
                            </div>
                        </div>
                        <div class="text-right mt-1">
                            <span class="text-[9px] font-mono text-text-muted"
                                >{{ job.progress }}%</span
                            >
                        </div>
                    </div>

                    <!-- Finished List -->
                    <div
                        v-for="job in finishedJobs"
                        :key="job.id"
                        class="p-3 flex items-center gap-3 hover:bg-canvas-darker/50 transition-colors group"
                    >
                        <div class="shrink-0">
                            <div
                                v-if="job.status === 'success'"
                                class="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20"
                            >
                                <CheckCircle
                                    class="w-3.5 h-3.5 text-green-500"
                                />
                            </div>
                            <div
                                v-else
                                class="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20"
                            >
                                <AlertCircle class="w-3.5 h-3.5 text-red-500" />
                            </div>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p
                                class="text-xs font-medium text-text-main truncate"
                            >
                                {{ job.title }}
                            </p>
                            <p
                                class="text-[10px] text-text-muted truncate"
                                :class="{
                                    'text-red-400': job.status === 'error',
                                }"
                            >
                                {{ job.error || "Completed" }}
                            </p>
                        </div>
                        <button
                            @click="removeJob(job.id)"
                            class="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-text-main p-1"
                        >
                            <X class="w-3 h-3" />
                        </button>
                    </div>
                </div>
            </div>
        </template>
    </Popover>
</template>

<style scoped>
@keyframes shine {
    0% {
        transform: translateX(-100%);
    }
    100% {
        transform: translateX(100%);
    }
}
</style>
