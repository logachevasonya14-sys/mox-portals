import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the same build works on Vercel, Netlify and GitHub Pages (/<repo>/).
export default defineConfig({
  base: './',
  plugins: [react()],
  // On Windows "localhost" may bind to IPv6 [::1] only, and browsers trying 127.0.0.1 get "connection refused".
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
})
