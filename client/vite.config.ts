import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Read the single repo-root .env. Vite only exposes VITE_* keys to the browser.
  envDir: '..',
})
