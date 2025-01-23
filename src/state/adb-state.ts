import { Adb, AdbDaemonDevice, AdbPacketData } from "@yume-chan/adb";
export type PacketLogItemDirection = "in" | "out";

export interface PacketLogItem extends AdbPacketData {
    direction: PacketLogItemDirection;
    timestamp?: Date;
    commandString?: string;
    arg0String?: string;
    arg1String?: string;
    payloadString?: string;
}

export class AdbState {
    private _device: any = undefined;
    private _adb: Adb | undefined = undefined;

    setDevice(device: AdbDaemonDevice | undefined, adb: Adb | undefined) {
        this._device = device;
        this._adb = adb;
    }

    getDevice(): any {
        return this._device;
    }

    getAdb(): Adb | undefined {
        return this._adb;
    }

    appendLog(item: PacketLogItem) {
        // 记录到控制台以便调试
        console.info(item);
    }

    showErrorDialog(error: Error | string) {
        const message = error instanceof Error ? error.message : error;
        // 记录到控制台以便调试
        console.info('Error:' +  message);
    }
}

// 创建全局单例
export const ADB_STATE = new AdbState();

