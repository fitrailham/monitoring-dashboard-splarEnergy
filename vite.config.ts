import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['API_PROXY_TARGET', 'API_PROXY_LEGACY_DASHBOARD', 'VITE_API_URL'])
  const configured = (env.API_PROXY_TARGET || env.VITE_API_URL || '').trim()
  const target = /^https?:\/\//i.test(configured) ? configured : 'http://127.0.0.1:8000'
  const routes: Record<string, string> = {
    '/api/v1/dashboard/overview': '/api/portfolio/summary',
    '/api/v1/plants': '/api/database/overview',
    '/api/v1/alarms/active': '/api/alarms',
  }
  const proxy = {
    '/api': {
      target,
      changeOrigin: true,
      rewrite: (path: string) => {
        if (env.API_PROXY_LEGACY_DASHBOARD !== 'true') return path
        const url = new URL(path, target)
        const mapped = routes[url.pathname]
        if (!mapped) return path
        if (mapped === '/api/alarms') url.searchParams.set('state', 'active')
        return mapped + url.search
      },
    },
  }
  return {
    plugins: [react()],
    server: { proxy },
    preview: { proxy },
  }
})
