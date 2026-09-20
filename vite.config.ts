import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// Detect if running within AI Studio preview environment
const isAiStudioPreview = Boolean(
  process.env.DISABLE_HMR === 'true' ||
  process.env.APPLET_ID ||
  process.env.APP_URL?.includes('ais-') ||
  process.env.K_SERVICE?.startsWith('ais-')
);

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // Explicitly set hmr: false in AI Studio preview to suppress the WebSocket closure error
      hmr: isAiStudioPreview ? false : true,
      // Disable file watching when in AI Studio preview to save CPU during agent edits
      watch: isAiStudioPreview ? null : {},
    },
  };
});
