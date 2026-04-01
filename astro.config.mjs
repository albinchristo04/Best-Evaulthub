import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://deportesenvivo.live',
  output: 'static',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/embed/')
    })
  ],
  build: { format: 'directory' },
  vite: { build: { rollupOptions: { output: { manualChunks: undefined } } } }
});
