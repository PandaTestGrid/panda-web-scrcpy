<template>
    <v-btn variant="tonal" size="40" @click="guideDialogVisible = true">
        <v-icon>mdi-help-circle</v-icon>
        <v-tooltip activator="parent" location="bottom">帮助文档</v-tooltip>
    </v-btn>
    <v-dialog v-model="guideDialogVisible" max-width="700px" transition="dialog-transition">
        <v-card class="guide-dialog">
            <v-card-title class="text-center text-h5 font-weight-bold pa-4">
                添加设备指南
            </v-card-title>
            <v-card-text class="pa-4">
                <v-card-subtitle class="px-0 pb-2">步骤说明</v-card-subtitle>
                <v-list dense>
                    <v-list-item v-for="(step, index) in allSteps" :key="index">
                        <v-list-item-title>{{ index + 1 }}. {{ step.title }}</v-list-item-title>
                        <v-list-item-subtitle>{{ step.content }}</v-list-item-subtitle>
                    </v-list-item>
                </v-list>

                <v-expansion-panels class="mt-4">
                    <v-expansion-panel>
                        <v-expansion-panel-title> 常见问题 (FAQ) </v-expansion-panel-title>
                        <v-expansion-panel-text>
                            <v-list dense>
                                <v-list-item v-for="(item, index) in faqItems" :key="index">
                                    <v-list-item-title class="font-weight-medium"
                                        >{{ item.question }}
                                    </v-list-item-title>
                                    <v-list-item-subtitle>{{ item.answer }}</v-list-item-subtitle>
                                </v-list-item>
                            </v-list>
                        </v-expansion-panel-text>
                    </v-expansion-panel>
                </v-expansion-panels>
            </v-card-text>
            <v-card-actions class="justify-end pa-4">
                <v-btn color="primary" @click="guideDialogVisible = false" class="close-btn">
                    完成
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup>
import { ref, computed } from 'vue';

const guideDialogVisible = ref(false);

const developerSteps = [
    {
        title: '打开设置',
        content: '进入您手机的设置应用',
    },
    {
        title: '找到"关于手机"',
        content: '滚动到设置底部，点击"关于手机"或"关于设备"',
    },
    {
        title: '点击"版本号"',
        content: '连续点击"版本号"或"构建号码"7次，直到看到"您已成为开发者"的提示',
    },
    {
        title: '返回设置',
        content: '返回到主设置页面，您应该能看到新的"开发者选项"菜单',
    },
];

const connectionSteps = [
    {
        title: '开发者选项',
        content: '进入"开发者选项"菜单',
    },
    {
        title: '启用USB调试',
        content: '在开发者选项中，找到并开启"USB调试"开关',
    },
    {
        title: '确认',
        content: '在弹出的对话框中点击"确定"或"允许"以启用USB调试',
    },
    {
        title: '连接设备',
        content: '使用USB线将您的设备连接到电脑，并在设备上允许USB调试',
    },
];

const allSteps = computed(() => [...developerSteps, ...connectionSteps]);

const faqItems = [
    {
        question: '如何开启开发者选项？',
        answer: '进入"设置" > "关于手机"，然后连续点击"版本号"7次。',
    },
    {
        question: '设备未被识别怎么办？',
        answer: '请确保您的设备驱动已正确安装，并且USB调试模式已开启。尝试重新插拔USB线或重启设备。',
    },
    {
        question: '无法启用USB调试怎么办？',
        answer: '某些设备可能需要额外的步骤。请查看您设备的具体说明或联系设备制造商获取帮助。',
    },
    {
        question: '连接设备后没有反应怎么办？',
        answer: '请检查您的USB线是否支持数据传输。某些USB线只能充电，无法传输数据。尝试使用其他USB线或端口。',
    },
];
</script>

<style scoped>
.guide-dialog {
    border-radius: 8px;
}

.v-dialog {
    max-height: 90vh;
}
</style>
