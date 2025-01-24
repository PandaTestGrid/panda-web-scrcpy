import { ref, shallowRef } from 'vue';
import type { Adb, AdbDaemonDevice } from '@yume-chan/adb';

interface DeviceConnection {
  device: AdbDaemonDevice;
  adb: Adb;
}

class DevicesState {
  private connections = ref<Map<string, DeviceConnection>>(new Map());
  public errorMessage = ref<string>('');
  
  // 添加设备连接
  setDevice(serial: string, device: AdbDaemonDevice, adb: Adb) {
    const newConnections = new Map(this.connections.value);
    newConnections.set(serial, { device, adb });
    this.connections.value = newConnections;
  }

  // 移除设备连接
  removeDevice(serial: string) {
    const newConnections = new Map(this.connections.value);
    newConnections.delete(serial);
    this.connections.value = newConnections;
  }

  // 获取设备的 ADB 实例
  getAdb(serial: string): Adb | undefined {
    return this.connections.value.get(serial)?.adb;
  }

  // 获取设备实例
  getDevice(serial: string): AdbDaemonDevice | undefined {
    return this.connections.value.get(serial)?.device;
  }

  // 获取所有连接的设备
  getAllDevices(): DeviceConnection[] {
    return Array.from(this.connections.value.values());
  }

  // 检查设备是否已连接
  isDeviceConnected(serial: string): boolean {
    return this.connections.value.has(serial);
  }

  // 显示错误对话框
  showErrorDialog(message: string) {
    this.errorMessage.value = message;
  }

  // 清除错误消息
  clearError() {
    this.errorMessage.value = '';
  }

  // 断开所有设备连接
  async disconnectAll() {
    for (const [serial, connection] of this.connections.value) {
      try {
        await connection.adb.close();
      } catch (e) {
        console.error(`Error disconnecting device ${serial}:`, e);
      }
    }
    this.connections.value = new Map();
  }
}

// 创建单例实例
export const DEVICES_STATE = new DevicesState(); 