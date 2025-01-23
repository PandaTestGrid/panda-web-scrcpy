<script setup>
import { ref, onMounted } from 'vue'

const stats = ref({
  stars: 0,
  forks: 0,
  watchers: 0
})

const loading = ref(true)

onMounted(async () => {
  try {
    const response = await fetch('https://api.github.com/repos/Maxwellos/web-scrcpy')
    const data = await response.json()
    stats.value = {
      stars: data.stargazers_count,
      forks: data.forks_count,
      watchers: data.watchers_count
    }
  } catch (error) {
    console.error('Failed to fetch GitHub stats:', error)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="d-flex align-center">
    <v-btn
      variant="text"
      density="comfortable"
      class="github-stat px-2"
      href="https://github.com/Maxwellos/web-scrcpy/stargazers"
      target="_blank"
      :loading="loading"
    >
      <v-icon start size="small">mdi-star</v-icon>
      {{ stats.stars }}
    </v-btn>

    <v-btn
      variant="text"
      density="comfortable"
      class="github-stat px-2"
      href="https://github.com/Maxwellos/web-scrcpy/network/members"
      target="_blank"
      :loading="loading"
    >
      <v-icon start size="small">mdi-source-fork</v-icon>
      {{ stats.forks }}
    </v-btn>

    <v-btn
      variant="text"
      density="comfortable"
      class="github-stat px-2"
      href="https://github.com/Maxwellos/web-scrcpy/watchers"
      target="_blank"
      :loading="loading"
    >
      <v-icon start size="small">mdi-eye</v-icon>
      {{ stats.watchers }}
    </v-btn>
  </div>
</template>

<style scoped>
.github-stat {
  min-width: 0;
  color: rgba(0, 0, 0, 0.7);
}
</style> 