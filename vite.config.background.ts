import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/background/service-worker.ts'),
      name: 'LinkedInServiceWorker',
      formats: ['es'],
      fileName: () => 'service-worker.js'
    }
  }
});
