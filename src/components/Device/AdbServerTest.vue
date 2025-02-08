<template>
  <div class="adb-server-test">
    <n-card title="ADB Server 测试">
      <n-space vertical>
        <n-form-item label="服务器配置">
          <n-input-group>
            <n-input v-model:value="host" placeholder="主机地址" />
            <n-input-number
              v-model:value="port"
              placeholder="端口"
              :min="1"
              :max="65535"
            />
          </n-input-group>
        </n-form-item>

        <n-space>
          <n-button @click="connectServer" :loading="loading">
            连接服务器
          </n-button>
          <n-button
            @click="listDevices"
            :loading="loading"
            :disabled="!isConnected"
          >
            列出设备
          </n-button>
        </n-space>

        <n-card v-if="result" title="结果" size="small">
          <pre>{{ result }}</pre>
        </n-card>
      </n-space>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { AdbServerNodeTcpConnector } from "@yume-chan/adb-server-node-tcp";
import { AdbServerClient } from "@yume-chan/adb";

const host = ref("localhost");
const port = ref(5037);
const loading = ref(false);
const result = ref("");
const isConnected = ref(false);

let client: AdbServerClient | null = null;

const connectServer = async () => {
  try {
    loading.value = true;
    const connector = new AdbServerNodeTcpConnector({
      host: host.value,
      port: port.value,
    });

    client = new AdbServerClient(connector);
    isConnected.value = true;
    result.value = "服务器连接成功";
  } catch (error) {
    result.value = `连接错误: ${error.message}`;
  } finally {
    loading.value = false;
  }
};

const listDevices = async () => {
  if (!client) {
    result.value = "请先连接服务器";
    return;
  }

  try {
    loading.value = true;
    const devices = await client.listDevices();
    result.value = JSON.stringify(devices, null, 2);
  } catch (error) {
    result.value = `获取设备列表错误: ${error.message}`;
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.adb-server-test {
  padding: 16px;
}
</style> 