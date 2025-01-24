<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import DevicesConnect from "../components/DevicesConnect.vue";
import BatteryInfo from "./BatteryInfo.vue";
import { DEVICES_STATE } from "../state/devices-state";
import { Adb } from "@yume-chan/adb";
import VideoContainer from "../components/VideoContainer.vue";

interface BatteryStats {
  serial: string;
  percentage: number;
  voltage: number;
  temperature: number;
}

const batteryStats = ref<Map<string, BatteryStats>>(new Map());

async function shell(device: Adb, command: string): Promise<string> {
  const subprocess = await device.subprocess.shell(command);
  const reader = subprocess.stdout.getReader();
  let result = "";
  let done = false;

  try {
    while (!done) {
      const { value, done: isDone } = await reader.read();
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
    const devices = DEVICES_STATE.getAllDevices();
    for (const { device } of devices) {
      await getBatteryInfo(device.serial);
    }
  }, updateInterval);
});

onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
  }
});
</script>

<template>
  <div class="adb-test">
    <v-container>
      <v-row>
        <v-col cols="12">
          <DevicesConnect />
        </v-col>
      </v-row>

      <v-row v-if="batteryStats.size > 0">
        <v-col
          v-for="stats in batteryStats.values()"
          :key="stats.serial"
          cols="12"
          sm="6"
          md="4"
        >
          <v-card class="device-card">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2">mdi-cellphone</v-icon>
              {{ stats.serial }}
            </v-card-title>
            <v-card-text>
              <BatteryInfo
                :battery-percentage="stats.percentage"
                :voltage="stats.voltage"
                :temperature="stats.temperature"
              />
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-row v-else>
        <v-col cols="12" class="text-center">
          <v-card class="empty-state pa-6">
            <v-icon size="64" color="grey-lighten-1">mdi-devices</v-icon>
            <div class="text-h6 mt-4 grey--text text--darken-1">
              没有连接的设备
            </div>
            <div class="text-body-2 mt-2 grey--text">
              请先连接设备以查看电池信息
            </div>
          </v-card>
        </v-col>
      </v-row>

      <!-- 添加投屏区域 -->
      <v-row v-if="DEVICES_STATE.getAllDevices().length > 0">
        <v-col
          v-for="{ device } in DEVICES_STATE.getAllDevices()"
          :key="device.serial"
          cols="12"
          sm="6"
          md="4"
        >
          <v-card class="screen-card">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2">mdi-monitor</v-icon>
              {{ device.serial }}
            </v-card-title>
            <v-card-text class="screen-container">
              <VideoContainer :device-serial="device.serial" />
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<style scoped>
.adb-test {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding: 20px 0;
}

.device-card {
  height: 100%;
  transition: transform 0.2s, box-shadow 0.2s;
}

.device-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  background-color: white;
  border-radius: 8px;
}

.screen-card {
  height: 100%;
  min-height: 300px;
}

.screen-container {
  height: 250px;
  position: relative;
}
</style>
