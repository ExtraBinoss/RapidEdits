import { globalEventBus } from '../events/EventBus';

import type { RecordedCursorPoint } from "../../types/Recording";

export class RecordingSystem {
    private isRecording: boolean = false;
    private isPaused: boolean = false;
    private sources: any[] = [];
    private selectedSource: any = null;
    private useCamera: boolean = false;
    private useMic: boolean = true;
    public showPicker: boolean = false;
    public recordedCursorPositions: RecordedCursorPoint[] = [];
    
    private mediaRecorder: MediaRecorder | null = null;
    private screenStream: MediaStream | null = null;
    private cameraStream: MediaStream | null = null;
    private chunks: Blob[] = [];
    private cursorInterval: any = null;

    private isElectron = !!(window as any).ipcRenderer;

    constructor() {
        if (this.isElectron) {
            (window as any).ipcRenderer.on('toggle-recording', () => {
                this.toggleRecording();
            });

            // Remote commands from toolbar
            (window as any).ipcRenderer.on('recording-command', (_: any, cmd: string) => {
                switch(cmd) {
                    case 'stop': this.stopRecording(); if (this.isElectron) (window as any).ipcRenderer.send('restore-main-window'); break;
                    case 'pause': this.pauseRecording(); break;
                    case 'resume': this.resumeRecording(); break;
                    case 'toggle-mic': this.setMic(!this.useMic); break;
                    case 'toggle-camera': this.setCamera(!this.useCamera); break;
                    case 'get-status': this.syncToolbar(); break;
                }
            });
        }
    }

    public async fetchSources() {
        if (!this.isElectron) return [];
        const results = await (window as any).ipcRenderer.invoke('get-desktop-sources', {
            types: ['window', 'screen'],
            thumbnailSize: { width: 300, height: 200 }
        });
        this.sources = results;
        if (results.length > 0 && !this.selectedSource) {
            this.selectedSource = results[0];
        }
        
        globalEventBus.emit({ type: 'RECORDING_SOURCES_UPDATED', payload: this.sources });
        return results;
    }

    public async toggleRecording() {
        if (this.isRecording) {
            await this.stopRecording();
            if (this.isElectron) (window as any).ipcRenderer.send('restore-main-window');
        } else {
            await this.startRecording();
            if (this.isElectron) (window as any).ipcRenderer.send('minimize-main-window');
        }
    }

    public async getStreamForSource(sourceId: string) {
        return await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: sourceId,
                }
            } as any
        });
    }

    public async startCamera() {
        try {
            this.cameraStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                },
                audio: false
            });
            return this.cameraStream;
        } catch (e) {
            console.error('Camera access failed', e);
            throw e;
        }
    }

    public stopCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(t => t.stop());
            this.cameraStream = null;
        }
    }

    public async startRecording() {
        if (this.isRecording) return;
        
        try {
            const audioConstraints = this.useMic ? true : false;
            this.showPicker = false; // Close picker when starting

            if (this.isElectron) {
                if (!this.selectedSource) await this.fetchSources();
                const source = this.selectedSource;

                this.screenStream = await navigator.mediaDevices.getUserMedia({
                    audio: audioConstraints ? {
                        mandatory: { chromeMediaSource: 'desktop' }
                    } : false as any,
                    video: {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            chromeMediaSourceId: source.id,
                            minWidth: 1920,
                            minHeight: 1080
                        }
                    } as any
                });
            } else {
                this.screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: audioConstraints
                });
            }

            if (this.useCamera) {
                try {
                    this.cameraStream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: false
                    });
                } catch (e) {
                    console.error('Camera access failed', e);
                    this.useCamera = false;
                }
            }

            this.recordedCursorPositions = [];
            this.chunks = [];
            this.mediaRecorder = new MediaRecorder(this.screenStream, {
                mimeType: 'video/webm; codecs=vp9'
            });

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) this.chunks.push(e.data);
            };

            const startTime = Date.now();
            let screenBase = { x: 0, y: 0, width: 1920, height: 1080 };
            if (this.isElectron) {
                try {
                    screenBase = await (window as any).ipcRenderer.invoke('get-primary-display');
                } catch (e) {
                    console.error('[RecordingSystem] Failed to get screen base:', e);
                }
            }

            if (this.isElectron) {
                this.cursorInterval = setInterval(async () => {
                    try {
                        const state = await (window as any).ipcRenderer.invoke('get-cursor-state');
                        const point: RecordedCursorPoint = {
                            t: Date.now() - startTime,
                            x: state.x - screenBase.x,
                            y: state.y - screenBase.y,
                            screenWidth: screenBase.width,
                            screenHeight: screenBase.height,
                            isClick: state.isClicked,
                            type: state.cursorType || 'default'
                        };
                        this.recordedCursorPositions.push(point);
                        
                        if (this.recordedCursorPositions.length % 50 === 0) {
                            console.log(`[RecordingSystem] Captured ${this.recordedCursorPositions.length} points. Local: ${point.x},${point.y}`);
                        }
                    } catch (err) {
                        console.error('[RecordingSystem] Failed to fetch cursor state:', err);
                    }
                }, 100);
            }

            this.mediaRecorder.onstop = async () => {
                if (this.cursorInterval) clearInterval(this.cursorInterval);
                const blob = new Blob(this.chunks, { type: 'video/webm' });
                
                console.log(`[RecordingSystem] Recording stopped. Total cursor points: ${this.recordedCursorPositions.length}`);
                console.log('Recorded blob size:', blob.size);
                
                globalEventBus.emit({
                    type: 'SHOW_FEEDBACK',
                    payload: { icon: 'Check', text: 'Recording saved!' }
                });

                globalEventBus.emit({
                    type: 'RECORDING_FINISHED',
                    payload: { blob, cursorData: [...this.recordedCursorPositions] }
                });

                this.cleanupStreams();
                this.isRecording = false;
                this.isPaused = false;
                this.syncToolbar();
                globalEventBus.emit({ type: 'RECORDING_STATE_CHANGED', payload: false });
            };

            this.mediaRecorder.start();
            this.isRecording = true;
            this.isPaused = false;
            this.syncToolbar();

            globalEventBus.emit({ type: 'RECORDING_STATE_CHANGED', payload: true });
            globalEventBus.emit({
                type: 'SHOW_FEEDBACK',
                payload: { icon: 'Circle', text: 'Recording started' }
            });

        } catch (err) {
            console.error('Failed to start recording', err);
            this.isRecording = false;
            globalEventBus.emit({ type: 'RECORDING_STATE_CHANGED', payload: false });
        }
    }

    public async pauseRecording() {
        if (this.mediaRecorder && this.isRecording && !this.isPaused) {
            this.mediaRecorder.pause();
            this.isPaused = true;
            this.syncToolbar();
        }
    }

    public async resumeRecording() {
        if (this.mediaRecorder && this.isRecording && this.isPaused) {
            this.mediaRecorder.resume();
            this.isPaused = false;
            this.syncToolbar();
        }
    }

    private syncToolbar() {
        if (this.isElectron) {
            (window as any).ipcRenderer.send('to-renderer', {
                channel: 'recording-status',
                data: {
                    isRecording: this.isRecording,
                    isPaused: this.isPaused,
                    useMic: this.useMic,
                    useCamera: this.useCamera
                }
            });
        }
    }

    public async stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
        }
    }

    private cleanupStreams() {
        this.screenStream?.getTracks().forEach(t => t.stop());
        this.cameraStream?.getTracks().forEach(t => t.stop());
        this.screenStream = null;
        this.cameraStream = null;
    }

    // Getters/Setters
    public getState() { 
        return {
            isRecording: this.isRecording,
            isPaused: this.isPaused,
            sources: this.sources,
            selectedSource: this.selectedSource,
            useCamera: this.useCamera,
            useMic: this.useMic,
            showPicker: this.showPicker
        };
    }

    public setSource(s: any) { 
        this.selectedSource = s; 
        globalEventBus.emit({ type: 'RECORDING_SETTINGS_UPDATED', payload: this.getState() });
    }
    public setCamera(v: boolean) { 
        this.useCamera = v; 
        this.syncToolbar();
        globalEventBus.emit({ type: 'RECORDING_SETTINGS_UPDATED', payload: this.getState() });
    }
    public setMic(v: boolean) { 
        this.useMic = v; 
        this.syncToolbar();
        globalEventBus.emit({ type: 'RECORDING_SETTINGS_UPDATED', payload: this.getState() });
    }
    public setShowPicker(v: boolean) { 
        this.showPicker = v; 
        globalEventBus.emit({ type: 'RECORDING_SETTINGS_UPDATED', payload: this.getState() });
    }
}
