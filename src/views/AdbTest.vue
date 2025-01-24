<script setup lang="ts">
import { ref, computed } from "vue";
import DevicesConnect from "../components/DevicesConnect.vue";
import BatteryInfo from "../components/BatteryInfo.vue";
import { DEVICES_STATE } from "../state";
import VideoContainer from "../components/VideoContainer.vue";

// 计算所有设备列表
const devices = computed(() => DEVICES_STATE.getAllDevices());

// 添加主控设备状态
const mainControlSerial = ref<string>("");

// 设置主控设备的方法
const setMainControl = (serial: string) => {
  mainControlSerial.value = serial;
};
</script>

<template>
  <div class="adb-test">
    <v-container>
      <v-row>
        <v-col cols="12">
          <DevicesConnect />
        </v-col>
      </v-row>

      <!-- 空设备提示 -->
      <v-row v-if="devices.length === 0">
        <v-col cols="12" class="text-center">
          <v-card class="empty-state pa-6">
            <v-icon size="64" color="grey-lighten-1">mdi-devices</v-icon>
            <div class="text-h6 mt-4 grey--text text--darken-1">
              没有连接的设备
            </div>
            <div class="text-body-2 mt-2 grey--text">请先连接设备</div>
          </v-card>
        </v-col>
      </v-row>

      <!-- 添加投屏区域 -->
      <v-row v-else>
        <!-- 主控设备 -->
        <v-col cols="12" md="6" lg="4" v-if="mainControlSerial">
          <v-card class="screen-card main-control-card">
            <v-card-title
              class="d-flex justify-space-between align-center primary"
            >
              <span class="d-flex align-center white--text">
                <v-icon class="mr-2" color="white">mdi-monitor</v-icon>
                {{ mainControlSerial }}
                <v-chip class="ml-2" small color="white" text-color="primary"
                  >主控设备</v-chip
                >
              </span>
            </v-card-title>
            <div class="d-flex flex-column h-100">
              <div class="flex-grow-1">
                <VideoContainer
                  :device-serial="mainControlSerial"
                  :is-main-control="false"
                />
              </div>
            </div>
          </v-card>
        </v-col>

        <!-- 其他设备 -->
        <v-col
          v-for="{ device } in devices"
          :key="device.serial"
          cols="12"
          sm="6"
          md="4"
        >
          <v-card class="screen-card">
            <v-card-title class="d-flex justify-space-between align-center">
              <span class="d-flex align-center">
                <v-icon class="mr-2">mdi-monitor</v-icon>
                {{ device.serial }}
              </span>
              <v-btn
                small
                :color="mainControlSerial === device.serial ? 'primary' : ''"
                @click="setMainControl(device.serial)"
              >
                设为主控
              </v-btn>
            </v-card-title>
            <div class="d-flex flex-column h-100">
              <div class="flex-grow-1">
                <VideoContainer
                  :device-serial="device.serial"
                  :is-main-control="mainControlSerial === device.serial"
                />
                <BatteryInfo :device-serial="device.serial" />
              </div>
            </div>
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
  min-height: 600px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.screen-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
}

.main-control-card {
  border: 2px solid var(--v-primary-base);
  height: 100%;
  min-height: 600px;
}

.main-control-card :deep(.v-card__title) {
  color: white;
}

.battery-wrapper {
  padding: 16px;
  background-color: rgba(0, 0, 0, 0.02);
}

.h-100 {
  height: 100%;
}
</style>
