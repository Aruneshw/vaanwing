import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  // In development, /api is forwarded to the FastAPI backend (cd backend && uvicorn app.main:app).
  server: { proxy: { '/api': process.env.VITE_PROXY_TARGET ?? 'http://localhost:8000' } },
})
