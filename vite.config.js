import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3000
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        gallery: './gallery.html',
        booking: './booking.html',
        login: './login.html',
        admin: './admin.html'
      }
    }
  }
})
