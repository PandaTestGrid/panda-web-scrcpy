<template>
  <v-card class="battery-card" flat>
    <v-card-text class="pa-6">
      <div class="text-h6 font-weight-regular mb-4">电池</div>
      <div
          class="d-flex flex-column align-center justify-center"
          style="height: 180px"
      >
        <div class="battery-circle">
          <div class="battery-background"></div>
          <div class="battery-level" :style="batteryLevelStyle"></div>
          <div class="battery-text">{{ batteryPercentage }}%</div>
        </div>
        <div class="mt-4 text-subtitle-1">
          {{ formattedVoltage }}V {{ temperature }}°C
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref} from 'vue';
import {DEVICES_STATE} from "../state";
import {Adb} from "@yume-chan/adb";

const props = defineProps<{
  deviceSerial: string;
}>();

interface BatteryStats {
  serial: string;
  percentage: number;
  voltage: number;
  temperature: number;
}

const batteryStats = ref<Map<string, BatteryStats>>(new Map());

async function shell(adb: Adb, command: string): Promise<string> {
  const subprocess = await adb.subprocess.shell(command);
  const reader = subprocess.stdout.getReader();
  let result = "";
  let done = false;

  try {
    while (!done) {
      const {value, done: isDone} = await reader.read();
      done = isDone;
      if (value) {
        result += new TextDecoder().decode(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  await subprocess.exit;
  return result.trim();
}

// 获取电池信息
const getBatteryInfo = async (serial: string) => {
  try {
    const adb = DEVICES_STATE.getAdb(serial);
    if (!adb) return;
    const text = await shell(adb, ["dumpsys", "battery"]);
    // 解析电池信息
    const level = Number(text.match(/level: (\d+)/)?.[1] || 0);
    const voltage = Number(text.match(/voltage: (\d+)/)?.[1] || 0) / 1000;
    const temperature = Number(text.match(/temperature: (\d+)/)?.[1] || 0) / 10;

    batteryStats.value.set(serial, {
      serial,
      percentage: level,
      voltage,
      temperature,
    });
  } catch (error) {
    console.error(`获取电池信息失败 (${serial}):`, error);
  }
};

const batteryLevelStyle = computed(() => {
  return {
    height: `${props.batteryPercentage}%`,
  }
});

const formattedVoltage = computed(() => {
  return isNaN(props.voltage) ? '0.000' : props.voltage.toFixed(3);
});

// 监听设备连接状态变化
watch(
  () => DEVICES_STATE.getAllDevices(),
  async (devices) => {
    // 清理已断开设备的电池信息
    for (const serial of batteryStats.value.keys()) {
      if (!devices.some((d) => d.device.serial === serial)) {
        batteryStats.value.delete(serial);
      }
    }
    // 获取新连接设备的电池信息
    for (const { device } of devices) {
      await getBatteryInfo(device.serial);
    }
  },
  { deep: true }
);

// 定期更新电池信息
const updateInterval = 1000; // 5秒更新一次
let timer: NodeJS.Timer | undefined;

onMounted(() => {
  timer = setInterval(async () => {
    await getBatteryInfo(props.deviceSerial);
  }, updateInterval);
});

onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
  }
});
</script>

<style scoped>
.battery-card {
  background: white;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  min-width: 280px;
}

.battery-circle {
  position: relative;
  width: 140px;
  height: 140px;
  border-radius: 50%;
  overflow: hidden;
  margin: 0 auto;
}

.battery-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.05);
}

.battery-level {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  background: linear-gradient(to bottom, #ef5350, #42a5f5);
  transition: height 0.3s ease;
}

.battery-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 24px;
  font-weight: 500;
  z-index: 2;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
</style>
