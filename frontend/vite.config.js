import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const hmrHost = process.env.VITE_HMR_HOST;
const hmrProtocol = process.env.VITE_HMR_PROTOCOL;
const hmrClientPort = process.env.VITE_HMR_CLIENT_PORT;
const hmrDisabled = process.env.VITE_HMR === 'false';

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'use-sync-external-store'],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'use-sync-external-store',
      'use-sync-external-store/with-selector',
      'zustand',
      'zustand/middleware',
    ],
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    // Custom HMR qua domain Docker có thể gây reload trang liên tục nếu WebSocket lỗi.
    // Đặt VITE_HMR=false trong .env để tắt HMR khi gặp hiện tượng đó.
    hmr: hmrDisabled
      ? false
      : hmrHost
        ? {
            host: hmrHost,
            protocol: hmrProtocol || 'wss',
            clientPort: Number(hmrClientPort || 443),
          }
        : true,
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

