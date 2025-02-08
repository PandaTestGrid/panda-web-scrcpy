<template>
  <v-container class="d-flex flex-column align-center justify-center h-100">
    <img :src="highQA" height="80" alt="logo" />

    <h2 class="text-h5 mb-8 text-grey-darken-1 text-center">
      ✨ 免费, 开源, 无广告 ✨
    </h2>

    <v-sheet max-width="400" width="100%" class="pa-4">
      <div
        v-for="(command, index) in commands"
        :key="index"
        class="d-flex flex-wrap justify-space-between align-center mb-4"
      >
        <span class="text-subtitle-1 command-text mb-2 mb-sm-0">{{
          command.text
        }}</span>
        <div class="d-flex flex-wrap">
          <div
            v-for="(button, btnIndex) in command.buttons"
            :key="btnIndex"
            class="key-background d-flex align-center justify-center ma-1 grey-text"
          >
            {{ button }}
          </div>
        </div>
      </div>
    </v-sheet>
  </v-container>
</template>

<script setup>
import { ref } from "vue";
import highQA from "../assets/high-qa.png";

const commands = ref([
  { text: "粘贴内容", buttons: ["⌘", "V"] },
  { text: "鼠标滚动", buttons: ["↑", "↓"] },
  { text: "切换搜索面板", buttons: ["⌘", "S"] },
]);
</script>

<style scoped>
.command-text {
  color: #4d4d4d;
  word-break: break-word;
}

.key-background {
  min-width: 28px;
  width: 28px;
  height: 28px;
  padding: 0;
  font-size: 14px;
  text-transform: none;
  border: 1px solid #e0e0e0;
  background-color: #f5f5f5;
  border-radius: 3px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1), 0 -1px 0 rgba(0, 0, 0, 0.05) inset;
  transition: all 0.1s ease-in-out;
}

.grey-text {
  color: #9e9e9e;
}

@media (max-width: 600px) {
  .key-background {
    min-width: 24px;
    width: 24px;
    height: 24px;
    font-size: 12px;
  }
}
</style>
