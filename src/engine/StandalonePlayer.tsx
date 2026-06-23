import { useEffect, useState, useRef } from 'react';
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



function DebugUI() {
  const consoleLogs = useEditorStore(state => state.consoleLogs);
  const clearConsole = useEditorStore(state => state.clearConsole);
  const [minimized, setMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<'perf' | 'logs'>('perf');
  const [fps, setFps] = useState(60);
  const [webglInfo, setWebglInfo] = useState<any>({ drawCalls: 0, triangles: 0, geometries: 0, textures: 0 });
  const [ramUsage, setRamUsage] = useState<string>('N/A');

  useEffect(() => {
    let lastTime = performance.now();
    let frames = 0;
    let animId: number;

    const updateStats = () => {
      const now = performance.now();
      frames++;
      
      if (now >= lastTime + 1000) {
        setFps(Math.round((frames * 1000) / (now - lastTime)));
        frames = 0;
        lastTime = now;
      }

      if ((window as any).__freedom3d_webgl_info) {
        setWebglInfo((window as any).__freedom3d_webgl_info);
      }

      const mem = (performance as any).memory;
      if (mem && mem.usedJSHeapSize) {
        setRamUsage((mem.usedJSHeapSize / 1024 / 1024).toFixed(1) + ' MB');
      }

      animId = requestAnimationFrame(updateStats);
    };

    animId = requestAnimationFrame(updateStats);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleCopy = () => {
    const text = consoleLogs.map(l => `[${l.type.toUpperCase()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    alert('Logs copiados para a área de transferência!');
  };

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 99999,
          background: 'rgba(99, 102, 241, 0.95)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '20px',
          padding: '8px 16px',
          fontSize: '12px',
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
          fontFamily: 'sans-serif',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'transform 0.2s',
          outline: 'none'
        }}
      >
        <span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%' }} />
        STATS: {fps} FPS
      </button>
    );
  }

  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '20px',
      width: '320px',
      maxHeight: '420px',
      background: 'rgba(10, 15, 30, 0.85)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      color: '#e2e8f0',
      fontFamily: 'sans-serif',
      borderRadius: '16px',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(255, 255, 255, 0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', background: '#6366f1', borderRadius: '50%' }} />
          <span style={{ fontWeight: 700, fontSize: '13px', letterSpacing: '0.5px' }}>TELEMETRIA ORION</span>
        </div>
        <button
          onClick={() => setMinimized(true)}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 600,
            padding: '4px 8px',
            borderRadius: '4px',
            transition: 'color 0.2s',
            outline: 'none'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
        >
          Minimizar
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <button
          onClick={() => setActiveTab('perf')}
          style={{
            flex: 1,
            padding: '10px',
            background: activeTab === 'perf' ? 'rgba(99, 102, 241, 0.15)' : 'none',
            border: 'none',
            color: activeTab === 'perf' ? '#a5b4fc' : '#94a3b8',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'perf' ? '2px solid #6366f1' : 'none',
            outline: 'none'
          }}
        >
          Performance
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          style={{
            flex: 1,
            padding: '10px',
            background: activeTab === 'logs' ? 'rgba(99, 102, 241, 0.15)' : 'none',
            border: 'none',
            color: activeTab === 'logs' ? '#a5b4fc' : '#94a3b8',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'logs' ? '2px solid #6366f1' : 'none',
            outline: 'none'
          }}
        >
          Console Logs
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '16px', overflowY: 'auto', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {activeTab === 'perf' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: 'monospace' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px' }}>
              <span style={{ color: '#94a3b8' }}>Taxa de Quadros:</span>
              <span style={{ color: fps >= 55 ? '#22c55e' : fps >= 30 ? '#eab308' : '#ef4444', fontWeight: 'bold' }}>{fps} FPS</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px' }}>
              <span style={{ color: '#94a3b8' }}>Memória RAM JS:</span>
              <span style={{ color: '#38bdf8' }}>{ramUsage}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px' }}>
              <span style={{ color: '#94a3b8' }}>Draw Calls:</span>
              <span style={{ color: '#a78bfa' }}>{webglInfo.drawCalls}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px' }}>
              <span style={{ color: '#94a3b8' }}>Triângulos:</span>
              <span style={{ color: '#a78bfa' }}>{webglInfo.triangles.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px' }}>
              <span style={{ color: '#94a3b8' }}>Texturas GPU:</span>
              <span style={{ color: '#f43f5e' }}>{webglInfo.textures}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px' }}>
              <span style={{ color: '#94a3b8' }}>Geometrias:</span>
              <span style={{ color: '#fb923c' }}>{webglInfo.geometries}</span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '180px' }}>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', fontFamily: 'monospace', fontSize: '11px', maxHeight: '180px', padding: '4px' }}>
              {consoleLogs.length === 0 ? (
                <div style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>Nenhum log registrado.</div>
              ) : (
                consoleLogs.map(log => (
                  <div key={log.id} style={{ color: log.type === 'error' ? '#f43f5e' : log.type === 'warn' ? '#fbbf24' : '#34d399', wordBreak: 'break-all' }}>
                    [{log.type.toUpperCase()}] {log.message}
                  </div>
                ))
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
              <button
                onClick={handleCopy}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.1)',
                  padding: '6px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  outline: 'none'
                }}
              >
                Copiar
              </button>
              <button
                onClick={() => {
                  if (typeof clearConsole === 'function') {
                    clearConsole();
                  }
                }}
                style={{
                  flex: 1,
                  background: 'rgba(244,63,94,0.1)',
                  color: '#f43f5e',
                  border: '1px solid rgba(244,63,94,0.2)',
                  padding: '6px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  outline: 'none'
                }}
              >
                Limpar
              </button>
            </div>
          </div>
        )}
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

  // Referencias para atualizacao direta no DOM da barra de carregamento
  const progressBarRef = useRef<HTMLDivElement>(null);
  const progressTextRef = useRef<HTMLSpanElement>(null);

  // Estados da tela de carregamento e inicio do jogo
  const [loading, setLoading] = useState(true);
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
    if (!(window as any).__orionNativeFetch__) {
      (window as any).__orionNativeFetch__ = window.fetch;
    }
    const originalFetch = (window as any).__orionNativeFetch__;
    window.fetch = async (input, init) => {
      const urlStr = typeof input === 'string' ? input : (input as Request).url || '';
      const method = (init && init.method) || 'GET';
      
      if (method.toUpperCase() === 'GET' && (urlStr.includes('/api/asset/') || urlStr.includes('/get-asset') || urlStr.includes('/api/project/get-asset'))) {
        try {
          // Arquivos 3D brutos e pesados (.gltf/.glb/.fbx) devem ser baixados da rede local diretamente para evitar estouro de RAM no clone/cache.put
          const isModel3D = urlStr.toLowerCase().split('?')[0].endsWith('.gltf') || urlStr.toLowerCase().split('?')[0].endsWith('.glb') || urlStr.toLowerCase().split('?')[0].endsWith('.fbx');
          
          const cache = await window.caches.open('freedom3d-assets-cache');
          
          if (!isModel3D) {
            const cachedResponse = await cache.match(input);
            if (cachedResponse) {
              return cachedResponse;
            }
          }
          
          const response = await originalFetch(input, init);
          if (response.status === 200 && !isModel3D) {
            try {
              // Evita clonar e cachear arquivos com mais de 15MB para não sobrecarregar a memória
              const contentLength = response.headers.get('content-length');
              const isLarge = contentLength ? parseInt(contentLength, 10) > 15 * 1024 * 1024 : false;
              
              if (!isLarge) {
                await cache.put(input, response.clone());
                // Atualiza tamanho do cache sem bloquear a thread principal
                setTimeout(() => {
                  updateCacheSize();
                }, 100);
              }
            } catch (err) {
              console.warn('[Cache Put Error]', err);
            }
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
        onProgress={(p) => {
          if (progressBarRef.current) {
            progressBarRef.current.style.width = `${p}%`;
          }
          if (progressTextRef.current) {
            progressTextRef.current.innerText = `${p}%`;
          }
        }}
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
                  <div 
                    ref={progressBarRef}
                    style={{
                      width: '0%',
                      height: '100%',
                      background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                      borderRadius: '3px',
                      transition: 'width 0.3s ease',
                      boxShadow: '0 0 10px rgba(99, 102, 241, 0.5)'
                    }} 
                  />
                </div>
                <span 
                  ref={progressTextRef}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    color: '#818cf8',
                    fontWeight: 600
                  }}
                >
                  0%
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
  lookAxisX: number;
  lookAxisY: number;
  invertX?: boolean;
  invertY?: boolean;
  buttonA: number;
  buttonB: number;
  buttonC: number;
  buttonD: number;
  buttonL1: number;
  buttonR1: number;
  buttonL2: number;
  buttonR2: number;
  buttonL3: number;
  buttonR3: number;
  buttonShare: number;
  buttonOptions: number;
}

function ControlConfigModal({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<GamepadConfig>(() => {
    const saved = localStorage.getItem('freedom3d_gamepad_config');
    return saved ? JSON.parse(saved) : {
      triggerButton: 0,
      moveAxisX: 0,
      moveAxisY: 1,
      lookAxisX: 2,
      lookAxisY: 3,
      invertX: false,
      invertY: false,
      buttonA: 0,
      buttonB: 1,
      buttonC: 2,
      buttonD: 3,
      buttonL1: 4,
      buttonR1: 5,
      buttonL2: 6,
      buttonR2: 7,
      buttonShare: 8,
      buttonOptions: 9,
      buttonL3: 10,
      buttonR3: 11
    };
  });

  const [activeGamepadName, setActiveGamepadName] = useState<string>('Nenhum controle detectado');
  const [bindingField, setBindingField] = useState<keyof GamepadConfig | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const scaleW = Math.min(1, (width - 40) / 1080);
      const scaleH = Math.min(1, (height - 40) / 780);
      setScale(Math.min(scaleW, scaleH));
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
        if (bindingField === 'moveAxisX' || bindingField === 'moveAxisY' || bindingField === 'lookAxisX' || bindingField === 'lookAxisY') {
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
      lookAxisX: 2,
      lookAxisY: 3,
      invertX: false,
      invertY: false,
      buttonA: 0,
      buttonB: 1,
      buttonC: 2,
      buttonD: 3,
      buttonL1: 4,
      buttonR1: 5,
      buttonL2: 6,
      buttonR2: 7,
      buttonShare: 8,
      buttonOptions: 9,
      buttonL3: 10,
      buttonR3: 11
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
        borderRadius: '24px', width: '1080px', padding: '30px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), inset 0 0 20px rgba(129, 140, 248, 0.05)', color: '#fff',
        display: 'flex', flexDirection: 'column', gap: '24px',
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        transition: 'transform 0.1s ease-out'
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
        <div style={{ position: 'relative', width: '100%', height: '510px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          
          {/* Card Esquerda - L1, L2, L3, Share, Analógico L, Inversões */}
          <div style={{ position: 'absolute', left: 0, width: '250px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 10 }}>
            
            {/* L2 e L1 */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{
                flex: 1, background: bindingField === 'buttonL2' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(30, 41, 59, 0.5)',
                border: bindingField === 'buttonL2' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px', padding: '8px'
              }}>
                <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>GATILHO L2</div>
                <button onClick={() => setBindingField('buttonL2')} style={{ width: '100%', marginTop: '4px', padding: '4px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'buttonL2' ? '#f59e0b' : 'rgba(99, 102, 241, 0.15)', color: bindingField === 'buttonL2' ? '#000' : '#818cf8', cursor: 'pointer' }}>
                  {bindingField === 'buttonL2' ? '...' : `Botão ${config.buttonL2}`}
                </button>
              </div>
              <div style={{
                flex: 1, background: bindingField === 'buttonL1' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(30, 41, 59, 0.5)',
                border: bindingField === 'buttonL1' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px', padding: '8px'
              }}>
                <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>BOTÃO L1</div>
                <button onClick={() => setBindingField('buttonL1')} style={{ width: '100%', marginTop: '4px', padding: '4px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'buttonL1' ? '#f59e0b' : 'rgba(99, 102, 241, 0.15)', color: bindingField === 'buttonL1' ? '#000' : '#818cf8', cursor: 'pointer' }}>
                  {bindingField === 'buttonL1' ? '...' : `Botão ${config.buttonL1}`}
                </button>
              </div>
            </div>

            {/* Share */}
            <div style={{
              background: bindingField === 'buttonShare' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(30, 41, 59, 0.5)',
              border: bindingField === 'buttonShare' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: '10px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>SHARE</div>
                <div style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 600 }}>Compartilhar / Menu</div>
              </div>
              <button onClick={() => setBindingField('buttonShare')} style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'buttonShare' ? '#f59e0b' : 'rgba(99, 102, 241, 0.15)', color: bindingField === 'buttonShare' ? '#000' : '#818cf8', cursor: 'pointer' }}>
                {bindingField === 'buttonShare' ? '...' : `B${config.buttonShare}`}
              </button>
            </div>

            {/* Analógico L (Movimento) */}
            <div style={{
              background: bindingField === 'moveAxisX' || bindingField === 'moveAxisY' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(30, 41, 59, 0.5)',
              border: bindingField === 'moveAxisX' || bindingField === 'moveAxisY' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px', padding: '10px'
            }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>ANALÓGICO ESQUERDO (L)</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', marginTop: '2px' }}>Movimento (Eixo X/Y)</div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button onClick={() => setBindingField('moveAxisX')} style={{ flex: 1, padding: '5px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'moveAxisX' ? '#f59e0b' : 'rgba(99, 102, 241, 0.1)', color: bindingField === 'moveAxisX' ? '#000' : '#818cf8', cursor: 'pointer' }}>
                  {bindingField === 'moveAxisX' ? 'X...' : `X: ${config.moveAxisX}`}
                </button>
                <button onClick={() => setBindingField('moveAxisY')} style={{ flex: 1, padding: '5px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'moveAxisY' ? '#f59e0b' : 'rgba(99, 102, 241, 0.1)', color: bindingField === 'moveAxisY' ? '#000' : '#818cf8', cursor: 'pointer' }}>
                  {bindingField === 'moveAxisY' ? 'Y...' : `Y: ${config.moveAxisY}`}
                </button>
              </div>
            </div>

            {/* L3 Clique */}
            <div style={{
              background: bindingField === 'buttonL3' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(30, 41, 59, 0.5)',
              border: bindingField === 'buttonL3' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: '10px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>CLIQUE L3</div>
                <div style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 600 }}>Corrida / Sprint</div>
              </div>
              <button onClick={() => setBindingField('buttonL3')} style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'buttonL3' ? '#f59e0b' : 'rgba(99, 102, 241, 0.15)', color: bindingField === 'buttonL3' ? '#000' : '#818cf8', cursor: 'pointer' }}>
                {bindingField === 'buttonL3' ? '...' : `B${config.buttonL3}`}
              </button>
            </div>

            {/* Inversão Horizontal e Vertical */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1', cursor: 'pointer' }}>
                <span>Inverter Horizontal</span>
                <input type="checkbox" checked={config.invertX || false} onChange={e => {
                  const next = { ...config, invertX: e.target.checked };
                  setConfig(next);
                  localStorage.setItem('freedom3d_gamepad_config', JSON.stringify(next));
                }} style={{ cursor: 'pointer', accentColor: '#818cf8' }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1', cursor: 'pointer' }}>
                <span>Inverter Vertical</span>
                <input type="checkbox" checked={config.invertY || false} onChange={e => {
                  const next = { ...config, invertY: e.target.checked };
                  setConfig(next);
                  localStorage.setItem('freedom3d_gamepad_config', JSON.stringify(next));
                }} style={{ cursor: 'pointer', accentColor: '#818cf8' }} />
              </label>
            </div>

          </div>

          {/* SVG Centralizado do Controle PS4 */}
          <div style={{ width: '500px', height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 480 300" width="100%" height="100%">
              <defs>
                <radialGradient id="glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                </radialGradient>
              </defs>

              <circle cx="240" cy="150" r="180" fill="url(#glow)" />

              {/* Linhas de conexão esquemáticas esquerdas */}
              <path d="M 115 50 L 50 40" fill="none" stroke={getLineStroke('buttonL2')} strokeWidth={getLineStrength('buttonL2')} strokeDasharray={getLineDash('buttonL2')} />
              <path d="M 120 60 L 50 95" fill="none" stroke={getLineStroke('buttonL1')} strokeWidth={getLineStrength('buttonL1')} strokeDasharray={getLineDash('buttonL1')} />
              <path d="M 170 110 L 50 155" fill="none" stroke={getLineStroke('buttonShare')} strokeWidth={getLineStrength('buttonShare')} strokeDasharray={getLineDash('buttonShare')} />
              <path d="M 190 190 L 50 220" fill="none" stroke={bindingField === 'moveAxisX' || bindingField === 'moveAxisY' ? '#f59e0b' : 'rgba(129, 140, 248, 0.4)'} strokeWidth={bindingField === 'moveAxisX' || bindingField === 'moveAxisY' ? '3' : '1.5'} strokeDasharray={bindingField === 'moveAxisX' || bindingField === 'moveAxisY' ? 'none' : '4'} />
              <path d="M 190 190 L 50 295" fill="none" stroke={getLineStroke('buttonL3')} strokeWidth={getLineStrength('buttonL3')} strokeDasharray={getLineDash('buttonL3')} />

              {/* Linhas de conexão esquemáticas direitas */}
              <path d="M 365 50 L 430 25" fill="none" stroke={getLineStroke('buttonR2')} strokeWidth={getLineStrength('buttonR2')} strokeDasharray={getLineDash('buttonR2')} />
              <path d="M 360 60 L 430 75" fill="none" stroke={getLineStroke('buttonR1')} strokeWidth={getLineStrength('buttonR1')} strokeDasharray={getLineDash('buttonR1')} />
              <path d="M 310 110 L 430 125" fill="none" stroke={getLineStroke('buttonOptions')} strokeWidth={getLineStrength('buttonOptions')} strokeDasharray={getLineDash('buttonOptions')} />
              <path d="M 350 115 L 430 175" fill="none" stroke={getLineStroke('buttonD')} strokeWidth={getLineStrength('buttonD')} strokeDasharray={getLineDash('buttonD')} />
              <path d="M 375 140 L 430 225" fill="none" stroke={getLineStroke('buttonB')} strokeWidth={getLineStrength('buttonB')} strokeDasharray={getLineDash('buttonB')} />
              <path d="M 350 165 L 430 275" fill="none" stroke={getLineStroke('buttonA')} strokeWidth={getLineStrength('buttonA')} strokeDasharray={getLineDash('buttonA')} />
              <path d="M 325 140 L 430 325" fill="none" stroke={getLineStroke('buttonC')} strokeWidth={getLineStrength('buttonC')} strokeDasharray={getLineDash('buttonC')} />
              <path d="M 290 190 L 430 375" fill="none" stroke={bindingField === 'lookAxisX' || bindingField === 'lookAxisY' ? '#f59e0b' : 'rgba(129, 140, 248, 0.4)'} strokeWidth={bindingField === 'lookAxisX' || bindingField === 'lookAxisY' ? '3' : '1.5'} strokeDasharray={bindingField === 'lookAxisX' || bindingField === 'lookAxisY' ? 'none' : '4'} />
              <path d="M 290 190 L 430 425" fill="none" stroke={getLineStroke('buttonR3')} strokeWidth={getLineStrength('buttonR3')} strokeDasharray={getLineDash('buttonR3')} />

              {/* CONTROLE - PARTE FÍSICA */}
              <path d="M 90 70 C 90 40, 130 40, 140 70 Z" fill="#1e293b" stroke="#334155" strokeWidth="2" />
              <path d="M 340 70 C 350 40, 390 40, 390 70 Z" fill="#1e293b" stroke="#334155" strokeWidth="2" />

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

              <rect x="160" y="72" width="160" height="65" rx="6" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
              <rect x="190" y="68" width="100" height="4" rx="2" fill="#00d8ff" style={{ filter: 'drop-shadow(0 0 4px #00d8ff)' }} />

              <path d="M 100 135 H 115 V 120 H 125 V 135 H 140 V 145 H 125 V 160 H 115 V 145 H 100 Z" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />

              <circle cx="350" cy="140" r="35" fill="#0c1322" stroke="#1e293b" strokeWidth="2" />
              
              <circle cx="350" cy="115" r="9" fill="#1e293b" stroke="#334155" />
              <path d="M 350 111 L 354 118 L 346 118 Z" fill="none" stroke="#2dd4bf" strokeWidth="1.5" />
              
              <circle cx="375" cy="140" r="9" fill="#1e293b" stroke="#334155" />
              <circle cx="375" cy="140" r="4.5" fill="none" stroke="#f87171" strokeWidth="1.5" />
              
              <circle cx="350" cy="165" r="9" fill="#1e293b" stroke="#334155" />
              <path d="M 347 162 L 353 168 M 353 162 L 347 168" fill="none" stroke="#60a5fa" strokeWidth="1.5" />
              
              <circle cx="325" cy="140" r="9" fill="#1e293b" stroke="#334155" />
              <rect x="321" y="136" width="8" height="8" fill="none" stroke="#f472b6" strokeWidth="1.5" />

              <circle cx="190" cy="190" r="26" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
              <circle cx="190" cy="190" r="20" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
              <circle cx="190" cy="190" r="12" fill="#0f172a" />
              <text x="190" y="194" fill="#334155" fontSize="11" fontWeight="800" textAnchor="middle">L</text>

              <circle cx="290" cy="190" r="26" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
              <circle cx="290" cy="190" r="20" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
              <circle cx="290" cy="190" r="12" fill="#0f172a" />
              <text x="290" y="194" fill="#334155" fontSize="11" fontWeight="800" textAnchor="middle">R</text>
            </svg>
          </div>

          {/* Card Direita - R1, R2, R3, Options, Ações Triângulo/Círculo/X/Quadrado, Analógico R */}
          <div style={{ position: 'absolute', right: 0, width: '250px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 10 }}>
            
            {/* R2 e R1 */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{
                flex: 1, background: bindingField === 'buttonR2' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(30, 41, 59, 0.5)',
                border: bindingField === 'buttonR2' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px', padding: '8px'
              }}>
                <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>GATILHO R2</div>
                <button onClick={() => setBindingField('buttonR2')} style={{ width: '100%', marginTop: '4px', padding: '4px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'buttonR2' ? '#f59e0b' : 'rgba(99, 102, 241, 0.15)', color: bindingField === 'buttonR2' ? '#000' : '#818cf8', cursor: 'pointer' }}>
                  {bindingField === 'buttonR2' ? '...' : `Botão ${config.buttonR2}`}
                </button>
              </div>
              <div style={{
                flex: 1, background: bindingField === 'buttonR1' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(30, 41, 59, 0.5)',
                border: bindingField === 'buttonR1' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px', padding: '8px'
              }}>
                <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>BOTÃO R1</div>
                <button onClick={() => setBindingField('buttonR1')} style={{ width: '100%', marginTop: '4px', padding: '4px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'buttonR1' ? '#f59e0b' : 'rgba(99, 102, 241, 0.15)', color: bindingField === 'buttonR1' ? '#000' : '#818cf8', cursor: 'pointer' }}>
                  {bindingField === 'buttonR1' ? '...' : `Botão ${config.buttonR1}`}
                </button>
              </div>
            </div>

            {/* Options */}
            <div style={{
              background: bindingField === 'buttonOptions' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(30, 41, 59, 0.5)',
              border: bindingField === 'buttonOptions' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: '10px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>OPTIONS</div>
                <div style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 600 }}>Opções / Pausa</div>
              </div>
              <button onClick={() => setBindingField('buttonOptions')} style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'buttonOptions' ? '#f59e0b' : 'rgba(99, 102, 241, 0.15)', color: bindingField === 'buttonOptions' ? '#000' : '#818cf8', cursor: 'pointer' }}>
                {bindingField === 'buttonOptions' ? '...' : `B${config.buttonOptions}`}
              </button>
            </div>

            {/* Ações Triângulo e Círculo */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{
                flex: 1, background: bindingField === 'buttonD' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(30, 41, 59, 0.5)',
                border: bindingField === 'buttonD' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px', padding: '8px'
              }}>
                <div style={{ fontSize: '9px', color: '#2dd4bf', fontWeight: 800 }}>TRIÂNGULO (🔺)</div>
                <button onClick={() => setBindingField('buttonD')} style={{ width: '100%', marginTop: '4px', padding: '4px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'buttonD' ? '#f59e0b' : 'rgba(99, 102, 241, 0.15)', color: bindingField === 'buttonD' ? '#000' : '#818cf8', cursor: 'pointer' }}>
                  {bindingField === 'buttonD' ? '...' : `B${config.buttonD}`}
                </button>
              </div>
              <div style={{
                flex: 1, background: bindingField === 'buttonB' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(30, 41, 59, 0.5)',
                border: bindingField === 'buttonB' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px', padding: '8px'
              }}>
                <div style={{ fontSize: '9px', color: '#f87171', fontWeight: 800 }}>CÍRCULO (🔴)</div>
                <button onClick={() => setBindingField('buttonB')} style={{ width: '100%', marginTop: '4px', padding: '4px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'buttonB' ? '#f59e0b' : 'rgba(99, 102, 241, 0.15)', color: bindingField === 'buttonB' ? '#000' : '#818cf8', cursor: 'pointer' }}>
                  {bindingField === 'buttonB' ? '...' : `B${config.buttonB}`}
                </button>
              </div>
            </div>

            {/* Ações X e Quadrado */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{
                flex: 1, background: bindingField === 'buttonA' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(30, 41, 59, 0.5)',
                border: bindingField === 'buttonA' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px', padding: '8px'
              }}>
                <div style={{ fontSize: '9px', color: '#60a5fa', fontWeight: 800 }}>CRUZ / X (❌)</div>
                <button onClick={() => setBindingField('buttonA')} style={{ width: '100%', marginTop: '4px', padding: '4px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'buttonA' ? '#f59e0b' : 'rgba(99, 102, 241, 0.15)', color: bindingField === 'buttonA' ? '#000' : '#818cf8', cursor: 'pointer' }}>
                  {bindingField === 'buttonA' ? '...' : `B${config.buttonA}`}
                </button>
              </div>
              <div style={{
                flex: 1, background: bindingField === 'buttonC' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(30, 41, 59, 0.5)',
                border: bindingField === 'buttonC' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px', padding: '8px'
              }}>
                <div style={{ fontSize: '9px', color: '#f472b6', fontWeight: 800 }}>QUADRADO (⬜)</div>
                <button onClick={() => setBindingField('buttonC')} style={{ width: '100%', marginTop: '4px', padding: '4px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'buttonC' ? '#f59e0b' : 'rgba(99, 102, 241, 0.15)', color: bindingField === 'buttonC' ? '#000' : '#818cf8', cursor: 'pointer' }}>
                  {bindingField === 'buttonC' ? '...' : `B${config.buttonC}`}
                </button>
              </div>
            </div>

            {/* Analógico R (Olhar) */}
            <div style={{
              background: bindingField === 'lookAxisX' || bindingField === 'lookAxisY' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(30, 41, 59, 0.5)',
              border: bindingField === 'lookAxisX' || bindingField === 'lookAxisY' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px', padding: '10px'
            }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>ANALÓGICO DIREITO (R)</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', marginTop: '2px' }}>Olhar Câmera (Eixo X/Y)</div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button onClick={() => setBindingField('lookAxisX')} style={{ flex: 1, padding: '5px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'lookAxisX' ? '#f59e0b' : 'rgba(99, 102, 241, 0.1)', color: bindingField === 'lookAxisX' ? '#000' : '#818cf8', cursor: 'pointer' }}>
                  {bindingField === 'lookAxisX' ? 'X...' : `X: ${config.lookAxisX}`}
                </button>
                <button onClick={() => setBindingField('lookAxisY')} style={{ flex: 1, padding: '5px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'lookAxisY' ? '#f59e0b' : 'rgba(99, 102, 241, 0.1)', color: bindingField === 'lookAxisY' ? '#000' : '#818cf8', cursor: 'pointer' }}>
                  {bindingField === 'lookAxisY' ? 'Y...' : `Y: ${config.lookAxisY}`}
                </button>
              </div>
            </div>

            {/* R3 Clique */}
            <div style={{
              background: bindingField === 'buttonR3' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(30, 41, 59, 0.5)',
              border: bindingField === 'buttonR3' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: '10px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>CLIQUE R3</div>
                <div style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 600 }}>Reset Câmera / Mira</div>
              </div>
              <button onClick={() => setBindingField('buttonR3')} style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'buttonR3' ? '#f59e0b' : 'rgba(99, 102, 241, 0.15)', color: bindingField === 'buttonR3' ? '#000' : '#818cf8', cursor: 'pointer' }}>
                {bindingField === 'buttonR3' ? '...' : `B${config.buttonR3}`}
              </button>
            </div>

          </div>

        </div>

        {/* Rodapé - Ações Globais */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '20px', marginTop: '10px' }}>
          
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
