<script setup lang="ts">
import { ref } from "vue";
import { useJobSystem, type Job } from "../../composables/useJobSystem";
import StatusItem from "./StatusItem.vue";
import Button from "../UI/Button/Button.vue";
import { X, Trash2 } from "lucide-vue-next";

const { activeJobs, finishedJobs, removeJob } = useJobSystem();

const selectedJob = ref<Job | null>(null);
const isPopoverOpen = ref(false);
const popoverTarget = ref<HTMLElement | null>(null);

const handleJobClick = (job: Job, event: MouseEvent) => {
    selectedJob.value = job;
    isPopoverOpen.value = true;
    // Simple positioning logic could go here or use floating-ui
};

const clearFinished = () => {
    finishedJobs.value.forEach((j) => removeJob(j.id));
};
</script>

<template>
    <div
        class="h-6 bg-brand-dark border-t border-canvas-border flex items-center px-2 select-none justify-between z-50"
    >
        <div class="flex items-center gap-1">
            <!-- Active Jobs -->
            <StatusItem
                v-for="job in activeJobs"
                :key="job.id"
                :job="job"
                @click="(e) => handleJobClick(job, e)"
            />

            <!-- Finished Jobs (Summary) -->
            <StatusItem
                v-for="job in finishedJobs"
                :key="job.id"
                :job="job"
                @click="(e) => handleJobClick(job, e)"
            />
        </div>

        <div class="flex gap-2 text-[10px] text-text-muted">
            <button
                v-if="finishedJobs.length > 0"
                @click="clearFinished"
                class="hover:text-text-main"
            >
                Clear Done
            </button>
            <span>v0.1.0 Beta</span>
        </div>

        <!-- Inline detailed view overlay (Popover equivalent) -->
        <Teleport to="body">
            <div
                v-if="isPopoverOpen && selectedJob"
                class="fixed inset-0 bg-black/50 z-[100] flex items-end justify-end p-4 pointer-events-none"
            >
                <div
                    class="bg-canvas border border-canvas-border rounded-lg shadow-2xl w-80 pointer-events-auto mr-4 mb-8 overflow-hidden flex flex-col"
                >
                    <div
                        class="p-3 border-b border-canvas-border flex justify-between items-center bg-canvas-darker"
                    >
                        <h3
                            class="font-semibold text-sm truncate"
                            :title="selectedJob.title"
                        >
                            {{ selectedJob.title }}
                        </h3>
                        <button
                            @click="isPopoverOpen = false"
                            class="text-text-muted hover:text-white"
                        >
                            <X class="w-4 h-4" />
                        </button>
                    </div>

                    <div class="p-4 flex flex-col gap-3">
                        <div
                            class="flex justify-between text-xs text-text-muted"
                        >
                            <span>Status:</span>
                            <span
                                class="uppercase font-bold"
                                :class="{
                                    'text-brand-primary':
                                        selectedJob.status === 'running',
                                    'text-green-500':
                                        selectedJob.status === 'success',
                                    'text-red-500':
                                        selectedJob.status === 'error',
                                }"
                                >{{ selectedJob.status }}</span
                            >
                        </div>

                        <div
                            v-if="selectedJob.status === 'running'"
                            class="w-full h-2 bg-canvas-border rounded-full overflow-hidden"
                        >
                            <div
                                class="h-full bg-brand-primary transition-all duration-300"
                                :style="{ width: `${selectedJob.progress}%` }"
                            ></div>
                        </div>

                        <div
                            class="text-xs text-text-muted bg-canvas-darker p-2 rounded max-h-32 overflow-y-auto whitespace-pre-wrap font-mono"
                        >
                            {{ selectedJob.details || "No details." }}
                            <div
                                v-if="selectedJob.error"
                                class="text-red-400 mt-2"
                            >
                                Error: {{ selectedJob.error }}
                            </div>
                        </div>

                        <div class="flex justify-end gap-2 mt-2">
                            <Button
                                v-if="selectedJob.status === 'running'"
                                variant="danger"
                                size="sm"
                                @click="selectedJob.cancel?.()"
                            >
                                Cancel
                            </Button>
                            <Button
                                v-else
                                variant="secondary"
                                size="sm"
                                @click="
                                    removeJob(selectedJob.id);
                                    isPopoverOpen = false;
                                "
                            >
                                Dismiss
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>
