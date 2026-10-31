import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// The page shell speaks for the cis edition too: its link previews describe
// it and show its copy of the card image, which names cishrt.mahiro.uk
// instead of hrt.mahiro.uk (public/og-cis.png, see design/og).
const cisShell = {
    name: 'cis-shell',
    transformIndexHtml: (html: string) =>
        html
            .replace(/https:\/\/hrt\.mahiro\.uk\/og\.png(?:\?v=\d+)?/g, 'https://cishrt.mahiro.uk/og-cis.png')
            .replace(
                /Log HRT doses and lab results, estimate hormone levels, and share a read-only record when you choose to\./g,
                'Log estradiol doses, health checks and blood tests, and estimate your level on top of your own.',
            ),
};

export default defineConfig(({ mode }) => {
    // The cis women's edition (cishrt.mahiro.uk) is this same app built with
    // `--mode cis`; src/edition.ts says what changes. It builds into its own
    // folder, so deploying one edition can never pick up the other's files.
    const cis = mode === 'cis';
    return {
        define: {
            'import.meta.env.VITE_EDITION': JSON.stringify(cis ? 'cis' : ''),
        },
        build: {
            outDir: cis ? 'dist-cis' : 'dist',
        },
        server: {
            port: 3000,
            host: '0.0.0.0',
            proxy: {
                '/api': {
                    target: 'http://127.0.0.1:8787',
                    changeOrigin: true,
                    secure: false,
                },
            },
        },
        plugins: [
            react(),
            ...(cis ? [cisShell] : []),
            VitePWA({
                // A new build waits until the user taps refresh in the update
                // prompt (src/utils/swUpdate.ts registers the worker itself).
                registerType: 'prompt',
                injectRegister: false,
                includeAssets: ['favicon.png', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
                manifest: {
                    name: 'HRT Tracker',
                    short_name: 'HRT Tracker',
                    description: cis
                        ? 'Log estradiol doses and estimate your levels from your own health check'
                        : 'Log HRT doses and estimate hormone levels',
                    theme_color: '#FFFFFF',
                    background_color: '#FFFFFF',
                    display: 'standalone',
                    orientation: 'portrait',
                    icons: [
                        {
                            src: 'pwa-192x192.png',
                            sizes: '192x192',
                            type: 'image/png',
                            purpose: 'any maskable',
                        },
                        {
                            src: 'pwa-512x512.png',
                            sizes: '512x512',
                            type: 'image/png',
                            purpose: 'any maskable',
                        },
                    ],
                },
                workbox: {
                    // Shared pages require the network API and should always load the
                    // current application shell instead of an older precached shell.
                    navigateFallbackDenylist: [/^\/share(?:\/|$)/],
                },
            }),
        ],
    };
});
