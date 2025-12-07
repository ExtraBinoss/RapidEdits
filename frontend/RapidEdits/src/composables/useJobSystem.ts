import { ref, computed } from "vue";

export type JobStatus = "idle" | "running" | "success" | "error";
export type JobType = "transcription" | "export" | "other";

export interface Job {
    id: string;
    type: JobType;
    title: string;
    status: JobStatus;
    progress: number; // 0-100
    details: string;
    error?: string;
    result?: any;
    cancel?: () => void;
    timestamp: number;
}

const jobs = ref<Job[]>([]);

export function useJobSystem() {
    const addJob = (
        job: Omit<
            Job,
            "id" | "timestamp" | "status" | "progress" | "details"
        > & {
            details?: string;
        },
    ): string => {
        const id = crypto.randomUUID();
        jobs.value.push({
            details: "", // default
            ...job,
            id,
            status: "running",
            progress: 0,
            timestamp: Date.now(),
        });
        return id;
    };

    const updateJob = (id: string, updates: Partial<Job>) => {
        const job = jobs.value.find((j) => j.id === id);
        if (job) {
            Object.assign(job, updates);
        }
    };

    const removeJob = (id: string) => {
        jobs.value = jobs.value.filter((j) => j.id !== id);
    };

    const activeJobs = computed(() =>
        jobs.value.filter((j) => j.status === "running"),
    );

    const finishedJobs = computed(() =>
        jobs.value.filter(
            (j) => j.status === "success" || j.status === "error",
        ),
    );

    return {
        jobs,
        activeJobs,
        finishedJobs,
        addJob,
        updateJob,
        removeJob,
    };
}
