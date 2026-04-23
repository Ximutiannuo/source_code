import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // 允许从网络访问（开发模式）
    port: 3000,
    proxy: {
      '/api': {
        // Windows 下 localhost 可能解析到 IPv6 (::1) 导致偶发 ECONNREFUSED，改用 IPv4 回环更稳定
        // 后端运行在8001端口（8200是Vault）
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
        rewrite: (path) => path,
      },
    },
  },
})

