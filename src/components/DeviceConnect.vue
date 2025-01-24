<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref, shallowRef, watch} from 'vue';
import {Adb, type AdbDaemonDevice, AdbDaemonTransport, type AdbPacketData} from '@yume-chan/adb';
import AdbWebCredentialStore from '@yume-chan/adb-credential-web';
import {AdbDaemonWebUsbDeviceManager, AdbDaemonWebUsbDeviceWatcher} from '@yume-chan/adb-daemon-webusb';
import {Consumable, ReadableStream, WritableStream} from '@yume-chan/stream-extra';
import DeviceGuide from "./DeviceGuide.vue";
import {DEVICE} from '../state';

const CredentialStore = new AdbWebCredentialStore('high-qa');
// 状态定义
const connecting = ref(false);
const usbSupported = ref(true);
const showDeviceMenu = ref(false);
let watcher: any = null;
let selected = shallowRef(null);
let usbDeviceList = shallowRef([] as AdbDaemonDevice)

// 计算属性
const deviceList = computed(() => [...usbDeviceList.value])

const deviceOptions = computed(() =>
    deviceList.value.map(device => ({
      value: device,
      text: `${device.serial} ${device.name ? `(${device.name})` : ""}`
    }))
)

// 方法定义
const updateUsbDeviceList = async () => {
  const devices = await AdbDaemonWebUsbDeviceManager.BROWSER?.getDevices() || [];
  usbDeviceList.value = devices;
  console.log(usbDeviceList.value);
  return devices;
};

// 监听器
watch(deviceList, () => {
  if (!selected.value || !deviceList.value.includes(selected.value)) {
    selected.value = deviceList.value[0]
  }
})

const addUsbDevice = async () => {
  const device = await AdbDaemonWebUsbDeviceManager.BROWSER?.requestDevice();
  if (device) {
    selected.value = device;
    await updateUsbDeviceList();
  }
};

const selectDevice = async (device: AdbDaemonDevice) => {
  if (selected.value?.serial === device.serial) {
    showDeviceMenu.value = false;
    return;
  }
  if (selected.value) {
    await disconnect();
  }
  selected.value = device;
  showDeviceMenu.value = false;
  await connect();
};


const getDeviceSerial = (device: AdbDaemonDevice) => {
  return device.serial;
};

const connect = async () => {
  if (!selected.value) return;
  connecting.value = true;

  let readable: ReadableStream<AdbPacketData>;
  let writable: WritableStream<Consumable<AdbPacketData>>;
  try {
    let streams;
    streams = await selected.value.connect();
    readable = streams.readable as ReadableStream<AdbPacketData>;
    writable = streams.writable as WritableStream<Consumable<AdbPacketData>>;
  } catch (e) {
    console.error('Connection error:', e);
    const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
    DEVICE.showErrorDialog(`Failed to connect: ${errorMessage}`);
    connecting.value = false;
    return;
  }

  const dispose = async () => {
    try {
      readable?.cancel();
    } catch {
    }
    try {
      await writable?.close();
    } catch {
    }
    DEVICE.setDevice(undefined, undefined);
  };

  try {
    const deviceSerial = getDeviceSerial(selected.value);

    const device = new Adb(await AdbDaemonTransport.authenticate({
      serial: deviceSerial,
      connection: {readable, writable},
      credentialStore: CredentialStore,
    }));

    device.disconnected.then(async () => {
      await dispose();
    }, async (e) => {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
      DEVICE.showErrorDialog(`Device disconnected: ${errorMessage}`);
      await dispose();
    });

    DEVICE.setDevice(selected.value, device);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
    DEVICE.showErrorDialog(`Authentication failed: ${errorMessage}`);
    await dispose();
  } finally {
    connecting.value = false;
  }
};

const disconnect = async () => {
  try {
    await DEVICE.getAdb()?.close()
    DEVICE.setDevice(undefined, undefined);
    selected.value = undefined;
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
    DEVICE.showErrorDialog(`Disconnect failed: ${errorMessage}`);
  }
};

// 生命周期钩子
onMounted(async () => {
  // 设置错误处理器使用 Vuetify 对话框
  const supported = !!AdbDaemonWebUsbDeviceManager.BROWSER;
  usbSupported.value = supported;

  if (!supported) {
    DEVICE.showErrorDialog('Your browser does not support WebUSB...');
    return;
  }
  await updateUsbDeviceList();
  watcher = new AdbDaemonWebUsbDeviceWatcher(async (serial) => {
    try {
      const list = await updateUsbDeviceList();
      if (serial) {
        const device = list.find(d => {
          try {
            return d.serial === serial;
          } catch {
            return false;
          }
        });
        if (!selected.value) {
          selected.value = device;
        }
      }
    } catch (e) {
      console.error('Error in device watcher:', e);
    }
  }, navigator.usb);

  // 最后尝试连接
  if (selected.value) {
    try {
      await connect();
      return
    } catch (error) {
      const errorMessage = error instanceof Error ? error : String(error);
      DEVICE.showErrorDialog(errorMessage);
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
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  DEVICE.showErrorDialog(errorMessage);
};

// 暴露给模板使用的变量和方法
defineExpose({
  selected,
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
          <v-btn v-bind="props" append-icon="mdi-chevron-down"
          >
            <v-tooltip activator="parent" location="end">设备切换</v-tooltip>
            <v-icon size="20">mdi-cellphone-link</v-icon>
            <span class="text-body-1 font-weight-medium ml-2"> {{ selected?.serial }} </span>
          </v-btn>
        </template>
        <v-card class="paired-devices-card mt-2" min-width="300" width="450" elevation="2">
          <v-card-title class="d-flex align-center text-h6 pa-4 font-weight-bold">
            <span>配对的设备</span>
            <v-spacer/>
            <v-btn variant="tonal" class="mr-2" size="40" @click="addUsbDevice">
              <v-icon>mdi-plus</v-icon>
              <v-tooltip activator="parent" location="bottom">配对设备</v-tooltip>
            </v-btn>
            <DeviceGuide/>
          </v-card-title>
          <v-card-text v-if="!deviceList.length">
            <v-btn variant="outlined" block @click="addUsbDevice">
              <v-icon left class="mr-2">mdi-cellphone-link</v-icon>
              添加 USB 设备
            </v-btn>
          </v-card-text>
          <v-card-text v-else>
            <v-list dense>
              <v-list-item
                  v-for="device in usbDeviceList"
                  :key="device?.serial"
                  class="py-2"
                  @click="selectDevice(device)"
              >
                <template #prepend>
                  <v-avatar color="black" size="35">
                    <v-icon color="white" size="24">mdi-cellphone</v-icon>
                  </v-avatar>
                </template>
                <v-list-item-title>
                  <span>{{ device?.name || device?.serial }}</span>
                </v-list-item-title>
                <v-list-item-subtitle>
                  <span>{{ device?.serial }}</span>
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
                      color="primary"
                      variant="text"
                      size="small"
                      style="width: 35px; height: 35px"
                      @click.stop="disconnect()"
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
          <img class="dialog-image" src="../assets/adb-connect.jpg" alt=""/>
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
</style>
