<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import {
  Adb,
  type AdbDaemonDevice,
  AdbDaemonTransport,
  type AdbPacketData,
} from "@yume-chan/adb";
import AdbWebCredentialStore from "@yume-chan/adb-credential-web";
import {
  AdbDaemonWebUsbDeviceManager,
  AdbDaemonWebUsbDeviceWatcher,
} from "@yume-chan/adb-daemon-webusb";
import {
  Consumable,
  ReadableStream,
  WritableStream,
} from "@yume-chan/stream-extra";
import DeviceGuide from "./DeviceGuide.vue";
import { DEVICES_STATE } from "../state/devices-state";

const CredentialStore = new AdbWebCredentialStore("high-qa");
// 状态定义
const connecting = ref(false);
const usbSupported = ref(true);
const showDeviceMenu = ref(false);
let watcher: any = null;
const selectedDevices = shallowRef<AdbDaemonDevice[]>([]);
const usbDeviceList = shallowRef<AdbDaemonDevice[]>([]);

// 计算属性
const deviceList = computed(() => [...usbDeviceList.value]);

const deviceOptions = computed(() =>
  deviceList.value.map((device) => ({
    value: device,
    text: `${device.serial} ${device.name ? `(${device.name})` : ""}`,
  }))
);

// 方法定义
const updateUsbDeviceList = async () => {
  const devices =
    (await AdbDaemonWebUsbDeviceManager.BROWSER?.getDevices()) || [];
  usbDeviceList.value = devices;
  console.log(usbDeviceList.value);
  return devices;
};

// 监听器
watch(deviceList, () => {
  if (!selectedDevices.value.length) {
    selectedDevices.value = deviceList.value;
  }
});

const addUsbDevice = async () => {
  const device = await AdbDaemonWebUsbDeviceManager.BROWSER?.requestDevice();
  if (device) {
    selectedDevices.value.push(device);
    await updateUsbDeviceList();
  }
};

const selectDevice = async (device: AdbDaemonDevice) => {
  const index = selectedDevices.value.findIndex(
    (d) => d.serial === device.serial
  );
  if (index !== -1) {
    await disconnect(device);
    selectedDevices.value.splice(index, 1);
  } else {
    selectedDevices.value.push(device);
    await connect(device);
  }
};

const getDeviceSerial = (device: AdbDaemonDevice) => {
  return device.serial;
};

const connect = async (device: AdbDaemonDevice) => {
  if (!device) return;
  connecting.value = true;

  let readable: ReadableStream<AdbPacketData>;
  let writable: WritableStream<Consumable<AdbPacketData>>;
  try {
    let streams = await device.connect();
    readable = streams.readable as ReadableStream<AdbPacketData>;
    writable = streams.writable as WritableStream<Consumable<AdbPacketData>>;
  } catch (e) {
    console.error("Connection error:", e);
    const errorMessage =
      e instanceof Error ? e.message : "Unknown error occurred";
    DEVICES_STATE.showErrorDialog(`Failed to connect: ${errorMessage}`);
    connecting.value = false;
    return;
  }

  const dispose = async () => {
    try {
      readable?.cancel();
    } catch {}
    try {
      await writable?.close();
    } catch {}
  };

  try {
    const deviceSerial = getDeviceSerial(device);
    const adbDevice = new Adb(
      await AdbDaemonTransport.authenticate({
        serial: deviceSerial,
        connection: { readable, writable },
        credentialStore: CredentialStore,
      })
    );

    adbDevice.disconnected.then(
      async () => {
        await dispose();
        DEVICES_STATE.removeDevice(deviceSerial);
      },
      async (e) => {
        const errorMessage =
          e instanceof Error ? e.message : "Unknown error occurred";
        DEVICES_STATE.showErrorDialog(`Device disconnected: ${errorMessage}`);
        await dispose();
        DEVICES_STATE.removeDevice(deviceSerial);
      }
    );

    DEVICES_STATE.setDevice(deviceSerial, device, adbDevice);
  } catch (e) {
    const errorMessage =
      e instanceof Error ? e.message : "Unknown error occurred";
    DEVICES_STATE.showErrorDialog(`Authentication failed: ${errorMessage}`);
    await dispose();
  } finally {
    connecting.value = false;
  }
};

const disconnect = async (device?: AdbDaemonDevice) => {
  try {
    if (device) {
      const serial = device.serial;
      await DEVICES_STATE.getAdb(serial)?.close();
      DEVICES_STATE.removeDevice(serial);
    } else {
      for (const d of selectedDevices.value) {
        await DEVICES_STATE.getAdb(d.serial)?.close();
        DEVICES_STATE.removeDevice(d.serial);
      }
      selectedDevices.value = [];
    }
  } catch (e) {
    const errorMessage =
      e instanceof Error ? e.message : "Unknown error occurred";
    DEVICES_STATE.showErrorDialog(`Disconnect failed: ${errorMessage}`);
  }
};

// 生命周期钩子
onMounted(async () => {
  // 设置错误处理器使用 Vuetify 对话框
  const supported = !!AdbDaemonWebUsbDeviceManager.BROWSER;
  usbSupported.value = supported;

  if (!supported) {
    DEVICES_STATE.showErrorDialog("Your browser does not support WebUSB...");
    return;
  }
  await updateUsbDeviceList();
  watcher = new AdbDaemonWebUsbDeviceWatcher(async (serial) => {
    try {
      const list = await updateUsbDeviceList();
      if (serial) {
        const device = list.find((d) => {
          try {
            return d.serial === serial;
          } catch {
            return false;
          }
        });
        if (!selectedDevices.value.length) {
          selectedDevices.value = [device];
        }
      }
    } catch (e) {
      console.error("Error in device watcher:", e);
    }
  }, navigator.usb);

  // 最后尝试连接
  if (selectedDevices.value.length) {
    try {
      for (const device of selectedDevices.value) {
        await connect(device);
      }
      return;
    } catch (error) {
      const errorMessage = error instanceof Error ? error : String(error);
      DEVICES_STATE.showErrorDialog(errorMessage);
    }
  }
});

onUnmounted(() => {
  if (watcher) {
    watcher.dispose();
    watcher = null;
  }
});

// 修改错误处理
const handleError = (error: unknown) => {
  const errorMessage =
    error instanceof Error ? error.message : "Unknown error occurred";
  DEVICES_STATE.showErrorDialog(errorMessage);
};

// 修改选择设备的方法
const isDeviceSelected = (device: AdbDaemonDevice) => {
  return selectedDevices.value.some((d) => d.serial === device.serial);
};

// 暴露给模板使用的变量和方法
defineExpose({
  selectedDevices,
  isDeviceSelected,
  connecting,
  usbSupported,
  deviceOptions,
  addUsbDevice,
  connect,
  disconnect,
});
</script>

<template>
  <v-container class="device-connect">
    <div class="paired-devices-component text-center">
      <v-menu
        v-model="showDeviceMenu"
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
          <v-btn v-bind="props" class="device-menu-btn" variant="outlined">
            <v-icon size="20" class="mr-2">mdi-cellphone-link</v-icon>
            <span v-if="selectedDevices.length === 0"> 选择设备 </span>
            <span v-else> 已选择 {{ selectedDevices.length }} 个设备 </span>
            <v-icon end>mdi-chevron-down</v-icon>
          </v-btn>
        </template>
        <v-card
          class="paired-devices-card mt-2"
          min-width="300"
          width="450"
          elevation="2"
        >
          <v-card-title
            class="d-flex align-center text-h6 pa-4 font-weight-bold"
          >
            <span>配对的设备</span>
            <v-spacer />
            <v-btn variant="tonal" class="mr-2" size="40" @click="addUsbDevice">
              <v-icon>mdi-plus</v-icon>
              <v-tooltip activator="parent" location="bottom"
                >配对设备</v-tooltip
              >
            </v-btn>
            <DeviceGuide />
          </v-card-title>
          <v-card-text v-if="!deviceList.length">
            <v-btn variant="outlined" block @click="addUsbDevice">
              <v-icon left class="mr-2">mdi-cellphone-link</v-icon>
              添加 USB 设备
            </v-btn>
          </v-card-text>
          <v-card-text v-else>
            <v-list dense class="device-list">
              <v-list-item
                v-for="device in usbDeviceList"
                :key="device.serial"
                class="device-item"
                @click="selectDevice(device)"
              >
                <template #prepend>
                  <v-checkbox
                    v-model="selectedDevices"
                    :value="device"
                    hide-details
                    class="mr-2"
                    @click.stop
                  />
                  <v-avatar color="grey-lighten-2" size="40">
                    <v-icon>mdi-cellphone</v-icon>
                  </v-avatar>
                </template>

                <v-list-item-title class="device-name">
                  {{ device.name || device.serial }}
                </v-list-item-title>

                <v-list-item-subtitle class="device-serial">
                  {{ device.serial }}
                </v-list-item-subtitle>

                <template #append>
                  <v-chip
                    v-if="isDeviceSelected(device)"
                    color="primary"
                    size="small"
                    class="mr-2"
                  >
                    已连接
                  </v-chip>
                  <v-btn
                    icon
                    variant="text"
                    size="small"
                    @click.stop="disconnect(device)"
                  >
                    <v-icon>mdi-link-off</v-icon>
                  </v-btn>
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-menu>
    </div>
    <v-dialog
      v-model="connecting"
      width="300"
      class="connecting-dialog"
      persistent
    >
      <v-card>
        <v-card-title class="dialog-title">
          <v-icon left color="primary">mdi-connection</v-icon>
          Connecting...
        </v-card-title>
        <v-card-text class="dialog-text">
          请在设备上允许连接 ADB 调试
          <img class="dialog-image" src="../assets/adb-connect.jpg" alt="" />
        </v-card-text>
        <v-progress-linear
          indeterminate
          color="primary"
          class="dialog-progress"
        ></v-progress-linear>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.device-connect {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.device-select :deep(.v-field__input) {
  padding: 8px 12px;
}

.connecting-dialog :deep(.v-card) {
  border-radius: 12px;
  overflow: hidden;
  transform-origin: center;
}

.dialog-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.25rem;
  font-weight: 500;
  padding: 16px 24px;
}

.dialog-text {
  padding: 16px 24px;
}

.dialog-progress {
  margin: 0;
}

.dialog-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.device-menu-btn {
  min-width: 180px;
  justify-content: space-between;
}

.device-list {
  max-height: 400px;
  overflow-y: auto;
}

.device-item {
  border-radius: 8px;
  margin: 4px 0;
  transition: background-color 0.2s;
}

.device-item:hover {
  background-color: rgb(var(--v-theme-primary-lighten-5));
}

.device-name {
  font-weight: 500;
}

.device-serial {
  font-size: 0.85rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

/* 添加滚动条样式 */
.device-list::-webkit-scrollbar {
  width: 8px;
}

.device-list::-webkit-scrollbar-track {
  background: transparent;
}

.device-list::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface), 0.2);
  border-radius: 4px;
}

.device-list::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--v-theme-on-surface), 0.3);
}
</style>
