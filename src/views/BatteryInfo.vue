<template>
  <v-card class="battery-card" flat>
    <v-card-text class="pa-6">
      <div class="text-h6 font-weight-regular mb-4">电池</div>
      <div
        class="d-flex flex-column align-center justify-center"
        style="height: 180px"
      >
        <div class="battery-circle">
          <div class="battery-background"></div>
          <div class="battery-level" :style="batteryLevelStyle"></div>
          <div class="battery-text">{{ batteryPercentage }}%</div>
        </div>
        <div class="mt-4 text-subtitle-1">
          {{ formattedVoltage }}V {{ temperature }}°C
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps({
  batteryPercentage: {
    type: Number,
    required: true,
    validator: (value: number) => value >= 0 && value <= 100,
  },
  voltage: {
    type: Number,
    required: true,
  },
  temperature: {
    type: Number,
    required: true,
  },
});

const batteryLevelStyle = computed(() => {
  return {
    height: `${props.batteryPercentage}%`,
  }
});

const formattedVoltage = computed(() => {
  return isNaN(props.voltage) ? '0.000' : props.voltage.toFixed(3);
});
</script>

<style scoped>
.battery-card {
  background: white;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  min-width: 280px;
}

.battery-circle {
  position: relative;
  width: 140px;
  height: 140px;
  border-radius: 50%;
  overflow: hidden;
  margin: 0 auto;
}

.battery-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.05);
}

.battery-level {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  background: linear-gradient(to bottom, #ef5350, #42a5f5);
  transition: height 0.3s ease;
}

.battery-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 24px;
  font-weight: 500;
  z-index: 2;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
</style>
