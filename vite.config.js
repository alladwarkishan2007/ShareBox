import { defineConfig } from 'vite';

export default defineConfig({
  base: '/ShareBox/',
  root: '.',
  server: {
    port: 3000,
    open: false
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true
  },
  esbuild: {
    supported: {
      'top-level-await': true
    }
  }
});
