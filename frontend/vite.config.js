import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const proxy = { '/api': { target: env.VITE_PROXY_TARGET || 'http://localhost:3000', changeOrigin: false } }
  return {
    plugins: [react()],
    server: { host: 'localhost', port: 5173, strictPort: true, proxy },
    preview: { host: 'localhost', port: 5173, strictPort: true, proxy },
  }
})
