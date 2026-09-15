import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [tailwindcss(), react()],
    define: {
      '__DEFAULT_OPENAI_KEY__': JSON.stringify(env.OPENAI_API_KEY || ''),
      '__DEFAULT_OPENAI_MODEL__': JSON.stringify(env.OPENAI_MODEL || 'gpt-4o-mini')
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: resolve(import.meta.dirname, 'popup.html'),
          options: resolve(import.meta.dirname, 'options.html')
        }
      }
    }
  };
});
