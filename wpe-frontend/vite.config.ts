import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/v1': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  // A2: test luôn chạy chế độ mock, không phụ thuộc .env.local hay biến môi trường của từng máy.
  test: {
    env: {
      VITE_USE_MOCK: 'true',
    },
  },
})
