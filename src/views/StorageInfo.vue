<template>
  <v-card class="storage-card" elevation="0">
    <v-card-text class="pa-4">
      <div class="text-subtitle-1 mb-4">存储和内存</div>
      <div class="d-flex flex-column align-center">
        <!-- 存储信息 -->
        <div class="storage-section">
          <div class="storage-indicator">
            <div class="storage-text">
              <div class="storage-percent">{{ storageUsage.percentage }}%</div>
            </div>
            <v-progress-circular
              :model-value="storageUsage.percentage"
              :size="120"
              :width="12"
              color="error"
              class="storage-progress"
            >
            </v-progress-circular>
          </div>
          <div class="mt-2 text-body-2 text-center">{{ storageUsage.used }}GB/{{ storageUsage.total }}GB</div>
        </div>

        <!-- 内存信息 -->
        <div class="storage-section mt-4">
          <div class="storage-indicator">
            <div class="storage-text">
              <div class="storage-percent">{{ memoryUsage.percentage }}%</div>
            </div>
            <v-progress-circular
              :model-value="memoryUsage.percentage"
              :size="120"
              :width="12"
              color="light-blue"
              class="storage-progress"
            >
            </v-progress-circular>
          </div>
          <div class="mt-2 text-body-2 text-center">{{ memoryUsage.used }}GB/{{ memoryUsage.total }}GB</div>
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

const storageUsage = computed(() => {
  const totalStr = props.deviceInfo.totalStorage;
  const usedStr = props.deviceInfo.usedStorage;
  
  // 移除 GB 单位并转换为数字
  const total = parseFloat(totalStr.replace('GB', ''));
  const used = parseFloat(usedStr.replace('GB', ''));
  
  return {
    used: used.toFixed(2),
    total: total.toFixed(2),
    percentage: Math.round((used / total) * 100)
  };
});

const memoryUsage = computed(() => {
  const totalStr = props.deviceInfo.totalMemory;
  const usedStr = props.deviceInfo.usedMemory;
  
  // 移除 MB 单位并转换为数字
  const total = parseInt(totalStr.replace('MB', ''));
  const used = parseInt(usedStr);
  
  return {
    used: (used / 1024).toFixed(1),
    total: (total / 1024).toFixed(1),
    percentage: Math.round((used / total) * 100)
  };
});
</script>

<style scoped>
.storage-card {
  background: white;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  min-width: 280px;
}

.storage-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.storage-indicator {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 120px;
}

.storage-text {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.storage-percent {
  font-size: 24px;
  font-weight: 500;
  color: var(--v-text-primary);
}

.storage-progress {
  position: absolute;
}

/* 适配暗色主题 */
:deep(.v-theme--dark) .storage-card {
  background-color: var(--v-surface-variant-dark);
}
</style>
