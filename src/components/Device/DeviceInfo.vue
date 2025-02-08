<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import DeviceBasicInfo from "./DeviceBasicInfo.vue";
import BatteryInfo from "./BatteryInfo.vue";
import StorageInfo from "./StorageInfo.vue";
import client from "../Scrcpy/client";
import { Adb } from "@yume-chan/adb";

const device = computed(() => client.device || undefined);
const isLoading = ref(true);

const deviceInfo = ref({
  deviceModel: "",
  manufacturer: "",
  androidVersion: "",
  sdkVersionCode: "",
  resolution: "",
  screenDensity: "",
  ipAddress: "",
  totalMemory: "",
  usedMemory: "",
  totalStorage: "",
  usedStorage: "",
  serialNumber: "",
  cpuInfo: "",
  cpuMin: "",
  cpuMax: "",
  cpuCur: "",
  brand: "",
  product: "",
  board: "",
  display: "",
  id: "",
  fingerPrint: "",
  host: "",
  hardware: "",
  device: "",
  user: "",
  radioVersion: "",
  tags: "",
  type: "",
  basebandVer: "",
  cpuAbi: "",
  abis: "",
  batteryPercentage: 0,
  voltage: 0,
  temperature: 0,
  bootloader: "",
  abPartition: "",
  uptime: "",
  storageType: "",
  kernelVersion: "",
});

async function executeShellCommand(
  device: Adb,
  command: string
): Promise<string> {
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

async function getDeviceInfo() {
  if (!device.value) return;

  const adbDevice = device.value;

  deviceInfo.value = {
    deviceModel: await adbDevice.getProp("ro.product.model"),
    manufacturer: await adbDevice.getProp("ro.product.manufacturer"),
    androidVersion: await adbDevice.getProp("ro.build.version.release"),
    sdkVersionCode: await adbDevice.getProp("ro.build.version.sdk"),
    resolution: await executeShellCommand(
      adbDevice,
      "wm size | awk '{print $3}'"
    ),
    screenDensity: await adbDevice.getProp("ro.sf.lcd_density"),
    ipAddress: await executeShellCommand(
      adbDevice,
      "ip addr show wlan0 | grep 'inet ' | cut -d' ' -f6 | cut -d/ -f1"
    ),
    totalMemory: `${await executeShellCommand(
      adbDevice,
      "free -m | awk '/Mem:/ {print $2}'"
    )} MB`,
    usedMemory: await executeShellCommand(
      adbDevice,
      "free -m | awk '/Mem:/ {print $3}'"
    ),
    totalStorage: await executeShellCommand(
      adbDevice,
      "df -h /data | awk '/\\/data/ {print $2}'"
    ),
    usedStorage: await executeShellCommand(
      adbDevice,
      "df -h /data | awk '/\\/data/ {print $3}'"
    ),
    serialNumber: await adbDevice.getProp("ro.serialno"),
    cpuInfo: await adbDevice.getProp("ro.hardware"),
    cpuMin: await executeShellCommand(
      adbDevice,
      "cat /sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_min_freq"
    ),
    cpuMax: await executeShellCommand(
      adbDevice,
      "cat /sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq"
    ),
    cpuCur: await executeShellCommand(
      adbDevice,
      "cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq"
    ),
    brand: await adbDevice.getProp("ro.product.brand"),
    product: await adbDevice.getProp("ro.product.name"),
    board: await adbDevice.getProp("ro.product.board"),
    display: await adbDevice.getProp("ro.build.display.id"),
    id: await adbDevice.getProp("ro.build.id"),
    fingerPrint: await adbDevice.getProp("ro.build.fingerprint"),
    host: await adbDevice.getProp("ro.build.host"),
    hardware: await adbDevice.getProp("ro.hardware"),
    device: await adbDevice.getProp("ro.product.device"),
    user: await adbDevice.getProp("ro.build.user"),
    radioVersion: await adbDevice.getProp("gsm.version.baseband"),
    tags: await adbDevice.getProp("ro.build.tags"),
    type: await adbDevice.getProp("ro.build.type"),
    basebandVer: await adbDevice.getProp("gsm.version.baseband"),
    cpuAbi: await adbDevice.getProp("ro.product.cpu.abi"),
    abis: await adbDevice.getProp("ro.product.cpu.abilist"),
    batteryPercentage: parseInt(
      await executeShellCommand(
        adbDevice,
        "dumpsys battery | grep level | awk '{print $2}'"
      ),
      10
    ),
    voltage:
      parseFloat(
        (await executeShellCommand(
          adbDevice,
          "dumpsys battery | grep voltage | awk '{print $2}'"
        )) || "0"
      ) / 1000,
    temperature:
      parseInt(
        await executeShellCommand(
          adbDevice,
          "dumpsys battery | grep temperature | awk '{print $2}'"
        ),
        10
      ) / 10,
    bootloader: await executeShellCommand(
      adbDevice,
      "getprop ro.boot.verifiedbootstate"
    ),
    abPartition: await executeShellCommand(
      adbDevice,
      "getprop ro.boot.slot_suffix"
    ),
    uptime: await executeShellCommand(
      adbDevice,
      "cat /proc/uptime | cut -d. -f1"
    ),
    storageType: await executeShellCommand(
      adbDevice,
      "getprop ro.boot.bootdevice"
    ),
    kernelVersion: await executeShellCommand(adbDevice, "uname -r"),
  };
}

const openSettings = async () => {
  if (!device.value) return;
  await executeShellCommand(
    device.value,
    "am start -a android.settings.SETTINGS"
  );
};

const openDeveloperOptions = async () => {
  if (!device.value) return;
  await executeShellCommand(
    device.value,
    "am start -a android.settings.APPLICATION_DEVELOPMENT_SETTINGS"
  );
};

const openBrowser = async () => {
  if (!device.value) return;
  await executeShellCommand(
    device.value,
    'am start -a android.intent.action.VIEW -d "http://www.google.com"'
  );
};

const openWifiSettings = async () => {
  if (!device.value) return;
  await executeShellCommand(
    device.value,
    "am start -a android.settings.WIFI_SETTINGS"
  );
};

const openDisplaySettings = async () => {
  if (!device.value) return;
  await executeShellCommand(
    device.value,
    "am start -a android.settings.DISPLAY_SETTINGS"
  );
};

const openSoundSettings = async () => {
  if (!device.value) return;
  await executeShellCommand(
    device.value,
    "am start -a android.settings.SOUND_SETTINGS"
  );
};

const openAppSettings = async () => {
  if (!device.value) return;
  await executeShellCommand(
    device.value,
    "am start -a android.settings.APPLICATION_SETTINGS"
  );
};

const openAboutPhone = async () => {
  if (!device.value) return;
  await executeShellCommand(
    device.value,
    "am start -a android.settings.DEVICE_INFO_SETTINGS"
  );
};

const refreshDeviceInfo = async () => {
  isLoading.value = true;
  try {
    await getDeviceInfo();
  } finally {
    isLoading.value = false;
  }
};

onMounted(async () => {
  if (client.isConnected) {
    await getDeviceInfo();
    isLoading.value = false;
  } else {
    console.error("Device not connected");
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="device-info">
    <div class="info-container">
      <v-fade-transition mode="out-in">
        <div v-if="isLoading" :key="'loading'" class="info-grid">
          <div class="info-main">
            <v-skeleton-loader
              type="article, actions"
              class="skeleton-card"
            ></v-skeleton-loader>
          </div>
          <div class="info-side">
            <v-skeleton-loader
              type="card"
              class="skeleton-card"
            ></v-skeleton-loader>
            <v-skeleton-loader
              type="card"
              class="skeleton-card"
            ></v-skeleton-loader>
          </div>
        </div>
        <div v-else :key="'content'" class="info-grid">
          <div class="info-main">
            <div class="basic-info-container">
              <DeviceBasicInfo :deviceInfo="deviceInfo" />
              <v-btn
                class="refresh-btn"
                icon="mdi-refresh"
                variant="text"
                :loading="isLoading"
                @click="refreshDeviceInfo"
                title="刷新设备信息"
              ></v-btn>
            </div>
            <div class="device-controls">
              <v-btn-group variant="outlined" class="control-group">
                <v-btn
                  prepend-icon="mdi-cog"
                  @click="openSettings"
                  title="打开系统设置"
                >
                  设置
                </v-btn>
                <v-btn
                  prepend-icon="mdi-bug"
                  @click="openDeveloperOptions"
                  title="打开开发者选项"
                >
                  开发者
                </v-btn>
                <v-btn
                  prepend-icon="mdi-web"
                  @click="openBrowser"
                  title="打开浏览器"
                >
                  浏览器
                </v-btn>
                <v-btn
                  prepend-icon="mdi-wifi"
                  @click="openWifiSettings"
                  title="打开WiFi设置"
                >
                  WiFi
                </v-btn>
              </v-btn-group>

              <v-btn-group variant="outlined" class="control-group">
                <v-btn
                  prepend-icon="mdi-cellphone-screenshot"
                  @click="openDisplaySettings"
                  title="打开显示设置"
                >
                  显示
                </v-btn>
                <v-btn
                  prepend-icon="mdi-apps"
                  @click="openAppSettings"
                  title="打开应用设置"
                >
                  应用
                </v-btn>
                <v-btn
                  prepend-icon="mdi-information"
                  @click="openAboutPhone"
                  title="关于手机"
                >
                  关于
                </v-btn>
              </v-btn-group>
            </div>
          </div>
          <div class="info-side">
            <BatteryInfo
              :batteryPercentage="deviceInfo.batteryPercentage"
              :voltage="deviceInfo.voltage"
              :temperature="deviceInfo.temperature"
            />
            <StorageInfo :deviceInfo="deviceInfo" />
          </div>
        </div>
      </v-fade-transition>
    </div>
  </div>
</template>

<style scoped>
.device-info {
  padding: 16px;
  height: calc(100vh - 160px);
  overflow-y: auto;
}

.info-container {
  position: relative;
  min-height: 400px;
}

.basic-info-container {
  position: relative;
}

.refresh-btn {
  position: absolute;
  top: 8px;
  right: 8px;
}

.info-grid {
  padding-top: 48px;
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 1fr);
  gap: 24px;
}

.info-main {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.device-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.12);
}

.control-group {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 8px;
  width: 100%;
}

.control-group :deep(.v-btn) {
  flex: 1;
  text-transform: none;
  min-width: 0;
  padding: 0 8px;
}

.info-side {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}

.info-side :deep(.v-card) {
  height: 100%;
  min-height: 200px;
}

@media (max-width: 1200px) {
  .info-grid {
    grid-template-columns: 1fr;
  }

  .info-side {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .device-controls {
    padding: 12px;
  }

  .control-group {
    grid-template-columns: 1fr 1fr;
  }

  .info-side {
    grid-template-columns: 1fr;
  }

  .info-side :deep(.v-card) {
    min-height: 180px;
  }
}

/* 适配暗色主题 */
:deep(.v-theme--dark) .device-controls {
  background-color: var(--v-surface-variant-dark);
}

.skeleton-card {
  background: white;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  height: 100%;
  min-height: 200px;
}

/* 适配暗色主题 */
:deep(.v-theme--dark) .skeleton-card {
  background-color: var(--v-surface-variant-dark);
}
</style>
