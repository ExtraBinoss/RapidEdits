<script setup lang="ts">
import { ref } from "vue";
import Dialog from "../UI/Overlay/Dialog.vue";
import ProjectSettings from "./ProjectSettings.vue";
import Button from "../UI/Button/Button.vue";
import { Plus, History } from "lucide-vue-next";
import { useProjectStore } from "../../stores/projectStore";

const props = defineProps<{
    isOpen: boolean;
}>();

const emit = defineEmits(["close", "started"]);

const projectStore = useProjectStore();
const view = ref<"initial" | "new">("initial");

const handleNewProject = () => {
    view.value = "new";
};

const handleLoadProject = async () => {
    const success = await projectStore.loadProject();
    if (success) {
        emit("started");
    } else {
        // If no project in localstorage, just go to new project
        view.value = "new";
    }
};

const startProject = () => {
    emit("started");
};
</script>

<template>
    <Dialog 
        :isOpen="isOpen" 
        title="Welcome to RapidEdits" 
        :closeOnBackdrop="false"
        @close="emit('close')"
    >
        <div v-if="view === 'initial'" class="flex flex-col gap-4 py-2">
            <p class="text-text-muted mb-2">Ready to create something amazing?</p>
            
            <div class="grid grid-cols-1 gap-3">
                <button 
                    @click="handleNewProject"
                    class="flex flex-col items-start gap-1 p-4 rounded-lg bg-canvas-lighter border border-canvas-border hover:border-brand-primary/50 hover:bg-canvas-border transition-all group"
                >
                    <div class="flex items-center gap-2 font-bold text-text-main group-hover:text-brand-accent">
                        <Plus :size="20" /> New Project
                    </div>
                    <p class="text-xs text-text-muted">Start a fresh project from scratch</p>
                </button>
                
                <button 
                    @click="handleLoadProject"
                    class="flex flex-col items-start gap-1 p-4 rounded-lg bg-canvas-lighter border border-canvas-border hover:border-brand-primary/50 hover:bg-canvas-border transition-all group"
                >
                    <div class="flex items-center gap-2 font-bold text-text-main group-hover:text-brand-accent">
                        <History :size="20" /> Resume Project
                    </div>
                    <p class="text-xs text-text-muted">Load your last auto-saved session</p>
                </button>
            </div>
        </div>

        <div v-if="view === 'new'" class="py-2">
            <ProjectSettings />
        </div>

        <template #footer v-if="view === 'new'">
            <Button variant="ghost" @click="view = 'initial'">Back</Button>
            <Button variant="primary" @click="startProject">Create Project</Button>
        </template>
    </Dialog>
</template>
