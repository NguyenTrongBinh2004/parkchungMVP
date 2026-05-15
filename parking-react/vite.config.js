import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/loai-xe': 'http://localhost:8000',
      '/xe-vao': 'http://localhost:8000',
      '/xe-ra': 'http://localhost:8000',
      '/xe-trong-bai': 'http://localhost:8000',
      '/thanh-toan': 'http://localhost:8000',
      '/dang-ky-ve-thang': 'http://localhost:8000',
      '/danh-sach-ve-thang': 'http://localhost:8000',
      '/ve-thang': 'http://localhost:8000',
      '/khach-hang': 'http://localhost:8000',
      '/uploads': 'http://localhost:8000',
    }
  }
})