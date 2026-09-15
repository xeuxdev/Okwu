import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      '__DEFAULT_OPENAI_KEY__': JSON.stringify(env.OPENAI_API_KEY || ''),
      '__DEFAULT_OPENAI_MODEL__': JSON.stringify(env.OPENAI_MODEL || 'gpt-4o-mini')
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
  };
});
