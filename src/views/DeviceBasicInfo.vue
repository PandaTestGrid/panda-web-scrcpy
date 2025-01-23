<template>
  <v-card class="info-card" elevation="0">
    <v-card-text class="pa-4">
      <div class="text-subtitle-1 mb-4">设备信息</div>
      <div class="info-table">
        <div class="info-row">
          <div class="info-label">品牌</div>
          <div class="info-value">{{ deviceInfo.brand }}</div>
          <div class="info-label">连接状态</div>
          <div class="info-value">{{ deviceInfo.type }}</div>
        </div>
        <div class="info-row">
          <div class="info-label">型号</div>
          <div class="info-value">{{ deviceInfo.deviceModel }}</div>
          <div class="info-label">Bootloader 锁</div>
          <div class="info-value">{{ bootloaderStatus }}</div>
        </div>
        <div class="info-row">
          <div class="info-label">代号</div>
          <div class="info-value">{{ deviceInfo.device }}</div>
          <div class="info-label">A/B槽位</div>
          <div class="info-value">{{ abPartitionStatus }}</div>
        </div>
        <div class="info-row">
          <div class="info-label">安卓SDK</div>
          <div class="info-value">Android {{ deviceInfo.androidVersion }}({{ deviceInfo.sdkVersionCode }})</div>
          <div class="info-label">VNDK 版本</div>
          <div class="info-value">{{ deviceInfo.sdkVersionCode }}</div>
        </div>
        <div class="info-row">
          <div class="info-label">CPU 架构</div>
          <div class="info-value">{{ deviceInfo.cpuAbi }}</div>
          <div class="info-label">CPU 代号</div>
          <div class="info-value">{{ deviceInfo.cpuInfo }}</div>
        </div>
        <div class="info-row">
          <div class="info-label">分辨率</div>
          <div class="info-value">{{ deviceInfo.resolution }}</div>
          <div class="info-label">开机时间</div>
          <div class="info-value">{{ uptime }}</div>
        </div>
        <div class="info-row">
          <div class="info-label">显示密度</div>
          <div class="info-value">{{ deviceInfo.screenDensity }}</div>
          <div class="info-label">闪存类型</div>
          <div class="info-value">{{ storageType }}</div>
        </div>
        <div class="info-row">
          <div class="info-label">主板 ID</div>
          <div class="info-value">{{ deviceInfo.board || '-' }}</div>
        </div>
        <div class="info-row">
          <div class="info-label">平台</div>
          <div class="info-value full-width">{{ deviceInfo.hardware }}</div>
        </div>
        <div class="info-row">
          <div class="info-label">编译版本</div>
          <div class="info-value full-width">{{ deviceInfo.fingerPrint }}</div>
        </div>
        <div class="info-row">
          <div class="info-label">内核版本</div>
          <div class="info-value full-width">{{ deviceInfo.kernelVersion }}</div>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps({
  deviceInfo: {
    type: Object,
    required: true
  }
});

// 计算属性：Bootloader 状态
const bootloaderStatus = computed(() => {
  // 这里可以添加实际的 bootloader 状态检测逻辑
  return 'locked';
});

// 计算属性：A/B 分区状态
const abPartitionStatus = computed(() => {
  // 这里可以添加实际的 A/B 分区检测逻辑
  return 'A-Only设备';
});

// 计算属性：开机时间
const uptime = computed(() => {
  // 这里可以添加实际的开机时间计算逻辑
  return '0天6时44分44秒';
});

// 计算属性：存储类型
const storageType = computed(() => {
  // 这里可以添加实际的存储类型检测逻辑
  return 'UFS';
});

// 计算属性：内核版本
const kernelVersion = computed(() => {
  // 这里可以添加实际的内核版本获取逻辑
  return '49.537-UOTAN-PE14-STABLE+';
});
</script>

<style scoped>
.info-card {
  background: white;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.12);
}

.info-table {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-row {
  display: grid;
  grid-template-columns: minmax(80px, auto) minmax(0, 1fr) minmax(100px, auto) minmax(0, 1fr);
  gap: 16px;
  align-items: center;
  min-height: 32px;
  padding: 0 4px;
}

.info-row:hover {
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
}

.info-label {
  font-weight: 500;
  color: var(--v-text-primary);
  white-space: nowrap;
  font-size: 14px;
}

.info-value {
  color: var(--v-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  min-width: 0;
}

.full-width {
  grid-column: 2 / -1;
}

@media (max-width: 768px) {
  .info-row {
    grid-template-columns: minmax(80px, auto) 1fr;
  }

  .info-row > *:nth-child(3),
  .info-row > *:nth-child(4) {
    grid-column: auto;
  }

  .full-width {
    grid-column: 2;
  }
}

/* 适配暗色主题 */
:deep(.v-theme--dark) .info-card {
  background-color: var(--v-surface-variant-dark);
}
</style>
