<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Mic, MicOff, Camera, CameraOff, Pause, Play, Square, GripVertical } from 'lucide-vue-next';

const isRecording = ref(false);
const isPaused = ref(false);
const useMic = ref(true);
const useCamera = ref(false);
const timeStr = ref('00:00');
let timer: any = null;
let startTime = 0;
let accumulatedTime = 0;

const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000) % 60;
    const m = Math.floor(ms / 60000);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const startTimer = () => {
    startTime = Date.now();
    timer = setInterval(() => {
        if (!isPaused.value) {
            timeStr.value = formatTime(Date.now() - startTime + accumulatedTime);
        }
    }, 1000);
};

const stopTimer = () => {
    if (timer) clearInterval(timer);
    accumulatedTime = 0;
    timeStr.value = '00:00';
};

const sendCommand = (cmd: string) => {
    (window as any).ipcRenderer.send('to-renderer', {
        channel: 'recording-command',
        data: cmd
    });
};

onMounted(() => {
    (window as any).ipcRenderer.on('recording-status', (_: any, data: any) => {
        const wasRecording = isRecording.value;
        const wasPaused = isPaused.value;
        
        isRecording.value = data.isRecording;
        isPaused.value = data.isPaused;
        useMic.value = data.useMic;
        useCamera.value = data.useCamera;

        if (isRecording.value && !wasRecording) {
            startTimer();
        } else if (!isRecording.value && wasRecording) {
            stopTimer();
        }

        if (isPaused.value && !wasPaused) {
            accumulatedTime += Date.now() - startTime;
        } else if (!isPaused.value && wasPaused) {
            startTime = Date.now();
        }
    });

    // Initial request for state
    sendCommand('get-status');
});

onUnmounted(() => {
    stopTimer();
});
</script>

<template>
    <div class="h-screen w-screen flex items-center justify-center p-2 drag-region">
        <div class="bg-canvas-dark/80 backdrop-blur-xl border border-white/10 rounded-full py-2 px-4 flex items-center gap-4 shadow-2xl no-drag-region group">
            <div class="flex items-center gap-3 pr-2 border-r border-white/10">
                <GripVertical class="w-4 h-4 text-text-muted cursor-move" />
                <div class="flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full bg-red-500 animate-pulse" v-if="isRecording && !isPaused"></div>
                    <div class="w-2 h-2 rounded-full bg-yellow-500" v-else-if="isPaused"></div>
                    <span class="text-sm font-mono font-bold text-white tabular-nums">{{ timeStr }}</span>
                </div>
            </div>

            <div class="flex items-center gap-2">
                <button 
                    @click="sendCommand(isPaused ? 'resume' : 'pause')"
                    class="p-2 rounded-full hover:bg-white/10 transition-colors"
                    :title="isPaused ? 'Resume' : 'Pause'"
                >
                    <component :is="isPaused ? Play : Pause" class="w-4 h-4 text-white" />
                </button>
                
                <button 
                    @click="sendCommand('toggle-mic')"
                    class="p-2 rounded-full hover:bg-white/10 transition-colors"
                    :class="{ 'text-brand-primary': useMic, 'text-red-400': !useMic }"
                    title="Toggle Microphone"
                >
                    <component :is="useMic ? Mic : MicOff" class="w-4 h-4" />
                </button>

                <button 
                    @click="sendCommand('toggle-camera')"
                    class="p-2 rounded-full hover:bg-white/10 transition-colors"
                    :class="{ 'text-brand-primary': useCamera, 'text-text-muted': !useCamera }"
                    title="Toggle Camera"
                >
                    <component :is="useCamera ? Camera : CameraOff" class="w-4 h-4" />
                </button>

                <div class="w-px h-4 bg-white/10 mx-1"></div>

                <button 
                    @click="sendCommand('stop')"
                    class="p-2 bg-red-500 hover:bg-red-600 rounded-full transition-all shadow-lg shadow-red-500/20 active:scale-95"
                    title="Stop Recording"
                >
                    <Square class="w-4 h-4 text-white fill-current" />
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.drag-region {
    -webkit-app-region: drag;
}
.no-drag-region {
    -webkit-app-region: no-drag;
}
</style>
