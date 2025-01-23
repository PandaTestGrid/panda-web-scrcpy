import { ref } from 'vue'
import { useErrorStore } from '../state'

export function useErrorHandler() {
  const errorStore = ref<ReturnType<typeof useErrorStore> | null>(null)
  
  const showError = (error: Error) => {
    try {
      if (!errorStore.value) {
        errorStore.value = useErrorStore()
      }
      errorStore.value.showError(error.message)
    } catch (e) {
      console.error('Error showing dialog:', error)
      console.error('Original error:', e)
    }
  }

  return { showError }
} 