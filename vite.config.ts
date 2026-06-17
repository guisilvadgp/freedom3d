import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const liveSyncPlugin = () => {
  let activeSceneState = "{}";
  const assets = new Map();

  return {
    name: 'live-sync',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        // Sync Scene JSON
        if (req.url === '/api/sync' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            activeSceneState = body;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end('ok');
          });
          return;
        }
        if (req.url === '/api/sync' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(activeSceneState);
          return;
        }

        // Sync Assets (GLTF Binary)
        if (req.url.startsWith('/api/asset/') && req.method === 'POST') {
          const fileName = decodeURIComponent(req.url.split('/api/asset/')[1]);
          const chunks: any[] = [];
          req.on('data', (chunk: any) => chunks.push(chunk));
          req.on('end', () => {
            assets.set(fileName, Buffer.concat(chunks));
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end('ok');
          });
          return;
        }
        if (req.url.startsWith('/api/asset/') && req.method === 'GET') {
          const fileName = decodeURIComponent(req.url.split('/api/asset/')[1]);
          if (assets.has(fileName)) {
            res.setHeader('Content-Type', 'model/gltf-binary');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(assets.get(fileName));
          } else {
            res.statusCode = 404;
            res.end('Not found');
          }
          return;
        }

        next();
      });
    }
  };
};

export default defineConfig({
  plugins: [react(), liveSyncPlugin()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true
  }
})
