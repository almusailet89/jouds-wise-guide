import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // VITE_BASE_PATH=/ for Vercel; defaults to /jouds-wise-guide/ for GitHub Pages
  base: process.env.VITE_BASE_PATH ?? (mode === "production" ? "/jouds-wise-guide/" : "/"),
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      // Service worker lives at /sw.js — no extra path prefix needed
      filename: "sw.js",
      manifest: false, // We ship our own /public/manifest.json
      workbox: {
        // Cache strategy: network-first for API/auth calls, cache-first for assets
        runtimeCaching: [
          {
            // Supabase API — network-first, 10s timeout, fallback to cache
            urlPattern: /^https:\/\/.*\.supabase\.co\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
          {
            // External data APIs (prayer times, weather, exchange rates)
            urlPattern: /^https:\/\/(api\.aladhan\.com|api\.open-meteo\.com|open\.er-api\.com)\//,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "external-apis",
              expiration: { maxEntries: 20, maxAgeSeconds: 3600 },
            },
          },
          {
            // Google Fonts + any CDN fonts
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "fonts",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "/index.html",
        // Don't cache the admin route in SW — always network
        navigateFallbackDenylist: [/^\/admin/],
      },
      devOptions: {
        enabled: false, // Keep dev uncluttered; SW only activates in prod build
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Animation library (~100 KB) — shared but sizeable
          'vendor-motion': ['framer-motion'],
          // Supabase client — large, changes rarely
          'vendor-supabase': ['@supabase/supabase-js'],
          // Radix UI primitives — many small modules, bundle together
          'vendor-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-tabs',
            '@radix-ui/react-select',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-slider',
            '@radix-ui/react-switch',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-popover',
            '@radix-ui/react-avatar',
            '@radix-ui/react-separator',
            '@radix-ui/react-label',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-progress',
          ],
          // Recharts — only used in Finance & Mood tabs
          'vendor-charts': ['recharts'],
        },
      },
    },
  },
}));
