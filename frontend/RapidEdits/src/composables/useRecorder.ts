import { ref, onMounted, onUnmounted, watch } from 'vue';
import { editorEngine } from '../core/EditorEngine';
import { globalEventBus } from '../core/events/EventBus';

export function useRecorder() {
  const recordingSystem = editorEngine.recordingSystem;
  
  const isRecording = ref(recordingSystem.getState().isRecording);
  const sources = ref(recordingSystem.getState().sources);
  const selectedSource = ref(recordingSystem.getState().selectedSource);
    const useCamera = ref(recordingSystem.getState().useCamera);
    const useMic = ref(recordingSystem.getState().useMic);
    const showPicker = ref(recordingSystem.getState().showPicker);
    const videoBitrate = ref(recordingSystem.getState().videoBitrate);

    const syncState = () => {
        const state = recordingSystem.getState();
        isRecording.value = state.isRecording;
        sources.value = state.sources;
        selectedSource.value = state.selectedSource;
        useCamera.value = state.useCamera;
        useMic.value = state.useMic;
        showPicker.value = state.showPicker;
        videoBitrate.value = state.videoBitrate;
    };

    onMounted(() => {
        const unsubState = globalEventBus.on('RECORDING_STATE_CHANGED', (val) => {
            isRecording.value = val;
        });
        
        const unsubSources = globalEventBus.on('RECORDING_SOURCES_UPDATED', (val) => {
            sources.value = val;
        });

        const unsubSettings = globalEventBus.on('RECORDING_SETTINGS_UPDATED', () => {
            syncState();
        });

        // Initial sync
        syncState();

        onUnmounted(() => {
            unsubState();
            unsubSources();
            unsubSettings();
        });
    });

    // Watchers to sync back to engine
    watch(useCamera, (v: boolean) => {
        if (v !== recordingSystem.getState().useCamera) recordingSystem.setCamera(v);
    });
    watch(useMic, (v: boolean) => {
        if (v !== recordingSystem.getState().useMic) recordingSystem.setMic(v);
    });
    watch(showPicker, (v: boolean) => {
        if (v !== recordingSystem.getState().showPicker) recordingSystem.setShowPicker(v);
    });
    watch(selectedSource, (v: any) => {
        if (v !== recordingSystem.getState().selectedSource) recordingSystem.setSource(v);
    });
    watch(videoBitrate, (v: number) => {
        if (v !== recordingSystem.getState().videoBitrate) recordingSystem.setVideoBitrate(v);
    });

    return {
        isRecording,
        sources,
        selectedSource,
        useCamera,
        useMic,
        showPicker,
        videoBitrate,
        recordingSystem, // Export for direct method calls
        startRecording: () => recordingSystem.startRecording(),
        stopRecording: () => recordingSystem.stopRecording(),
        fetchSources: () => recordingSystem.fetchSources(),
        setSource: (s: any) => recordingSystem.setSource(s),
        setCamera: (v: boolean) => recordingSystem.setCamera(v),
        setMic: (v: boolean) => recordingSystem.setMic(v),
        setShowPicker: (v: boolean) => recordingSystem.setShowPicker(v),
        setVideoBitrate: (v: number) => recordingSystem.setVideoBitrate(v)
    };
}
