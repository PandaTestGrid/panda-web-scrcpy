import { AdbDaemonWebUsbDeviceManager } from '@yume-chan/adb-daemon-webusb';
import AdbWebCredentialStore from '@yume-chan/adb-credential-web';
import { Adb, AdbDaemonTransport, type AdbPacketData } from '@yume-chan/adb';
import { Consumable, ReadableStream, WritableStream } from '@yume-chan/stream-extra';

export interface DeviceMeta {
    serial: string;
    connect: () => Promise<{
        readable: ReadableStream<AdbPacketData>;
        writable: WritableStream<Consumable<AdbPacketData>>;
    }>;
}

export class AdbClient {
    device: Adb | undefined;
    serial: string | undefined;
    name: string | undefined;
    credentialStore: AdbWebCredentialStore;

    constructor() {
        this.credentialStore = new AdbWebCredentialStore('high-qa');
    }

    get isSupportedWebUsb() {
        return !!AdbDaemonWebUsbDeviceManager.BROWSER;
    }

    get isConnected() {
        return !!this.device;
    }

    get deviceName() {
        return this.name;
    }

    get deviceSerial() {
        return this.serial;
    }

    async connect(deviceMeta: DeviceMeta) {
        if (this.device) {
            await this.disconnect();
        }
        let readable: ReadableStream<AdbPacketData>;
        let writable: WritableStream<Consumable<AdbPacketData>>;
        try {
            const streams = await deviceMeta.connect();
            readable = streams.readable;
            writable = streams.writable;
        } catch (e: any) {
            if (typeof e === 'object' && e !== null && 'name' in e && e.name === 'NetworkError') {
                throw new Error(
                    'Failed to connect to device. Please check if the device is connected and try again.'
                );
            }
            return;
        }

        this.device = new Adb(
            await AdbDaemonTransport.authenticate({
                serial: deviceMeta.serial,
                connection: { readable, writable },
                credentialStore: this.credentialStore,
            })
        );

        return this.device;
    }

    async disconnect() {
        if (!this.device) {
            return;
        }
        await this.device.close();
        this.device = undefined;
    }

    async addUsbDevice() {
        return await AdbDaemonWebUsbDeviceManager.BROWSER!.requestDevice();
    }

    async getUsbDeviceList() {
        return await AdbDaemonWebUsbDeviceManager.BROWSER!.getDevices();
    }
}

const client = new AdbClient();
export default client;
