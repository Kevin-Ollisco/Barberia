import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // host: true permite abrir la app desde el celular en la misma red WiFi
  server: { host: true },
})
