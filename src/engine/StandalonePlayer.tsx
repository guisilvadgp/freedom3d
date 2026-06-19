import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { SceneView, xrStore } from '../editor/panels/SceneView';
import { useEditorStore } from '../editor/store/editorStore';
import { HardDrive, Trash2 } from 'lucide-react';

// Helper para formatar bytes em formato legível
function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Obter tamanho ocupado no Cache Storage
async function getCacheSize() {
  if (typeof window === 'undefined' || !('caches' in window)) return 0;
  try {
    const cache = await window.caches.open('freedom3d-assets-cache');
    const keys = await cache.keys();
    let totalSize = 0;
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const len = response.headers.get('content-length');
        if (len) {
          totalSize += parseInt(len, 10);
        } else {
          try {
            const blob = await response.clone().blob();
            totalSize += blob.size;
          } catch (err) {
            // Ignorar falhas ao extrair blob
          }
        }
      }
    }
    return totalSize;
  } catch (e) {
    console.error('Erro ao obter tamanho do cache:', e);
    return 0;
  }
}

// Limpar Cache Storage e Three.js cache em memória
async function clearAssetsCache() {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    await window.caches.delete('freedom3d-assets-cache');
    THREE.Cache.clear();
  } catch (e) {
    console.error('Erro ao limpar cache:', e);
  }
}

// Monkey-patch THREE.FileLoader para interceptar carregamento do Three.js e servir do Cache Storage
if (typeof window !== 'undefined') {
  const originalFileLoaderLoad = THREE.FileLoader.prototype.load;

  THREE.FileLoader.prototype.load = function (
    this: any,
    url: string,
    onLoad?: (response: string | ArrayBuffer) => void,
    onProgress?: (request: ProgressEvent) => void,
    onError?: (event: any) => void
  ) {
    const self = this;

    if (url.includes('/api/asset/')) {
      (async () => {
        try {
          const cache = await window.caches.open('freedom3d-assets-cache');
          const cachedResponse = await cache.match(url);
          
          if (cachedResponse) {
            let data: any;
            if (self.responseType === 'arraybuffer') {
              data = await cachedResponse.arrayBuffer();
            } else if (self.responseType === 'blob') {
              data = await cachedResponse.blob();
            } else if (self.responseType === 'json') {
              data = await cachedResponse.json();
            } else {
              data = await cachedResponse.text();
            }
            
            if (onLoad) {
              onLoad(data);
            }
            return;
          }
        } catch (err) {
          console.warn('[Cache Match Error]', err);
        }

        // Se não encontrar no cache, faz o fetch normal e salva no cache ao concluir
        const customOnLoad = async (response: string | ArrayBuffer) => {
          try {
            const cache = await window.caches.open('freedom3d-assets-cache');
            const responseHeaders = {
              headers: {
                'content-type': self.responseType === 'arraybuffer' ? 'application/octet-stream' : 'text/plain',
                'content-length': (response instanceof ArrayBuffer ? response.byteLength : new Blob([response]).size).toString()
              }
            };
            const cacheResponse = new Response(response, responseHeaders);
            await cache.put(url, cacheResponse);
            
            if ((window as any).__updateFreedom3DCacheSize) {
              (window as any).__updateFreedom3DCacheSize();
            }
          } catch (cacheErr) {
            console.warn('[Cache Put Error]', cacheErr);
          }

          if (onLoad) {
            onLoad(response);
          }
        };

        originalFileLoaderLoad.call(self, url, customOnLoad, onProgress, onError);
      })();
      return;
    }

    return originalFileLoaderLoad.call(self, url, onLoad, onProgress, onError);
  } as any;
}

function DebugUI() {
  const consoleLogs = useEditorStore(state => state.consoleLogs);

  const handleCopy = () => {
    const text = consoleLogs.map(l => l.message).join('\n');
    navigator.clipboard.writeText(text);
    alert('Log copiado para a area de transferencia!');
  };

  return (
    <div style={{
      position: 'absolute', top: '50px', right: '10px', width: '300px', height: '400px',
      background: 'rgba(0,0,0,0.8)', color: '#0f0', fontFamily: 'monospace', fontSize: '12px',
      padding: '10px', borderRadius: '8px', zIndex: 9999, display: 'flex', flexDirection: 'column'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <strong>Console Logs</strong>
        <button onClick={handleCopy} style={{ background: '#555', color: '#fff', border: 'none', padding: '4px 8px', cursor: 'pointer', borderRadius: '4px' }}>
          Copiar
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {consoleLogs.map(log => (
          <div key={log.id} style={{ color: log.type === 'error' ? '#f44' : log.type === 'warn' ? '#fd4' : '#0f0' }}>
            {log.message}
          </div>
        ))}
      </div>
    </div>
  );
}

export function StandalonePlayer() {
  const setActiveViewport = useEditorStore(state => state.setActiveViewport);
  const togglePlay = useEditorStore(state => state.togglePlay);
  const addLog = useEditorStore(state => state.addLog);
  const activeSceneId = useEditorStore(state => state.activeSceneId);
  const [showDebug, setShowDebug] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Estados da tela de carregamento e inicio do jogo
  const [loading, setLoading] = useState(true);
  const [progressVal, setProgressVal] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [sceneLoaded, setSceneLoaded] = useState(false);

  // Estados do Cache de Assets
  const [cacheSize, setCacheSize] = useState<number>(0);

  const updateCacheSize = async () => {
    const size = await getCacheSize();
    setCacheSize(size);
  };

  const handleClearCache = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await clearAssetsCache();
    await updateCacheSize();
  };

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation(); // Evita conflito com o clique de fullscreen do fundo
    setGameStarted(true);
    if (!useEditorStore.getState().isPlaying) {
      togglePlay(); // Inicia física e scripts
    }

    // Entrar no modo VR diretamente ao iniciar apenas se for suportado
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr').then(supported => {
        if (supported) {
          xrStore.enterVR().catch(() => { }); // silencia falhas de permissão
        } else {
          console.log('ℹ️ Dispositivo não suporta WebXR imersivo. Rodando apenas em tela cheia.');
        }
      });
    }
  };

  useEffect(() => {
    // Forçar modo Jogo
    setActiveViewport('game');

    // Só força o pause se for o carregamento inicial real da página
    // e não um HMR (Hot Module Replacement) do Vite
    const isFirstLoad = !window.sessionStorage.getItem('firstLoadDone');
    if (isFirstLoad) {
      window.sessionStorage.setItem('firstLoadDone', 'true');
      if (useEditorStore.getState().isPlaying) {
        togglePlay();
      }
    }

    // Capture global errors
    const handleError = (e: ErrorEvent) => {
      addLog('error', 'Global: ' + e.message);
    };
    window.addEventListener('error', handleError);
    const origError = console.error;

    // Evitar loop infinito e lag limitando erros repetidos no console
    const loggedErrors = new Map<string, number>();
    console.error = (...args) => {
      const msg = args.join(' ');
      const now = Date.now();
      const lastLogged = loggedErrors.get(msg) || 0;
      if (now - lastLogged > 1000) { // Limita o log a no máximo 1 por segundo para a mesma mensagem
        loggedErrors.set(msg, now);
        addLog('error', msg);
      }
      origError.apply(console, args);
    };

    // Monkey patch para cachear assets de forma persistente no Cache Storage
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const urlStr = typeof input === 'string' ? input : (input as Request).url || '';
      
      if (urlStr.includes('/api/asset/')) {
        try {
          const cache = await window.caches.open('freedom3d-assets-cache');
          const cachedResponse = await cache.match(input);
          if (cachedResponse) {
            return cachedResponse;
          }
          
          const response = await originalFetch(input, init);
          if (response.status === 200) {
            await cache.put(input, response.clone());
            // Atualiza tamanho do cache após salvar novo asset
            updateCacheSize();
          }
          return response;
        } catch (e) {
          console.warn('[Cache] Falha ao obter/salvar cache:', e);
          return originalFetch(input, init);
        }
      }
      return originalFetch(input, init);
    };

    (window as any).__updateFreedom3DCacheSize = updateCacheSize;
    updateCacheSize();

    const isOffline = (window as any).__freedom3d_standalone__;

    const handleSceneUpdate = (scene: any) => {
      if (scene && scene.id) {
        // Rewrite GLTF and Audio paths
        Object.values(scene.entities).forEach((e: any) => {
          if (e.components?.GLTFModel?.fileName) {
            e.components.GLTFModel.src = isOffline 
              ? './assets/' + e.components.GLTFModel.fileName
              : '/api/asset/' + encodeURIComponent(e.components.GLTFModel.fileName);
          }
          if (e.components?.Audio?.fileName) {
            e.components.Audio.src = isOffline 
              ? './assets/' + e.components.Audio.fileName
              : '/api/project/get-asset?project=' + encodeURIComponent(scene.name) + '&file=' + encodeURIComponent(e.components.Audio.fileName);
          }
        });
        useEditorStore.setState(state => ({
          scenes: { ...state.scenes, [scene.id]: scene },
          activeSceneId: scene.id
        }));
      }
    };

    // Load initial scene state once
    const syncUrl = isOffline ? './scene.json' : '/api/sync';
    fetch(syncUrl)
      .then(res => res.json())
      .then(scene => {
        handleSceneUpdate(scene);
        setSceneLoaded(true);
        if (scene && scene.publishedAt) {
          window.sessionStorage.setItem('lastPublishedAt', scene.publishedAt.toString());
        }

        // Pré-carrega todos os assets GLTF com limite de concorrência (max 2) para evitar sobrecarga mobile
        if (scene && scene.entities) {
          const gltfUrls: string[] = [];
          Object.values(scene.entities).forEach((e: any) => {
            if (e.components?.GLTFModel?.fileName) {
              const url = isOffline 
                ? './assets/' + e.components.GLTFModel.fileName
                : '/api/asset/' + encodeURIComponent(e.components.GLTFModel.fileName);
              if (!THREE.Cache.get(url)) {
                gltfUrls.push(url);
              }
            }
          });

          if (gltfUrls.length > 0) {
            const limit = 2; // Downloads concorrentes simultâneos
            let index = 0;
            const runNext = () => {
              if (index >= gltfUrls.length) return;
              const url = gltfUrls[index++];
              fetch(url, { priority: 'low' } as any)
                .then(r => r.arrayBuffer())
                .then(buf => {
                  THREE.Cache.add(url, buf);
                  updateCacheSize();
                  runNext();
                })
                .catch(() => {
                  runNext();
                });
            };
            for (let i = 0; i < Math.min(limit, gltfUrls.length); i++) {
              runNext();
            }
          }
        }
      })
      .catch(() => {
        setSceneLoaded(true);
      });

    // Polling para atualizações — apenas quando o editor está ativo e não está em modo offline standalone
    const isEditorMode = !isOffline && (window.location.search.includes('editor') || document.referrer.includes('editor'));
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    if (isEditorMode) {
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch('/api/sync', { cache: 'no-store' });
          const scene = await res.json();
          if (scene && scene.publishedAt) {
            const lastPublishedAt = window.sessionStorage.getItem('lastPublishedAt');
            if (lastPublishedAt && lastPublishedAt !== scene.publishedAt.toString()) {
              console.log('Nova cena detectada! Atualizando o cenário sem recarregar a página...');
              window.sessionStorage.setItem('lastPublishedAt', scene.publishedAt.toString());
              handleSceneUpdate(scene);
            }
          }
        } catch (err) { }
      }, 3000);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' || (e.ctrlKey && e.shiftKey && e.key === 'D')) {
        setShowDebug(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      window.removeEventListener('error', handleError);
      window.removeEventListener('keydown', handleKeyDown);
      console.error = origError;
      window.fetch = originalFetch;
      delete (window as any).__updateFreedom3DCacheSize;
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden', position: 'relative' }}>
      <SceneView
        isStandalone={true}
        sceneLoaded={sceneLoaded}
        onProgress={(p) => setProgressVal(p)}
        onLoaded={() => setLoading(false)}
      />
      {showDebug && <DebugUI />}

      {/* Botão Flutuante de Atualizar */}
      {gameStarted && (
        <button
          onClick={() => window.location.reload()}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            background: 'rgba(0,0,0,0.5)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
            transition: 'background 0.2s'
          }}
          title="Atualizar Página"
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.8)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      )}

      {/* Overlay de Carregamento e Botão PLAY */}
      {showOverlay && (
        <div
          onTransitionEnd={() => {
            if (gameStarted) setShowOverlay(false);
          }}
          onClick={() => {
            if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
              document.documentElement.requestFullscreen().then(() => {
                // Tenta forçar o modo paisagem (landscape) automaticamente no mobile
                const orientation = window.screen && (window.screen.orientation as any);
                if (orientation && orientation.lock) {
                  orientation.lock('landscape').catch((err: any) => {
                    console.warn('Bloqueio de orientação falhou/não suportado:', err);
                  });
                }
              }).catch(() => { });
            }
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: '#06080d',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            opacity: gameStarted ? 0 : 1,
            pointerEvents: gameStarted ? 'none' : 'all',
          }}
        >
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <h1 style={{
              fontSize: '48px',
              fontWeight: 800,
              letterSpacing: '2px',
              background: 'linear-gradient(135deg, #fff, #818cf8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '10px',
              fontFamily: 'Outfit, sans-serif'
            }}>
              Freedom3D
            </h1>
            <p style={{
              color: '#9ca3af',
              fontSize: '12px',
              letterSpacing: '2px',
              marginBottom: '40px',
              textTransform: 'uppercase',
              fontWeight: 500
            }}>
              {loading ? 'Carregando recursos...' : !activeSceneId ? 'Aguardando Publicação' : 'Pronto para iniciar'}
            </p>

            {loading ? (
              <div style={{ width: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 auto' }}>
                <div style={{
                  width: '100%',
                  height: '6px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                  marginBottom: '12px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  <div style={{
                    width: `${progressVal}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                    borderRadius: '3px',
                    transition: 'width 0.3s ease',
                    boxShadow: '0 0 10px rgba(99, 102, 241, 0.5)'
                  }} />
                </div>
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  color: '#818cf8',
                  fontWeight: 600
                }}>
                  {progressVal}%
                </span>
              </div>
            ) : !activeSceneId ? (
              <div style={{ color: '#ef4444', fontSize: '13px', maxWidth: '380px', margin: '0 auto', lineHeight: '1.6', background: 'rgba(239, 68, 68, 0.08)', padding: '14px 20px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.15)', fontFamily: 'sans-serif' }}>
                ⚠️ Nenhum cenário publicado no Mobile Preview ainda. No editor, abra o projeto desejado e clique em <strong>Publish to Mobile</strong> na barra superior para visualizá-lo aqui.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
                <button
                  onClick={handlePlay}
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    color: '#fff',
                    border: 'none',
                    padding: '16px 40px',
                    fontSize: '16px',
                    fontWeight: 700,
                    letterSpacing: '1px',
                    borderRadius: '30px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    outline: 'none',
                    margin: '0 auto'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 6px 25px rgba(99, 102, 241, 0.6)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(99, 102, 241, 0.4)';
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  PLAY GAME
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowConfigModal(true);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#e2e8f0',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    padding: '12px 30px',
                    fontSize: '14px',
                    fontWeight: 600,
                    borderRadius: '30px',
                    cursor: 'pointer',
                    transition: 'background 0.2s ease, transform 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    outline: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.transform = 'scale(1.03)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  CONFIGURAR CONTROLE
                </button>
              </div>
            )}

            {/* CARD DE ARMAZENAMENTO E LIMPEZA DE CACHE */}
            {activeSceneId && (
              <div style={{
                marginTop: '30px',
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '14px 20px',
                width: '320px',
                margin: '30px auto 0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '15px',
                textAlign: 'left',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
                transition: 'all 0.3s ease',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    background: 'rgba(99, 102, 241, 0.1)',
                    color: '#818cf8',
                    borderRadius: '10px',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(99, 102, 241, 0.2)'
                  }}>
                    <HardDrive size={20} />
                  </div>
                  <div>
                    <h3 style={{
                      margin: 0,
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#f3f4f6',
                      fontFamily: 'Outfit, sans-serif'
                    }}>
                      Cache de Assets
                    </h3>
                    <p style={{
                      margin: '2px 0 0 0',
                      fontSize: '12px',
                      color: '#a5b4fc',
                      fontFamily: 'monospace',
                      fontWeight: 600
                    }}>
                      {formatBytes(cacheSize)}
                    </p>
                    <p style={{
                      margin: '2px 0 0 0',
                      fontSize: '9px',
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      fontWeight: 600
                    }}>
                      Sem limite de cache
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleClearCache}
                  disabled={cacheSize === 0}
                  style={{
                    background: cacheSize === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(239, 68, 68, 0.08)',
                    color: cacheSize === 0 ? '#4b5563' : '#f87171',
                    border: cacheSize === 0 ? '1px solid rgba(255,255,255,0.03)' : '1px solid rgba(239, 68, 68, 0.15)',
                    borderRadius: '10px',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: cacheSize === 0 ? 'default' : 'pointer',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                  }}
                  title="Limpar Cache de Assets"
                  onMouseEnter={(e) => {
                    if (cacheSize > 0) {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.18)';
                      e.currentTarget.style.color = '#ef4444';
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (cacheSize > 0) {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                      e.currentTarget.style.color = '#f87171';
                      e.currentTarget.style.transform = 'scale(1)';
                    }
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {showConfigModal && <ControlConfigModal onClose={() => setShowConfigModal(false)} />}
    </div>
  );
}

interface GamepadConfig {
  triggerButton: number;
  moveAxisX: number;
  moveAxisY: number;
  invertX?: boolean;
  invertY?: boolean;
  buttonA: number;
  buttonB: number;
  buttonC: number;
  buttonD: number;
}

function ControlConfigModal({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<GamepadConfig>(() => {
    const saved = localStorage.getItem('freedom3d_gamepad_config');
    return saved ? JSON.parse(saved) : {
      triggerButton: 0,
      moveAxisX: 0,
      moveAxisY: 1,
      invertX: false,
      invertY: false,
      buttonA: 0,
      buttonB: 1,
      buttonC: 2,
      buttonD: 3
    };
  });

  const [activeGamepadName, setActiveGamepadName] = useState<string>('Nenhum controle detectado');
  const [bindingField, setBindingField] = useState<keyof GamepadConfig | null>(null);

  useEffect(() => {
    const updateGamepad = () => {
      if (typeof navigator !== 'undefined' && navigator.getGamepads) {
        const gps = navigator.getGamepads();
        const firstGp = Array.from(gps).find(g => g !== null && g.connected);
        if (firstGp) {
          setActiveGamepadName(`${firstGp.id} (${firstGp.buttons.length} botões, ${firstGp.axes.length} eixos)`);
        } else {
          setActiveGamepadName('Nenhum controle detectado. Pressione um botão no controle bluetooth para ativar.');
        }
      }
    };

    updateGamepad();
    const interval = setInterval(updateGamepad, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!bindingField) return;

    let animFrameId: number;
    let initialAxesValues: number[] = [];
    if (navigator.getGamepads) {
      const gps = navigator.getGamepads();
      const gp = Array.from(gps).find(g => g !== null && g.connected);
      if (gp) {
        initialAxesValues = Array.from(gp.axes);
      }
    }

    const poll = () => {
      const gps = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = Array.from(gps).find(g => g !== null && g.connected);

      if (gp) {
        // 1. Escuta botões
        for (let i = 0; i < gp.buttons.length; i++) {
          if (gp.buttons[i].pressed || gp.buttons[i].value > 0.6) {
            setConfig(prev => {
              const next = { ...prev, [bindingField]: i };
              localStorage.setItem('freedom3d_gamepad_config', JSON.stringify(next));
              return next;
            });
            setBindingField(null);
            return;
          }
        }

        // 2. Escuta eixos
        if (bindingField === 'moveAxisX' || bindingField === 'moveAxisY') {
          for (let i = 0; i < gp.axes.length; i++) {
            const val = gp.axes[i];
            const initVal = initialAxesValues[i] || 0;
            if (Math.abs(val - initVal) > 0.4) {
              setConfig(prev => {
                const next = { ...prev, [bindingField]: i };
                localStorage.setItem('freedom3d_gamepad_config', JSON.stringify(next));
                return next;
              });
              setBindingField(null);
              return;
            }
          }
        }
      }
      animFrameId = requestAnimationFrame(poll);
    };

    animFrameId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animFrameId);
  }, [bindingField]);

  const handleReset = () => {
    const defaults = {
      triggerButton: 0,
      moveAxisX: 0,
      moveAxisY: 1,
      invertX: false,
      invertY: false,
      buttonA: 0,
      buttonB: 1,
      buttonC: 2,
      buttonD: 3
    };
    setConfig(defaults);
    localStorage.setItem('freedom3d_gamepad_config', JSON.stringify(defaults));
  };

  const getLineStroke = (field: keyof GamepadConfig) => {
    return bindingField === field ? '#f59e0b' : 'rgba(129, 140, 248, 0.4)';
  };
  const getLineDash = (field: keyof GamepadConfig) => {
    return bindingField === field ? 'none' : '4';
  };
  const getLineStrength = (field: keyof GamepadConfig) => {
    return bindingField === field ? '3' : '1.5';
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(10, 15, 30, 0.9)', backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
      fontFamily: 'system-ui, -apple-system, sans-serif', padding: '20px'
    }} onClick={onClose}>
      <div style={{
        background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(129, 140, 248, 0.2)',
        borderRadius: '24px', width: '100%', maxWidth: '960px', padding: '30px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), inset 0 0 20px rgba(129, 140, 248, 0.05)', color: '#fff',
        display: 'flex', flexDirection: 'column', gap: '24px'
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.025em', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }}></span>
              Configurar Controles Bluetooth
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>Mapeie os eixos e botões do seu controle de PS4 gamepad</p>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#64748b', fontSize: '28px', cursor: 'pointer', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', transition: 'all 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
          >&times;</button>
        </div>

        {/* HUD de Controle Conectado */}
        <div style={{
          background: 'rgba(99, 102, 241, 0.05)', borderRadius: '14px', padding: '12px 18px',
          border: '1px solid rgba(99, 102, 241, 0.15)', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <span style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em' }}>Controle Conectado</span>
            <div style={{ color: '#818cf8', marginTop: '2px', fontWeight: 600, fontSize: '14px' }}>{activeGamepadName}</div>
          </div>
          <div style={{ padding: '4px 10px', borderRadius: '8px', background: activeGamepadName.includes('Nenhum') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: activeGamepadName.includes('Nenhum') ? '#f87171' : '#34d399', fontSize: '11px', fontWeight: 700 }}>
            {activeGamepadName.includes('Nenhum') ? 'OFFLINE' : 'ONLINE'}
          </div>
        </div>

        {/* Corpo principal em colunas flutuantes */}
        <div style={{ position: 'relative', width: '100%', height: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          
          {/* Card Esquerda - Analógico e Gatilho */}
          <div style={{ position: 'absolute', left: 0, width: '220px', display: 'flex', flexDirection: 'column', gap: '20px', zIndex: 10 }}>
            
            {/* Gatilho Esquerdo */}
            <div style={{
              background: bindingField === 'triggerButton' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(30, 41, 59, 0.5)',
              border: bindingField === 'triggerButton' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px', padding: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Gatilho (L2/R2)</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9', marginTop: '2px' }}>Teleporte</div>
              <button
                onClick={() => setBindingField('triggerButton')}
                style={{
                  width: '100%', marginTop: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, borderRadius: '8px', cursor: 'pointer', border: 'none',
                  background: bindingField === 'triggerButton' ? '#f59e0b' : 'rgba(99, 102, 241, 0.15)',
                  color: bindingField === 'triggerButton' ? '#000' : '#818cf8',
                  transition: 'all 0.2s'
                }}
              >
                {bindingField === 'triggerButton' ? 'Aguardando...' : `Botão ${config.triggerButton}`}
              </button>
            </div>

            {/* Analógico L */}
            <div style={{
              background: bindingField === 'moveAxisX' || bindingField === 'moveAxisY' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(30, 41, 59, 0.5)',
              border: bindingField === 'moveAxisX' || bindingField === 'moveAxisY' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px', padding: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Analógico Esquerdo (L)</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9', marginTop: '2px' }}>Movimento (X/Y)</div>
              
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  onClick={() => setBindingField('moveAxisX')}
                  style={{
                    flex: 1, padding: '6px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', cursor: 'pointer', border: 'none',
                    background: bindingField === 'moveAxisX' ? '#f59e0b' : 'rgba(99, 102, 241, 0.1)',
                    color: bindingField === 'moveAxisX' ? '#000' : '#818cf8'
                  }}
                >
                  {bindingField === 'moveAxisX' ? 'Eixo X...' : `X: ${config.moveAxisX}`}
                </button>
                <button
                  onClick={() => setBindingField('moveAxisY')}
                  style={{
                    flex: 1, padding: '6px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', cursor: 'pointer', border: 'none',
                    background: bindingField === 'moveAxisY' ? '#f59e0b' : 'rgba(99, 102, 241, 0.1)',
                    color: bindingField === 'moveAxisY' ? '#000' : '#818cf8'
                  }}
                >
                  {bindingField === 'moveAxisY' ? 'Eixo Y...' : `Y: ${config.moveAxisY}`}
                </button>
              </div>
            </div>

          </div>

          {/* SVG Centralizado do Controle PS4 */}
          <div style={{ width: '480px', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 480 300" width="100%" height="100%">
              {/* Definições de Gradientes e Filtros */}
              <defs>
                <radialGradient id="glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Fundo Glow de Neon */}
              <circle cx="240" cy="150" r="180" fill="url(#glow)" />

              {/* Linhas de conexão esquemáticas */}
              {/* Linha Gatilho Esquerdo */}
              <path d="M 115 50 L 50 50" fill="none" stroke={getLineStroke('triggerButton')} strokeWidth={getLineStrength('triggerButton')} strokeDasharray={getLineDash('triggerButton')} />
              <circle cx="115" cy="50" r="3.5" fill={getLineStroke('triggerButton')} />

              {/* Linha Analógico Esquerdo */}
              <path d="M 190 190 L 50 190" fill="none" stroke={bindingField === 'moveAxisX' || bindingField === 'moveAxisY' ? '#f59e0b' : 'rgba(129, 140, 248, 0.4)'} strokeWidth={bindingField === 'moveAxisX' || bindingField === 'moveAxisY' ? '3' : '1.5'} strokeDasharray={bindingField === 'moveAxisX' || bindingField === 'moveAxisY' ? 'none' : '4'} />
              <circle cx="190" cy="190" r="3.5" fill={bindingField === 'moveAxisX' || bindingField === 'moveAxisY' ? '#f59e0b' : 'rgba(129, 140, 248, 0.4)'} />

              {/* Linha Botão Triângulo (Ação D) */}
              <path d="M 350 115 L 430 115" fill="none" stroke={getLineStroke('buttonD')} strokeWidth={getLineStrength('buttonD')} strokeDasharray={getLineDash('buttonD')} />
              <circle cx="350" cy="115" r="3.5" fill={getLineStroke('buttonD')} />

              {/* Linha Botão Círculo (Ação B) */}
              <path d="M 375 140 L 430 140" fill="none" stroke={getLineStroke('buttonB')} strokeWidth={getLineStrength('buttonB')} strokeDasharray={getLineDash('buttonB')} />
              <circle cx="375" cy="140" r="3.5" fill={getLineStroke('buttonB')} />

              {/* Linha Botão X (Ação A) */}
              <path d="M 350 165 L 430 165" fill="none" stroke={getLineStroke('buttonA')} strokeWidth={getLineStrength('buttonA')} strokeDasharray={getLineDash('buttonA')} />
              <circle cx="350" cy="165" r="3.5" fill={getLineStroke('buttonA')} />

              {/* Linha Botão Quadrado (Ação C) */}
              <path d="M 325 140 L 430 200" fill="none" stroke={getLineStroke('buttonC')} strokeWidth={getLineStrength('buttonC')} strokeDasharray={getLineDash('buttonC')} />
              <circle cx="325" cy="140" r="3.5" fill={getLineStroke('buttonC')} />


              {/* CONTROLE - PARTE FÍSICA */}
              {/* Gatilho L1/L2 */}
              <path d="M 90 70 C 90 40, 130 40, 140 70 Z" fill="#1e293b" stroke="#334155" strokeWidth="2" />
              {/* Gatilho R1/R2 */}
              <path d="M 340 70 C 350 40, 390 40, 390 70 Z" fill="#1e293b" stroke="#334155" strokeWidth="2" />

              {/* Corpo Principal do DualShock 4 */}
              <path d="M 120 70 
                       C 90 70, 70 95, 60 130 
                       C 40 200, 50 255, 75 270 
                       C 95 280, 130 250, 155 220 
                       C 185 205, 295 205, 325 220 
                       C 350 250, 385 280, 405 270 
                       C 430 255, 440 200, 420 130 
                       C 410 95, 390 70, 360 70 
                       Z" 
                    fill="#151f32" stroke="#25354e" strokeWidth="3" />

              {/* Touchpad Central */}
              <rect x="160" y="72" width="160" height="65" rx="6" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
              {/* Lightbar Decorativa (Neon Azul) */}
              <rect x="190" y="68" width="100" height="4" rx="2" fill="#00d8ff" style={{ filter: 'drop-shadow(0 0 4px #00d8ff)' }} />

              {/* D-Pad (Direcional) */}
              <path d="M 100 135 H 115 V 120 H 125 V 135 H 140 V 145 H 125 V 160 H 115 V 145 H 100 Z" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />

              {/* Botões de Ação na Direita */}
              <circle cx="350" cy="140" r="35" fill="#0c1322" stroke="#1e293b" strokeWidth="2" />
              
              {/* Triângulo */}
              <circle cx="350" cy="115" r="9" fill="#1e293b" stroke="#334155" />
              <path d="M 350 111 L 354 118 L 346 118 Z" fill="none" stroke="#2dd4bf" strokeWidth="1.5" />
              
              {/* Círculo */}
              <circle cx="375" cy="140" r="9" fill="#1e293b" stroke="#334155" />
              <circle cx="375" cy="140" r="4.5" fill="none" stroke="#f87171" strokeWidth="1.5" />
              
              {/* X */}
              <circle cx="350" cy="165" r="9" fill="#1e293b" stroke="#334155" />
              <path d="M 347 162 L 353 168 M 353 162 L 347 168" fill="none" stroke="#60a5fa" strokeWidth="1.5" />
              
              {/* Quadrado */}
              <circle cx="325" cy="140" r="9" fill="#1e293b" stroke="#334155" />
              <rect x="321" y="136" width="8" height="8" fill="none" stroke="#f472b6" strokeWidth="1.5" />

              {/* Analógico Esquerdo (L) */}
              <circle cx="190" cy="190" r="26" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
              <circle cx="190" cy="190" r="20" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
              <circle cx="190" cy="190" r="12" fill="#0f172a" />
              <text x="190" y="194" fill="#334155" fontSize="11" fontWeight="800" textAnchor="middle">L</text>

              {/* Analógico Direito (R) */}
              <circle cx="290" cy="190" r="26" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
              <circle cx="290" cy="190" r="20" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
              <circle cx="290" cy="190" r="12" fill="#0f172a" />
              <text x="290" y="194" fill="#334155" fontSize="11" fontWeight="800" textAnchor="middle">R</text>

            </svg>
          </div>

          {/* Card Direita - Botões de Ação */}
          <div style={{ position: 'absolute', right: 0, width: '220px', display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 10 }}>
            
            {/* Triângulo */}
            <div style={{
              background: bindingField === 'buttonD' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(30, 41, 59, 0.5)',
              border: bindingField === 'buttonD' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: '10px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px'
            }}>
              <div>
                <div style={{ fontSize: '10px', color: '#2dd4bf', fontWeight: 800 }}>TRIÂNGULO (🔺)</div>
                <div style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 600 }}>Ação D</div>
              </div>
              <button
                onClick={() => setBindingField('buttonD')}
                style={{
                  padding: '6px 12px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', cursor: 'pointer', border: 'none',
                  background: bindingField === 'buttonD' ? '#f59e0b' : 'rgba(99, 102, 241, 0.15)',
                  color: bindingField === 'buttonD' ? '#000' : '#818cf8',
                  minWidth: '80px'
                }}
              >
                {bindingField === 'buttonD' ? '...' : `B${config.buttonD}`}
              </button>
            </div>

            {/* Círculo */}
            <div style={{
              background: bindingField === 'buttonB' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(30, 41, 59, 0.5)',
              border: bindingField === 'buttonB' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: '10px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px'
            }}>
              <div>
                <div style={{ fontSize: '10px', color: '#f87171', fontWeight: 800 }}>CÍRCULO (🔴)</div>
                <div style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 600 }}>Ação B / Voltar</div>
              </div>
              <button
                onClick={() => setBindingField('buttonB')}
                style={{
                  padding: '6px 12px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', cursor: 'pointer', border: 'none',
                  background: bindingField === 'buttonB' ? '#f59e0b' : 'rgba(99, 102, 241, 0.15)',
                  color: bindingField === 'buttonB' ? '#000' : '#818cf8',
                  minWidth: '80px'
                }}
              >
                {bindingField === 'buttonB' ? '...' : `B${config.buttonB}`}
              </button>
            </div>

            {/* X */}
            <div style={{
              background: bindingField === 'buttonA' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(30, 41, 59, 0.5)',
              border: bindingField === 'buttonA' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: '10px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px'
            }}>
              <div>
                <div style={{ fontSize: '10px', color: '#60a5fa', fontWeight: 800 }}>CRUZ / X (❌)</div>
                <div style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 600 }}>Ação A / Pular</div>
              </div>
              <button
                onClick={() => setBindingField('buttonA')}
                style={{
                  padding: '6px 12px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', cursor: 'pointer', border: 'none',
                  background: bindingField === 'buttonA' ? '#f59e0b' : 'rgba(99, 102, 241, 0.15)',
                  color: bindingField === 'buttonA' ? '#000' : '#818cf8',
                  minWidth: '80px'
                }}
              >
                {bindingField === 'buttonA' ? '...' : `B${config.buttonA}`}
              </button>
            </div>

            {/* Quadrado */}
            <div style={{
              background: bindingField === 'buttonC' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(30, 41, 59, 0.5)',
              border: bindingField === 'buttonC' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: '10px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px'
            }}>
              <div>
                <div style={{ fontSize: '10px', color: '#f472b6', fontWeight: 800 }}>QUADRADO (⬜)</div>
                <div style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 600 }}>Ação C</div>
              </div>
              <button
                onClick={() => setBindingField('buttonC')}
                style={{
                  padding: '6px 12px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', cursor: 'pointer', border: 'none',
                  background: bindingField === 'buttonC' ? '#f59e0b' : 'rgba(99, 102, 241, 0.15)',
                  color: bindingField === 'buttonC' ? '#000' : '#818cf8',
                  minWidth: '80px'
                }}
              >
                {bindingField === 'buttonC' ? '...' : `B${config.buttonC}`}
              </button>
            </div>

          </div>

        </div>

        {/* Rodapé - Inversões e Ações Globais */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '20px', marginTop: '10px' }}>
          
          {/* Inversões de eixos */}
          <div style={{ display: 'flex', gap: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#cbd5e1', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={config.invertX || false} 
                onChange={e => {
                  const next = { ...config, invertX: e.target.checked };
                  setConfig(next);
                  localStorage.setItem('freedom3d_gamepad_config', JSON.stringify(next));
                }}
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#818cf8' }}
              />
              Inverter Horizontal (Eixo X)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#cbd5e1', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={config.invertY || false} 
                onChange={e => {
                  const next = { ...config, invertY: e.target.checked };
                  setConfig(next);
                  localStorage.setItem('freedom3d_gamepad_config', JSON.stringify(next));
                }}
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#818cf8' }}
              />
              Inverter Vertical (Eixo Y)
            </label>
          </div>

          {/* Botões de Ação */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={handleReset} style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8',
              padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.2s', outline: 'none'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = '#94a3b8';
            }}
            >
              Resetar Padrão
            </button>
            <button onClick={onClose} style={{
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none', color: '#fff',
              padding: '10px 25px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
              cursor: 'pointer', boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)', outline: 'none', transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.45)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 14px rgba(99, 102, 241, 0.3)'}
            >
              Salvar e Fechar
            </button>
        </div>

      </div>
    </div>
  </div>
  );
}
