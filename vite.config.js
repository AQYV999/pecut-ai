import { defineConfig } from 'vite';
import { handleProxyRequest } from './api/ai/proxy.js';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    port: 5173,
    open: false
  },
  plugins: [
    {
      name: 'vite-plugin-ai-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url && req.url.startsWith('/api/ai/proxy')) {
            return handleProxyRequest(req, res);
          }
          next();
        });
      }
    }
  ],
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
