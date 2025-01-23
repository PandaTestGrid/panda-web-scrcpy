<template>
    <v-dialog v-if="store" v-model="store.visible" width="500">
        <v-card>
            <v-card-title>错误</v-card-title>
            <v-card-text>
                <pre class="error-message">{{ store.message }}</pre>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="primary" @click="store.hideError">关闭</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const store = computed(() => {
    try {
        return useErrorStore()
    } catch {
        return null
    }
})
</script>

<style scoped>
.error-message {
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 400px;
    overflow-y: auto;
}
</style> 