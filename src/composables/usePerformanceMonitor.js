import { ref, computed } from 'vue';

export function usePerformanceMonitor() {
  // 初始化基础数据
  const cpuCores = ref(Array(8).fill().map((_, index) => ({
    core: index,
    usage: 0,
    frequency: 0,
    history: Array(50).fill(0)
  })));
  
  const totalCpuUsage = ref(0);
  const memoryUsage = ref(0);
  const totalMemory = ref(0);
  const usedMemory = ref(0);
  const fps = ref(0);
  
  // 历史数据
  const cpuData = ref(Array(50).fill(0));
  const memoryData = ref(Array(50).fill(0));
  const fpsData = ref(Array(50).fill(0));

  // 更新性能数据
  const updatePerformanceData = async () => {
    try {
      const data = await fetchPerformanceData(); // 假设这是你的数据获取函数
      
      // 更新 CPU 数据
      if (data.cpuUsage !== null) {
        totalCpuUsage.value = data.cpuUsage;
      }
      
      // 更新 CPU 核心数据
      if (data.cpuCoreInfo) {
        data.cpuCoreInfo.forEach((core, index) => {
          if (index < cpuCores.value.length) {
            cpuCores.value[index] = {
              ...cpuCores.value[index],
              usage: core.usage || 0,
              frequency: core.frequency || 0
            };
          }
        });
      }
      
      // 更新内存数据
      if (data.memInfo) {
        const { total, used } = data.memInfo;
        totalMemory.value = total || 0;
        usedMemory.value = used || 0;
        memoryUsage.value = total ? (used / total) * 100 : 0;
      }
      
      // 更新 FPS
      fps.value = data.fps || 0;
      
      // 更新历史数据
      cpuData.value = [...cpuData.value.slice(1), totalCpuUsage.value];
      memoryData.value = [...memoryData.value.slice(1), memoryUsage.value];
      fpsData.value = [...fpsData.value.slice(1), fps.value];
      
    } catch (error) {
      console.error('Failed to update performance data:', error);
    }
  };

  return {
    cpuCores,
    totalCpuUsage,
    memoryUsage,
    totalMemory,
    usedMemory,
    fps,
    cpuData,
    memoryData,
    fpsData,
    updatePerformanceData
  };
}
