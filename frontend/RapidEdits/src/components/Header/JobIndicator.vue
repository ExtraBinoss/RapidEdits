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
                <Button variant="ghost" class="relative group">
                    <component
                        :is="statusIcon"
                        class="w-4 h-4"
                        :class="[
                            statusColor,
                            { 'animate-spin': hasActiveJobs },
                        ]"
                    />
                    <span
                        v-if="hasActiveJobs || latestJob"
                        class="ml-2 text-xs font-medium max-w-[100px] truncate hidden md:inline-block"
                    >
                        {{ latestJob?.title || "Jobs" }}
                    </span>
                </Button>

                <!-- Notification Dot for finished jobs -->
                <span
                    v-if="finishedJobs.length > 0 && !hasActiveJobs"
                    class="absolute top-1 right-1 w-2 h-2 bg-brand-primary rounded-full border border-canvas"
                ></span>
            </div>
        </template>

        <template #content>
            <div class="w-80 p-2">
                <div
                    class="pb-2 border-b border-canvas-border mb-2 flex justify-between items-center px-1"
                >
                    <h3 class="text-sm font-semibold text-text-main">
                        Background Tasks
                    </h3>
                    <button
                        v-if="finishedJobs.length > 0"
                        class="text-[10px] text-text-muted hover:text-red-400 flex items-center gap-1"
                        @click="clearFinished"
                    >
                        <Trash2 class="w-3 h-3" /> Clear Done
                    </button>
                </div>

                <div
                    v-if="activeJobs.length === 0 && finishedJobs.length === 0"
                    class="text-center py-6 text-text-muted text-xs italic"
                >
                    No active tasks.
                </div>

                <div class="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                    <!-- Active List -->
                    <div
                        v-for="job in activeJobs"
                        :key="job.id"
                        class="p-3 bg-canvas-darker rounded border border-canvas-border/50"
                    >
                        <div class="flex justify-between items-start mb-2">
                            <div
                                class="text-xs font-semibold text-text-main truncate pr-2"
                                :title="job.title"
                            >
                                {{ job.title }}
                            </div>
                            <button
                                @click="cancelJob(job)"
                                class="text-[10px] text-red-500 hover:text-red-400"
                            >
                                Cancel
                            </button>
                        </div>
                        <div
                            class="w-full h-1.5 bg-canvas-border rounded-full overflow-hidden mb-1"
                        >
                            <div
                                class="h-full bg-brand-primary transition-all duration-300 relative overflow-hidden"
                                :style="{ width: `${job.progress}%` }"
                            >
                                <div
                                    class="absolute inset-0 bg-white/20 animate-[shine_2s_infinite]"
                                ></div>
                            </div>
                        </div>
                        <div
                            class="flex justify-between text-[10px] text-text-muted"
                        >
                            <span class="truncate max-w-[180px]">{{
                                job.details
                            }}</span>
                            <span>{{ job.progress }}%</span>
                        </div>
                    </div>

                    <!-- Finished List -->
                    <div
                        v-for="job in finishedJobs"
                        :key="job.id"
                        class="p-2 rounded hover:bg-canvas-darker transition-colors flex items-center gap-3"
                    >
                        <div class="shrink-0">
                            <CheckCircle
                                v-if="job.status === 'success'"
                                class="w-4 h-4 text-green-500"
                            />
                            <AlertCircle v-else class="w-4 h-4 text-red-500" />
                        </div>
                        <div class="flex-1 min-w-0">
                            <p
                                class="text-xs font-medium text-text-main truncate"
                            >
                                {{ job.title }}
                            </p>
                            <p class="text-[10px] text-text-muted truncate">
                                {{ job.error || "Completed" }}
                            </p>
                        </div>
                        <button
                            @click="removeJob(job.id)"
                            class="text-text-muted hover:text-text-main"
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
