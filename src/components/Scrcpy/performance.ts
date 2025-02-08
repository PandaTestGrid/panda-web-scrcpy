import { Adb } from '@yume-chan/adb';

export async function getDevicePerformance(device: Adb) {
   if (!device) {
      throw new Error('Device not connected');
   }

   const subprocess = device.subprocess;

   // 获取 CPU 核心数
   let cpuInfoOutput;
   try {
      cpuInfoOutput = await subprocess.spawnAndWait(['cat', '/proc/cpuinfo']);
   } catch (error) {
      throw new Error('Failed to get CPU info: ' + error.message);
   }
   const cpuCores = cpuInfoOutput.match(/processor\s+:/g)?.length || 1;

   // 获取 CPU 使用率和频率
   let cpuOutput;
   try {
      cpuOutput = await subprocess.spawnAndWait(['top', '-n', '1', '-b']);
   } catch (error) {
      throw new Error('Failed to get CPU usage: ' + error.message);
   }
   const cpuUsage = (() => {
      const match = cpuOutput.match(/(\d+\.?\d*)%\s+us/);
      return match ? parseFloat(match[1]) : null;
   })();

   const cpuCoreInfo = [];
   for (let i = 0; i < cpuCores; i++) {
      let freqOutput;
      try {
         freqOutput = await subprocess.spawnAndWait(['cat', `/sys/devices/system/cpu/cpu${i}/cpufreq/scaling_cur_freq`]);
      } catch (error) {
         throw new Error(`Failed to get frequency for CPU${i}: ` + error.message);
      }
      const frequency = parseInt(freqOutput.trim()) / 1000; // Convert to MHz
      const coreUsageMatch = cpuOutput.match(new RegExp(`CPU${i}\\s+(\\d+\\.?\\d*)%`));
      const coreUsage = coreUsageMatch ? parseFloat(coreUsageMatch[1]) : null;
      cpuCoreInfo.push({ core: i, frequency, usage: coreUsage });
   }

   // 获取内存使用情况
   let memOutput;
   try {
      memOutput = await subprocess.spawnAndWait(['cat', '/proc/meminfo']);
   } catch (error) {
      throw new Error('Failed to get memory info: ' + error.message);
   }
   const memInfo = (() => {
      const total = memOutput.match(/MemTotal:\s+(\d+)/);
      const free = memOutput.match(/MemFree:\s+(\d+)/);
      const available = memOutput.match(/MemAvailable:\s+(\d+)/);
      return {
         total: total ? parseInt(total[1]) : null,
         free: free ? parseInt(free[1]) : null,
         available: available ? parseInt(available[1]) : null
      };
   })();

   // 获取 FPS 数据
   let fpsOutput;
   try {
      fpsOutput = await subprocess.spawnAndWait(['dumpsys', 'SurfaceFlinger', '--latency', 'SurfaceView']);
   } catch (error) {
      throw new Error('Failed to get FPS data: ' + error.message);
   }
   const fpsLines = fpsOutput.trim().split('\n');
   let fps = 0;
   if (fpsLines.length > 1) {
      const timestamps = fpsLines.slice(1).map(line => parseInt(line.split('\t')[0]));
      const frameTimes = [];
      for (let i = 1; i < timestamps.length; i++) {
         frameTimes.push(timestamps[i] - timestamps[i - 1]);
      }
      const averageFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      fps = Math.round(1000000000 / averageFrameTime); // Convert nanoseconds to FPS
   }

   return {
      cpuUsage,
      cpuCoreInfo,
      memInfo,
      fps
   };
}
