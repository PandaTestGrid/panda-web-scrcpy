<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['update:modelValue'])

const drawer = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})
</script>

<template>
  <v-navigation-drawer
    v-model="drawer"
    location="top"
    temporary
    class="device-drawer"
  >
    <v-card flat>
      <v-card-title class="d-flex justify-space-between align-center pa-4">
        <span>选择调试设备</span>
        <v-btn icon @click="drawer = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>
      <v-card-text>
        <v-alert
          type="info"
          variant="tonal"
          class="mb-4"
        >
          支持将您本地设备快速接入到High-QA平台，提供设备调试、应用管理、日志查看等功能
        </v-alert>
        <v-list>
          <v-list-subheader>可用设备</v-list-subheader>
          <!-- 这里可以添加设备列表,根据实际需求对接数据 -->
          <v-list-item
            prepend-icon="mdi-cellphone-android"
            title="未检测到设备"
            subtitle="请确保设备已开启USB调试模式并连接到电脑"
          />
        </v-list>
      </v-card-text>
    </v-card>
  </v-navigation-drawer>
</template>

<style lang="scss" scoped>
.device-drawer {
  max-height: 80vh;
  border-radius: 0 0 16px 16px;
  
  :deep(.v-navigation-drawer__content) {
    border-radius: 0 0 16px 16px;
    overflow: hidden;
  }
}
</style> 