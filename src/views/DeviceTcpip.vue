<!--<template>-->
<!--  <v-container>-->
<!--    <v-row>-->
<!--      <v-col cols="12">-->
<!--        <v-card>-->
<!--          <v-card-title>ADB over WiFi - Tango</v-card-title>-->
<!--          <v-card-text>-->
<!--            <v-alert type="info" dense>-->
<!--              For Tango to wirelessly connect to your device,-->
<!--              <a href="https://github.com/yume-chan/ya-webadb/discussions/245#discussioncomment-384030" target="_blank">-->
<!--                extra software-->
<!--              </a>-->
<!--              is required.-->
<!--            </v-alert>-->
<!--            <v-alert type="warning" dense>-->
<!--              Your device will disconnect after changing ADB over WiFi config.-->
<!--            </v-alert>-->

<!--            <v-switch-->
<!--              v-model="serviceListenAddresses"-->
<!--              label="service.adb.listen_addrs"-->
<!--              :disabled="true"-->
<!--              :input-value="!!serviceListenAddresses"-->
<!--              readonly-->
<!--            />-->
<!--            <v-text-field-->
<!--              v-for="address in serviceListenAddresses"-->
<!--              :key="address"-->
<!--              :value="address"-->
<!--              :disabled="true"-->
<!--              readonly-->
<!--              style="width: 300px;"-->
<!--            />-->

<!--            <v-switch-->
<!--              v-model="servicePortEnabled"-->
<!--              label="service.adb.tcp.port"-->
<!--              :disabled="!GLOBAL_STATE.adb || !!serviceListenAddresses"-->
<!--              @change="handleServicePortEnabledChange"-->
<!--            />-->
<!--            <v-text-field-->
<!--              v-model="servicePort"-->
<!--              :disabled="!GLOBAL_STATE.adb || !!serviceListenAddresses"-->
<!--              style="width: 300px;"-->
<!--              @input="handleServicePortChange"-->
<!--            />-->

<!--            <v-switch-->
<!--              v-model="persistPortEnabled"-->
<!--              label="persist.adb.tcp.port"-->
<!--              :disabled="true"-->
<!--              :input-value="persistPortEnabled"-->
<!--              readonly-->
<!--            />-->
<!--            <v-text-field-->
<!--              v-if="persistPort"-->
<!--              :value="persistPort"-->
<!--              :disabled="true"-->
<!--              readonly-->
<!--              style="width: 300px;"-->
<!--            />-->
<!--          </v-card-text>-->
<!--          <v-card-actions>-->
<!--            <v-btn-->
<!--              :disabled="!GLOBAL_STATE.adb"-->
<!--              @click="queryInfo"-->
<!--            >-->
<!--              Refresh-->
<!--            </v-btn>-->
<!--            <v-btn-->
<!--              :disabled="!GLOBAL_STATE.adb"-->
<!--              @click="applyServicePort"-->
<!--            >-->
<!--              Apply-->
<!--            </v-btn>-->
<!--          </v-card-actions>-->
<!--        </v-card>-->
<!--      </v-col>-->
<!--    </v-row>-->
<!--  </v-container>-->
<!--</template>-->

<!--<script setup lang="ts">-->
<!--import { ref, onMounted, onUnmounted, computed } from 'vue';-->
<!--import { observer } from 'mobx-vue-lite';-->
<!--import { GLOBAL_STATE } from '../state';-->
<!--import { RouteStackProps, asyncEffect } from '../utils';-->
<!--import { autorun, makeAutoObservable, runInAction } from 'mobx';-->

<!--class TcpIpState {-->
<!--  initial = true;-->
<!--  visible = false;-->
<!--  serviceListenAddresses = ref<string[] | undefined>(undefined);-->
<!--  servicePortEnabled = ref(false);-->
<!--  servicePort = ref('');-->
<!--  persistPortEnabled = ref(false);-->
<!--  persistPort = ref<string | undefined>(undefined);-->

<!--  constructor() {-->
<!--    makeAutoObservable(this, {-->
<!--      initial: false,-->
<!--      queryInfo: false,-->
<!--      applyServicePort: false,-->
<!--    });-->

<!--    autorun(() => {-->
<!--      if (GLOBAL_STATE.adb) {-->
<!--        if (this.initial && this.visible) {-->
<!--          this.initial = false;-->
<!--          this.queryInfo();-->
<!--        }-->
<!--      } else {-->
<!--        this.initial = true;-->
<!--      }-->
<!--    });-->
<!--  }-->

<!--  get commandBarItems() {-->
<!--    return [-->
<!--      {-->
<!--        key: 'refresh',-->
<!--        disabled: !GLOBAL_STATE.adb,-->
<!--        iconProps: { iconName: Icons.ArrowClockwise },-->
<!--        text: 'Refresh',-->
<!--        onClick: this.queryInfo,-->
<!--      },-->
<!--      {-->
<!--        key: 'apply',-->
<!--        disabled: !GLOBAL_STATE.adb,-->
<!--        iconProps: { iconName: Icons.Save },-->
<!--        text: 'Apply',-->
<!--        onClick: this.applyServicePort,-->
<!--      },-->
<!--    ];-->
<!--  }-->

<!--  queryInfo = asyncEffect(async (signal) => {-->
<!--    if (!GLOBAL_STATE.adb) {-->
<!--      runInAction(() => {-->
<!--        this.serviceListenAddresses.value = undefined;-->
<!--        this.servicePortEnabled.value = false;-->
<!--        this.servicePort.value = '';-->
<!--        this.persistPortEnabled.value = false;-->
<!--        this.persistPort.value = undefined;-->
<!--      });-->
<!--      return;-->
<!--    }-->

<!--    const serviceListenAddresses = await GLOBAL_STATE.adb.getProp(-->
<!--      'service.adb.listen_addrs',-->
<!--    );-->
<!--    const servicePort = await GLOBAL_STATE.adb.getProp('service.adb.tcp.port');-->
<!--    const persistPort = await GLOBAL_STATE.adb.getProp('persist.adb.tcp.port');-->

<!--    if (signal.aborted) {-->
<!--      return;-->
<!--    }-->

<!--    runInAction(() => {-->
<!--      this.serviceListenAddresses.value =-->
<!--        serviceListenAddresses !== ''-->
<!--          ? serviceListenAddresses.split(',')-->
<!--          : undefined;-->

<!--      if (servicePort) {-->
<!--        this.servicePortEnabled.value =-->
<!--          !serviceListenAddresses && servicePort !== '0';-->
<!--        this.servicePort.value = servicePort;-->
<!--      } else {-->
<!--        this.servicePortEnabled.value = false;-->
<!--        this.servicePort.value = '5555';-->
<!--      }-->

<!--      if (persistPort) {-->
<!--        this.persistPortEnabled.value =-->
<!--          !serviceListenAddresses && !servicePort;-->
<!--        this.persistPort.value = persistPort;-->
<!--      } else {-->
<!--        this.persistPortEnabled.value = false;-->
<!--        this.persistPort.value = undefined;-->
<!--      }-->
<!--    });-->
<!--  });-->

<!--  applyServicePort = async () => {-->
<!--    if (!GLOBAL_STATE.adb) {-->
<!--      return;-->
<!--    }-->

<!--    if (this.servicePortEnabled.value) {-->
<!--      await GLOBAL_STATE.adb.tcpip.setPort(-->
<!--        Number.parseInt(this.servicePort.value, 10),-->
<!--      );-->
<!--    } else {-->
<!--      await GLOBAL_STATE.adb.tcpip.disable();-->
<!--    }-->
<!--  };-->
<!--}-->

<!--const state = new TcpIpState();-->

<!--onMounted(() => {-->
<!--  runInAction(() => {-->
<!--    state.visible = true;-->
<!--  });-->
<!--});-->

<!--onUnmounted(() => {-->
<!--  runInAction(() => {-->
<!--    state.visible = false;-->
<!--  });-->
<!--});-->

<!--const handleServicePortEnabledChange = (value: boolean) => {-->
<!--  runInAction(() => {-->
<!--    state.servicePortEnabled.value = value;-->
<!--  });-->
<!--};-->

<!--const handleServicePortChange = (value: string) => {-->
<!--  runInAction(() => (state.servicePort.value = value));-->
<!--};-->

<!--const queryInfo = state.queryInfo;-->
<!--const applyServicePort = state.applyServicePort;-->

<!--const serviceListenAddresses = computed(() => state.serviceListenAddresses.value);-->
<!--const servicePortEnabled = computed(() => state.servicePortEnabled.value);-->
<!--const servicePort = computed(() => state.servicePort.value);-->
<!--const persistPortEnabled = computed(() => state.persistPortEnabled.value);-->
<!--const persistPort = computed(() => state.persistPort.value);-->
<!--</script>-->

<!--<style scoped>-->
<!--/* Add any scoped styles here */-->
<!--</style>-->
