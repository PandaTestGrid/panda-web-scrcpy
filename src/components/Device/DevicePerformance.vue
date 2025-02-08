<template>
  <v-container fluid class="pa-4 performance-monitor">
    <!-- 控制按钮 -->
    <v-btn
      :color="isMonitoring ? 'error' : 'primary'"
      class="mb-4"
      @click="toggleMonitoring"
    >
      {{ isMonitoring ? "停止监控" : "开始监控" }}
    </v-btn>

    <!-- 总体 CPU 使用率 -->
    <v-card outlined class="mb-4 total-cpu">
      <v-card-text>
        <div class="d-flex justify-space-between align-center mb-2">
          <div class="d-flex align-center">
            <span class="text-h6 mr-2">CPU</span>
            <span class="text-caption grey--text">
              {{ totalCpuUsage?.toFixed(1) || "0.0" }}%
            </span>
          </div>
          <span class="text-caption grey--text"> FPS: {{ fps || 0 }} </span>
        </div>
        <div class="chart-container">
          <Line :data="totalCpuChartData" :options="totalCpuChartOptions" />
        </div>
      </v-card-text>
    </v-card>

    <!-- CPU 核心使用率 -->
    <v-row class="cpu-cores">
      <v-col
        v-for="(core, index) in cpuCores"
        :key="index"
        cols="12"
        sm="6"
        md="3"
        lg="3"
      >
        <v-card outlined class="mb-4 core-card">
          <v-card-text>
            <div class="d-flex justify-space-between align-center mb-2">
              <span class="text-body-2">
                CPU{{ core.core }} {{ core.frequency?.toFixed(0) || "0" }}MHz
              </span>
              <span :class="['text-body-2', getCpuColorClass(core.usage || 0)]">
                {{ core.usage?.toFixed(1) || "0.0" }}%
              </span>
            </div>
            <div class="chart-container">
              <Line
                :data="getCoreChartData(index)"
                :options="coreChartOptions"
              />
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Memory Usage -->
    <v-card outlined class="my-4 memory-usage">
      <v-card-text>
        <div class="d-flex justify-space-between align-center mb-2">
          <div class="d-flex align-center">
            <span class="text-h6 mr-2">Memory</span>
            <span class="text-caption grey--text">
              {{ memoryUsage?.toFixed(1) || "0.0" }}%
            </span>
          </div>
          <span class="text-caption grey--text">
            {{ formatMemory(usedMemory || 0) }} /
            {{ formatMemory(totalMemory || 0) }}
          </span>
        </div>
        <div class="chart-container">
          <Line :data="memoryChartData" :options="memoryChartOptions" />
        </div>
      </v-card-text>
    </v-card>

    <!-- FPS Chart -->
    <v-card outlined class="my-4">
      <v-card-text>
        <div class="d-flex justify-space-between align-center mb-2">
          <div class="d-flex align-center">
            <span class="text-h6 mr-2">FPS</span>
            <span class="text-caption grey--text">{{ fps || 0 }}</span>
          </div>
        </div>
        <div class="chart-container">
          <Line :data="fpsChartData" :options="fpsChartOptions" />
        </div>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from "vue";
import { Line } from "vue-chartjs";
import { usePerformanceMonitor } from "../../composables/usePerformanceMonitor";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const REFRESH_INTERVAL = 1000;
const MAX_DATA_POINTS = 50;

let intervalId = null;
const isMonitoring = ref(false);

const {
  cpuCores,
  totalCpuUsage,
  memoryUsage,
  totalMemory,
  usedMemory,
  updatePerformanceData,
  fps,
} = usePerformanceMonitor();

// 图表数据
const chartData = ref({
  totalCpu: Array(MAX_DATA_POINTS).fill(0),
  memory: Array(MAX_DATA_POINTS).fill(0),
  cores: Array(8).fill(Array(MAX_DATA_POINTS).fill(0)),
  fps: Array(MAX_DATA_POINTS).fill(0),
});

// 图表配置
const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      max: 100,
      grid: {
        color: "rgba(255, 255, 255, 0.1)",
      },
    },
    x: {
      display: false,
    },
  },
  animation: false,
};

// CPU总体图表数据
const totalCpuChartData = computed(() => ({
  labels: Array(MAX_DATA_POINTS).fill(""),
  datasets: [
    {
      data: chartData.value.totalCpu,
      borderColor: "#4CAF50",
      backgroundColor: "rgba(76, 175, 80, 0.2)",
      fill: true,
      tension: 0.4,
    },
  ],
}));

// CPU核心图表数据
const getCoreChartData = (index) => ({
  labels: Array(MAX_DATA_POINTS).fill(""),
  datasets: [
    {
      data: chartData.value.cores[index],
      borderColor: "#4CAF50",
      backgroundColor: "rgba(76, 175, 80, 0.1)",
      fill: true,
      tension: 0.4,
    },
  ],
});

// 内存图表数据
const memoryChartData = computed(() => ({
  labels: Array(MAX_DATA_POINTS).fill(""),
  datasets: [
    {
      data: chartData.value.memory,
      borderColor: "#9C27B0",
      backgroundColor: "rgba(156, 39, 176, 0.2)",
      fill: true,
      tension: 0.4,
    },
  ],
}));

// FPS 图表数据
const fpsChartData = computed(() => ({
  labels: Array(MAX_DATA_POINTS).fill(""),
  datasets: [
    {
      data: chartData.value.fps,
      borderColor: "#FFC107",
      backgroundColor: "rgba(255, 193, 7, 0.1)",
      fill: true,
      tension: 0.4,
      borderWidth: 2,
    },
  ],
}));

// FPS 图表配置
const fpsChartOptions = computed(() => ({
  ...baseChartOptions,
  scales: {
    y: {
      beginAtZero: true,
      max: 60,
      grid: {
        display: true,
        color: "rgba(255, 255, 255, 0.1)",
      },
      ticks: {
        stepSize: 15,
        color: "rgba(255, 255, 255, 0.7)",
      },
    },
    x: {
      display: true,
      grid: {
        display: true,
        color: "rgba(255, 255, 255, 0.1)",
      },
    },
  },
}));

// 更新图表数据
const updateChartData = () => {
  // 更新CPU总体数据
  chartData.value.totalCpu = [
    ...chartData.value.totalCpu.slice(1),
    totalCpuUsage.value || 0,
  ];

  // 更新CPU核心数据
  cpuCores.value.forEach((core, index) => {
    chartData.value.cores[index] = [
      ...chartData.value.cores[index].slice(1),
      core.usage || 0,
    ];
  });

  // 更新内存数据
  chartData.value.memory = [
    ...chartData.value.memory.slice(1),
    memoryUsage.value || 0,
  ];

  // 更新 FPS 数据
  chartData.value.fps = [...chartData.value.fps.slice(1), fps.value || 0];
};

// 切换监控状态
const toggleMonitoring = async () => {
  if (isMonitoring.value) {
    stopMonitoring();
  } else {
    await startMonitoring();
  }
};

// 开始监控
const startMonitoring = async () => {
  try {
    isMonitoring.value = true;

    // 初始化数据
    await updatePerformanceData();

    // 开始定时更新
    updateChartData();
    intervalId = setInterval(async () => {
      await updatePerformanceData();
      updateChartData();
    }, REFRESH_INTERVAL);
  } catch (error) {
    console.error("Failed to start monitoring:", error);
    stopMonitoring();
  }
};

// 停止监控
const stopMonitoring = () => {
  isMonitoring.value = false;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

// 格式化内存显示
const formatMemory = (bytes) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// CPU 使用率颜色类
const getCpuColorClass = (usage) => {
  if (usage > 90) return "red--text";
  if (usage > 70) return "orange--text";
  return "green--text";
};

// 图表选项
const totalCpuChartOptions = computed(() => ({
  ...baseChartOptions,
}));

const coreChartOptions = computed(() => ({
  ...baseChartOptions,
  scales: {
    ...baseChartOptions.scales,
    y: {
      ...baseChartOptions.scales.y,
      ticks: {
        display: false,
      },
    },
  },
}));

const memoryChartOptions = computed(() => ({
  ...baseChartOptions,
}));

onUnmounted(() => {
  stopMonitoring();
});
</script>

<style scoped>
.performance-monitor {
  height: 100vh; /* 设置高度为视口高度 */
  overflow-y: auto; /* 允许垂直滚动 */
  background-color: #fff; /* 设置背景颜色 */
}

.chart-container {
  height: 200px;
}

.cpu-cores .chart-container {
  height: 100px;
}
</style>
