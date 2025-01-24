<template>
  <v-app>
    <!-- <v-icon icon="mdi-cellphone-android" color="primary" size="large"></v-icon> -->
    <AdbTess/>
    <ErrorDialog />
  </v-app>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { VApp } from 'vuetify/components';
// import DeviceView from './views/DeviceView.vue';
import AdbTess from "./views/AdbTest.vue";
import ErrorDialog from './components/ErrorDialog.vue';

const roomName = ref('default-room');
const currentUser = ref({
  id: 'default-user',
  name: 'Default User',
});
</script>

<style>
body {
  margin: 0;
  padding: 0;
  font-family: Arial, sans-serif;
}
</style>
