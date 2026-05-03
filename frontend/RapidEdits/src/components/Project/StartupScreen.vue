<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from "vue";
import { useProjectStore } from "../../stores/projectStore";
import Button from "../UI/Button/Button.vue";
import { Plus, History, ChevronLeft, Check, Monitor, Smartphone, Square, Play, Settings2 } from "lucide-vue-next";
import Skeleton from "../UI/Skeleton/Skeleton.vue";
import Input from "../UI/Input/Input.vue";
import gsap from "gsap";

const props = defineProps<{
    isOpen: boolean;
}>();

const emit = defineEmits(["started"]);

const projectStore = useProjectStore();
const view = ref<"landing" | "presets" | "custom">("landing");
const loadedImages = ref<Record<string, boolean>>({});

// Form State for Custom View
const customSettings = ref({
    name: "My New Edit",
    width: 1920,
    height: 1080,
    fps: 30
});

const presets = [
    { 
        id: "reels",
        name: "TikTok & Reels", 
        resolution: "1080x1920", 
        aspect: "9:16",
        icon: Smartphone,
        image: "/startup/social_media.jpg", // maybe switch to avif someday.
        video: null, 
        description: "Vertical video optimized for mobile platforms."
    },
    { 
        id: "youtube",
        name: "YouTube / Cinematic", 
        resolution: "1920x1080", 
        aspect: "16:9",
        icon: Monitor,
        image: "/startup/computer_normal.jpg", // maybe switch to avif someday.
        video: null,
        description: "Standard widescreen for desktop and TV."
    },
    { 
        id: "square",
        name: "Instagram Square", 
        resolution: "1080x1080", 
        aspect: "1:1",
        icon: Square,
        image: "/startup/instagram_square.avif",
        video: null,
        description: "Perfect for Instagram posts and social feeds."
    },
    { 
        id: "custom",
        name: "Custom Project", 
        resolution: "Custom", 
        aspect: "Any",
        icon: Settings2,
        image: "/startup/custom.avif",
        video: null,
        description: "Manually define your resolution and frame rate."
    }
];

const selectedPreset = ref(presets[1]);
const hasPlayedInitialAnimation = ref(false);

const handleImageLoad = (id: string) => {
    loadedImages.value[id] = true;
};

const handleVideoLoad = (id: string) => {
    loadedImages.value[id] = true; // Use same flag for simplicity
};

// Animations snappier and faster
const animateLanding = (force = false) => {
    if (hasPlayedInitialAnimation.value && !force) return;
    
    const tl = gsap.timeline({ defaults: { ease: "expo.out", duration: 0.4 } });
    tl.fromTo(".animated-gradient", { opacity: 0, scale: 1.08 }, { opacity: 0.3, scale: 1.05 })
      .fromTo(logoRef.value, { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1 }, "-=0.25")
      .fromTo(".action-card", { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, stagger: 0.05 }, "-=0.3");
    
    hasPlayedInitialAnimation.value = true;
};

const animatePresets = async () => {
    await nextTick();
    const tl = gsap.timeline({ defaults: { ease: "expo.out", duration: 0.4 } });
    
    gsap.set([".preset-header", ".preset-card", ".preset-footer"], { opacity: 0 });

    tl.fromTo(".preset-header", { opacity: 0, x: -10 }, { opacity: 1, x: 0 })
      .fromTo(".preset-card", { opacity: 0, scale: 0.98 }, { opacity: 1, scale: 1, stagger: 0.04 }, "-=0.3")
      .fromTo(".preset-footer", { opacity: 0 }, { opacity: 1 }, "-=0.2");
};

const animateCustom = async () => {
    await nextTick();
    const tl = gsap.timeline({ defaults: { ease: "expo.out", duration: 0.4 } });
    gsap.set(".custom-view-content", { opacity: 0 });
    tl.fromTo(".custom-view-content", { opacity: 0, scale: 0.98 }, { opacity: 1, scale: 1 });
};

onMounted(() => {
    if (props.isOpen) {
        animateLanding();

        // Animate background gradient with GSAP (Slow & Subtle)
        if (gradientRef.value) {
            gsap.to(gradientRef.value, {
                backgroundPosition: "100% 50%",
                duration: 45,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut"
            });

            gsap.to(gradientRef.value, {
                rotation: 15,
                scale: 1.15,
                duration: 35,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut"
            });
        }
    }
});

watch(view, (newView) => {
    if (newView === 'presets') {
        animatePresets();
    } else if (newView === 'custom') {
        animateCustom();
    }
});

const handleResume = async () => {
    const success = await projectStore.loadProject();
    if (success) {
        emit("started");
    } else {
        view.value = "presets";
    }
};

const selectPreset = (preset: any) => {
    selectedPreset.value = preset;
};

const handleNext = () => {
    if (selectedPreset.value.id === 'custom') {
        view.value = 'custom';
    } else {
        startProject();
    }
};

const startProject = () => {
    if (view.value === 'custom') {
        projectStore.resolution = { width: customSettings.value.width, height: customSettings.value.height };
        projectStore.fps = customSettings.value.fps;
        projectStore.projectName = customSettings.value.name;
    } else {
        const [w, h] = selectedPreset.value.resolution.split("x").map(Number);
        projectStore.resolution = { width: w, height: h };
        projectStore.projectName = "My New Edit";
    }
    
    gsap.to(containerRef.value, { 
        opacity: 0, 
        scale: 1.02, 
        duration: 0.25, 
        ease: "power2.in",
        onComplete: () => emit("started")
    });
};

const containerRef = ref(null);
const logoRef = ref(null);
const gradientRef = ref(null);
</script>

<template>
    <div v-if="isOpen" ref="containerRef" class="fixed inset-0 z-[200] flex items-center justify-center bg-canvas overflow-hidden">
        <!-- Animated Cinematic Background -->
        <div class="absolute inset-0 z-0 overflow-hidden">
            <div ref="gradientRef" class="animated-gradient absolute inset-[-50%] opacity-30"></div>
            <div class="absolute inset-0 bg-gradient-to-b from-canvas/40 via-canvas to-canvas"></div>
        </div>

        <!-- Content Container -->
        <div class="relative z-10 w-full max-w-5xl px-6 flex flex-col items-center max-h-screen overflow-y-auto py-8 custom-scrollbar-hidden">
            
            <!-- Logo & Title -->
            <div ref="logoRef" class="flex flex-col items-center mb-8 shrink-0">
                <div class="w-16 h-16 bg-brand-gradient rounded-2xl flex items-center justify-center shadow-2xl shadow-brand-primary/20 mb-4">
                    <Plus :size="32" class="text-white" />
                </div>
                <h1 class="text-4xl font-black tracking-tighter text-text-main mb-1">RapidEdits</h1>
                <p class="text-text-muted text-base">Unleash your creativity with lightning speed.</p>
            </div>

            <!-- Main View: Landing -->
            <div v-if="view === 'landing'" class="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl shrink-0">
                <button 
                    @click="view = 'presets'"
                    class="action-card group relative flex flex-col items-center justify-center p-8 rounded-3xl bg-canvas-light border border-canvas-border hover:border-brand-primary/50 transition-all shadow-xl hover:shadow-brand-primary/5 overflow-hidden"
                >
                    <div class="absolute inset-0 bg-brand-gradient opacity-0 group-hover:opacity-[0.03] transition-opacity"></div>
                    <Plus :size="40" class="text-brand-accent mb-3 group-hover:scale-110 transition-transform" />
                    <h2 class="text-xl font-bold text-text-main mb-1">New Project</h2>
                    <p class="text-text-muted text-center text-sm">Start fresh with a new timeline</p>
                </button>

                <button 
                    @click="handleResume"
                    class="action-card group relative flex flex-col items-center justify-center p-8 rounded-3xl bg-canvas-light border border-canvas-border hover:border-brand-primary/50 transition-all shadow-xl hover:shadow-brand-primary/5 overflow-hidden"
                >
                    <div class="absolute inset-0 bg-brand-gradient opacity-0 group-hover:opacity-[0.03] transition-opacity"></div>
                    <History :size="40" class="text-brand-accent mb-3 group-hover:scale-110 transition-transform" />
                    <h2 class="text-xl font-bold text-text-main mb-1">Resume</h2>
                    <p class="text-text-muted text-center text-sm">Open your last auto-saved work</p>
                </button>
            </div>

            <!-- Main View: Presets -->
            <div v-if="view === 'presets'" class="w-full shrink-0">
                <div class="preset-header opacity-0 flex items-center gap-4 mb-6">
                    <button @click="view = 'landing'" class="p-2 rounded-full bg-canvas-light border border-canvas-border hover:bg-canvas-border text-text-muted hover:text-text-main transition-all">
                        <ChevronLeft :size="20" />
                    </button>
                    <h2 class="text-2xl font-bold text-text-main">Choose your format</h2>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div 
                        v-for="preset in presets" 
                        :key="preset.id"
                        @click="selectPreset(preset)"
                        class="preset-card opacity-0 group relative flex flex-col rounded-2xl bg-canvas-light border-2 transition-all cursor-pointer overflow-hidden aspect-[4/5]"
                        :class="selectedPreset.id === preset.id ? 'border-brand-primary shadow-2xl shadow-brand-primary/10' : 'border-canvas-border hover:border-brand-primary/30'"
                    >
                        <div v-if="!loadedImages[preset.id]" class="absolute inset-0 z-20">
                            <Skeleton height="100%" borderRadius="0" variant="dark" />
                        </div>

                        <!-- Preset Video (if available) -->
                        <video 
                            v-if="preset.video"
                            :src="preset.video" 
                            class="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 z-10"
                            :class="[loadedImages[preset.id] ? 'opacity-60 group-hover:opacity-80' : 'opacity-0']"
                            autoplay 
                            muted 
                            loop 
                            playsinline
                            @canplay="handleVideoLoad(preset.id)"
                        ></video>

                        <!-- Preset Image (Fallback/Default) -->
                        <img 
                            v-else
                            :src="preset.image" 
                            class="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
                            :class="[loadedImages[preset.id] ? 'opacity-60 group-hover:opacity-80' : 'opacity-0']"
                            @load="handleImageLoad(preset.id)"
                        />
                        <div class="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent z-10"></div>
                        
                        <div v-if="selectedPreset.id === preset.id" class="absolute top-3 right-3 w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center shadow-lg z-30">
                            <Check :size="18" class="text-white" />
                        </div>

                        <div class="mt-auto p-4 relative z-20">
                            <div class="flex items-center gap-2 mb-1">
                                <component :is="preset.icon" :size="14" class="text-brand-accent" />
                                <span class="text-[10px] font-bold text-brand-accent uppercase tracking-widest">{{ preset.aspect }}</span>
                            </div>
                            <h3 class="text-base font-bold text-white">{{ preset.name }}</h3>
                            <p class="text-[10px] text-white/60 font-medium">{{ preset.resolution }}</p>
                        </div>
                    </div>
                </div>

                <div class="preset-footer opacity-0 flex flex-col items-center gap-4">
                    <p class="text-text-muted text-xs max-w-md text-center">
                        {{ selectedPreset.description }}
                    </p>
                    <Button variant="primary" size="lg" :icon="selectedPreset.id === 'custom' ? Settings2 : Check" @click="handleNext" class="px-10 py-3 rounded-2xl text-base">
                        {{ selectedPreset.id === 'custom' ? 'Configure' : 'Get Started' }}
                    </Button>
                </div>
            </div>

            <!-- Main View: Custom Configuration -->
            <div v-if="view === 'custom'" class="w-full max-w-lg custom-view-content shrink-0">
                 <div class="flex items-center gap-4 mb-6">
                    <button @click="view = 'presets'" class="p-2 rounded-full bg-canvas-light border border-canvas-border hover:bg-canvas-border text-text-muted hover:text-text-main transition-all">
                        <ChevronLeft :size="20" />
                    </button>
                    <h2 class="text-2xl font-bold text-text-main">Custom Settings</h2>
                </div>

                <div class="bg-canvas-light border border-canvas-border rounded-3xl p-6 space-y-5 shadow-2xl">
                    <div class="space-y-2">
                        <label class="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Project Name</label>
                        <Input v-model="customSettings.name" placeholder="Enter project name..." />
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <label class="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Width (px)</label>
                            <Input type="number" v-model.number="customSettings.width" />
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Height (px)</label>
                            <Input type="number" v-model.number="customSettings.height" />
                        </div>
                    </div>

                    <div class="space-y-2">
                        <label class="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Frame Rate (FPS)</label>
                        <div class="grid grid-cols-3 gap-2">
                            <button 
                                v-for="f in [24, 30, 60]" 
                                :key="f"
                                @click="customSettings.fps = f"
                                class="py-2 rounded-xl border-2 transition-all font-bold text-sm"
                                :class="customSettings.fps === f ? 'border-brand-primary bg-brand-primary/10 text-brand-accent' : 'border-canvas-border text-text-muted hover:border-text-muted/30'"
                            >
                                {{ f }}
                            </button>
                        </div>
                    </div>

                    <div class="pt-2">
                        <Button variant="primary" size="lg" :icon="Play" @click="startProject" class="w-full py-3 rounded-2xl text-base">
                            Create Project
                        </Button>
                    </div>
                </div>
            </div>

        </div>
    </div>
</template>

<style scoped>
.animated-gradient {
    background: linear-gradient(
        -45deg, 
        #1e3c72, 
        #2a5298, 
        #1e3c72, 
        #316ea0, 
        #2a5298
    );
    background-size: 400% 400%;
    filter: blur(80px);
    will-change: transform, background-position;
}

.custom-scrollbar-hidden {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
}
.custom-scrollbar-hidden::-webkit-scrollbar {
    display: none; /* Chrome, Safari and Opera */
}
</style>
