import { MatroskaMuxingRecorder } from './matroska';
import type { ScrcpyMediaStreamPacket, ScrcpyVideoStreamMetadata } from '@yume-chan/scrcpy';

export interface RecordingState {
    isRecording: boolean;
    currentTime: string;
    canRecord: boolean;
}

export class VideoRecorder {
    private recorder: MatroskaMuxingRecorder;
    private isRecording: boolean;
    private recordingTime: number;
    private intervalId: number | null;
    private stateChangeCallbacks: ((state: RecordingState) => void)[];
    private packetCount: number;

    constructor() {
        this.recorder = new MatroskaMuxingRecorder();
        this.isRecording = false;
        this.recordingTime = 0;
        this.intervalId = null;
        this.stateChangeCallbacks = [];
        this.packetCount = 0;
    }

    public get canRecord(): boolean {
        return this.recorder.videoMetadata !== undefined;
    }

    public get recording(): boolean {
        return this.isRecording;
    }

    public get currentRecordingTime(): number {
        return this.recordingTime;
    }

    public formatTime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    public onStateChange(callback: (state: RecordingState) => void): () => void {
        this.stateChangeCallbacks.push(callback);
        callback(this.getCurrentState());
        return () => {
            const index = this.stateChangeCallbacks.indexOf(callback);
            if (index !== -1) {
                this.stateChangeCallbacks.splice(index, 1);
            }
        };
    }

    private notifyStateChange(): void {
        const state = this.getCurrentState();
        this.stateChangeCallbacks.forEach((callback) => {
            try {
                callback(state);
            } catch (error) {
                console.error('Error in recording state change callback:', error);
            }
        });
    }

    private getCurrentState(): RecordingState {
        return {
            isRecording: this.isRecording,
            currentTime: this.formatTime(this.recordingTime),
            canRecord: this.canRecord,
        };
    }

    public startRecording(): void {
        if (!this.canRecord) {
            const error = new Error('Cannot start recording: video metadata is not set');
            console.error(error);
            throw error;
        }
        if (this.isRecording) {
            console.warn('Recording is already in progress');
            return;
        }
        try {
            this.recorder.start();
            this.isRecording = true;
            this.packetCount = 0;
            this.intervalId = window.setInterval(() => {
                this.recordingTime++;
                this.notifyStateChange();
            }, 1000);
            this.notifyStateChange();
            console.log('Recording started successfully');
        } catch (error) {
            this.isRecording = false;
            this.recordingTime = 0;
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
            console.error('Failed to start recording:', error);
            throw error;
        }
    }

    public stopRecording(): void {
        if (!this.isRecording) {
            console.warn('No recording in progress');
            return;
        }
        try {
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
            this.recorder.stop();
            console.log(`Recording stopped. Total packets processed: ${this.packetCount}`);
            this.isRecording = false;
            this.recordingTime = 0;
            this.packetCount = 0;
            this.notifyStateChange();
        } catch (error) {
            console.error('Error stopping recording:', error);
            this.isRecording = false;
            this.recordingTime = 0;
            this.packetCount = 0;
            this.notifyStateChange();
            throw error;
        }
    }

    public toggleRecording(): void {
        try {
            if (this.isRecording) {
                this.stopRecording();
            } else {
                this.startRecording();
            }
        } catch (error) {
            console.error('Error toggling recording:', error);
            throw error;
        }
    }

    public addVideoPacket(packet: ScrcpyMediaStreamPacket): void {
        if (!packet) {
            console.warn('Received empty video packet');
            return;
        }
        if (!this.isRecording) {
            return;
        }
        try {
            this.recorder.addVideoPacket(packet);
            this.packetCount++;
            if (this.packetCount % 100 === 0) {
                console.log(`Processed ${this.packetCount} video packets`);
            }
        } catch (error) {
            console.error('Error adding video packet:', error);
        }
    }

    public setVideoMetadata(metadata: ScrcpyVideoStreamMetadata): void {
        if (!metadata) {
            console.warn('Received empty video metadata');
            return;
        }
        try {
            this.recorder.videoMetadata = metadata;
            this.notifyStateChange();
            console.log('Video metadata set successfully:', metadata);
        } catch (error) {
            console.error('Error setting video metadata:', error);
            throw error;
        }
    }

    public dispose(): void {
        try {
            if (this.isRecording) {
                this.stopRecording();
            }
            this.stateChangeCallbacks = [];
            console.log('Recorder disposed successfully');
        } catch (error) {
            console.error('Error disposing recorder:', error);
            this.stateChangeCallbacks = [];
        }
    }
}

// 创建单例实例
const recorder = new VideoRecorder();
export default recorder;
