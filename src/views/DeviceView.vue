<script setup>
import { ref, computed, onMounted, onUnmounted, shallowRef, watch } from "vue";
import { useDisplay } from "vuetify";
import PairedDevices from "./PairedDevices.vue";
import highQA from "../assets/high-qa.png";
import DeviceShell from "./DeviceShell.vue";
import DeviceLogcat from "./DeviceLogcat.vue";
import DeviceInfo from "./DeviceInfo.vue";
import AbstractList from "./AbstractList.vue";
import VideoContainer from "./VideoContainer.vue";
import NavigationBar from "./NavigationBar.vue";
import state from "../state/scrcpy-state";
import AppManager from "./AppManager.vue";
import DeviceSelectDrawer from './DeviceSelectDrawer.vue'
import GitHubStats from '../components/GitHubStats.vue'

const { width } = useDisplay();
const showRightPanel = computed(() => width.value >= 960);

const containerSize = ref({ width: 0, height: 0 });
const highQAImage = ref(highQA);
const userSetLeftPanelWidth = ref(560);
const leftPanelWidth = computed(() => {
  if (!showRightPanel.value) {
    return width.value;
  }
  return userSetLeftPanelWidth.value;
});

const rightPanelWidth = computed(() =>
  Math.max(300, containerSize.value.width - leftPanelWidth.value - 16)
);
const isResizing = ref(false);
const startX = ref(0);
const startWidth = ref(0);

const deviceMeta = shallowRef(undefined);
const connected = ref(false);
const tab = ref(0);

const isHorizontalLayout = computed(() => {
  return containerSize.value.width > leftPanelWidth.value + 200;
});

const handleDisconnected = () => {
  connected.value = false;
  deviceMeta.value = undefined;
};

const onPairDevice = (device) => {
  deviceMeta.value = device;
};

const handleConnectionStatus = async (status) => {
  if (status) {
    await ensureContainerSize();
  }
  connected.value = status;
  if (!status) {
    handleDisconnected();
  }
};

const startResize = (e) => {
  if (!showRightPanel.value) return;
  isResizing.value = true;
  startX.value = e.clientX || e.touches[0].clientX;
  startWidth.value = userSetLeftPanelWidth.value;
  document.addEventListener("mousemove", resize);
  document.addEventListener("touchmove", resize);
  document.addEventListener("mouseup", stopResize);
  document.addEventListener("touchend", stopResize);
};

const resize = (e) => {
  if (!isResizing.value) return;
  const clientX = e.clientX || e.touches[0]?.clientX;
  const diff = clientX - startX.value;
  userSetLeftPanelWidth.value = Math.max(
    300,
    Math.min(startWidth.value + diff, containerSize.value.width - 300)
  );
};

const stopResize = () => {
  isResizing.value = false;
  document.removeEventListener("mousemove", resize);
  document.removeEventListener("touchmove", resize);
  document.removeEventListener("mouseup", stopResize);
  document.removeEventListener("touchend", stopResize);
};

const containerRef = ref(null);
const DeviceContainerRef = ref(null);
const videoWrapperRef = ref(null);

// 计算容器的实际可用空间
const containerDimensions = computed(() => {
  const horizontalPadding = 20;
  const verticalPadding = 30;
  const navBarWidth = 80;
  const borderWidth = 6; // 考虑边框宽度

  return {
    width:
      leftPanelWidth.value - (navBarWidth + horizontalPadding + borderWidth),
    height: containerSize.value.height - (verticalPadding * 2 + borderWidth),
  };
});

// 监听容器尺寸变化
watch(
  () => containerDimensions.value,
  (newDimensions) => {
    if (videoWrapperRef.value) {
      // 更新视频包装器的尺寸
      videoWrapperRef.value.style.width = `${newDimensions.width}px`;
      videoWrapperRef.value.style.height = `${newDimensions.height}px`;
      // 通知 state 更新视频容器
      state.updateVideoContainer();
    }
  },
  { immediate: true }
);

// 修改 updateContainerSize 方法
const updateContainerSize = () => {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect();
    containerSize.value = {
      width: rect.width,
      height: rect.height,
    };
    // 强制设置视频包装器的初始尺寸
    if (videoWrapperRef.value) {
      videoWrapperRef.value.style.width = `${containerDimensions.value.width}px`;
      videoWrapperRef.value.style.height = `${containerDimensions.value.height}px`;
      // 通知 state 更新视频容器
      if (state.running) {
        state.updateVideoContainer();
      }
    }
  }
};

// 添加一个方法来确保容器尺寸已准备好
const ensureContainerSize = () => {
  return new Promise(resolve => {
    const checkSize = () => {
      updateContainerSize();
      if (containerSize.value.width > 0 && containerSize.value.height > 0) {
        resolve();
      } else {
        requestAnimationFrame(checkSize);
      }
    };
    checkSize();
  });
};

onMounted(async () => {
  // 确保容器尺寸已准备好
  await ensureContainerSize();
  window.addEventListener('resize', updateContainerSize);
});

onUnmounted(() => {
  stopResize();
  window.removeEventListener("resize", updateContainerSize);
});

watch(
  () => document.fullscreenElement,
  (newValue) => {
    if (!newValue) {
      setTimeout(updateContainerSize, 100);
    }
  }
);

watch(width, (newWidth, oldWidth) => {
  if (newWidth < 960 && oldWidth >= 960) {
    userSetLeftPanelWidth.value = newWidth;
  } else if (newWidth >= 960 && oldWidth < 960) {
    userSetLeftPanelWidth.value = 450;
  }
});

const tabs = [
  { title: "基础信息", icon: "mdi-android", component: DeviceInfo },
  { title: "应用管理", icon: "mdi-android", component: AppManager },
  { title: "终端", icon: "mdi-console", component: DeviceShell },
  { title: "Logcat", icon: "mdi-android", component: DeviceLogcat },
];

const showDeviceDrawer = ref(false);
</script>

<template>
  <v-app>
    <v-app-bar height="64" color="white" app>
      <v-container class="d-flex align-center justify-center pa-0" fluid>
        <v-img
          :src="highQAImage"
          max-width="110"
          max-height="24"
          class="mr-6 ml-10"
        />
        <PairedDevices
          @pair-device="onPairDevice"
          @update-connection-status="handleConnectionStatus"
        />
        <v-spacer />
        
        <div class="d-flex align-center">
          <div class="d-flex align-center mx-2">
            <v-btn
              icon
              class="mr-2"
              href="https://github.com/Maxwellos/web-scrcpy"
              target="_blank"
              title="GitHub"
            >
              <v-icon>mdi-github</v-icon>
            </v-btn>
            <GitHubStats />
          </div>
        </div>
      </v-container>
    </v-app-bar>

    <v-main>
      <div
        ref="containerRef"
        class="resizable-container"
        :class="{ 'horizontal-layout': isHorizontalLayout }"
      >
        <div class="left-panel" :style="{ width: leftPanelWidth + 'px' }">
          <v-card class="panel-content">
            <v-card-text class="d-flex align-center justify-center">
              <div
                v-if="connected"
                ref="DeviceContainerRef"
                class="device-container"
              >
                <div 
                  ref="videoWrapperRef" 
                  class="video-wrapper"
                  :style="{
                    width: `${containerDimensions.width}px`,
                    height: `${containerDimensions.height}px`
                  }"
                >
                  <VideoContainer />
                </div>
                <div class="navigation-wrapper">
                  <NavigationBar />
                </div>
              </div>
              <div v-else class="d-flex align-center justify-center">
                <div
                  class="loading-indicator"
                  :style="{
                    width: leftPanelWidth / 1.2 + 'px',
                    height: containerSize.height / 1.2 + 'px',
                  }"
                >
                  <div class="connection-status">
                    <v-progress-circular
                      v-if="state.connecting"
                      indeterminate
                      color="primary"
                      size="60"
                      width="4"
                    />
                    <v-btn
                      v-else
                      icon
                      x-large
                      size="60"
                      color="black"
                      class="power-button mb-2"
                      @click="showDeviceDrawer = true"
                    >
                      <v-icon x-large>mdi-power</v-icon>
                    </v-btn>
                  </div>
                  <div class="text-h6">
                    {{ state.connecting ? '正在连接设备...' : '连接设备' }}
                  </div>
                  <div class="text-body-2">
                    {{ state.connecting ? '请稍候...' : '请确保设备已开启USB调试模式' }}
                  </div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </div>
        <div
          v-if="showRightPanel"
          class="resizer"
          @mousedown="startResize"
          @touchstart="startResize"
        />
        <div
          v-if="showRightPanel"
          class="right-panel"
          :style="{ width: rightPanelWidth + 'px' }"
        >
          <v-card height="100%">
            <template v-if="connected">
              <v-tabs v-model="tab" color="primary" align-tabs="center" grow>
                <v-tab
                  v-for="(item, index) in tabs"
                  :key="index"
                  :value="index"
                >
                  <v-icon start>{{ item.icon }}</v-icon>
                  {{ item.title }}
                </v-tab>
              </v-tabs>
              <v-window v-model="tab" class="right-panel-content">
                <v-window-item
                  v-for="(item, index) in tabs"
                  :key="index"
                  :value="index"
                >
                  <v-card flat>
                    <component :is="item.component" :device-meta="deviceMeta" />
                  </v-card>
                </v-window-item>
              </v-window>
            </template>
            <template v-else>
              <AbstractList />
            </template>
          </v-card>
        </div>
      </div>
    </v-main>

    <DeviceSelectDrawer v-model="showDeviceDrawer" />
  </v-app>
</template>

<style lang="scss" scoped>
.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(#e9ecf1, #deeefa);
  border-radius: 16px;
  border: 3px solid black;
  padding: 16px;
  text-align: center;
  font-size: 16px;
  font-weight: 500;
  
  .connection-status {
    margin-bottom: 16px;
    min-height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .text-h6 {
    margin-bottom: 8px;
    transition: all 0.3s ease;
  }

  .text-body-2 {
    color: rgba(0, 0, 0, 0.6);
    transition: all 0.3s ease;
  }
}

.resizable-container {
  display: flex;
  height: calc(100vh - 64px);
  overflow: hidden;

  &.horizontal-layout {
    flex-direction: row;
  }

  .left-panel {
    min-width: 200px;
    max-width: 100%;
    overflow: hidden;
    margin: 16px;

    .panel-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 16px;
    }
  }

  .right-panel {
    flex-grow: 1;
    min-width: 300px;
    margin: 16px 16px 16px 8px;
    display: flex;
    flex-direction: column;
  }

  .right-panel-content {
    flex-grow: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .resizer {
    width: 8px;
    background-color: #e0e0e0;
    cursor: col-resize;
    transition: background-color 0.3s ease;

    &:hover {
      background-color: #bdbdbd;
    }
  }
}

.v-window-item {
  height: 100%;
  overflow-y: auto;
}

@media (max-width: 959px) {
  .resizable-container {
    flex-direction: column;

    .left-panel {
      max-width: 100%;
      margin: 16px;
    }

    .resizer {
      display: none;
    }
  }
}

.device-container {
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100%;
  padding: 30px 10px;
  gap: 16px;
  box-sizing: border-box;
  background: transparent;
}

.video-wrapper {
  position: relative;
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  background: transparent;
  border-radius: 16px;
  overflow: visible;
  box-sizing: border-box;
  transition: none !important;
}

.navigation-wrapper {
  width: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
  background: transparent;
}

.device-container.hidden {
  display: none;
}

.device-drawer {
  max-height: 80vh;
  border-radius: 0 0 16px 16px;
  
  :deep(.v-navigation-drawer__content) {
    border-radius: 0 0 16px 16px;
    overflow: hidden;
  }
}

.discord-icon {
  width: 24px;
  height: 24px;
}
</style>
