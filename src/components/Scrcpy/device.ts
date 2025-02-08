
// 添加必要的导入
import { Device } from './types'; // 假设有一个 Device 类型定义


// 添加 getPerformanceData 方法
export async function getPerformanceData(device: Device): Promise<{ cpuUsage: number, memoryUsage: number, fps: number }> {
  // 模拟获取性能数据的逻辑
  // 实际应用中应替换为实际的获取数据的代码
  const cpuUsage = Math.random() * 100; // 随机生成 CPU 使用率
  const memoryUsage = Math.random() * 100; // 随机生成内存使用率
  const fps = Math.random() * 60; // 随机生成 FPS

  return { cpuUsage, memoryUsage, fps };
}
