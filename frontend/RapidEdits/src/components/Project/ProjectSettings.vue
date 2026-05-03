<script setup lang="ts">
import { useProjectStore } from "../../stores/projectStore";
import Input from "../UI/Input/Input.vue";
import Select from "../UI/Input/Select.vue";
import Button from "../UI/Button/Button.vue";
import { Save, Settings2, Monitor, Zap } from "lucide-vue-next";
import { computed } from "vue";

const props = defineProps<{
    showSaveButton?: boolean;
}>();

const emit = defineEmits(["saved"]);

const projectStore = useProjectStore();

const resolutions = [
    { value: "1920x1080", label: "Full HD (1920x1080)", subLabel: "Standard 16:9" },
    { value: "1080x1920", label: "TikTok/Reels (1080x1920)", subLabel: "Vertical 9:16" },
    { value: "1080x1080", label: "Square (1080x1080)", subLabel: "Social Media 1:1" },
    { value: "1280x720", label: "HD (1280x720)", subLabel: "Fast Rendering 16:9" },
    { value: "3840x2160", label: "4K (3840x2160)", subLabel: "Ultra HD 16:9" },
];

const fpsOptions = [
    { value: 24, label: "24 fps", subLabel: "Cinematic" },
    { value: 30, label: "30 fps", subLabel: "Standard" },
    { value: 60, label: "60 fps", subLabel: "Smooth / Gaming" },
];

const handleResolutionChange = (val: string) => {
    const [w, h] = val.split("x").map(Number);
    projectStore.resolution = { width: w, height: h };
};

const currentResValue = computed(() => 
    `${projectStore.resolution.width}x${projectStore.resolution.height}`
);

const handleSave = () => {
    projectStore.saveProject();
    emit("saved");
};
</script>

<template>
    <div class="flex flex-col gap-5">
        <div class="flex items-center gap-2 pb-2 border-b border-canvas-border">
            <Settings2 :size="18" class="text-brand-accent" />
            <h3 class="font-bold text-text-main">Project Settings</h3>
        </div>

        <div class="space-y-4">
            <div class="space-y-1.5">
                <label class="text-[10px] font-bold text-text-muted uppercase tracking-wider px-1 flex items-center gap-1.5">
                    Project Name
                </label>
                <Input v-model="projectStore.projectName" placeholder="My Awesome Edit" />
            </div>

            <div class="space-y-1.5">
                <label class="text-[10px] font-bold text-text-muted uppercase tracking-wider px-1 flex items-center gap-1.5">
                    <Monitor :size="12" /> Resolution
                </label>
                <Select 
                    :modelValue="currentResValue"
                    @update:modelValue="handleResolutionChange"
                    :options="resolutions"
                />
            </div>

            <div class="space-y-1.5">
                <label class="text-[10px] font-bold text-text-muted uppercase tracking-wider px-1 flex items-center gap-1.5">
                    <Zap :size="12" /> Frame Rate
                </label>
                <Select 
                    v-model="projectStore.fps"
                    :options="fpsOptions"
                />
            </div>
        </div>

        <div v-if="showSaveButton" class="pt-2">
            <Button variant="primary" :icon="Save" class="w-full" @click="handleSave">
                Save Project
            </Button>
        </div>
    </div>
</template>
