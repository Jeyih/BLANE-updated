import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { handler as ingredientPrices } from './netlify/functions/ingredient-prices.mjs';
var stdin_default = defineConfig({
  plugins: [
    {
      name: 'ingredient-price-api',
      configureServer(server) {
        server.middlewares.use('/.netlify/functions/ingredient-prices', async (req, res) => {
          try {
            const query = new URL(req.url || '/', 'http://localhost').searchParams;
            const result = await ingredientPrices({
              httpMethod: req.method,
              queryStringParameters: { refresh: query.get('refresh') },
            });
            res.writeHead(result.statusCode, result.headers);
            res.end(result.body);
          } catch {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Price source unavailable' }));
          }
        });
      },
    },
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'BLANE \u2014 Biological Adaptive Nutrition Engine',
        short_name: 'BLANE',
        description: 'Adaptive nutrition planner with markets, recipes, and food composition data.',
        theme_color: '#2ddc7a',
        background_color: '#060d0a',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
    }),
  ],
});
export { stdin_default as default };
