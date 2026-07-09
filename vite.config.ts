import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import fs from 'fs'
import path from 'path'

const serveFilePhysical = (req: any, res: any, filePath: string, defaultContentType?: string) => {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.statusCode = 404;
    res.end('File not found');
    return;
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  let contentType = defaultContentType;
  if (!contentType) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.glb' || ext === '.gltf') contentType = 'model/gltf-binary';
    else if (ext === '.mp3') contentType = 'audio/mpeg';
    else if (ext === '.wav') contentType = 'audio/wav';
    else if (ext === '.ogg') contentType = 'audio/ogg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.mp4') contentType = 'video/mp4';
    else if (ext === '.webm') contentType = 'video/webm';
    else if (ext === '.ogv') contentType = 'video/ogg';
    else contentType = 'application/octet-stream';
  }

  res.setHeader('Content-Type', contentType);
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      res.statusCode = 416;
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      res.end();
      return;
    }

    const chunksize = (end - start) + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });

    res.statusCode = 206;
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', chunksize);
    fileStream.pipe(res);
  } else {
    res.statusCode = 200;
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    fs.createReadStream(filePath).pipe(res);
  }
};

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
      // Configurar servidor WebSocket para replicação multiplayer usando import dinâmico para compatibilidade ESM
      import('ws').then(({ WebSocketServer }) => {
        try {
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
                  ws.role = data.role || 'red';
                  ws.playbackRate = data.playbackRate;
                  ws.volume = data.volume;

                  room.add(ws);
                  console.log(`[WS Multiplayer] Player ${currentPlayerId} (${ws.role}) joined room ${currentRoomId}`);

                  // Envia a lista dos outros jogadores
                  const existingPlayers = Array.from(room)
                    .filter((client: any) => client !== ws && client.playerId)
                    .map((client: any) => ({
                      playerId: client.playerId,
                      position: client.position,
                      rotation: client.rotation,
                      name: client.name,
                      role: client.role || 'red',
                      playbackRate: client.playbackRate,
                      volume: client.volume
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
                        name: ws.name,
                        role: ws.role,
                        playbackRate: ws.playbackRate,
                        volume: ws.volume
                      }));
                    }
                  });
                } else if (data.type === 'move') {
                  ws.position = data.position;
                  ws.rotation = data.rotation;
                  ws.role = data.role || ws.role || 'red';
                  ws.playbackRate = data.playbackRate;
                  ws.volume = data.volume;

                  const room = rooms.get(currentRoomId);
                  if (room) {
                    room.forEach((client: any) => {
                      if (client !== ws && client.readyState === 1) {
                        client.send(JSON.stringify({
                          type: 'player-moved',
                          playerId: currentPlayerId,
                          position: data.position,
                          rotation: data.rotation,
                          role: ws.role,
                          playbackRate: data.playbackRate,
                          volume: data.volume
                        }));
                      }
                    });
                  }
                } else if (data.type === 'role-update') {
                  ws.role = data.role;
                  const room = rooms.get(currentRoomId);
                  if (room) {
                    room.forEach((client: any) => {
                      if (client !== ws && client.readyState === 1) {
                        client.send(JSON.stringify({
                          type: 'role-update',
                          playerId: currentPlayerId,
                          role: data.role
                        }));
                      }
                    });
                  }
                } else {
                  // Retransmissão genérica para qualquer outro tipo de pacote (ball-sync, score-sync, etc.)
                  const room = rooms.get(currentRoomId);
                  if (room) {
                    room.forEach((client: any) => {
                      if (client !== ws && client.readyState === 1) {
                        client.send(messageStr);
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
          console.warn('[WS Multiplayer] Could not initialize WebSocket server, setup error:', err);
        }
      }).catch((err) => {
        console.warn('[WS Multiplayer] Could not initialize WebSocket server, ws module import failed:', err);
      });

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
              } catch (e) { }
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
                fs.mkdirSync(path.join(projectPath, 'scripts'), { recursive: true });
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

              // Create scripts directory if not exists
              const scriptsDir = path.join(projectPath, 'scripts');
              if (!fs.existsSync(scriptsDir)) {
                fs.mkdirSync(scriptsDir, { recursive: true });
              }

              // Save physical scripts from scene entities
              if (scene && scene.entities) {
                for (const entity of Object.values(scene.entities) as any[]) {
                  if (entity && entity.components && entity.components.Script) {
                    const scriptComp = entity.components.Script;

                    // Main script
                    if (scriptComp.scriptName) {
                      const scriptNameClean = scriptComp.scriptName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
                      if (scriptNameClean) {
                        const scriptFilePath = path.join(scriptsDir, `${scriptNameClean}.js`);
                        fs.writeFileSync(scriptFilePath, scriptComp.code || '', 'utf8');
                      }
                    }

                    // Additional scripts
                    if (scriptComp.scripts && Array.isArray(scriptComp.scripts)) {
                      for (const addScript of scriptComp.scripts) {
                        if (addScript.scriptName) {
                          const addScriptNameClean = addScript.scriptName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
                          if (addScriptNameClean) {
                            const addScriptFilePath = path.join(scriptsDir, `${addScriptNameClean}.js`);
                            fs.writeFileSync(addScriptFilePath, addScript.code || '', 'utf8');
                          }
                        }
                      }
                    }
                  }
                }
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
                try { client.write(`data: ${activeSceneState}\n\n`); } catch (e) { }
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
            let scene: any;
            try {
              scene = JSON.parse(content);
            } catch (err) {
              scene = null;
            }

            // Rehydrate scripts from disk files if they exist
            if (scene && scene.entities) {
              const scriptsDir = path.join(projectPath, 'scripts');
              if (!fs.existsSync(scriptsDir)) {
                fs.mkdirSync(scriptsDir, { recursive: true });
              }
              for (const entity of Object.values(scene.entities) as any[]) {
                if (entity && entity.components && entity.components.Script) {
                  const scriptComp = entity.components.Script;

                  // Main script
                  if (scriptComp.scriptName) {
                    const scriptNameClean = scriptComp.scriptName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
                    const scriptFilePath = path.join(scriptsDir, `${scriptNameClean}.js`);
                    if (fs.existsSync(scriptFilePath)) {
                      scriptComp.code = fs.readFileSync(scriptFilePath, 'utf8');
                    }
                  }

                  // Additional scripts
                  if (scriptComp.scripts && Array.isArray(scriptComp.scripts)) {
                    for (const addScript of scriptComp.scripts) {
                      if (addScript.scriptName) {
                        const addScriptNameClean = addScript.scriptName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
                        const addScriptFilePath = path.join(scriptsDir, `${addScriptNameClean}.js`);
                        if (fs.existsSync(addScriptFilePath)) {
                          addScript.code = fs.readFileSync(addScriptFilePath, 'utf8');
                        }
                      }
                    }
                  }
                }
              }
            }

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify(scene));
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

        // 8. Get Asset from projects/[name]/assets or project root
        if (req.url.startsWith('/api/project/get-asset') && req.method === 'GET') {
          const urlParams = new URL(req.url, 'http://localhost');
          const projectName = urlParams.searchParams.get('project') || '';
          const fileName = decodeURIComponent(urlParams.searchParams.get('file') || '');
          let filePath = path.join(projectsDir, projectName.trim(), 'assets', fileName);

          if (!fs.existsSync(filePath)) {
            filePath = path.join(projectsDir, projectName.trim(), fileName);
          }

          if (fs.existsSync(filePath)) {
            serveFilePhysical(req, res, filePath);
          } else {
            const globalPath = path.join(cacheDir, fileName);
            if (fs.existsSync(globalPath)) {
              serveFilePhysical(req, res, globalPath, 'model/gltf-binary');
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
              try { fs.rmSync(tempExportDir, { recursive: true, force: true }); } catch (e) { }

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
                try { fs.rmSync(zipPath, { force: true }); } catch (e) { }
              } else {
                res.statusCode = 500;
                res.end('Zip file not found');
              }
            });

          } catch (error) {
            console.error('[Export Error] Failed to export:', error);
            try { fs.rmSync(tempExportDir, { recursive: true, force: true }); } catch (e) { }
            try { fs.rmSync(zipPath, { force: true }); } catch (e) { }
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
              try { client.write(`data: ${body}\n\n`); } catch (e) { }
            });
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end('ok');
          });
          return;
        }
        const pathName = req.url.split('?')[0];
        if (pathName === '/api/sync' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');

          const urlParams = new URLSearchParams(req.url.split('?')[1] || '');
          const projectParam = urlParams.get('project');
          if (projectParam) {
            const projectScenePath = path.join(projectsDir, projectParam, 'scene.json');
            if (fs.existsSync(projectScenePath)) {
              try {
                const specificScene = fs.readFileSync(projectScenePath, 'utf8');
                res.end(specificScene);
                return;
              } catch (e) {
                console.error(`[Sync] Erro ao carregar scene.json do projeto ${projectParam}:`, e);
              }
            }
          }

          if (activeSceneState === "{}" || !activeSceneState) {
            // Em vez de forçar o Futebol, retorna um JSON de cena vazia básico.
            activeSceneState = JSON.stringify({ entities: {}, rootEntityIds: [], name: "Default Scene" });
          }
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
                  // 1. Procura na pasta assets
                  let projectAssetPath = path.join(projectsDir, folder, 'assets', fileName);
                  if (fs.existsSync(projectAssetPath) && fs.statSync(projectAssetPath).isFile()) {
                    filePath = projectAssetPath;
                    break;
                  }
                  // 2. Procura na raiz do projeto (como skyboxes/ ou sons/ na raiz)
                  projectAssetPath = path.join(projectsDir, folder, fileName);
                  if (fs.existsSync(projectAssetPath) && fs.statSync(projectAssetPath).isFile()) {
                    filePath = projectAssetPath;
                    break;
                  }
                }
              }
            }

            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              serveFilePhysical(req, res, filePath);
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

              let targetSubpath = subpath || '';
              if (cleanFileName.toLowerCase().endsWith('.js')) {
                targetSubpath = 'scripts';
              }
              const targetPath = path.join(projectsDir, project.trim(), targetSubpath, cleanFileName);

              const targetDir = path.dirname(targetPath);
              if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
              }

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
              let targetSubpath = subpath || '';
              if (path.basename(targetSubpath).toLowerCase().endsWith('.js')) {
                targetSubpath = path.join('scripts', path.basename(targetSubpath));
              }
              const targetPath = path.join(projectsDir, project.trim(), targetSubpath);

              const targetDir = path.dirname(targetPath);
              if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
              }

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

        // 7. Upload de Arquivos do Explorer (Multipart/Binary)
        if (req.url.startsWith('/api/explorer/upload-file') && req.method === 'POST') {
          try {
            const urlParams = new URL(req.url, 'http://localhost');
            const projectName = urlParams.searchParams.get('project') || '';
            let subpath = urlParams.searchParams.get('subpath') || '';
            const fileName = decodeURIComponent(urlParams.searchParams.get('file') || '');

            if (fileName.toLowerCase().endsWith('.js')) {
              subpath = 'scripts';
            }
            const targetDir = path.join(projectsDir, projectName.trim(), subpath);

            if (!fs.existsSync(targetDir)) {
              fs.mkdirSync(targetDir, { recursive: true });
            }

            const chunks: any[] = [];
            req.on('data', (chunk: any) => chunks.push(chunk));
            req.on('end', () => {
              try {
                const buffer = Buffer.concat(chunks);
                const filePath = path.join(targetDir, fileName);
                fs.writeFileSync(filePath, buffer);
                console.log(`Uploaded file to explorer "${projectName}/${subpath}": ${fileName}`);
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end('ok');
              } catch (e: any) {
                res.statusCode = 500;
                res.end(e.message);
              }
            });
          } catch (e: any) {
            res.statusCode = 500;
            res.end(e.message);
          }
          return;
        }

        // 8b. Listar Arquivos de Imagem recursivamente do projeto
        if (req.url.startsWith('/api/explorer-image/list') && req.method === 'GET') {
          try {
            const urlParams = new URL(req.url, 'http://localhost');
            const projectName = urlParams.searchParams.get('project') || '';
            const projectPath = path.join(projectsDir, projectName.trim());

            if (!fs.existsSync(projectPath)) {
              res.statusCode = 404;
              res.end('Project not found');
              return;
            }

            const imageExtensions = ['.png', '.jpg', '.jpeg', '.hdr', '.webp', '.tga', '.dds'];
            const findImageFiles = (dir: string): string[] => {
              let results: string[] = [];
              const items = fs.readdirSync(dir);
              for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                  results = results.concat(findImageFiles(fullPath));
                } else {
                  const ext = path.extname(item).toLowerCase();
                  if (imageExtensions.includes(ext)) {
                    const relativePath = path.relative(projectPath, fullPath).replace(/\\/g, '/');
                    results.push(relativePath);
                  }
                }
              }
              return results;
            };

            const imageFiles = findImageFiles(projectPath);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify(imageFiles));
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
          return;
        }

        // 8. Listar Arquivos de Áudio recursivamente do projeto
        if (req.url.startsWith('/api/explorer-audio/list') && req.method === 'GET') {
          try {
            const urlParams = new URL(req.url, 'http://localhost');
            const projectName = urlParams.searchParams.get('project') || '';
            const projectPath = path.join(projectsDir, projectName.trim());

            if (!fs.existsSync(projectPath)) {
              res.statusCode = 404;
              res.end('Project not found');
              return;
            }

            const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
            const findAudioFiles = (dir: string): string[] => {
              let results: string[] = [];
              const items = fs.readdirSync(dir);
              for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                  results = results.concat(findAudioFiles(fullPath));
                } else {
                  const ext = path.extname(item).toLowerCase();
                  if (audioExtensions.includes(ext)) {
                    const relativePath = path.relative(projectPath, fullPath).replace(/\\/g, '/');
                    results.push(relativePath);
                  }
                }
              }
              return results;
            };

            const audioFiles = findAudioFiles(projectPath);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify(audioFiles));
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
          return;
        }

        // 8c. Listar Arquivos de Vídeo recursivamente do projeto
        if (req.url.startsWith('/api/explorer-video/list') && req.method === 'GET') {
          try {
            const urlParams = new URL(req.url, 'http://localhost');
            const projectName = urlParams.searchParams.get('project') || '';
            const projectPath = path.join(projectsDir, projectName.trim());

            if (!fs.existsSync(projectPath)) {
              res.statusCode = 404;
              res.end('Project not found');
              return;
            }

            const videoExtensions = ['.mp4', '.webm', '.ogv'];
            const findVideoFiles = (dir: string): string[] => {
              let results: string[] = [];
              const items = fs.readdirSync(dir);
              for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                  results = results.concat(findVideoFiles(fullPath));
                } else {
                  const ext = path.extname(item).toLowerCase();
                  if (videoExtensions.includes(ext)) {
                    const relativePath = path.relative(projectPath, fullPath).replace(/\\/g, '/');
                    results.push(relativePath);
                  }
                }
              }
              return results;
            };

            const videoFiles = findVideoFiles(projectPath);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify(videoFiles));
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
          return;
        }

        // 9. Servir arquivo físico do Explorer (load-file)
        if (req.url.startsWith('/api/explorer/load-file') && req.method === 'GET') {
          try {
            const urlParams = new URL(req.url, 'http://localhost');
            const projectName = urlParams.searchParams.get('project') || '';
            const subpath = urlParams.searchParams.get('subpath') || '';
            const targetPath = path.join(projectsDir, projectName.trim(), subpath);

            serveFilePhysical(req, res, targetPath);
          } catch (e: any) {
            res.statusCode = 500;
            res.end(e.message);
          }
          return;
        }

        // ── SISTEMA DE SALAS ────────────────────────────────────────────────

        // GET /api/rooms — Lista todos os projetos como salas (com roomId, coverImage)
        if (req.url === '/api/rooms' && req.method === 'GET') {
          try {
            const folders = fs.readdirSync(projectsDir).filter(name => {
              try { return fs.statSync(path.join(projectsDir, name)).isDirectory(); }
              catch (e) { return false; }
            });

            const rooms = folders.map(name => {
              const projectPath = path.join(projectsDir, name);
              // Tenta carregar da pasta scenes/Main Scene.json primeiro, depois scene.json
              const sceneFiles = [
                path.join(projectPath, 'scenes', 'Main Scene.json'),
                path.join(projectPath, 'scene.json'),
              ];
              let roomId = name; // fallback: usa o nome do projeto
              let coverImage = '';
              let entityCount = 0;
              let savedAt = 0;

              for (const scenePath of sceneFiles) {
                if (fs.existsSync(scenePath)) {
                  try {
                    const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
                    if (scene.roomId) roomId = scene.roomId;
                    if (scene.coverImage) coverImage = scene.coverImage;
                    entityCount = Object.keys(scene.entities || {}).length;
                    savedAt = fs.statSync(scenePath).mtimeMs;
                    break;
                  } catch (e) { }
                }
              }

              if (!savedAt) {
                try { savedAt = fs.statSync(projectPath).mtimeMs; } catch (e) { savedAt = 0; }
              }

              return { roomId, name, coverImage, savedAt, entityCount };
            });

            rooms.sort((a, b) => b.savedAt - a.savedAt);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify(rooms));
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
          return;
        }

        // GET /api/room/:roomId — Carrega o projeto/sala pelo roomId
        if (req.url && req.url.startsWith('/api/room/') && req.method === 'GET') {
          try {
            const roomId = decodeURIComponent(req.url.replace('/api/room/', '').split('?')[0]);
            let foundScene: any = null;

            // Varre todos os projetos procurando o roomId
            const folders = fs.readdirSync(projectsDir).filter(name => {
              try { return fs.statSync(path.join(projectsDir, name)).isDirectory(); }
              catch (e) { return false; }
            });

            for (const name of folders) {
              const projectPath = path.join(projectsDir, name);
              const sceneFiles: string[] = [];

              // Coleta todos os scene JSONs do projeto
              const scenesDir = path.join(projectPath, 'scenes');
              if (fs.existsSync(scenesDir)) {
                fs.readdirSync(scenesDir).filter(f => f.endsWith('.json')).forEach(f => {
                  sceneFiles.push(path.join(scenesDir, f));
                });
              }
              const rootScene = path.join(projectPath, 'scene.json');
              if (fs.existsSync(rootScene)) sceneFiles.push(rootScene);

              for (const scenePath of sceneFiles) {
                try {
                  const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));

                  // Match por roomId OU pelo nome do projeto (retrocompat)
                  if (scene.roomId === roomId || name === roomId) {
                    // Rehydrate scripts from disk
                    const scriptsDir = path.join(projectPath, 'scripts');
                    if (fs.existsSync(scriptsDir) && scene.entities) {
                      for (const entity of Object.values(scene.entities) as any[]) {
                        if (entity?.components?.Script) {
                          const scriptComp = entity.components.Script;
                          if (scriptComp.scriptName) {
                            const scriptNameClean = scriptComp.scriptName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
                            const scriptFilePath = path.join(scriptsDir, `${scriptNameClean}.js`);
                            if (fs.existsSync(scriptFilePath)) {
                              scriptComp.code = fs.readFileSync(scriptFilePath, 'utf8');
                            }
                          }
                          if (scriptComp.scripts && Array.isArray(scriptComp.scripts)) {
                            for (const addScript of scriptComp.scripts) {
                              if (addScript.scriptName) {
                                const addScriptNameClean = addScript.scriptName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
                                const addScriptFilePath = path.join(scriptsDir, `${addScriptNameClean}.js`);
                                if (fs.existsSync(addScriptFilePath)) {
                                  addScript.code = fs.readFileSync(addScriptFilePath, 'utf8');
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                    foundScene = { ...scene, _projectName: name };
                    break;
                  }
                } catch (e) { }
              }
              if (foundScene) break;
            }

            if (foundScene) {
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify(foundScene));
            } else {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `Sala "${roomId}" não encontrada.` }));
            }
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
          return;
        }

        // ── SPA Fallback ─────────────────────────────────────────────────
        // Rotas sem extensão de arquivo (ex: /discover, /room/:id) servem index.html
        const reqPath = req.url?.split('?')[0] || '/';
        const hasFileExtension = path.extname(reqPath) !== '';
        const isApiRoute = reqPath.startsWith('/api/');

        if (!hasFileExtension && !isApiRoute) {
          const indexPath = path.join(process.cwd(), 'index.html');
          if (fs.existsSync(indexPath)) {
            res.setHeader('Content-Type', 'text/html');
            res.setHeader('Access-Control-Allow-Origin', '*');
            // Não servimos o arquivo diretamente — deixamos o Vite processar
            next();
            return;
          }
        }

        next();
      });
    }
  };
};

const isHttps = process.argv.includes('--https') || process.env.HTTPS === 'true';

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    liveSyncPlugin(),
    isHttps ? basicSsl() : null
  ].filter(Boolean),
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    // SPA fallback: todas as rotas /room/*, /discover, etc. servem index.html
    fs: {
      strict: false
    }
  }
})




