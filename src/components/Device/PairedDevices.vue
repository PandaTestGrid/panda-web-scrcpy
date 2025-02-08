<script setup lang="ts">
import { ref, onMounted, shallowRef, watch, computed, onUnmounted } from "vue";
import client from "../Scrcpy/client";
import {
  AdbDaemonWebUsbDeviceWatcher,
  AdbDaemonWebUsbDevice,
} from "@yume-chan/adb-daemon-webusb";
import DeviceGuide from "./DeviceGuide.vue";

// 使用 Vue 3 的新语法定义 emit
const emit = defineEmits([
  "pair-device",
  "remove-device",
  "update-connection-status",
]);

const showDevices = ref(false);
const selected = shallowRef<AdbDaemonWebUsbDevice | undefined>(undefined);
const usbDeviceList = shallowRef<AdbDaemonWebUsbDevice[]>([]);
const watcher = shallowRef<AdbDaemonWebUsbDeviceWatcher | null>(null);
const errorMessage = ref("");
const errorDetails = ref("");
const isLoading = ref(false);
const deviceInfo = ref<{ model: string; androidVersion: string } | null>(null);
const connectionStatus = ref<"connected" | "disconnected" | "connecting">(
  "disconnected"
);
const autoReconnectAttempts = ref(0);
const maxAutoReconnectAttempts = 3;
const disconnectionMessage = ref("");

const deviceList = computed(() => {
  return [...usbDeviceList.value];
});

const deviceOptions = computed(() => {
  return deviceList.value;
});

const selectDevice = async (device: any) => {
  if (
    selected.value?.serial === device?.serial &&
    connectionStatus.value === "connected"
  ) {
    console.log("Device already connected:", device?.serial);
    return;
  }

  connectionStatus.value = "connecting";
  isLoading.value = true;
  errorMessage.value = "";
  errorDetails.value = "";
  deviceInfo.value = null;
  emit("update-connection-status", false);
  try {
    await client.connect(device);
    selected.value = device;
    connectionStatus.value = "connected";
    showDevices.value = false;
    emit("pair-device", device);
    emit("update-connection-status", true);
    deviceInfo.value = {
      model: device.name || "Unknown",
      androidVersion: "Unknown",
    };
    autoReconnectAttempts.value = 0;
  } catch (error: any) {
    handleConnectionError(error);
  } finally {
    isLoading.value = false;
  }
};

const handleConnectionError = (error: any) => {
  if (error.message.includes("Unknown command: 48545541")) {
    errorMessage.value = "设备连接失败：未知命令";
    errorDetails.value =
      "请确保设备支持 ADB 调试，并且已在开发者选项中启用 USB 调试。";
  } else if (
    error.name === "DOMException" &&
    error.message.includes("The transfer was cancelled")
  ) {
    errorMessage.value = "设备连接失败：USB 传输被取消";
    errorDetails.value = "请重新插拔设备并重试。如果问题持续，请尝试重启设备。";
  } else if (
    error.message.includes("No authenticator can handle the request")
  ) {
    errorMessage.value = "设备认证失败：无法处理认证请求";
    errorDetails.value =
      '请检查设备上的 ADB 授权设置。在设备上点击"允许 USB 调试"对话框，然后重试连接。';
  } else {
    errorMessage.value = `设备连接失败`;
    errorDetails.value +=
      "这通常是已经运行了其他 ADB 客户端导致的。通过运行 `adb kill-server` 命令来终止其他 ADB 进程，然后再重新连接当前设备。";
  }
  emit("update-connection-status", false);
  connectionStatus.value = "disconnected";
};

const retryConnection = async () => {
  if (selected.value) {
    await selectDevice(selected.value);
  }
};

const autoReconnect = async () => {
  if (autoReconnectAttempts.value < maxAutoReconnectAttempts) {
    console.log(
      `Attempting auto-reconnect (${
        autoReconnectAttempts.value + 1
      }/${maxAutoReconnectAttempts})`
    );
    await retryConnection();
    autoReconnectAttempts.value++;
  } else {
    console.log("Max auto-reconnect attempts reached");
    errorMessage.value = "自动重连失败";
    errorDetails.value = "请手动重试连接或检查设备状态。";
  }
};

const toggleDevices = () => {
  showDevices.value = !showDevices.value;
  console.log("Device list toggled:", showDevices.value);
};

const removeDevice = async (serial: string) => {
  isLoading.value = true;
  console.log("Attempting to remove device:", serial);
  if (selected.value?.serial === serial) {
    selected.value = undefined;
    await client.disconnect();
    deviceInfo.value = null;
    emit("update-connection-status", false);
    connectionStatus.value = "disconnected";
    console.log("Disconnected from device:", serial);
  }
  usbDeviceList.value = usbDeviceList.value.filter(
    (device) => device.serial !== serial
  );
  emit("remove-device", serial);
  console.log("Device removed from list:", serial);
  isLoading.value = false;
};

const updateUsbDeviceList = async () => {
  isLoading.value = true;
  try {
    usbDeviceList.value = await client.getUsbDeviceList();
    console.log("Updated USB device list:", usbDeviceList.value);
  } catch (error: any) {
    console.error("Failed to update USB device list:", error);
    errorMessage.value = "获取设备列表失败";
    errorDetails.value = `${error.message}。请检查设备连接并重试。`;
  } finally {
    isLoading.value = false;
  }
  return usbDeviceList.value;
};

onMounted(async () => {
  const supported = client.isSupportedWebUsb;
  console.log("WebUSB support:", supported);
  if (!supported) {
    console.log("WebUSB is not supported");
    errorMessage.value = "浏览器不支持 WebUSB";
    errorDetails.value =
      "请使用支持 WebUSB 的现代浏览器，如 Chrome 或 Edge 的最新版本。";
    return;
  }

  await updateUsbDeviceList();
  watcher.value = new AdbDaemonWebUsbDeviceWatcher(async () => {
    console.log("Device list change detected");
    await updateUsbDeviceList();
  }, navigator.usb);
});

onUnmounted(() => {
  if (watcher.value) {
    watcher.value.dispose();
    console.log("Device watcher disposed");
  }
});

watch(deviceList, async (newList) => {
  console.log("Device list changed:", newList);
  if (selected.value) {
    const current = newList.find(
      (device) => device.serial === selected.value?.serial
    );
    if (!current) {
      console.log("Selected device not found in new list, disconnecting");
      await client.disconnect();
      const disconnectedDeviceName =
        selected.value.name || selected.value.serial;
      selected.value = undefined;
      deviceInfo.value = null;
      errorMessage.value = "设备已断开连接";
      errorDetails.value = "选中的设备已从列表中移除。请检查设备连接状态。";
      disconnectionMessage.value = `设备 ${disconnectedDeviceName} 已断开连接。请检查设备连接状态。`;
      emit("update-connection-status", false);
      connectionStatus.value = "disconnected";
      await autoReconnect();
    } else {
      disconnectionMessage.value = "";
    }
  }
});

const handleAddDevice = async () => {
  errorMessage.value = "";
  errorDetails.value = "";
  try {
    console.log("Attempting to add new USB device");
    const newDevice = await client.addUsbDevice();
    if (newDevice) {
      console.log("New device added:", newDevice);
      await updateUsbDeviceList();
    }
  } catch (error: any) {
    console.error("Failed to add USB device:", error);
    errorMessage.value = "添加设备失败";
    errorDetails.value = `${error.message}。请确保设备已正确连接并启用了 USB 调试。`;
  }
};
</script>

<template>
  <div class="paired-devices-component text-center">
    <v-menu
      v-model="showDevices"
      transition="slide-y-transition"
      :close-on-content-click="false"
      :nudge-right="40"
      :offset-y="true"
      offset-x
      min-width="300"
      max-width="450"
      location="bottom"
    >
      <template #activator="{ props }">
        <v-btn color="black" v-bind="props" append-icon="mdi-chevron-down">
          <v-tooltip activator="parent" location="end">设备切换</v-tooltip>
          <v-icon size="20">mdi-cellphone-link</v-icon>
          <span v-if="selected" class="text-body-1 font-weight-medium ml-2">
            {{ selected.name || selected.serial }}
          </span>
          <span v-else class="text-body-1 font-weight-medium ml-2">
            选择设备
          </span>
          <v-icon
            :color="connectionStatus === 'connected' ? 'green' : ''"
            class="ml-2"
          >
            {{
              connectionStatus === "connected"
                ? "mdi-check-circle"
                : "mdi-alert-circle"
            }}
          </v-icon>
        </v-btn>
      </template>
      <v-card
        class="paired-devices-card mt-2"
        min-width="300"
        width="450"
        elevation="2"
      >
        <v-card-title class="d-flex align-center text-h6 pa-4 font-weight-bold">
          <span>配对的设备</span>
          <v-spacer />
          <v-btn
            variant="tonal"
            class="mr-2"
            size="40"
            @click="handleAddDevice"
          >
            <v-icon>mdi-plus</v-icon>
            <v-tooltip activator="parent" location="bottom">配对设备</v-tooltip>
          </v-btn>
          <DeviceGuide />
        </v-card-title>
        <v-card-text v-if="errorMessage" class="error-container">
          <v-alert type="error" prominent>
            <h3>{{ errorMessage }}</h3>
            <p>{{ errorDetails }}</p>
            <v-btn
              v-if="selected"
              variant="text"
              @click="retryConnection"
              class="mt-2"
              >重试连接
            </v-btn>
            <v-btn variant="text" @click="handleAddDevice" class="mt-2 ml-2"
              >查看帮助
            </v-btn>
          </v-alert>
        </v-card-text>
        <v-card-text v-if="disconnectionMessage" class="disconnection-message">
          <v-alert type="warning" prominent>
            {{ disconnectionMessage }}
          </v-alert>
        </v-card-text>
        <v-card-text v-if="!deviceList.length">
          <v-btn variant="outlined" block @click="handleAddDevice">
            <v-icon left class="mr-2">mdi-cellphone-link</v-icon>
            添加 USB 设备
          </v-btn>
        </v-card-text>
        <v-card-text v-else>
          <v-list dense>
            <v-list-item
              v-for="device in deviceOptions"
              :key="device.serial"
              class="py-2"
              @click="selectDevice(device)"
            >
              <template #prepend>
                <v-avatar color="black" size="40">
                  <v-icon color="white" size="24">mdi-cellphone</v-icon>
                </v-avatar>
              </template>
              <v-list-item-title>
                <span>{{ device.name || device.serial }}</span>
              </v-list-item-title>
              <v-list-item-subtitle>
                <span>{{ device.serial }}</span>
              </v-list-item-subtitle>
              <template #append>
                <v-icon
                  v-if="selected?.serial === device.serial"
                  class="mr-2"
                  color="green"
                >
                  mdi-check-circle
                </v-icon>
                <v-btn
                  icon
                  color="black"
                  variant="text"
                  size="small"
                  style="width: 35px; height: 35px"
                  @click.stop="removeDevice(device.serial)"
                >
                  <v-icon>mdi-delete</v-icon>
                  <v-tooltip activator="parent" location="end"
                    >移除设备
                  </v-tooltip>
                </v-btn>
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-text>
          <v-btn variant="outlined" block @click="toggleDevices">关闭</v-btn>
        </v-card-text>
      </v-card>
    </v-menu>
  </div>
</template>

<style scoped>
.paired-devices-component {
  display: inline-block;
}

.paired-devices-card {
  border-radius: 8px;
}

.error-container,
.disconnection-message {
  margin-bottom: 16px;
}
</style>
