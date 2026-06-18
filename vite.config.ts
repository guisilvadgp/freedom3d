import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const liveSyncPlugin = () => {
  let activeSceneState = "{}";
  const clients: any[] = [];

  const cacheDir = path.join(process.cwd(), 'node_modules', '.cache', 'freedom3d-assets');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const projectsDir = path.join(process.cwd(), 'projects');
  if (!fs.existsSync(projectsDir)) {
    fs.mkdirSync(projectsDir, { recursive: true });
  }

  return {
    name: 'live-sync',
    enforce: 'pre',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        // 1. List Projects
        if (req.url === '/api/projects' && req.method === 'GET') {
          const folders = fs.readdirSync(projectsDir).filter(name => {
            return fs.statSync(path.join(projectsDir, name)).isDirectory();
          });
          const projects = folders.map(name => {
            const projectPath = path.join(projectsDir, name);
            const scenePath = path.join(projectPath, 'scene.json');
            let entityCount = 0;
            let savedAt = Date.now();
            if (fs.existsSync(scenePath)) {
              try {
                const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
                entityCount = Object.keys(scene.entities || {}).length;
                savedAt = fs.statSync(scenePath).mtimeMs;
              } catch (e) {}
            }
            return {
              id: name,
              name: name,
              savedAt,
              entityCount
            };
          });
          projects.sort((a, b) => b.savedAt - a.savedAt);
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify(projects));
          return;
        }

        // 2. Create Project Folder
        if (req.url === '/api/projects' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              const { name } = JSON.parse(body);
              const cleanName = name.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Novo Projeto';
              const projectPath = path.join(projectsDir, cleanName);
              if (!fs.existsSync(projectPath)) {
                fs.mkdirSync(projectPath, { recursive: true });
                fs.mkdirSync(path.join(projectPath, 'assets'), { recursive: true });
              }
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ success: true, name: cleanName }));
            } catch (e) {
              res.statusCode = 400;
              res.end('Invalid request');
            }
          });
          return;
        }

        // 3. Rename Project Folder
        if (req.url.startsWith('/api/project/rename') && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              const { oldName, newName } = JSON.parse(body);
              const cleanOld = oldName.trim();
              const cleanNew = newName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
              const oldPath = path.join(projectsDir, cleanOld);
              const newPath = path.join(projectsDir, cleanNew);
              if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
                fs.renameSync(oldPath, newPath);
                const scenePath = path.join(newPath, 'scene.json');
                if (fs.existsSync(scenePath)) {
                  const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
                  scene.name = cleanNew;
                  fs.writeFileSync(scenePath, JSON.stringify(scene, null, 2), 'utf8');
                }
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: true, name: cleanNew }));
              } else {
                res.statusCode = 400;
                res.end('Project not found or new name already exists');
              }
            } catch (e) {
              res.statusCode = 500;
              res.end('Error renaming');
            }
          });
          return;
        }

        // 4. Delete Project Folder
        if (req.url.startsWith('/api/project/delete') && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              const { name } = JSON.parse(body);
              const projectPath = path.join(projectsDir, name.trim());
              if (fs.existsSync(projectPath)) {
                fs.rmSync(projectPath, { recursive: true, force: true });
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: true }));
              } else {
                res.statusCode = 404;
                res.end('Not found');
              }
            } catch (e) {
              res.statusCode = 500;
              res.end('Error deleting');
            }
          });
          return;
        }

        // 5. Save Scene to scene.json
        if (req.url.startsWith('/api/project/save-scene') && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              const { projectName, scene } = JSON.parse(body);
              const projectPath = path.join(projectsDir, projectName.trim());
              if (!fs.existsSync(projectPath)) {
                fs.mkdirSync(projectPath, { recursive: true });
                fs.mkdirSync(path.join(projectPath, 'assets'), { recursive: true });
              }
              const scenePath = path.join(projectPath, 'scene.json');
              fs.writeFileSync(scenePath, JSON.stringify(scene, null, 2), 'utf8');
              
              activeSceneState = JSON.stringify(scene);
              clients.forEach(client => {
                try { client.write(`data: ${activeSceneState}\n\n`); } catch(e) {}
              });

              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ success: true }));
            } catch (e) {
              res.statusCode = 500;
              res.end('Error saving scene');
            }
          });
          return;
        }

        // 6. Load Scene from scene.json
        if (req.url.startsWith('/api/project/load-scene') && req.method === 'GET') {
          const urlParams = new URL(req.url, 'http://localhost');
          const name = urlParams.searchParams.get('name') || '';
          const scenePath = path.join(projectsDir, name.trim(), 'scene.json');
          if (fs.existsSync(scenePath)) {
            const content = fs.readFileSync(scenePath, 'utf8');
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(content);
          } else {
            res.statusCode = 404;
            res.end('Scene not found');
          }
          return;
        }

        // 7. Upload Asset to projects/[name]/assets
        if (req.url.startsWith('/api/project/upload-asset') && req.method === 'POST') {
          const urlParams = new URL(req.url, 'http://localhost');
          const projectName = urlParams.searchParams.get('project') || '';
          const fileName = decodeURIComponent(urlParams.searchParams.get('file') || '');
          const projectPath = path.join(projectsDir, projectName.trim());
          const assetsPath = path.join(projectPath, 'assets');
          if (!fs.existsSync(assetsPath)) {
            fs.mkdirSync(assetsPath, { recursive: true });
          }
          const chunks: any[] = [];
          req.on('data', (chunk: any) => chunks.push(chunk));
          req.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const filePath = path.join(assetsPath, fileName);
            fs.writeFileSync(filePath, buffer);
            console.log(`Uploaded asset to project "${projectName}": ${fileName}`);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end('ok');
          });
          return;
        }

        // 8. Get Asset from projects/[name]/assets
        if (req.url.startsWith('/api/project/get-asset') && req.method === 'GET') {
          const urlParams = new URL(req.url, 'http://localhost');
          const projectName = urlParams.searchParams.get('project') || '';
          const fileName = decodeURIComponent(urlParams.searchParams.get('file') || '');
          const filePath = path.join(projectsDir, projectName.trim(), 'assets', fileName);
          if (fs.existsSync(filePath)) {
            if (fileName.endsWith('.glb') || fileName.endsWith('.gltf')) {
              res.setHeader('Content-Type', 'model/gltf-binary');
            } else if (fileName.endsWith('.mp3')) {
              res.setHeader('Content-Type', 'audio/mpeg');
            } else {
              res.setHeader('Content-Type', 'application/octet-stream');
            }
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(fs.readFileSync(filePath));
          } else {
            const globalPath = path.join(cacheDir, fileName);
            if (fs.existsSync(globalPath)) {
              res.setHeader('Content-Type', 'model/gltf-binary');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(fs.readFileSync(globalPath));
            } else {
              res.statusCode = 404;
              res.end('Asset not found');
            }
          }
          return;
        }

        // 9. List Project Assets
        if (req.url.startsWith('/api/project/assets') && req.method === 'GET') {
          const urlParams = new URL(req.url, 'http://localhost');
          const projectName = urlParams.searchParams.get('project') || '';
          const assetsPath = path.join(projectsDir, projectName.trim(), 'assets');
          if (fs.existsSync(assetsPath)) {
            const files = fs.readdirSync(assetsPath);
            const assetsList = files.map(fileName => {
              const filePath = path.join(assetsPath, fileName);
              const stat = fs.statSync(filePath);
              return {
                fileName,
                size: stat.size
              };
            });
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify(assetsList));
          } else {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify([]));
          }
          return;
        }

        // Legacy / Sync Scene JSON
        if (req.url === '/api/sync' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            activeSceneState = body;
            clients.forEach(client => {
              try { client.write(`data: ${body}\n\n`); } catch (e) {}
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

        // Legacy / Sync Assets (GLTF Binary)
        if (req.url.startsWith('/api/asset/') && req.method === 'POST') {
          const pathName = req.url.split('?')[0];
          const fileName = decodeURIComponent(pathName.split('/api/asset/')[1] || '');
          const chunks: any[] = [];
          req.on('data', (chunk: any) => chunks.push(chunk));
          req.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const filePath = path.join(cacheDir, fileName);
            fs.writeFileSync(filePath, buffer);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end('ok');
          });
          return;
        }
        if (req.url.startsWith('/api/asset/') && req.method === 'GET') {
          try {
            const pathName = req.url.split('?')[0];
            const fileName = decodeURIComponent(pathName.split('/api/asset/')[1] || '');
            let filePath = path.join(cacheDir, fileName);

            // Se não existir no cache global, procura nas pastas de assets de todos os projetos
            if (!fs.existsSync(filePath)) {
              if (fs.existsSync(projectsDir)) {
                const folders = fs.readdirSync(projectsDir).filter(name => {
                  try {
                    return fs.statSync(path.join(projectsDir, name)).isDirectory();
                  } catch (e) {
                    return false;
                  }
                });
                for (const folder of folders) {
                  const projectAssetPath = path.join(projectsDir, folder, 'assets', fileName);
                  if (fs.existsSync(projectAssetPath)) {
                    filePath = projectAssetPath;
                    break;
                  }
                }
              }
            }

            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              if (fileName.endsWith('.glb') || fileName.endsWith('.gltf')) {
                res.setHeader('Content-Type', 'model/gltf-binary');
              } else if (fileName.endsWith('.mp3')) {
                res.setHeader('Content-Type', 'audio/mpeg');
              } else {
                res.setHeader('Content-Type', 'application/octet-stream');
              }
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(fs.readFileSync(filePath));
            } else {
              res.statusCode = 404;
              res.end('Not found');
            }
          } catch (err) {
            console.error('Error serving asset:', err);
            res.statusCode = 500;
            res.end('Internal server error');
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




