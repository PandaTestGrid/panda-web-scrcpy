<template>
    <v-card class="device-logcat">
        <v-card-text class="pa-0">
            <div class="header d-flex align-center justify-space-between">
                <div class="d-flex align-center flex-grow-1">
                    <v-select
                        v-model="selectedPriority"
                        :items="priorityOptions"
                        item-title="text"
                        item-value="value"
                        label="日志级别"
                        dense
                        hide-details
                        variant="outlined"
                        density="compact"
                        class="mr-2"
                        style="max-width: 150px"
                    ></v-select>
                    <v-text-field
                        v-model="tagFilter"
                        label="标签过滤"
                        placeholder="输入标签进行过滤"
                        dense
                        hide-details
                        variant="outlined"
                        density="compact"
                        class="mr-2"
                        style="max-width: 150px"
                    ></v-text-field>
                    <v-text-field
                        v-model="searchQuery"
                        label="搜索日志"
                        placeholder="输入关键词搜索"
                        dense
                        hide-details
                        variant="outlined"
                        density="compact"
                        class="flex-grow-1"
                        style="max-width: 450px"
                    ></v-text-field>
                </div>
                <div class="d-flex align-center">
                    <v-btn
                        :color="isRunning ? 'error' : 'primary'"
                        class="mr-2"
                        variant="text"
                        @click="toggleLogcat"
                    >
                        <v-icon>{{ isRunning ? 'mdi-stop' : 'mdi-play' }}</v-icon>
                    </v-btn>
                    <v-btn color="secondary" class="mr-2" variant="text" @click="clearLogs">
                        <v-icon>mdi-delete</v-icon>
                    </v-btn>
                    <v-btn
                        :disabled="filteredLogs.length === 0"
                        color="secondary"
                        variant="text"
                        @click="exportLogs"
                    >
                        <v-icon>mdi-export</v-icon>
                    </v-btn>
                </div>
            </div>

            <div class="log-container">
                <div class="log-header">
                    <div class="log-cell time">时间</div>
                    <div class="log-cell priority">级别</div>
                    <div class="log-cell tag">标签</div>
                    <div class="log-cell message">消息</div>
                </div>
                <div ref="logContainer" style="height: calc(100vh - 300px)">
                    <v-virtual-scroll
                        :items="filteredLogs"
                        :item-size="28"
                        height="100%"
                        item-height="28"
                    >
                        <template #default="{ item }">
                            <div
                                v-memo="[
                                    item.seconds,
                                    item.nanoseconds,
                                    item.priority,
                                    item.tag,
                                    item.message,
                                ]"
                                :class="[
                                    'log-entry',
                                    `priority-${AndroidLogPriorityToCharacter[item.priority].toLowerCase()}`,
                                ]"
                            >
                                <div class="log-cell time">{{ formatTime(item) }}</div>
                                <div class="log-cell priority">
                                    <v-chip
                                        :color="getPriorityColor(item.priority)"
                                        text-color="white"
                                        size="x-small"
                                        label
                                        class="priority-chip"
                                    >
                                        {{ AndroidLogPriorityToCharacter[item.priority] }}
                                    </v-chip>
                                </div>
                                <div class="log-cell tag">{{ item.tag }}</div>
                                <div class="log-cell message">{{ item.message }}</div>
                            </div>
                        </template>
                    </v-virtual-scroll>
                </div>

                <div v-if="filteredLogs.length === 0" class="no-logs-message">
                    {{ isRunning ? '正在等待日志...' : '没有日志可显示' }}
                </div>
            </div>
        </v-card-text>
    </v-card>
</template>

<script setup lang="ts">
// 脚本部分保持不变
import { ref, onUnmounted, shallowRef, computed, nextTick, onMounted, watch } from 'vue';
import client from '../device/adb-client';
import {
    Logcat,
    AndroidLogPriority,
    AndroidLogPriorityToCharacter,
    type AndroidLogEntry,
} from '@yume-chan/android-bin';
import type { ReadableStream } from '@yume-chan/stream-extra';

// 状态变量
const isRunning = ref(false);
const logs = shallowRef<AndroidLogEntry[]>([]);
const selectedPriority = ref<AndroidLogPriority>(AndroidLogPriority.Verbose);
const tagFilter = ref('');
const searchQuery = ref('');
const logContainer = ref<HTMLElement | null>(null);
const isNearBottom = ref(true);

// Logcat 实例
let logcat: Logcat | null = null;
let logStream: ReadableStream<AndroidLogEntry> | null = null;
let abortController: AbortController | null = null;
let reader: ReadableStreamDefaultReader<AndroidLogEntry> | null = null;
let shouldStopLogcat = false;

// 日志队列和处理相关变量
const MAX_LOGS = 5000;
const logQueue: AndroidLogEntry[] = [];
let isProcessingQueue = false;
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 100;

// 优先级选项
const priorityOptions = [
    { text: '详细 (V)', value: AndroidLogPriority.Verbose },
    { text: '调试 (D)', value: AndroidLogPriority.Debug },
    { text: '信息 (I)', value: AndroidLogPriority.Info },
    { text: '警告 (W)', value: AndroidLogPriority.Warn },
    { text: '错误 (E)', value: AndroidLogPriority.Error },
    { text: '致命 (F)', value: AndroidLogPriority.Fatal },
];

// 优先级颜色映射
const priorityColors = {
    [AndroidLogPriority.Verbose]: 'grey darken-2',
    [AndroidLogPriority.Debug]: 'blue darken-3',
    [AndroidLogPriority.Info]: 'green darken-3',
    [AndroidLogPriority.Warn]: 'orange darken-3',
    [AndroidLogPriority.Error]: 'red darken-3',
    [AndroidLogPriority.Fatal]: 'purple darken-3',
};

// 使用计算属性来过滤日志
const filteredLogs = computed(() => {
    const priority = selectedPriority.value;
    const tag = tagFilter.value.toLowerCase();
    const query = searchQuery.value.toLowerCase();

    return logs.value.filter((log) => {
        if (log.priority < priority) return false;
        if (tag && !log.tag.toLowerCase().includes(tag)) return false;
        if (query && !log.message.toLowerCase().includes(query)) return false;
        return true;
    });
});

// 监听过滤条件变化，当条件变化时重置滚动位置
watch([selectedPriority, tagFilter, searchQuery], () => {
    nextTick(() => {
        if (logContainer.value) {
            logContainer.value.scrollTop = 0;
        }
    });
});

// 切换 Logcat 状态
const toggleLogcat = async () => {
    if (isRunning.value) {
        await stopLogcat();
    } else {
        await startLogcat();
    }
};

// 启动 Logcat
const startLogcat = async () => {
    try {
        logcat = new Logcat(client.device);
        abortController = new AbortController();
        logStream = logcat.binary();

        isRunning.value = true;
        shouldStopLogcat = false;
        logs.value = [];

        reader = logStream.getReader();
        while (!shouldStopLogcat) {
            const { done, value } = await reader.read();
            if (done) break;
            logQueue.push(value);
            if (!isProcessingQueue) {
                processLogQueue();
            }
        }
    } catch (error) {
        console.error('启动 Logcat 失败，请检查设备连接状态', error);
    } finally {
        await cleanupLogcat();
    }
};

// 异步处理日志队列
const processLogQueue = async () => {
    isProcessingQueue = true;
    while (logQueue.length > 0 && !shouldStopLogcat) {
        const now = Date.now();
        if (now - lastUpdateTime >= UPDATE_INTERVAL) {
            await new Promise((resolve) => requestAnimationFrame(resolve));
            const batch = logQueue.splice(0, Math.min(100, logQueue.length));
            logs.value = [...logs.value, ...batch].slice(-MAX_LOGS);
            lastUpdateTime = now;
            if (isNearBottom.value) {
                scrollToBottom();
                await nextTick();
            }
        } else {
            await new Promise((resolve) =>
                setTimeout(resolve, UPDATE_INTERVAL - (now - lastUpdateTime))
            );
        }
    }
    isProcessingQueue = false;
};

// 停止 Logcat
const stopLogcat = async () => {
    shouldStopLogcat = true;
    isRunning.value = false;

    // 等待当前的读取操作完成
    if (reader) {
        try {
            await reader.cancel();
        } catch (error) {
            console.error('取消 reader 时出错:', error);
        }
    }

    await cleanupLogcat();
};

// 清理 Logcat 资源
const cleanupLogcat = async () => {
    if (reader) {
        try {
            reader.releaseLock();
        } catch (error) {
            console.error('释放 reader 锁时出错:', error);
        }
        reader = null;
    }

    if (logStream) {
        try {
            await logStream.cancel();
        } catch (error) {
            console.error('取消 logStream 时出错:', error);
        }
        logStream = null;
    }

    if (abortController) {
        abortController.abort();
        abortController = null;
    }

    logcat = null;
    logQueue.length = 0;
};

// 清除日志
const clearLogs = async () => {
    try {
        if (logcat) {
            await logcat.clear();
        }
        logs.value = [];
        logQueue.length = 0;
    } catch (error) {
        console.error('清除日志失败，请重试', error);
    }
};

// 导出日志
const exportLogs = () => {
    const logText = filteredLogs.value
        .map((log) => `${formatTime(log)} ${log.tag} ${log.message}`)
        .join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logcat_export_${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// 格式化时间
const formatTime = (log: AndroidLogEntry): string => {
    const date = new Date(log.seconds * 1000 + log.nanoseconds / 1000000);
    return date.toISOString().replace('T', ' ').slice(0, -1);
};

// 获取优先级对应的颜色
const getPriorityColor = (priority: AndroidLogPriority): string => {
    return priorityColors[priority] || 'grey darken-2';
};

// 滚动到底部
const scrollToBottom = () => {
    if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
};
</script>

<style scoped>
.device-logcat {
    height: 100%;
    display: flex;
    flex-direction: column;
}

.header {
    padding: 8px;
    border-bottom: 1px solid #e0e0e0;
}

.log-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
}

.log-header {
    display: flex;
    font-weight: bold;
    padding: 6px 6px;
    position: sticky;
    top: 0;
    z-index: 1;
    background-color: #fff;
}

.log-entry {
    display: flex;
    padding: 6px 5px;
    font-size: 0.9rem;
    border-bottom: 1px solid #f0f0f0;
    min-width: max-content;
}

.log-cell {
    padding: 0 10px;
}

.log-cell.time {
    flex: 0 0 210px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.log-cell.priority {
    flex: 0 0 50px;
    text-align: center;
}

.log-cell.tag {
    flex: 0 0 180px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.log-cell.message {
    flex: 1;
    min-width: 200px;
    white-space: nowrap;
    word-break: break-word;
}

.priority-chip {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.no-logs-message {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: #757575;
}

@media (max-width: 600px) {
    .log-cell.time {
        flex: 0 0 120px;
    }

    .log-cell.tag {
        flex: 0 0 100px;
    }
}
</style>
