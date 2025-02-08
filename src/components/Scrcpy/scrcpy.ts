// 导入外部依赖
import { AdbDaemonWebUsbDevice } from '@yume-chan/adb-daemon-webusb';
import { AdbScrcpyClient, AdbScrcpyOptionsLatest } from '@yume-chan/adb-scrcpy';
import { VERSION } from '@yume-chan/fetch-scrcpy-server';
import { PcmPlayer } from '@yume-chan/pcm-player';
import {
    clamp,
    CodecOptions,
    h264ParseConfiguration,
    ScrcpyHoverHelper,
    ScrcpyInstanceId,
    ScrcpyLogLevel,
    ScrcpyOptionsLatest,
    ScrcpyVideoCodecId,
    ScrcpyVideoOrientation,
    DEFAULT_SERVER_PATH,
} from '@yume-chan/scrcpy';
import type {
    ScrcpyMediaStreamPacket,
    ScrcpyMediaStreamConfigurationPacket,
    ScrcpyMediaStreamDataPacket,
} from '@yume-chan/scrcpy';
import {Consumable, InspectStream, ReadableStream, WritableStream} from '@yume-chan/stream-extra';
import {WebCodecsVideoDecoder} from '@yume-chan/scrcpy-decoder-webcodecs';

// 导入本地依赖
import {ScrcpyKeyboardInjector} from './input';
import recorder from './recorder';

// @ts-ignore
import SCRCPY_SERVER_BIN from '../../../public/scrcpy-server-v2.6.1?binary';

// 类型定义
type RotationListener = (rotation: number, prevRotation: number) => void;

// 常量定义
const DEFAULT_VIDEO_CODEC = 'h264';
const DEFAULT_MAX_SIZE = 1920;
const DEFAULT_DISPLAY_ID = 0;
const DEFAULT_POWER_ON = true;
const DEFAULT_BORDER_WIDTH = 6;
const DEFAULT_FPS = 30;
const DEFAULT_BITRATE = 8000000;

export class Scrcpy {
    // 基本状态
    running = false;
    rendererContainer: HTMLDivElement | null = null;
    canvas?: HTMLCanvasElement;
    isFullScreen = false;
    width = 0;
    height = 0;
    private _rotation = 0;
    private rotationListeners: RotationListener[] = [];
    // 解码器和视频相关
    decoder: WebCodecsVideoDecoder | undefined = undefined;
    videoCodec: 'h264' | 'h265' = DEFAULT_VIDEO_CODEC;
    videoBitRate = DEFAULT_BITRATE;
    maxSize = DEFAULT_MAX_SIZE;
    maxFps = DEFAULT_FPS;
    lockVideoOrientation = ScrcpyVideoOrientation.Unlocked;
    displayId = DEFAULT_DISPLAY_ID;
    powerOn = DEFAULT_POWER_ON;

    // 设备和连接相关
    device: AdbDaemonWebUsbDevice | undefined = undefined;
    scrcpy: AdbScrcpyClient | undefined = undefined;
    hoverHelper: ScrcpyHoverHelper | undefined = undefined;
    keyboard: ScrcpyKeyboardInjector | undefined = undefined;
    audioPlayer: PcmPlayer<unknown> | undefined = undefined;

    // 性能指标
    fps = '0';
    bitRatesCount = 0;
    connecting = false;

    constructor() {
        // 添加默认的旋转监听器
        this.addRotationListener((rotation: number, prevRotation: number) => {
            console.log(`屏幕旋转从 ${prevRotation} 变为 ${rotation}`);
        });
    }

    // 旋转相关方法
    get rotation(): number {
        return this._rotation;
    }

    set rotation(value: number) {
        if (this._rotation !== value) {
            const prevRotation = this._rotation;
            this._rotation = value;
            // 通知所有监听器
            this.rotationListeners.forEach((listener) => {
                try {
                    listener(value, prevRotation);
                } catch (error) {
                    console.error('旋转监听器出错:', error);
                }
            });
            // 触发视频容器重新调整大小
            this.updateVideoContainer();
        }
    }

    get rotatedWidth(): number {
        return this.rotation & 1 ? this.height : this.width;
    }

    get rotatedHeight(): number {
        return this.rotation & 1 ? this.width : this.height;
    }

    // 添加旋转监听器
    addRotationListener(listener: RotationListener): void {
        this.rotationListeners.push(listener);
    }

    // 移除旋转监听器
    removeRotationListener(listener: RotationListener): void {
        const index = this.rotationListeners.indexOf(listener);
        if (index !== -1) {
            this.rotationListeners.splice(index, 1);
        }
    }

    // 更新视频容器
    updateVideoContainer(): void {
        if (!this.canvas || !this.rendererContainer) {
            return;
        }

        const containerRect = this.rendererContainer.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;

        if (
            containerWidth === 0 ||
            containerHeight === 0 ||
            this.width === 0 ||
            this.height === 0
        ) {
            return;
        }

        const containerAspectRatio = containerWidth / containerHeight;
        const videoAspectRatio = this.width / this.height;

        let width: number;
        let height: number;

        // 计算实际视频尺寸，考虑边框宽度
        if (containerAspectRatio > videoAspectRatio) {
            // 以高度为基准
            height = containerHeight - DEFAULT_BORDER_WIDTH;
            width = height * videoAspectRatio;
        } else {
            // 以宽度为基准
            width = containerWidth - DEFAULT_BORDER_WIDTH;
            height = width / videoAspectRatio;
        }

        // 设置视频尺寸
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        // 设置变换原点和位置
        this.canvas.style.transformOrigin = 'center';
        this.canvas.style.position = 'absolute';
        this.canvas.style.left = '50%';
        this.canvas.style.top = '50%';
        this.canvas.style.backgroundColor = 'transparent';

        // 根据旋转角度设置变换
        let transform = 'translate(-50%, -50%)';
        switch (this.rotation) {
            case 1: // 90度
                transform += ' rotate(90deg)';
                // 交换宽高
                [this.canvas.style.width, this.canvas.style.height] = [`${height}px`, `${width}px`];
                break;
            case 2: // 180度
                transform += ' rotate(180deg)';
                break;
            case 3: // 270度
                transform += ' rotate(270deg)';
                // 交换宽高
                [this.canvas.style.width, this.canvas.style.height] = [`${height}px`, `${width}px`];
                break;
        }
        this.canvas.style.transform = transform;

        // 设置其他样式
        this.canvas.style.maxWidth = '100%';
        this.canvas.style.maxHeight = '100%';
        this.canvas.style.objectFit = 'contain';
        this.canvas.style.pointerEvents = 'auto';
    }

    // 服务器相关方法
    async pushServer(): Promise<void> {
        if (!this.device) {
            console.error('设备不可用');
            return;
        }

        try {
            console.log('开始推送服务器...', new Uint8Array(SCRCPY_SERVER_BIN).length);
            const stream = new ReadableStream<Consumable<Uint8Array>>({
                start(controller) {
                    controller.enqueue(new Consumable(new Uint8Array(SCRCPY_SERVER_BIN)));
                    controller.close();
                },
            });

            await AdbScrcpyClient.pushServer(this.device as any, stream);
        } catch (error) {
            console.error('推送服务器失败:', error);
        }
    }

    // 数据包类型检查
    private isConfigurationPacket(
        packet: ScrcpyMediaStreamPacket
    ): packet is ScrcpyMediaStreamConfigurationPacket {
        return packet.type === 'configuration';
    }

    private isDataPacket(packet: ScrcpyMediaStreamPacket): packet is ScrcpyMediaStreamDataPacket {
        return packet.type === 'data';
    }

    // 启动方法
    async start(device: USBDevice) {
        if (!device || this.rendererContainer === undefined) {
            throw new Error('无效的参数');
        }
        this.device = device;
        try {
            if (!this.decoder) {
                throw new Error('没有可用的解码器');
            }
            this.connecting = true;
            await this.pushServer();
            const videoCodecOptions = new CodecOptions();
            const options = new AdbScrcpyOptionsLatest(
                new ScrcpyOptionsLatest({
                    maxSize: this.maxSize,
                    videoBitRate: this.videoBitRate,
                    videoCodec: this.videoCodec,
                    maxFps: this.maxFps,
                    lockVideoOrientation: this.lockVideoOrientation,
                    displayId: this.displayId,
                    powerOn: this.powerOn,
                    audio: false, // 禁用音频
                    logLevel: ScrcpyLogLevel.Debug,
                    scid: ScrcpyInstanceId.random(),
                    sendDeviceMeta: false,
                    sendDummyByte: false,
                    videoCodecOptions,
                })
            );

            this.scrcpy = await AdbScrcpyClient.start(
                this.device as any,
                DEFAULT_SERVER_PATH,
                VERSION,
                options
            );

            if (!this.scrcpy) {
                throw new Error('启动 core 客户端失败');
            }

            this.scrcpy.stdout.pipeTo(
                new WritableStream<string>({
                    write(chunk) {
                        console.log(`[服务器] ${chunk}`);
                    },
                })
            );

            if (this.scrcpy.videoStream) {
                const videoStream = await this.scrcpy.videoStream;
                const {metadata: videoMetadata, stream: videoPacketStream} = videoStream;
                // 初始化视频大小
                this.width = videoMetadata.width ?? 0;
                this.height = videoMetadata.height ?? 0;
                this.rotation = 0; // 初始化为0，后续通过元数据更新

                // 设置录制器的视频元数据
                recorder.setVideoMetadata(videoMetadata);

                if (this.decoder && videoPacketStream) {
                    videoPacketStream
                        .pipeThrough(
                            new InspectStream((packet: ScrcpyMediaStreamPacket) => {
                                // 将数据包传递给录制器
                                recorder.addVideoPacket(packet);
                                try {
                                    if (this.isConfigurationPacket(packet)) {
                                        try {
                                            const {croppedWidth, croppedHeight} =
                                                h264ParseConfiguration(packet.data);
                                            if (croppedWidth > 0 && croppedHeight > 0) {
                                                this.width = croppedWidth;
                                                this.height = croppedHeight;
                                                // 更新视频容器大小
                                                this.updateVideoContainer();
                                            }
                                        } catch (error) {
                                            console.error('解析配置出错:', error);
                                        }
                                    } else if (this.isDataPacket(packet)) {
                                        // 更新屏幕旋转状态
                                        const metadata = packet.data;
                                        if (
                                            metadata &&
                                            typeof metadata === 'object' &&
                                            'rotation' in metadata
                                        ) {
                                            const rotation = (metadata as { rotation: number })
                                                .rotation;
                                            if (
                                                typeof rotation === 'number' &&
                                                rotation >= 0 &&
                                                rotation <= 3
                                            ) {
                                                this.rotation = rotation;
                                            }
                                        }
                                        if (packet.data instanceof Uint8Array) {
                                            this.bitRatesCount += packet.data.byteLength;
                                        }
                                    }
                                } catch (error) {
                                    console.error('处理数据包出错:', error);
                                }
                            })
                        )
                        .pipeTo(this.decoder.writable)
                        .catch((error) => {
                            console.error('处理数据包出错:', error);
                        });
                }
            }

            this.keyboard = new ScrcpyKeyboardInjector(this.scrcpy);
            this.hoverHelper = new ScrcpyHoverHelper();
            this.scrcpy.exit.then(() => this.dispose());

            this.running = true;
            return this.scrcpy;
        } catch (e) {
            console.error(e);
            this.connecting = false;
            this.dispose();
            return;
        }
    }

    // 停止方法
    async stop() {
        // 首先请求关闭客户端
        await this.scrcpy?.close();
        this.dispose();
    }

    // 清理方法
    dispose(): void {
        // 否则一些数据包可能仍会到达解码器
        this.decoder?.dispose();
        this.decoder = undefined;
        this.keyboard?.dispose();
        this.keyboard = undefined;

        this.audioPlayer?.stop();
        this.audioPlayer = undefined;

        this.fps = '0';

        if (this.isFullScreen) {
            document.exitFullscreen();
            this.isFullScreen = false;
        }

        this.scrcpy = undefined;
        this.device = undefined;
        this.canvas = undefined;
        this.running = false;
        // 清空旋转监听器
        this.rotationListeners = [];
    }

    setRendererContainer(container: HTMLDivElement): void {
        // 移除旧的容器及其内容
        const oldContainer = this.rendererContainer;
        if (oldContainer) {
            if (oldContainer.parentNode && oldContainer.parentNode.contains(oldContainer)) {
                oldContainer.remove(); // 更安全的方式移除节点
            }
        }

        // 清除旧的解码器及其渲染器
        if (this.decoder?.renderer) {
            console.log('渲染器容器已更改', this.decoder);
            if (container.contains(this.decoder.renderer)) {
                container.removeChild(this.decoder.renderer);
            }
            this.decoder.dispose(); // 确保释放资源
            this.decoder = null;
        }

        this.rendererContainer = container;

        // 确保容器可以正确定位子元素
        container.style.position = 'relative';
        container.style.overflow = 'hidden';
        container.style.backgroundColor = 'transparent';

        // 创建新的解码器并附加渲染器
        this.decoder = new WebCodecsVideoDecoder(ScrcpyVideoCodecId.H264, false);
        if (this.decoder?.renderer) {
            container.appendChild(this.decoder.renderer);
            this.canvas = this.decoder.renderer;
        }

        // 初始化视频容器
        this.updateVideoContainer();
    }

    getCanvas(): HTMLCanvasElement | undefined {
        if (!this.scrcpy) {
            return;
        }
        return this.canvas;
    }

    clientPositionToDevicePosition(clientX: number, clientY: number): { x: number; y: number } {
        const viewRect = this.canvas!.getBoundingClientRect();
        let pointerViewX = clamp((clientX - viewRect.x) / viewRect.width, 0, 1);
        let pointerViewY = clamp((clientY - viewRect.y) / viewRect.height, 0, 1);

        if (this.rotation & 1) {
            [pointerViewX, pointerViewY] = [pointerViewY, pointerViewX];
        }
        switch (this.rotation) {
            case 1:
                pointerViewY = 1 - pointerViewY;
                break;
            case 2:
                pointerViewX = 1 - pointerViewX;
                pointerViewY = 1 - pointerViewY;
                break;
            case 3:
                pointerViewX = 1 - pointerViewX;
                break;
        }

        return {
            x: pointerViewX * this.width,
            y: pointerViewY * this.height,
        };
    }
}

const state = new Scrcpy();
export default state;
