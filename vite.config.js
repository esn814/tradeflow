import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: 'hidden',
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          // React core
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'vendor-react';
          // React Router
          if (id.includes('node_modules/react-router')) return 'vendor-router';
          // i18n framework
          if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next')) return 'vendor-i18n';
          // D3 sub-libraries (split from recharts)
          if (id.includes('node_modules/d3-')) return 'vendor-d3';
          // Recharts core
          if (id.includes('node_modules/recharts/')) return 'vendor-recharts';
          // Lucide icons
          if (id.includes('node_modules/lucide-react/')) return 'vendor-lucide';
          // html2canvas (200KB)
          if (id.includes('node_modules/html2canvas')) return 'vendor-html2canvas';
          // Sentry SDK
          if (id.includes('node_modules/@sentry')) return 'vendor-sentry';
          // Crypto primitives
          if (id.includes('node_modules/@noble/curves')) return 'vendor-noble-curves';
          if (id.includes('node_modules/@noble/hashes')) return 'vendor-noble-hashes';
          if (id.includes('node_modules/@noble') || id.includes('node_modules/@spruceid') || id.includes('node_modules/siwe/')) return 'vendor-siwe';
          // Ethers — split largest sub-modules (Rolldown resolves to lib.commonjs)
          if (id.includes('/ethers/lib.commonjs/providers')) return 'vendor-ethers-providers';
          if (id.includes('/ethers/lib.commonjs/wordlists')) return 'vendor-ethers-wordlists';
          if (id.includes('/ethers/lib.commonjs/abi')) return 'vendor-ethers-abi';
          if (id.includes('/ethers/lib.commonjs/contract')) return 'vendor-ethers-contract';
          if (id.includes('/ethers/lib.commonjs/wallet')) return 'vendor-ethers-wallet';
          if (id.includes('/ethers/lib.commonjs/utils')) return 'vendor-ethers-utils';
          if (id.includes('node_modules/ethers/')) return 'vendor-ethers-core';
          // Capacitor runtime
          if (id.includes('node_modules/@capacitor/')) return 'vendor-capacitor';
          // All other node_modules
          if (id.includes('node_modules/')) return 'vendor-misc';
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    exclude: ['e2e/**', 'server/**', 'node_modules/**'],
    css: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
})
