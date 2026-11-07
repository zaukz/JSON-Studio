import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Relative base keeps the static build portable across GitHub Pages,
  // Cloudflare Pages and any subdirectory host.
  base: './',
  plugins: [react(), tailwindcss()],
})
