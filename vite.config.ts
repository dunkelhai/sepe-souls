import { defineConfig } from 'vite';

export default defineConfig({
  base: '/sepe-souls/',
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
