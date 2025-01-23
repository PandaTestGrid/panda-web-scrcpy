import { defineStore } from 'pinia';

export const useErrorStore = defineStore('error', {
    state: () => ({
        visible: false,
        message: '',
    }),

    actions: {
        showError(error: Error | string) {
            this.visible = true;
            if (error instanceof Error) {
                this.message = error.stack || error.message;
            } else {
                this.message = error;
            }
        },

        hideError() {
            this.visible = false;
            this.message = '';
        }
    }
});
