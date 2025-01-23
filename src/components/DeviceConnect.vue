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
						<v-btn v-bind="props" append-icon="mdi-chevron-down">
							<v-tooltip activator="parent" location="end">设备切换</v-tooltip>
							<v-icon size="20">mdi-cellphone-link</v-icon>
							<span v-if="selected" class="text-body-1 font-weight-medium ml-2"></span>
							<span v-else class="text-body-1 font-weight-medium ml-2"> 选择设备 </span>
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
					</v-card>
				</v-menu>
			</div>
<!--		<v-select-->
<!--				v-model="useDevice"-->
<!--				:items="deviceOptions"-->
<!--				item-title="serial"-->
<!--				:item-text="device => `${device.serial} ${device.name ? `(${device.name})` : ''}`"-->
<!--				:return-object="true"-->
<!--				label="Available devices"-->
<!--				placeholder="No available devices"-->
<!--				:disabled="!!ADB_STATE.getAdb() || deviceOptions.length === 0"-->
<!--				class="device-select"-->
<!--				variant="outlined"-->
<!--				density="comfortable"-->
<!--				bg-color="surface"-->
<!--		>-->
<!--			<template v-slot:prepend>-->
<!--				<v-icon color="primary">mdi-cellphone-android</v-icon>-->
<!--			</template>-->
<!--			<template v-slot:append>-->
<!--				<v-icon color="primary">mdi-cellphone-android</v-icon>-->
<!--			</template>-->
<!--			<template v-slot:no-data>-->
<!--				<v-list-item>-->
<!--					<v-list-item-title>No available devices</v-list-item-title>-->
<!--				</v-list-item>-->
<!--			</template>-->
<!--		</v-select>-->

<!--		<div v-if="!ADB_STATE.getAdb()" class="action-buttons">-->
<!--			<v-btn-->
<!--					prepend-icon="mdi-power-plug"-->
<!--					:disabled="!selected"-->
<!--					:color="selected ? 'primary' : undefined"-->
<!--					@click="connect"-->
<!--					class="connect-btn"-->
<!--					variant="elevated"-->
<!--			>-->
<!--				Connect-->
<!--			</v-btn>-->
<!--			<v-btn-->
<!--					prepend-icon="mdi-plus-circle"-->
<!--					:disabled="!usbSupported"-->
<!--					:color="!selected ? 'primary' : undefined"-->
<!--					@click="addUsbDevice"-->
<!--					class="add-btn"-->
<!--					variant="elevated"-->
<!--			>-->
<!--				Add-->
<!--			</v-btn>-->
<!--		</div>-->
<!--		<v-btn-->
<!--				v-else-->
<!--				prepend-icon="mdi-power-plug-off"-->
<!--				@click="disconnect"-->
<!--				class="disconnect-btn"-->
<!--				color="error"-->
<!--				variant="elevated"-->
<!--		>-->
<!--			Disconnect-->
<!--		</v-btn>-->

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
					Please authorize the connection on your device
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

<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref, shallowRef, watch} from 'vue';
import {Adb, type AdbDaemonDevice, AdbDaemonSocket, AdbDaemonTransport, type AdbPacketData} from '@yume-chan/adb';
import AdbWebCredentialStore from '@yume-chan/adb-credential-web';
import {AdbDaemonWebUsbDeviceManager, AdbDaemonWebUsbDeviceWatcher} from '@yume-chan/adb-daemon-webusb';
import {Consumable, InspectStream, pipeFrom, ReadableStream, WritableStream} from '@yume-chan/stream-extra';
import {ADB_STATE} from '../state';
import DeviceGuide from "../views/DeviceGuide.vue";

const CredentialStore = new AdbWebCredentialStore('high-qa');
// 状态定义
const connecting = ref(false);
const usbSupported = ref(true);
const showDeviceMenu = ref(false);
let watcher: any = null;
let selected : AdbDaemonDevice = null
let usbDeviceList : AdbDaemonDevice = [];

// 计算属性
const deviceList = computed(() => [...usbDeviceList])

const deviceOptions = computed(() =>
		deviceList.value.map(device => ({
			value: device,
			text: `${device.serial} ${device.name ? `(${device.name})` : ""}`
		}))
)

const useDevice = computed(() => !!selected?.serial)

// 方法定义
const updateUsbDeviceList = async () => {
	const devices = await AdbDaemonWebUsbDeviceManager.BROWSER?.getDevices() || [];
	usbDeviceList = devices;
	console.log(usbDeviceList);
	return devices;
};

// 监听器
watch(deviceList, () => {
	if (!selected || !deviceList.value.includes(selected)) {
		selected = deviceList.value[0]
	}
})

const addUsbDevice = async () => {
	const device = await AdbDaemonWebUsbDeviceManager.BROWSER?.requestDevice();
	if (device) {
		selected = device;
		await updateUsbDeviceList();
	}
};

const getDeviceSerial = (device: AdbDaemonDevice) => {
	return device.serial;
};

const connect = async () => {
	if (!selected) return;
	connecting.value = true;

	let readable: ReadableStream<AdbPacketData>;
	let writable: WritableStream<Consumable<AdbPacketData>>;
	try {
		let streams;
		streams = await selected.connect();
		readable = streams.readable as ReadableStream<AdbPacketData>;
		writable = streams.writable as WritableStream<Consumable<AdbPacketData>>;
	} catch (e) {
		console.error('Connection error:', e);
		const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
		ADB_STATE.showErrorDialog(`Failed to connect: ${errorMessage}`);
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
		ADB_STATE.setDevice(undefined, undefined);
	};

	try {
		const deviceSerial = getDeviceSerial(selected);

		const device = new Adb(await AdbDaemonTransport.authenticate({
			serial: deviceSerial,
			connection: {readable, writable},
			credentialStore: CredentialStore,
		}));

		device.disconnected.then(async () => {
			await dispose();
		}, async (e) => {
			const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
			ADB_STATE.showErrorDialog(`Device disconnected: ${errorMessage}`);
			await dispose();
		});

		ADB_STATE.setDevice(selected, device);
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
		ADB_STATE.showErrorDialog(`Authentication failed: ${errorMessage}`);
		await dispose();
	} finally {
		connecting.value = false;
	}
};

const disconnect = async () => {
	try {
		await ADB_STATE.getAdb()?.close()
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
		ADB_STATE.showErrorDialog(`Disconnect failed: ${errorMessage}`);
	}
};

// 生命周期钩子
onMounted(async () => {
	// 设置错误处理器使用 Vuetify 对话框
	const supported = !!AdbDaemonWebUsbDeviceManager.BROWSER;
	usbSupported.value = supported;

	if (!supported) {
		ADB_STATE.showErrorDialog('Your browser does not support WebUSB...');
		return;
	}
	await updateUsbDeviceList();
	watcher = new AdbDaemonWebUsbDeviceWatcher(async (serial) => {
		try {
			const list = await updateUsbDeviceList();
			if (serial) {
				debugger
				const device = list.find(d => {
					try {
						return d.serial === serial;
					} catch {
						return false;
					}
				});
				if (device) {
					selected = device;
				}
			}
		} catch (e) {
			console.error('Error in device watcher:', e);
		}
	}, navigator.usb);

	// 最后尝试连接
	if (selected) {
		try {
			// await connect();
			return
		} catch (error) {
			const errorMessage = error instanceof Error ? error : String(error);
			ADB_STATE.showErrorDialog(errorMessage);
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
	ADB_STATE.showErrorDialog(errorMessage);
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

<style scoped>
.device-connect {
	max-width: 600px;
	margin: 0 auto;
	padding: 20px;
}

.device-select {
	margin-bottom: 20px;
	border-radius: 8px;
}

.device-select :deep(.v-field__input) {
	padding: 8px 12px;
}

.action-buttons {
	display: flex;
	gap: 16px;
	margin-top: 16px;
}

.connect-btn,
.add-btn,
.disconnect-btn {
	flex: 1;
	height: 48px;
	border-radius: 8px;
	text-transform: none;
	font-weight: 500;
	letter-spacing: 0.5px;
	transition: transform 0.3s ease, box-shadow 0.3s ease;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	will-change: transform;
}

.connect-btn:not(:disabled):hover,
.add-btn:not(:disabled):hover,
.disconnect-btn:not(:disabled):hover {
	transform: translateY(-2px);
	box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.add-button-wrapper {
	display: flex;
	align-items: center;
	flex: 1;
}

.add-btn {
	flex: 1;
}

.menu-trigger {
	margin-left: 4px;
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

/* 暗色主题适配 */
:deep(.v-theme--dark) {
	.connect-btn:not(:disabled):hover,
	.add-btn:not(:disabled):hover,
	.disconnect-btn:not(:disabled):hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
	}
}
</style>
