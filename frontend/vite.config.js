import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_PROXY_TARGET || 'http://localhost:80',
        changeOrigin: true,
      },
    },
    allowedHosts: [
      'bookstore.ailab.engineer',
      'localhost'
    ]
  },
});

