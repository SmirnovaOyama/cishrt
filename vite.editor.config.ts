import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The cis edition's text editor (editorWorker.ts): its own small page, built
// from editor/ with the cis edition's language packs, which it lists for
// editing.
export default defineConfig({
    root: 'editor',
    plugins: [react()],
    define: {
        'import.meta.env.VITE_EDITION': JSON.stringify('cis'),
    },
    build: {
        outDir: '../dist-editor',
        emptyOutDir: true,
    },
    server: {
        port: 3004,
        proxy: { '/api': { target: 'http://127.0.0.1:8788', changeOrigin: true } },
    },
});
