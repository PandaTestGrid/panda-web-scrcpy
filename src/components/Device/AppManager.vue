<template>
  <div class="app-manager">
    <div class="info-container">
      <v-fade-transition mode="out-in">
        <div class="app-grid">
          <!-- 应用列表部分 -->
          <div class="app-list">
            <v-card class="d-flex flex-column h-100">
              <v-card-title
                class="py-3 px-4 bg-primary-lighten-5 d-flex justify-space-between align-center"
              >
                <div class="d-flex align-center">
                  <v-icon start color="primary" class="mr-2"
                    >mdi-format-list-bulleted</v-icon
                  >
                  <span class="text-h6">应用列表</span>
                </div>
                <div class="d-flex gap-2">
                  <v-btn
                    color="primary"
                    variant="tonal"
                    @click="refreshAppList"
                    :loading="loading"
                    prepend-icon="mdi-refresh"
                  >
                    刷新
                  </v-btn>
                </div>
              </v-card-title>

              <div class="px-4 py-2">
                <v-text-field
                  v-model="search"
                  label="搜索应用"
                  prepend-icon="mdi-magnify"
                  variant="outlined"
                  density="compact"
                  hide-details
                ></v-text-field>
              </div>

              <v-card-text class="flex-grow-1 pa-0 overflow-auto">
                <v-data-table
                  :headers="headers"
                  :items="apps"
                  :loading="loading"
                  :search="search"
                  :items-per-page="10"
                  hover
                  fixed-header
                  class="app-table"
                >
                  <!-- 应用信息列 -->
                  <template v-slot:item.appInfo="{ item }">
                    <div class="d-flex align-center">
                      <v-icon size="32" color="grey" class="mr-3"
                        >mdi-android</v-icon
                      >
                      <div>
                        <div class="font-weight-medium">{{ item.appName }}</div>
                        <div class="text-caption text-grey">
                          {{ item.packageName }}
                        </div>
                      </div>
                    </div>
                  </template>

                  <!-- 版本号列 -->
                  <template v-slot:item.versionInfo="{ item }">
                    <div>
                      <div class="font-weight-medium">
                        版本号: {{ item.versionCode || "未知" }}
                      </div>
                    </div>
                  </template>

                  <!-- 安装信息列 -->
                  <template v-slot:item.installInfo="{ item }">
                    <div>
                      <div class="text-caption">来源: {{ item.installer }}</div>
                      <div
                        class="text-caption text-grey text-truncate"
                        :title="item.sourceDir"
                      >
                        路径: {{ item.sourceDir }}
                      </div>
                    </div>
                  </template>

                  <!-- 操作列 -->
                  <template v-slot:item.actions="{ item }">
                    <div class="d-flex gap-2 actions-container">
                      <v-btn
                        color="primary"
                        variant="tonal"
                        size="small"
                        prepend-icon="mdi-play"
                        @click="launchApp(item)"
                      >
                        启动
                      </v-btn>
                      <v-btn
                        color="info"
                        variant="tonal"
                        size="small"
                        prepend-icon="mdi-export"
                        @click="exportApk(item)"
                        :loading="item.exporting"
                      >
                        导出
                      </v-btn>
                      <v-btn
                        color="error"
                        variant="tonal"
                        size="small"
                        prepend-icon="mdi-delete"
                        @click="uninstallApp(item)"
                        :loading="item.uninstalling"
                      >
                        卸载
                      </v-btn>
                    </div>
                  </template>
                </v-data-table>
              </v-card-text>
            </v-card>
          </div>

          <!-- 安装应用部分 -->
          <div class="app-install">
            <v-card class="h-100">
              <v-card-title class="py-3 px-4 bg-primary-lighten-5">
                <v-icon start color="primary" class="mr-2"
                  >mdi-package-variant</v-icon
                >
                安装应用
              </v-card-title>
              <v-card-text class="overflow-auto">
                <DeviceInstall @install-complete="handleInstallComplete" />
              </v-card-text>
            </v-card>
          </div>
        </div>
      </v-fade-transition>
    </div>

    <!-- 导出进度对话框 -->
    <v-dialog v-model="showExportDialog" persistent max-width="400">
      <v-card>
        <v-card-title>导出APK</v-card-title>
        <v-card-text>
          <div class="text-subtitle-2 mb-2">{{ exportingApp?.appName }}</div>
          <v-progress-linear
            v-if="exportProgress"
            :model-value="exportProgress"
            height="25"
            color="info"
          >
            <template v-slot:default="{ value }">
              <strong>{{ Math.ceil(value) }}%</strong>
            </template>
          </v-progress-linear>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- 错误提示 -->
    <v-snackbar
      v-model="showError"
      :color="errorType"
      timeout="3000"
      location="top"
    >
      {{ errorMessage }}
    </v-snackbar>

    <!-- 确认对话框 -->
    <v-dialog v-model="showConfirmDialog" max-width="400">
      <v-card>
        <v-card-title class="text-h6"> 确认卸载 </v-card-title>
        <v-card-text>
          确定要卸载 <strong>{{ selectedApp?.appName }}</strong> 吗？
          <div class="text-caption mt-2">
            包名: {{ selectedApp?.packageName }}
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="grey-darken-1"
            variant="text"
            @click="showConfirmDialog = false"
          >
            取消
          </v-btn>
          <v-btn
            color="error"
            variant="tonal"
            @click="confirmUninstall"
            :loading="selectedApp?.uninstalling"
          >
            卸载
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import DeviceInstall from "./DeviceInstall.vue";
import { PackageManager } from "@yume-chan/android-bin";
import type { PackageManagerListPackagesResult } from "@yume-chan/android-bin";
import client from "../Scrcpy/client";
import { saveAs } from "file-saver";

interface ExtendedPackageInfo extends PackageManagerListPackagesResult {
  appName: string;
  uninstalling: boolean;
  exporting: boolean;
}

const loading = ref(false);
const search = ref("");
const apps = ref<ExtendedPackageInfo[]>([]);
const packageManager = ref<PackageManager | null>(null);
const showError = ref(false);
const errorMessage = ref("");
const showConfirmDialog = ref(false);
const selectedApp = ref<ExtendedPackageInfo[]>([]);
const errorType = ref<"error" | "success">("error");
const showExportDialog = ref(false);
const exportProgress = ref(0);
const showInstallDialog = ref(false);
const exportingApp = ref<ExtendedPackageInfo | null>(null);

const refreshAppList = async () => {
  if (!client.device || !packageManager.value) return;

  loading.value = true;
  try {
    const pm = packageManager.value;
    const appList: ExtendedPackageInfo[] = [];

    // 使用 spawnAndWaitLegacy 方法执行命令
    const output = await client.device.subprocess.spawnAndWaitLegacy([
      "pm",
      "list",
      "packages",
      "-f", // showSourceDir
      "-i", // showInstaller
      "--show-versioncode", // showVersionCode
      "-3", // listThirdParty
    ]);

    // 处理输出结果
    const lines = output.split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const pkg = PackageManager.parsePackageListItem(line);
        appList.push({
          ...pkg,
          appName: pkg.packageName.split(".").pop() || pkg.packageName,
          uninstalling: false,
          exporting: false,
        });
      } catch (e) {
        console.warn("解析包信息失败:", line, e);
      }
    }

    apps.value = appList;
  } catch (error) {
    console.error("获取应用列表失败:", error);
    showError.value = true;
    errorMessage.value = "获取应用列表失败，请重试";
  } finally {
    loading.value = false;
  }
};

const uninstallApp = (app: ExtendedPackageInfo) => {
  selectedApp.value = [app];
  showConfirmDialog.value = true;
};

const confirmUninstall = async () => {
  if (!client.device || !packageManager.value || !selectedApp.value[0]) return;

  try {
    selectedApp.value[0].uninstalling = true;

    const output = await client.device.subprocess.spawnAndWaitLegacy([
      "pm",
      "uninstall",
      selectedApp.value[0].packageName,
    ]);

    if (output.trim() !== "Success") {
      throw new Error(output);
    }

    await refreshAppList();
    errorType.value = "success";
    showError.value = true;
    errorMessage.value = "应用卸载成功";
    showConfirmDialog.value = false;
  } catch (error) {
    console.error("卸载应用失败:", error);
    errorType.value = "error";
    showError.value = true;
    errorMessage.value = "卸载应用失败，请重试";
  } finally {
    if (selectedApp.value[0]) {
      selectedApp.value[0].uninstalling = false;
    }
  }
};

const handleInstallComplete = (success: boolean, message: string) => {
  errorType.value = success ? "success" : "error";
  showError.value = true;
  errorMessage.value = message;
  if (success) {
    refreshAppList();
    showInstallDialog.value = false;
  }
};

const launchApp = async (app: ExtendedPackageInfo) => {
  if (!client.device) return;

  try {
    await client.device.subprocess.spawnAndWaitLegacy([
      "monkey",
      "-p",
      app.packageName,
      "-c",
      "android.intent.category.LAUNCHER",
      "1",
    ]);

    errorType.value = "success";
    showError.value = true;
    errorMessage.value = "应用启动成功";
  } catch (error) {
    console.error("启动应用失败:", error);
    errorType.value = "error";
    showError.value = true;
    errorMessage.value = "启动应用失败，请重试";
  }
};

const exportApk = async (app: ExtendedPackageInfo) => {
  if (!client.device) return;

  app.exporting = true;
  exportingApp.value = app;
  showExportDialog.value = true;
  exportProgress.value = 0;

  try {
    const sourceDir = app.sourceDir;
    if (!sourceDir) {
      throw new Error("无法获取应用路径");
    }

    const tempDir = "/data/local/tmp";
    const tempFile = `${tempDir}/${app.packageName}.apk`;

    await client.device.subprocess.spawnAndWaitLegacy([
      "cp",
      sourceDir,
      tempFile,
    ]);

    const sync = await client.device.sync();
    try {
      const stat = await sync.stat(tempFile);
      const stream = await sync.read(tempFile);

      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];
      const totalSize = Number(stat.size);
      let receivedLength = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedLength += value.length;
        exportProgress.value = (receivedLength / totalSize) * 100;
      }

      const blob = new Blob(chunks, {
        type: "application/vnd.android.package-archive",
      });
      saveAs(blob, `${app.packageName}.apk`);

      errorType.value = "success";
      showError.value = true;
      errorMessage.value = "APK导出成功";
    } finally {
      await sync.dispose();
      await client.device.subprocess.spawnAndWaitLegacy(["rm", tempFile]);
    }
  } catch (error) {
    console.error("导出APK失败:", error);
    errorType.value = "error";
    showError.value = true;
    errorMessage.value = "导出APK失败，请重试";
  } finally {
    app.exporting = false;
    exportingApp.value = null;
    showExportDialog.value = false;
    exportProgress.value = 0;
  }
};

// 监听设备连接状态
watch(
  () => client.device,
  async (newDevice) => {
    if (newDevice) {
      packageManager.value = new PackageManager(newDevice);
      await refreshAppList();
    } else {
      packageManager.value = null;
      apps.value = [];
    }
  }
);

onMounted(() => {
  if (client.device) {
    packageManager.value = new PackageManager(client.device);
    refreshAppList();
  }
});

const headers = [
  {
    title: "应用信息",
    key: "appInfo",
    align: "start" as const,
    sortable: false,
    width: "300",
  },
  {
    title: "版本信息",
    key: "versionInfo",
    align: "start" as const,
    sortable: true,
    width: "150",
  },
  {
    title: "安装信息",
    key: "installInfo",
    align: "start" as const,
    sortable: false,
    width: "300",
  },
  {
    title: "操作",
    key: "actions",
    align: "center" as const,
    sortable: false,
    width: "250",
    fixed: true,
  },
];
</script>

<style scoped>
.app-manager {
  height: 100%;
  padding: 16px;
  overflow: hidden;
  max-height: calc(100vh - 64px); /* 减去顶部导航栏的高度 */
}

.info-container {
  height: 100%;
  max-height: 100%;
}

.app-grid {
  height: 100%;
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 24px;
  max-height: 100%;
}

.app-list,
.app-install {
  height: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  max-height: 100%;
}

/* 表格容器样式 */
.v-card-text {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 200px); /* 调整最大高度 */
}

/* 表格样式 */
.app-table {
  flex: 1;
  overflow: auto;
}

:deep(.v-data-table) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

:deep(.v-data-table__wrapper) {
  flex: 1;
  overflow-y: auto !important;
}

/* 固定操作列样式 */
.actions-container {
  min-width: 240px;
  justify-content: flex-start;
}

:deep(.v-data-table__wrapper table) {
  table-layout: fixed;
}

/* 确保水平滚动条正常工作 */
:deep(.v-data-table__wrapper) {
  overflow-x: auto !important;
}

/* 其他样式保持不变 */
</style>
