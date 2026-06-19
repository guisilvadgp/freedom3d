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
      // Configurar servidor WebSocket para replicação multiplayer
      try {
        const { WebSocketServer } = require('ws');
        const wss = new WebSocketServer({ noServer: true });

        server.httpServer.on('upgrade', (request: any, socket: any, head: any) => {
          const urlParams = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
          if (urlParams.pathname === '/api/multiplayer') {
            wss.handleUpgrade(request, socket, head, (ws: any) => {
              wss.emit('connection', ws, request);
            });
          }
        });

        const rooms = new Map<string, Set<any>>(); // roomId -> Set of ws sockets

        wss.on('connection', (ws: any) => {
          let currentRoomId = 'default-room';
          let currentPlayerId = '';

          ws.on('message', (messageStr: string) => {
            try {
              const data = JSON.parse(messageStr);
              if (data.type === 'join') {
                currentPlayerId = data.playerId;
                currentRoomId = data.roomId || 'default-room';
                
                if (!rooms.has(currentRoomId)) {
                  rooms.set(currentRoomId, new Set());
                }
                const room = rooms.get(currentRoomId)!;
                
                ws.playerId = currentPlayerId;
                ws.position = data.position || [0, 0, 0];
                ws.rotation = data.rotation || [0, 0, 0];
                ws.name = data.name || `Player_${currentPlayerId}`;
                
                room.add(ws);
                console.log(`[WS Multiplayer] Player ${currentPlayerId} joined room ${currentRoomId}`);

                // Envia a lista dos outros jogadores
                const existingPlayers = Array.from(room)
                  .filter((client: any) => client !== ws && client.playerId)
                  .map((client: any) => ({
                    playerId: client.playerId,
                    position: client.position,
                    rotation: client.rotation,
                    name: client.name
                  }));
                
                ws.send(JSON.stringify({
                  type: 'room-players',
                  players: existingPlayers
                }));

                // Notifica os outros
                room.forEach((client: any) => {
                  if (client !== ws && client.readyState === 1) {
                    client.send(JSON.stringify({
                      type: 'player-joined',
                      playerId: currentPlayerId,
                      position: ws.position,
                      rotation: ws.rotation,
                      name: ws.name
                    }));
                  }
                });
              } else if (data.type === 'move') {
                ws.position = data.position;
                ws.rotation = data.rotation;

                const room = rooms.get(currentRoomId);
                if (room) {
                  room.forEach((client: any) => {
                    if (client !== ws && client.readyState === 1) {
                      client.send(JSON.stringify({
                        type: 'player-moved',
                        playerId: currentPlayerId,
                        position: data.position,
                        rotation: data.rotation
                      }));
                    }
                  });
                }
              }
            } catch (err) {
              console.error('[WS Multiplayer] Error processing message:', err);
            }
          });

          ws.on('close', () => {
            const room = rooms.get(currentRoomId);
            if (room) {
              room.delete(ws);
              console.log(`[WS Multiplayer] Player ${currentPlayerId} left room ${currentRoomId}`);
              
              room.forEach((client: any) => {
                if (client.readyState === 1) {
                  client.send(JSON.stringify({
                    type: 'player-left',
                    playerId: currentPlayerId
                  }));
                }
              });

              if (room.size === 0) {
                rooms.delete(currentRoomId);
              }
            }
          });
        });
      } catch (err) {
        console.warn('[WS Multiplayer] Could not initialize WebSocket server, ws module probably missing:', err);
      }

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

        // 5. Save Scene to scene.json or scenes/[sceneName].json
        if (req.url.startsWith('/api/project/save-scene') && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              const { projectName, sceneName, scene } = JSON.parse(body);
              const projectPath = path.join(projectsDir, projectName.trim());
              if (!fs.existsSync(projectPath)) {
                fs.mkdirSync(projectPath, { recursive: true });
                fs.mkdirSync(path.join(projectPath, 'assets'), { recursive: true });
              }

              const scenesDir = path.join(projectPath, 'scenes');
              if (!fs.existsSync(scenesDir)) {
                fs.mkdirSync(scenesDir, { recursive: true });
              }

              const sceneNameClean = (sceneName || 'Main Scene').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
              const scenePath = path.join(scenesDir, `${sceneNameClean}.json`);
              fs.writeFileSync(scenePath, JSON.stringify(scene, null, 2), 'utf8');

              // Retrocompatibilidade: Se for Main Scene ou o nome do próprio projeto, salva no scene.json da raiz
              if (!sceneName || sceneNameClean === 'Main Scene' || sceneNameClean === projectName) {
                fs.writeFileSync(path.join(projectPath, 'scene.json'), JSON.stringify(scene, null, 2), 'utf8');
              }
              
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

        // 6. Load Scene from scene.json or scenes/[sceneName].json
        if (req.url.startsWith('/api/project/load-scene') && req.method === 'GET') {
          const urlParams = new URL(req.url, 'http://localhost');
          const name = urlParams.searchParams.get('name') || '';
          const sceneName = urlParams.searchParams.get('sceneName') || '';
          const projectPath = path.join(projectsDir, name.trim());
          const sceneNameClean = sceneName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();

          let scenePath = path.join(projectPath, 'scenes', `${sceneNameClean}.json`);
          if (!sceneName || !fs.existsSync(scenePath)) {
            scenePath = path.join(projectPath, 'scene.json');
          }

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

        // 6b. List Scenes in a Project
        if (req.url.startsWith('/api/project/scenes') && req.method === 'GET') {
          const urlParams = new URL(req.url, 'http://localhost');
          const projectName = urlParams.searchParams.get('project') || '';
          const projectPath = path.join(projectsDir, projectName.trim());
          const scenesDir = path.join(projectPath, 'scenes');
          let scenesList: string[] = [];
          
          if (fs.existsSync(scenesDir)) {
            scenesList = fs.readdirSync(scenesDir)
              .filter(f => f.endsWith('.json'))
              .map(f => f.replace('.json', ''));
          }

          if (scenesList.length === 0 && fs.existsSync(path.join(projectPath, 'scene.json'))) {
            scenesList.push('Main Scene');
          }

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify(scenesList));
          return;
        }

        // 6c. Delete Scene in a Project
        if (req.url.startsWith('/api/project/delete-scene') && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              const { projectName, sceneName } = JSON.parse(body);
              const sceneNameClean = sceneName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
              const scenePath = path.join(projectsDir, projectName.trim(), 'scenes', `${sceneNameClean}.json`);
              if (fs.existsSync(scenePath)) {
                fs.unlinkSync(scenePath);
              }
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ success: true }));
            } catch (e) {
              res.statusCode = 500;
              res.end('Error deleting scene');
            }
          });
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
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            res.end(fs.readFileSync(filePath));
          } else {
            const globalPath = path.join(cacheDir, fileName);
            if (fs.existsSync(globalPath)) {
              res.setHeader('Content-Type', 'model/gltf-binary');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
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

        // 9b. Export Project as Standalone Web App (ZIP)
        if (req.url.startsWith('/api/project/export') && req.method === 'GET') {
          const urlParams = new URL(req.url, 'http://localhost');
          const projectName = urlParams.searchParams.get('project') || '';
          const cleanProjectName = projectName.trim();
          const projectPath = path.join(projectsDir, cleanProjectName);
          const scenePath = path.join(projectPath, 'scene.json');

          if (!projectName || !fs.existsSync(scenePath)) {
            res.statusCode = 404;
            res.end('Project scene not found');
            return;
          }

          const distPath = path.join(process.cwd(), 'dist');
          if (!fs.existsSync(distPath)) {
            res.statusCode = 500;
            res.end('Production build not found. Please run npm run build first.');
            return;
          }

          const tempExportDir = path.join(projectPath, 'export_temp');
          const zipPath = path.join(projectPath, `${cleanProjectName}_export.zip`);

          try {
            // Remove arquivos residuais
            if (fs.existsSync(tempExportDir)) {
              fs.rmSync(tempExportDir, { recursive: true, force: true });
            }
            if (fs.existsSync(zipPath)) {
              fs.rmSync(zipPath, { force: true });
            }

            // Cria diretório temporário
            fs.mkdirSync(tempExportDir, { recursive: true });

            // 1. Copiar todos os arquivos de dist/ para export_temp/
            const copyRecursiveSync = (src: string, dest: string) => {
              const exists = fs.existsSync(src);
              const stats = exists && fs.statSync(src);
              const isDirectory = stats && stats.isDirectory();
              if (isDirectory) {
                if (!fs.existsSync(dest)) fs.mkdirSync(dest);
                fs.readdirSync(src).forEach((childItemName) => {
                  copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
                });
              } else {
                fs.copyFileSync(src, dest);
              }
            };
            copyRecursiveSync(distPath, tempExportDir);

            // 2. Copiar scene.json do projeto
            fs.copyFileSync(scenePath, path.join(tempExportDir, 'scene.json'));

            // 3. Copiar assets do projeto
            const projectAssetsDir = path.join(projectPath, 'assets');
            const exportAssetsDir = path.join(tempExportDir, 'assets');
            if (fs.existsSync(projectAssetsDir)) {
              if (!fs.existsSync(exportAssetsDir)) fs.mkdirSync(exportAssetsDir);
              fs.readdirSync(projectAssetsDir).forEach((file) => {
                fs.copyFileSync(path.join(projectAssetsDir, file), path.join(exportAssetsDir, file));
              });
            }

            // 4. Injetar flag standalone no index.html
            const indexHtmlPath = path.join(tempExportDir, 'index.html');
            if (fs.existsSync(indexHtmlPath)) {
              let html = fs.readFileSync(indexHtmlPath, 'utf8');
              const scriptInject = `<script>window.__freedom3d_standalone__ = true;</script>`;
              // Insere no início do head
              if (html.includes('<head>')) {
                html = html.replace('<head>', `<head>${scriptInject}`);
              } else {
                html = scriptInject + html;
              }
              fs.writeFileSync(indexHtmlPath, html, 'utf8');
            }

            // 5. Comprimir a pasta temporária usando Compress-Archive do PowerShell
            const { exec } = require('child_process');
            const cmd = `powershell -Command "Compress-Archive -Path '${tempExportDir}/*' -DestinationPath '${zipPath}' -Force"`;
            
            exec(cmd, (err: any, _stdout: any, _stderr: any) => {
              // Limpa a pasta temporária export_temp após zipar
              try { fs.rmSync(tempExportDir, { recursive: true, force: true }); } catch (e) {}

              if (err) {
                console.error('[Export Error] Compressing failed:', err, _stderr);
                res.statusCode = 500;
                res.end('Compression failed');
                return;
              }

              if (fs.existsSync(zipPath)) {
                res.setHeader('Content-Type', 'application/zip');
                res.setHeader('Content-Disposition', `attachment; filename="${cleanProjectName}_export.zip"`);
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(fs.readFileSync(zipPath));
                
                // Remove o ZIP gerado localmente após enviar
                try { fs.rmSync(zipPath, { force: true }); } catch(e) {}
              } else {
                res.statusCode = 500;
                res.end('Zip file not found');
              }
            });

          } catch (error) {
            console.error('[Export Error] Failed to export:', error);
            try { fs.rmSync(tempExportDir, { recursive: true, force: true }); } catch (e) {}
            try { fs.rmSync(zipPath, { force: true }); } catch (e) {}
            res.statusCode = 500;
            res.end('Failed to process export');
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
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
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

        // --- API DO FILE EXPLORER ---

        // 1. Listar arquivos e pastas
        if (req.url.startsWith('/api/explorer/list') && req.method === 'GET') {
          try {
            const urlParams = new URL(req.url, 'http://localhost');
            const projectName = urlParams.searchParams.get('project') || '';
            const subpath = urlParams.searchParams.get('subpath') || '';
            const targetPath = path.join(projectsDir, projectName.trim(), subpath);

            if (!fs.existsSync(targetPath)) {
              res.statusCode = 404;
              res.end('Directory not found');
              return;
            }

            const items = fs.readdirSync(targetPath);
            const list = items.map(name => {
              const itemPath = path.join(targetPath, name);
              const relativePath = subpath ? `${subpath}/${name}` : name;
              const stat = fs.statSync(itemPath);
              return {
                name,
                isDir: stat.isDirectory(),
                path: relativePath,
                size: stat.isFile() ? stat.size : 0
              };
            });

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify(list));
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
          return;
        }

        // 2. Criar Pasta
        if (req.url.startsWith('/api/explorer/create-folder') && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              const { project, subpath, folderName } = JSON.parse(body);
              const cleanFolderName = folderName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
              if (!cleanFolderName) throw new Error('Nome de pasta inválido');

              const targetPath = path.join(projectsDir, project.trim(), subpath || '', cleanFolderName);
              if (!fs.existsSync(targetPath)) {
                fs.mkdirSync(targetPath, { recursive: true });
              }
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ success: true }));
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        // 3. Criar Arquivo
        if (req.url.startsWith('/api/explorer/create-file') && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              const { project, subpath, fileName, content } = JSON.parse(body);
              const cleanFileName = fileName.replace(/[^a-zA-Z0-9_\-\.\s]/g, '').trim();
              if (!cleanFileName) throw new Error('Nome de arquivo inválido');

              const targetPath = path.join(projectsDir, project.trim(), subpath || '', cleanFileName);
              fs.writeFileSync(targetPath, content || '', 'utf8');

              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ success: true }));
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        // 4. Ler Arquivo
        if (req.url.startsWith('/api/explorer/read-file') && req.method === 'GET') {
          try {
            const urlParams = new URL(req.url, 'http://localhost');
            const projectName = urlParams.searchParams.get('project') || '';
            const subpath = urlParams.searchParams.get('subpath') || '';
            const targetPath = path.join(projectsDir, projectName.trim(), subpath);

            if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
              res.statusCode = 404;
              res.end('File not found');
              return;
            }

            const content = fs.readFileSync(targetPath, 'utf8');
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ content }));
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
          return;
        }

        // 5. Escrever/Salvar Arquivo
        if (req.url.startsWith('/api/explorer/write-file') && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              const { project, subpath, content } = JSON.parse(body);
              const targetPath = path.join(projectsDir, project.trim(), subpath);

              fs.writeFileSync(targetPath, content, 'utf8');

              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ success: true }));
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        // 6. Excluir Arquivo/Pasta
        if (req.url.startsWith('/api/explorer/delete') && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              const { project, subpath } = JSON.parse(body);
              const targetPath = path.join(projectsDir, project.trim(), subpath);

              if (fs.existsSync(targetPath)) {
                fs.rmSync(targetPath, { recursive: true, force: true });
              }

              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ success: true }));
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        next();
      });
    }
  };
};

export default defineConfig({
  base: './',
  plugins: [react(), liveSyncPlugin()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true
  }
})




