import { ref, shallowRef } from 'vue';
import type {Adb, AdbDaemonDevice} from '@yume-chan/adb';
import { Scrcpy } from './scrcpy';

interface ScrcpyConnection {
  adb: Adb;
  state: Scrcpy;
}

class ScrcpyState {
  private connections = shallowRef<Map<string, ScrcpyConnection>>(new Map());
  public errorMessage = ref<string>('');

  // 添加新的投屏连接
  async addConnection(adb: Adb, container: HTMLDivElement) {
    try {
      const state = new Scrcpy();
      state.setRendererContainer(container);
      await state.start(adb);

      this.connections.value.set(adb.serial, {
        adb,
        state
      });
    } catch (error) {
      console.error(`启动设备 ${adb.serial} 的投屏失败:`, error);
      this.errorMessage.value = `启动设备 ${adb.serial} 的投屏失败: ${error instanceof Error ? error.message : '未知错误'}`;
      throw error; // 重新抛出错误以便上层处理
    }
  }

  // 移除投屏连接
  async removeConnection(serial: string) {
    const connection = this.connections.value.get(serial);
    if (connection) {
      try {
        await connection.state.stop();
      } catch (error) {
        console.error(`停止设备 ${serial} 的投屏失败:`, error);
      }
      this.connections.value.delete(serial);
    }
  }

  // 获取特定设备的投屏状态
  getScrcpyState(serial: string): ScrcpyState | undefined {
    return this.connections.value.get(serial)?.state;
  }

  // 获取所有投屏连接
  getAllConnections(): ScrcpyConnection[] {
    return Array.from(this.connections.value.values());
  }

  // 检查设备是否已经在投屏
  isDeviceStreaming(serial: string): boolean {
    return this.connections.value.has(serial);
  }

  // 停止所有投屏
  async stopAll() {
    for (const [serial, connection] of this.connections.value) {
      try {
        await connection.state.stop();
      } catch (error) {
        console.error(`停止设备 ${serial} 的投屏失败:`, error);
      }
    }
    this.connections.value.clear();
  }

  // 显示错误信息
  showError(message: string) {
    this.errorMessage.value = message;
  }

  // 清除错误信息
  clearError() {
    this.errorMessage.value = '';
  }
}

export const SCRCPY_STATE = new ScrcpyState();
