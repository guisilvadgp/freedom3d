import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const liveSyncPlugin = () => {
  let activeSceneState = "{}";
  const assets = new Map();
  const clients: any[] = [];

  return {
    name: 'live-sync',
    enforce: 'pre',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        // Sync Scene JSON
        if (req.url === '/api/sync' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            activeSceneState = body;
            clients.forEach(client => {
              try {
                client.write(`data: ${body}\n\n`);
              } catch (e) {
                // Ignore closed client
              }
            });
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
        if (req.url === '/api/sync-stream' && req.method === 'GET') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
          });
          res.write(': ping\n\n');
          clients.push(res);
          req.on('close', () => {
            const index = clients.indexOf(res);
            if (index !== -1) clients.splice(index, 1);
          });
          return;
        }

        // Sync Assets (GLTF Binary)
        if (req.url.startsWith('/api/asset/') && req.method === 'POST') {
          const pathName = req.url.split('?')[0];
          const fileName = decodeURIComponent(pathName.split('/api/asset/')[1] || '');
          const chunks: any[] = [];
          req.on('data', (chunk: any) => chunks.push(chunk));
          req.on('end', () => {
            const buffer = Buffer.concat(chunks);
            assets.set(fileName, buffer);
            console.log('UPLOADED ASSET: ', fileName, ' SIZE: ', buffer.length);
            console.log('UPLOADED ASSET: ', fileName);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end('ok');
          });
          return;
        }
        if (req.url.startsWith('/api/asset/') && req.method === 'GET') {
          const pathName = req.url.split('?')[0];
          const fileName = decodeURIComponent(pathName.split('/api/asset/')[1] || '');
          if (assets.has(fileName)) {
            res.setHeader('Content-Type', 'model/gltf-binary');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(assets.get(fileName));
          } else {
            console.log('404 NOT FOUND: ', fileName);
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




