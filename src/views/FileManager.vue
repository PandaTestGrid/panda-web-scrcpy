<template>
  <v-card>
    <v-card-title>文件管理器</v-card-title>
    <v-card-text>
      <v-row>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="currentPath"
            label="当前路径"
            append-icon="mdi-refresh"
            @click:append="refreshFiles"
          ></v-text-field>
        </v-col>
      </v-row>
      
      <v-data-table
        :headers="headers"
        :items="files"
        :loading="loading"
        @click:row="handleRowClick"
      >
        <template v-slot:item.type="{ item }">
          <v-icon>{{ item.type === 'directory' ? 'mdi-folder' : 'mdi-file' }}</v-icon>
        </template>
      </v-data-table>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { GLOBAL_STATE } from "../state";

const store = useGlobalStore()
const currentPath = ref('/storage/emulated/0')
const loading = ref(false)
const files = ref([])

const headers = [
  { title: '类型', key: 'type', width: '50px' },
  { title: '名称', key: 'name' },
  { title: '大小', key: 'size' },
  { title: '修改时间', key: 'modifiedTime' }
]

const refreshFiles = async () => {
  loading.value = true
  try {
    // 实现文件列表刷新逻辑
    // files.value = await store.device.listFiles(currentPath.value)
  } finally {
    loading.value = false
  }
}

const handleRowClick = (item: any) => {
  if (item.type === 'directory') {
    currentPath.value = item.path
    refreshFiles()
  }
}

onMounted(() => {
  refreshFiles()
})
</script>
