import { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { SceneView, xrStore } from '../editor/panels/SceneView';
import { useEditorStore } from '../editor/store/editorStore';
import { HardDrive } from 'lucide-react';

// Helper para formatar bytes em formato legÃ­vel
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
      const response = await cache.match(request, { ignoreVary: true });
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

// Limpar Cache Storage e Three.js cache em memÃ³ria
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
    alert('Logs copiados para a Ã¡rea de transferÃªncia!');
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
              <span style={{ color: '#94a3b8' }}>MemÃ³ria RAM JS:</span>
              <span style={{ color: '#38bdf8' }}>{ramUsage}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px' }}>
              <span style={{ color: '#94a3b8' }}>Draw Calls:</span>
              <span style={{ color: '#a78bfa' }}>{webglInfo.drawCalls}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px' }}>
              <span style={{ color: '#94a3b8' }}>TriÃ¢ngulos:</span>
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

export function StandalonePlayer({ roomId }: { roomId?: string } = {}) {
  const setActiveViewport = useEditorStore(state => state.setActiveViewport);
  const togglePlay = useEditorStore(state => state.togglePlay);
  const addLog = useEditorStore(state => state.addLog);
  const activeSceneId = useEditorStore(state => state.activeSceneId);
  const [showDebug, setShowDebug] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);


  // Referencias para atualizacao direta no DOM da barra de carregamento
  const progressBarRef = useRef<HTMLDivElement>(null);
  const progressTextRef = useRef<HTMLSpanElement>(null);
  const progressStatusRef = useRef<HTMLSpanElement>(null);

  // Elemento de video oculto para captura da camera no Modo AR (Passthrough simulado em VR)
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.style.display = 'none';
      videoElementRef.current = video;
      (window as any).__freedom3d_ar_video__ = video;
    }
    return () => {
      if (videoElementRef.current && videoElementRef.current.srcObject) {
        const stream = videoElementRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Estados da tela de carregamento e inicio do jogo
  const [loading, setLoading] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [sceneLoaded, setSceneLoaded] = useState(false);

  // Estados do Cache de Assets
  const [cacheSize, setCacheSize] = useState<number>(0);
  const [isXRSupported, setIsXRSupported] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr').then(supported => {
        setIsXRSupported(supported);
      });
    }
  }, []);

  const updateCacheSize = async () => {
    const size = await getCacheSize();
    setCacheSize(size);
  };

  const handleClearCache = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await clearAssetsCache();
    await updateCacheSize();
  };

  const triggerPlay = () => {
    setGameStarted(true);
    if (!useEditorStore.getState().isPlaying) {
      togglePlay();
    }
    // Tenta entrar em VR automaticamente se suportado â€” sem avisos se falhar
    if (isXRSupported) {
      xrStore.enterVR().catch(() => {});
    }
  };

  const handlePlayScreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    (window as any).__freedom3d_ar_mode__ = false;
    if (videoElementRef.current && videoElementRef.current.srcObject) {
      const stream = videoElementRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoElementRef.current.srcObject = null;
    }
    setGameStarted(true);
    if (!useEditorStore.getState().isPlaying) {
      togglePlay();
    }
  };

  const handlePlayVR = (e: React.MouseEvent) => {
    e.stopPropagation();
    (window as any).__freedom3d_ar_mode__ = false;
    if (videoElementRef.current && videoElementRef.current.srcObject) {
      const stream = videoElementRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoElementRef.current.srcObject = null;
    }
    setGameStarted(true);
    if (!useEditorStore.getState().isPlaying) {
      togglePlay();
    }
    xrStore.enterVR().catch(() => {});
  };

  const handlePlayAR = (e: React.MouseEvent) => {
    e.stopPropagation();
    (window as any).__freedom3d_ar_mode__ = true;
    
    // Inicia captura do feed da câmera traseira (passthrough simulado)
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      })
      .then(stream => {
        if (videoElementRef.current) {
          videoElementRef.current.srcObject = stream;
          videoElementRef.current.play().catch(() => {});
        }
      })
      .catch(err => {
        console.warn("Falha ao inicializar a câmera do dispositivo:", err);
      });
    }

    setGameStarted(true);
    if (!useEditorStore.getState().isPlaying) {
      togglePlay();
    }
    xrStore.enterVR().catch(() => {});
  };

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerPlay();
  };

  const triggerPlayRef = useRef(triggerPlay);
  triggerPlayRef.current = triggerPlay;
  const gameStartedRef = useRef(gameStarted);
  gameStartedRef.current = gameStarted;

  useEffect(() => {
    // ForÃ§ar modo Jogo
    setActiveViewport('game');

    // SÃ³ forÃ§a o pause se for o carregamento inicial real da pÃ¡gina
    // e nÃ£o um HMR (Hot Module Replacement) do Vite
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
      if (now - lastLogged > 1000) { // Limita o log a no mÃ¡ximo 1 por segundo para a mesma mensagem
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
          const cache = await window.caches.open('freedom3d-assets-cache');

          const cachedResponse = await cache.match(input, { ignoreVary: true });
          if (cachedResponse) {
            return cachedResponse;
          }

          const response = await originalFetch(input, init);
          if (response.status === 200) {
            try {
              // Evita clonar e cachear arquivos com mais de 30MB para nÃ£o sobrecarregar a memÃ³ria temporÃ¡ria de stream
              const contentLength = response.headers.get('content-length');
              const isLarge = contentLength ? parseInt(contentLength, 10) > 30 * 1024 * 1024 : false;

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

    // Monkey patch para THREE.ImageLoader para carregar imagens com fetch
    // Isso garante que todas as texturas sejam interceptadas pelo Cache Storage
    const originalImageLoaderLoad = THREE.ImageLoader.prototype.load;
    THREE.ImageLoader.prototype.load = function (
      url: string,
      onLoad?: (image: HTMLImageElement) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (event: ErrorEvent) => void
    ) {
      if (!url || url.startsWith('blob:') || url.startsWith('data:')) {
        return originalImageLoaderLoad.call(this, url, onLoad, onProgress, onError);
      }

      const cachedImage = document.createElement('img');
      if (this.crossOrigin) cachedImage.crossOrigin = this.crossOrigin;

      window.fetch(url)
        .then(res => res.blob())
        .then(blob => {
          const blobUrl = URL.createObjectURL(blob);
          const handleLoad = () => {
            cachedImage.removeEventListener('load', handleLoad);
            cachedImage.removeEventListener('error', handleErrorEvent);
            URL.revokeObjectURL(blobUrl);
            if (onLoad) onLoad(cachedImage);
          };
          const handleErrorEvent = (err: any) => {
            cachedImage.removeEventListener('load', handleLoad);
            cachedImage.removeEventListener('error', handleErrorEvent);
            URL.revokeObjectURL(blobUrl);
            if (onError) onError(err);
          };
          cachedImage.addEventListener('load', handleLoad);
          cachedImage.addEventListener('error', handleErrorEvent);
          cachedImage.src = blobUrl;
        })
        .catch(() => {
          originalImageLoaderLoad.call(this, url, onLoad, onProgress, onError);
        });

      return cachedImage;
    };

    (window as any).__updateFreedom3DCacheSize = updateCacheSize;
    updateCacheSize();

    const isOffline = (window as any).__freedom3d_standalone__;
    const urlParams = new URLSearchParams(window.location.search);
    const projectParam = urlParams.get('project') || '';

    // â”€â”€ Determina URL de carregamento de cena â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Prioridade: roomId prop > project queryParam > /api/sync
    const getSyncUrl = () => {
      if (roomId) {
        return `/api/room/${encodeURIComponent(roomId)}`;
      }
      if (isOffline) return './scene.json';
      if (projectParam) return `/api/sync?project=${encodeURIComponent(projectParam)}`;
      return '/api/sync';
    };

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
            const finalProjectName = projectParam || scene.name || 'default';
            e.components.Audio.src = isOffline
              ? './assets/' + e.components.Audio.fileName
              : '/api/project/get-asset?project=' + encodeURIComponent(finalProjectName) + '&file=' + encodeURIComponent(e.components.Audio.fileName);
          }
        });
        useEditorStore.setState(state => ({
          scenes: { ...state.scenes, [scene.id]: scene },
          activeSceneId: scene.id
        }));
      }
    };

    // Load initial scene state once
    const syncUrl = getSyncUrl();

    fetch(syncUrl, { cache: 'no-store' })

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

    // Polling para atualizaÃ§Ãµes â€” apenas quando o editor estÃ¡ ativo e nÃ£o estÃ¡ em modo offline standalone
    const isEditorMode = !isOffline && (window.location.search.includes('editor') || document.referrer.includes('editor'));
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    if (isEditorMode) {
      pollInterval = setInterval(async () => {
        try {
          const syncPollUrl = projectParam ? `/api/sync?project=${encodeURIComponent(projectParam)}` : '/api/sync';
          const res = await fetch(syncPollUrl, { cache: 'no-store' });
          const scene = await res.json();
          if (scene && scene.publishedAt) {
            const lastPublishedAt = window.sessionStorage.getItem('lastPublishedAt');
            if (lastPublishedAt && lastPublishedAt !== scene.publishedAt.toString()) {
              window.sessionStorage.setItem('lastPublishedAt', scene.publishedAt.toString());
              handleSceneUpdate(scene);
            }
          }
        } catch (err) { }
      }, 3000);
    }

    // Monitoramento dos botÃµes do Gamepad (Share/Select para reiniciar, Options/Start para dar Play)
    const gamepadPollInterval = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.getGamepads) {
        const gamepads = navigator.getGamepads();
        for (const gp of gamepads) {
          if (gp && gp.connected) {
            // Skip Android motion sensors / gyros often reported as gamepads in Chrome
            const idLower = gp.id ? gp.id.toLowerCase() : '';
            if (idLower.includes('sensor') || idLower.includes('motion') || idLower.includes('accelerometer') || idLower.includes('gyro')) {
              continue;
            }
            // Skip devices with no buttons
            if (!gp.buttons || gp.buttons.length === 0) {
              continue;
            }

            let optionsIdx = 9; // Options/Start padrÃ£o
            let shareIdx = 8;   // Share/Select padrÃ£o
            try {
              const saved = localStorage.getItem('freedom3d_gamepad_config');
              if (saved) {
                const config = JSON.parse(saved);
                if (typeof config.buttonOptions === 'number') {
                  optionsIdx = config.buttonOptions;
                }
                if (typeof config.buttonShare === 'number') {
                  shareIdx = config.buttonShare;
                }
              }
            } catch (err) { }

            if (gp.buttons[shareIdx] && gp.buttons[shareIdx].pressed) {
              window.location.reload();
            }

            if (gp.buttons[optionsIdx] && gp.buttons[optionsIdx].pressed) {
              if (!gameStartedRef.current) {
                triggerPlayRef.current();
              }
            }
          }
        }
      }
    }, 100);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' || (e.ctrlKey && e.shiftKey && e.key === 'D')) {
        setShowDebug(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      clearInterval(gamepadPollInterval);
      window.removeEventListener('error', handleError);
      window.removeEventListener('keydown', handleKeyDown);
      console.error = origError;
      window.fetch = originalFetch;
      THREE.ImageLoader.prototype.load = originalImageLoaderLoad;
      delete (window as any).__updateFreedom3DCacheSize;
    };
  }, []);

    // Lê coverImage e roomName da cena carregada para usar no overlay
  const activeScene = useEditorStore(state =>
    state.activeSceneId ? state.scenes[state.activeSceneId] : null
  );
  const coverImage = (activeScene as any)?.coverImage || '';
  const roomName = (activeScene as any)?.name || '';

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden', position: 'relative' }}>
      <SceneView
        isStandalone={true}
        sceneLoaded={sceneLoaded}
        onProgress={(p, statusText) => {
          const clampedP = Math.max(5, p);
          if (progressBarRef.current) progressBarRef.current.style.width = `${clampedP}%`;
          if (progressTextRef.current) progressTextRef.current.innerText = `${clampedP}%`;
          if (progressStatusRef.current && statusText) {
            progressStatusRef.current.innerText = statusText;
          }
        }}
        onLoaded={() => setLoading(false)}
      />
      {showDebug && <DebugUI />}

      {/* Botão de debug flutuante (discreto, canto superior direito) */}
      {gameStarted && (
        <button
          onClick={() => window.location.reload()}
          style={{
            position: 'absolute', top: '16px', right: '16px', zIndex: 9999,
            background: 'rgba(0,0,0,0.35)', color: 'rgba(255,255,255,0.7)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: '50%',
            width: '36px', height: '36px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(8px)',
            transition: 'all 0.2s', outline: 'none'
          }}
          title="Recarregar Sala"
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.65)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.35)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
          </svg>
        </button>
      )}

      {/* Botão de voltar para o Discover (no canto superior esquerdo, só visível se o jogo não iniciou) */}
      {!gameStarted && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            window.location.href = '/discover';
          }}
          style={{
            position: 'absolute', top: '24px', left: '24px', zIndex: 10000,
            background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.85)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '100px',
            padding: '10px 20px', fontSize: '13px', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '8px',
            cursor: 'pointer', backdropFilter: 'blur(10px)',
            transition: 'all 0.2s ease', outline: 'none',
            fontFamily: "'Outfit', sans-serif"
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Voltar ao Discover
        </button>
      )}

      {/* ── Overlay principal ─────────────────────────────────────── */}
      {showOverlay && (
        <div
          onTransitionEnd={() => { if (gameStarted) setShowOverlay(false); }}
          onClick={() => {
            // Fullscreen ao clicar no fundo
            if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
              document.documentElement.requestFullscreen().then(() => {
                const orientation = window.screen && (window.screen.orientation as any);
                if (orientation && orientation.lock) orientation.lock('landscape').catch(() => {});
              }).catch(() => {});
            }
          }}
          style={{
            position: 'absolute', inset: 0, zIndex: 9999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            transition: 'opacity 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
            opacity: gameStarted ? 0 : 1,
            pointerEvents: gameStarted ? 'none' : 'all',
            overflow: 'hidden',
          }}
        >
          {/* Fundo: usa coverImage da sala ou fallback gradiente */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: coverImage ? `url(${coverImage})` : 'none',
            backgroundSize: 'cover', backgroundPosition: 'center',
            transform: 'scale(1.04)',
            filter: 'brightness(0.45) saturate(1.1)',
          }} />
          {/* Fallback escuro se não houver capa */}
          {!coverImage && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse at 30% 60%, #1a0a3e 0%, #06080d 60%)',
            }} />
          )}
          {/* Gradiente de legibilidade */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(6,8,13,1) 0%, rgba(6,8,13,0.5) 50%, rgba(6,8,13,0.2) 100%)',
          }} />

          {/* Conteúdo central */}
          <div style={{
            position: 'relative', zIndex: 2, textAlign: 'center',
            padding: '24px 32px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: '0',
            fontFamily: "'Outfit', 'Inter', sans-serif",
          }}>

            {/* Logo / nome da engine */}
            <div style={{
              fontSize: '11px', fontWeight: 700, letterSpacing: '3px',
              color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: '16px',
            }}>
              Freedom3D
            </div>

            {/* Nome da sala */}
            {roomName && !loading && activeSceneId && (
              <h1 style={{
                fontSize: 'clamp(28px, 6vw, 56px)', fontWeight: 900,
                letterSpacing: '-1px', lineHeight: 1.05,
                color: '#fff', margin: '0 0 8px',
                textShadow: '0 2px 32px rgba(0,0,0,0.7)',
              }}>
                {roomName}
              </h1>
            )}

            {/* Estado: carregando */}
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '32px' }}>
                <span
                  ref={progressStatusRef}
                  style={{
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.5)',
                    fontWeight: 500,
                    marginBottom: '4px',
                    maxWidth: '260px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontFamily: "'Outfit', 'Inter', sans-serif"
                  }}
                >
                  Iniciando carregamento...
                </span>
                <div style={{
                  width: '240px', height: '4px',
                  background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden',
                }}>
                  <div
                    ref={progressBarRef}
                    style={{
                      width: '5%', height: '100%',
                      background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
                      borderRadius: '2px', transition: 'width 0.3s ease',
                      boxShadow: '0 0 12px rgba(124,58,237,0.6)',
                    }}
                  />
                </div>
                <span
                  ref={progressTextRef}
                  style={{ fontFamily: 'monospace', fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}
                >
                  5%
                </span>
              </div>
            ) : (
              <>
                {/* Badge VR — só aparece quando VR está disponível, de forma sutil */}
                {isXRSupported && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px',
                    color: '#10b981', textTransform: 'uppercase',
                    background: 'rgba(16,185,129,0.1)',
                    border: '1px solid rgba(16,185,129,0.25)',
                    borderRadius: '4px', padding: '3px 10px', marginBottom: '28px',
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }} />
                    VR Disponível
                  </div>
                )}
                {!isXRSupported && <div style={{ marginBottom: '28px' }} />}

                {/* Três Modos de Inicialização lado a lado */}
                <div style={{
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  marginTop: '8px'
                }}>
                  {/* Botão SCREEN */}
                  <button
                    onClick={handlePlayScreen}
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.15)',
                      padding: '16px 36px',
                      fontSize: '14px', fontWeight: 700, letterSpacing: '0.5px',
                      borderRadius: '100px', cursor: 'pointer',
                      backdropFilter: 'blur(8px)',
                      transition: 'all 0.2s ease',
                      display: 'inline-flex', alignItems: 'center', gap: '8px',
                      outline: 'none', textTransform: 'uppercase',
                      fontFamily: "'Outfit', 'Inter', sans-serif",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                    Screen
                  </button>

                  {/* Botão VR */}
                  <button
                    onClick={handlePlayVR}
                    style={{
                      background: 'rgba(255,255,255,0.95)',
                      color: '#0a0a0f',
                      border: 'none',
                      padding: '18px 44px',
                      fontSize: '15px', fontWeight: 800, letterSpacing: '0.5px',
                      borderRadius: '100px', cursor: 'pointer',
                      boxShadow: '0 8px 30px rgba(124, 58, 237, 0.3)',
                      transition: 'all 0.2s ease',
                      display: 'inline-flex', alignItems: 'center', gap: '8px',
                      outline: 'none', textTransform: 'uppercase',
                      fontFamily: "'Outfit', 'Inter', sans-serif",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'scale(1.05) translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 12px 35px rgba(124, 58, 237, 0.45)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'scale(1) translateY(0)';
                      e.currentTarget.style.boxShadow = '0 8px 30px rgba(124, 58, 237, 0.3)';
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 8V6a2 2 0 0 1 2-2h2" />
                      <path d="M20 8V6a2 2 0 0 0-2-2h-2" />
                      <path d="M4 16v2a2 2 0 0 0 2 2h2" />
                      <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
                      <circle cx="9" cy="12" r="1" />
                      <circle cx="15" cy="12" r="1" />
                    </svg>
                    Entrar em VR
                  </button>

                  {/* Botão AR */}
                  <button
                    onClick={handlePlayAR}
                    style={{
                      background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                      color: '#fff',
                      border: 'none',
                      padding: '16px 36px',
                      fontSize: '14px', fontWeight: 700, letterSpacing: '0.5px',
                      borderRadius: '100px', cursor: 'pointer',
                      boxShadow: '0 8px 30px rgba(168, 85, 247, 0.25)',
                      transition: 'all 0.2s ease',
                      display: 'inline-flex', alignItems: 'center', gap: '8px',
                      outline: 'none', textTransform: 'uppercase',
                      fontFamily: "'Outfit', 'Inter', sans-serif",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'scale(1.03) translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 12px 35px rgba(168, 85, 247, 0.4)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'scale(1) translateY(0)';
                      e.currentTarget.style.boxShadow = '0 8px 30px rgba(168, 85, 247, 0.25)';
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 12h8" />
                      <path d="M12 8v8" />
                    </svg>
                    Modo AR
                  </button>
                </div>

                {/* Botão de configuração de controles — discreto, abaixo */}
                <button
                  onClick={e => { e.stopPropagation(); setShowConfigModal(true); }}
                  style={{
                    marginTop: '20px',
                    background: 'transparent', color: 'rgba(255,255,255,0.35)',
                    border: 'none', padding: '8px 16px', fontSize: '12px',
                    fontWeight: 500, borderRadius: '8px', cursor: 'pointer',
                    transition: 'color 0.2s', outline: 'none',
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    fontFamily: "'Inter', sans-serif",
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9" />
                  </svg>
                  Configurar Controle
                </button>

                {/* Cache — super discreto, apenas quando tem algo */}
                {cacheSize > 0 && (
                  <div style={{
                    marginTop: '28px', display: 'flex', alignItems: 'center',
                    gap: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.2)',
                    fontFamily: 'monospace',
                  }}>
                    <HardDrive size={12} />
                    <span>{formatBytes(cacheSize)} em cache</span>
                    <button
                      onClick={handleClearCache}
                      style={{
                        background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)',
                        cursor: 'pointer', fontSize: '11px', padding: '0 4px', outline: 'none',
                        textDecoration: 'underline', fontFamily: 'monospace',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                      onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
                    >
                      limpar
                    </button>
                  </div>
                )}
              </>
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
        const firstGp = Array.from(gps).find(g => {
          if (!g || !g.connected) return false;
          const id = (g.id || '').toLowerCase();
          if (id.includes('sensor') || id.includes('motion') || id.includes('accelerometer') || id.includes('gyro')) return false;
          return g.buttons && g.buttons.length > 0;
        });
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

    const findRealGamepad = () => {
      if (typeof navigator === 'undefined' || !navigator.getGamepads) return undefined;
      const gps = navigator.getGamepads();
      return Array.from(gps).find(g => {
        if (!g || !g.connected) return false;
        const id = (g.id || '').toLowerCase();
        if (id.includes('sensor') || id.includes('motion') || id.includes('accelerometer') || id.includes('gyro')) return false;
        return g.buttons && g.buttons.length > 0;
      });
    };

    const initialGp = findRealGamepad();
    if (initialGp) {
      initialAxesValues = Array.from(initialGp.axes);
    }

    const poll = () => {
      const gp = findRealGamepad();

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
    return bindingField === field ? '#7c3aed' : 'rgba(124, 58, 237, 0.3)';
  };
  const getLineDash = (field: keyof GamepadConfig) => {
    return bindingField === field ? 'none' : '3';
  };
  const getLineStrength = (field: keyof GamepadConfig) => {
    return bindingField === field ? '3.5' : '1.5';
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(5, 5, 8, 0.85)', backdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
      fontFamily: "'Outfit', 'Inter', sans-serif", padding: '20px'
    }} onClick={onClose}>
      <div style={{
        background: 'rgba(11, 11, 16, 0.95)', border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '28px', width: '1080px', padding: '32px',
        boxShadow: '0 32px 64px -16px rgba(0, 0, 0, 0.8), inset 0 0 32px rgba(124, 58, 237, 0.03)', color: '#fff',
        display: 'flex', flexDirection: 'column', gap: '24px',
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        transition: 'transform 0.1s ease-out'
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '18px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: activeGamepadName.includes('Nenhum') ? '#ef4444' : '#10b981', boxShadow: activeGamepadName.includes('Nenhum') ? '0 0 10px #ef4444' : '0 0 10px #10b981' }}></span>
              Configurar Controles Bluetooth
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>Mapeie os eixos e botões do seu controle compatível ou gamepad</p>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '28px', cursor: 'pointer', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', transition: 'all 0.2s'
          }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
          >&times;</button>
        </div>

        {/* HUD de Controle Conectado */}
        <div style={{
          background: activeGamepadName.includes('Nenhum') ? 'rgba(255, 255, 255, 0.02)' : 'rgba(124, 58, 237, 0.05)',
          borderRadius: '16px', padding: '14px 20px',
          border: activeGamepadName.includes('Nenhum') ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(124, 58, 237, 0.15)',
          fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <span style={{ color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em' }}>Controle Conectado</span>
            <div style={{ color: activeGamepadName.includes('Nenhum') ? 'rgba(255,255,255,0.5)' : '#a78bfa', marginTop: '2px', fontWeight: 600, fontSize: '14px' }}>{activeGamepadName}</div>
          </div>
          <div style={{ padding: '6px 12px', borderRadius: '8px', background: activeGamepadName.includes('Nenhum') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: activeGamepadName.includes('Nenhum') ? '#f87171' : '#34d399', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>
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
                flex: 1, background: bindingField === 'buttonL2' ? 'rgba(124, 58, 237, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                border: bindingField === 'buttonL2' ? '1px solid #7c3aed' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px', padding: '10px', transition: 'all 0.2s'
              }}>
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.5px' }}>GATILHO L2</div>
                <button onClick={() => setBindingField('buttonL2')} style={{ width: '100%', marginTop: '6px', padding: '6px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'buttonL2' ? '#7c3aed' : 'rgba(255, 255, 255, 0.06)', color: bindingField === 'buttonL2' ? '#fff' : 'rgba(255,255,255,0.8)', cursor: 'pointer', transition: 'all 0.2s' }}>
                  {bindingField === 'buttonL2' ? '...' : `Botão ${config.buttonL2}`}
                </button>
              </div>
              <div style={{
                flex: 1, background: bindingField === 'buttonL1' ? 'rgba(124, 58, 237, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                border: bindingField === 'buttonL1' ? '1px solid #7c3aed' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px', padding: '10px', transition: 'all 0.2s'
              }}>
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.5px' }}>BOTÃO L1</div>
                <button onClick={() => setBindingField('buttonL1')} style={{ width: '100%', marginTop: '6px', padding: '6px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'buttonL1' ? '#7c3aed' : 'rgba(255, 255, 255, 0.06)', color: bindingField === 'buttonL1' ? '#fff' : 'rgba(255,255,255,0.8)', cursor: 'pointer', transition: 'all 0.2s' }}>
                  {bindingField === 'buttonL1' ? '...' : `Botão ${config.buttonL1}`}
                </button>
              </div>
            </div>

            {/* Share */}
            <div style={{
              background: bindingField === 'buttonShare' ? 'rgba(124, 58, 237, 0.1)' : 'rgba(255, 255, 255, 0.02)',
              border: bindingField === 'buttonShare' ? '1px solid #7c3aed' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.2s'
            }}>
              <div>
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.5px' }}>SHARE</div>
                <div style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 600 }}>Compartilhar / Menu</div>
              </div>
              <button onClick={() => setBindingField('buttonShare')} style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'buttonShare' ? '#7c3aed' : 'rgba(255, 255, 255, 0.06)', color: bindingField === 'buttonShare' ? '#fff' : 'rgba(255,255,255,0.8)', cursor: 'pointer', transition: 'all 0.2s' }}>
                {bindingField === 'buttonShare' ? '...' : `B${config.buttonShare}`}
              </button>
            </div>

            {/* Analógico L (Movimento) */}
            <div style={{
              background: bindingField === 'moveAxisX' || bindingField === 'moveAxisY' ? 'rgba(124, 58, 237, 0.1)' : 'rgba(255, 255, 255, 0.02)',
              border: bindingField === 'moveAxisX' || bindingField === 'moveAxisY' ? '1px solid #7c3aed' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: '14px', padding: '12px', transition: 'all 0.2s'
            }}>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.5px' }}>ANALÓGICO ESQUERDO (L)</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>Movimento (Eixo X/Y)</div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button onClick={() => setBindingField('moveAxisX')} style={{ flex: 1, padding: '6px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'moveAxisX' ? '#7c3aed' : 'rgba(255, 255, 255, 0.06)', color: bindingField === 'moveAxisX' ? '#fff' : 'rgba(255,255,255,0.8)', cursor: 'pointer', transition: 'all 0.2s' }}>
                  {bindingField === 'moveAxisX' ? 'X...' : `X: ${config.moveAxisX}`}
                </button>
                <button onClick={() => setBindingField('moveAxisY')} style={{ flex: 1, padding: '6px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'moveAxisY' ? '#7c3aed' : 'rgba(255, 255, 255, 0.06)', color: bindingField === 'moveAxisY' ? '#fff' : 'rgba(255,255,255,0.8)', cursor: 'pointer', transition: 'all 0.2s' }}>
                  {bindingField === 'moveAxisY' ? 'Y...' : `Y: ${config.moveAxisY}`}
                </button>
              </div>
            </div>

            {/* L3 Clique */}
            <div style={{
              background: bindingField === 'buttonL3' ? 'rgba(124, 58, 237, 0.1)' : 'rgba(255, 255, 255, 0.02)',
              border: bindingField === 'buttonL3' ? '1px solid #7c3aed' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.2s'
            }}>
              <div>
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.5px' }}>CLIQUE L3</div>
                <div style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 600 }}>Corrida / Sprint</div>
              </div>
              <button onClick={() => setBindingField('buttonL3')} style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'buttonL3' ? '#7c3aed' : 'rgba(255, 255, 255, 0.06)', color: bindingField === 'buttonL3' ? '#fff' : 'rgba(255,255,255,0.8)', cursor: 'pointer', transition: 'all 0.2s' }}>
                {bindingField === 'buttonL3' ? '...' : `B${config.buttonL3}`}
              </button>
            </div>

            {/* Inversão Horizontal e Vertical */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255,255,255,0.04)',
              borderRadius: '14px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'rgba(255,255,255,0.75)', cursor: 'pointer' }}>
                <span>Inverter Horizontal</span>
                <input type="checkbox" checked={config.invertX || false} onChange={e => {
                  const next = { ...config, invertX: e.target.checked };
                  setConfig(next);
                  localStorage.setItem('freedom3d_gamepad_config', JSON.stringify(next));
                }} style={{ cursor: 'pointer', accentColor: '#7c3aed' }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'rgba(255,255,255,0.75)', cursor: 'pointer' }}>
                <span>Inverter Vertical</span>
                <input type="checkbox" checked={config.invertY || false} onChange={e => {
                  const next = { ...config, invertY: e.target.checked };
                  setConfig(next);
                  localStorage.setItem('freedom3d_gamepad_config', JSON.stringify(next));
                }} style={{ cursor: 'pointer', accentColor: '#7c3aed' }} />
              </label>
            </div>

          </div>

          {/* SVG Centralizado do Controle PS4 */}
          <div style={{ width: '500px', height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 480 300" width="100%" height="100%">
              <defs>
                <radialGradient id="glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
                </radialGradient>
              </defs>

              <circle cx="240" cy="150" r="180" fill="url(#glow)" />

              {/* Linhas de conexão esquemáticas esquerdas */}
              <path d="M 115 50 L 50 40" fill="none" stroke={getLineStroke('buttonL2')} strokeWidth={getLineStrength('buttonL2')} strokeDasharray={getLineDash('buttonL2')} />
              <path d="M 120 60 L 50 95" fill="none" stroke={getLineStroke('buttonL1')} strokeWidth={getLineStrength('buttonL1')} strokeDasharray={getLineDash('buttonL1')} />
              <path d="M 170 110 L 50 155" fill="none" stroke={getLineStroke('buttonShare')} strokeWidth={getLineStrength('buttonShare')} strokeDasharray={getLineDash('buttonShare')} />
              <path d="M 190 190 L 50 220" fill="none" stroke={bindingField === 'moveAxisX' || bindingField === 'moveAxisY' ? '#7c3aed' : 'rgba(124, 58, 237, 0.3)'} strokeWidth={bindingField === 'moveAxisX' || bindingField === 'moveAxisY' ? '3.5' : '1.5'} strokeDasharray={bindingField === 'moveAxisX' || bindingField === 'moveAxisY' ? 'none' : '3'} />
              <path d="M 190 190 L 50 295" fill="none" stroke={getLineStroke('buttonL3')} strokeWidth={getLineStrength('buttonL3')} strokeDasharray={getLineDash('buttonL3')} />

              {/* Linhas de conexão esquemáticas direitas */}
              <path d="M 365 50 L 430 25" fill="none" stroke={getLineStroke('buttonR2')} strokeWidth={getLineStrength('buttonR2')} strokeDasharray={getLineDash('buttonR2')} />
              <path d="M 360 60 L 430 75" fill="none" stroke={getLineStroke('buttonR1')} strokeWidth={getLineStrength('buttonR1')} strokeDasharray={getLineDash('buttonR1')} />
              <path d="M 310 110 L 430 125" fill="none" stroke={getLineStroke('buttonOptions')} strokeWidth={getLineStrength('buttonOptions')} strokeDasharray={getLineDash('buttonOptions')} />
              <path d="M 350 115 L 430 175" fill="none" stroke={getLineStroke('buttonD')} strokeWidth={getLineStrength('buttonD')} strokeDasharray={getLineDash('buttonD')} />
              <path d="M 375 140 L 430 225" fill="none" stroke={getLineStroke('buttonB')} strokeWidth={getLineStrength('buttonB')} strokeDasharray={getLineDash('buttonB')} />
              <path d="M 350 165 L 430 275" fill="none" stroke={getLineStroke('buttonA')} strokeWidth={getLineStrength('buttonA')} strokeDasharray={getLineDash('buttonA')} />
              <path d="M 325 140 L 430 325" fill="none" stroke={getLineStroke('buttonC')} strokeWidth={getLineStrength('buttonC')} strokeDasharray={getLineDash('buttonC')} />
              <path d="M 290 190 L 430 375" fill="none" stroke={bindingField === 'lookAxisX' || bindingField === 'lookAxisY' ? '#7c3aed' : 'rgba(124, 58, 237, 0.3)'} strokeWidth={bindingField === 'lookAxisX' || bindingField === 'lookAxisY' ? '3.5' : '1.5'} strokeDasharray={bindingField === 'lookAxisX' || bindingField === 'lookAxisY' ? 'none' : '3'} />
              <path d="M 290 190 L 430 425" fill="none" stroke={getLineStroke('buttonR3')} strokeWidth={getLineStrength('buttonR3')} strokeDasharray={getLineDash('buttonR3')} />

              {/* CONTROLE - PARTE FÍSICA */}
              <path d="M 90 70 C 90 40, 130 40, 140 70 Z" fill="#161622" stroke="#252538" strokeWidth="2" />
              <path d="M 340 70 C 350 40, 390 40, 390 70 Z" fill="#161622" stroke="#252538" strokeWidth="2" />

              <path d="M 120 70 
                       C 90 70, 70 95, 60 130 
                       C 40 200, 50 255, 75 270 
                       C 95 280, 130 250, 155 220 
                       C 185 205, 295 205, 325 220 
                       C 350 250, 385 280, 405 270 
                       C 430 255, 440 200, 420 130 
                       C 410 95, 390 70, 360 70 
                       Z"
                fill="#0f0f15" stroke="#1f1f2e" strokeWidth="3" />

              <rect x="160" y="72" width="160" height="65" rx="8" fill="#07070a" stroke="#181824" strokeWidth="2" />
              <rect x="190" y="68" width="100" height="4" rx="2" fill="#7c3aed" style={{ filter: 'drop-shadow(0 0 6px #7c3aed)' }} />

              <path d="M 100 135 H 115 V 120 H 125 V 135 H 140 V 145 H 125 V 160 H 115 V 145 H 100 Z" fill="#161622" stroke="#252538" strokeWidth="1.5" />

              <circle cx="350" cy="140" r="35" fill="#08080c" stroke="#161622" strokeWidth="2" />

              <circle cx="350" cy="115" r="9" fill="#161622" stroke="#252538" />
              <path d="M 350 111 L 354 118 L 346 118 Z" fill="none" stroke="#2dd4bf" strokeWidth="1.5" />

              <circle cx="375" cy="140" r="9" fill="#161622" stroke="#252538" />
              <circle cx="375" cy="140" r="4.5" fill="none" stroke="#f87171" strokeWidth="1.5" />

              <circle cx="350" cy="165" r="9" fill="#161622" stroke="#252538" />
              <path d="M 347 162 L 353 168 M 353 162 L 347 168" fill="none" stroke="#60a5fa" strokeWidth="1.5" />

              <circle cx="325" cy="140" r="9" fill="#161622" stroke="#252538" />
              <rect x="321" y="136" width="8" height="8" fill="none" stroke="#f472b6" strokeWidth="1.5" />

              <circle cx="190" cy="190" r="26" fill="#07070a" stroke="#161622" strokeWidth="2" />
              <circle cx="190" cy="190" r="20" fill="#161622" stroke="#252538" strokeWidth="1.5" />
              <circle cx="190" cy="190" r="12" fill="#07070a" />
              <text x="190" y="194" fill="#555" fontSize="11" fontWeight="800" textAnchor="middle">L</text>

              <circle cx="290" cy="190" r="26" fill="#07070a" stroke="#161622" strokeWidth="2" />
              <circle cx="290" cy="190" r="20" fill="#161622" stroke="#252538" strokeWidth="1.5" />
              <circle cx="290" cy="190" r="12" fill="#07070a" />
              <text x="290" y="194" fill="#555" fontSize="11" fontWeight="800" textAnchor="middle">R</text>
            </svg>
          </div>

          {/* Card Direita - R1, R2, R3, Options, Ações Triângulo/Círculo/X/Quadrado, Analógico R */}
          <div style={{ position: 'absolute', right: 0, width: '250px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 10 }}>

            {/* R2 e R1 */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{
                flex: 1, background: bindingField === 'buttonR2' ? 'rgba(124, 58, 237, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                border: bindingField === 'buttonR2' ? '1px solid #7c3aed' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px', padding: '10px', transition: 'all 0.2s'
              }}>
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.5px' }}>GATILHO R2</div>
                <button onClick={() => setBindingField('buttonR2')} style={{ width: '100%', marginTop: '6px', padding: '6px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'buttonR2' ? '#7c3aed' : 'rgba(255, 255, 255, 0.06)', color: bindingField === 'buttonR2' ? '#fff' : 'rgba(255,255,255,0.8)', cursor: 'pointer', transition: 'all 0.2s' }}>
                  {bindingField === 'buttonR2' ? '...' : `Botão ${config.buttonR2}`}
                </button>
              </div>
              <div style={{
                flex: 1, background: bindingField === 'buttonR1' ? 'rgba(124, 58, 237, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                border: bindingField === 'buttonR1' ? '1px solid #7c3aed' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px', padding: '10px', transition: 'all 0.2s'
              }}>
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.5px' }}>BOTÃO R1</div>
                <button onClick={() => setBindingField('buttonR1')} style={{ width: '100%', marginTop: '6px', padding: '6px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'buttonR1' ? '#7c3aed' : 'rgba(255, 255, 255, 0.06)', color: bindingField === 'buttonR1' ? '#fff' : 'rgba(255,255,255,0.8)', cursor: 'pointer', transition: 'all 0.2s' }}>
                  {bindingField === 'buttonR1' ? '...' : `Botão ${config.buttonR1}`}
                </button>
              </div>
            </div>

            {/* Options */}
            <div style={{
              background: bindingField === 'buttonOptions' ? 'rgba(124, 58, 237, 0.1)' : 'rgba(255, 255, 255, 0.02)',
              border: bindingField === 'buttonOptions' ? '1px solid #7c3aed' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.2s'
            }}>
              <div>
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.5px' }}>OPTIONS</div>
                <div style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 600 }}>Opções / Pausa</div>
              </div>
              <button onClick={() => setBindingField('buttonOptions')} style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'buttonOptions' ? '#7c3aed' : 'rgba(255, 255, 255, 0.06)', color: bindingField === 'buttonOptions' ? '#fff' : 'rgba(255,255,255,0.8)', cursor: 'pointer', transition: 'all 0.2s' }}>
                {bindingField === 'buttonOptions' ? '...' : `B${config.buttonOptions}`}
              </button>
            </div>

            {/* Ações Triângulo e Círculo */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{
                flex: 1, background: bindingField === 'buttonD' ? 'rgba(124, 58, 237, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                border: bindingField === 'buttonD' ? '1px solid #7c3aed' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px', padding: '10px', transition: 'all 0.2s'
              }}>
                <div style={{ fontSize: '9px', color: '#2dd4bf', fontWeight: 800, letterSpacing: '0.5px' }}>TRIÂNGULO (▲)</div>
                <button onClick={() => setBindingField('buttonD')} style={{ width: '100%', marginTop: '6px', padding: '6px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'buttonD' ? '#7c3aed' : 'rgba(255, 255, 255, 0.06)', color: bindingField === 'buttonD' ? '#fff' : 'rgba(255,255,255,0.8)', cursor: 'pointer', transition: 'all 0.2s' }}>
                  {bindingField === 'buttonD' ? '...' : `B${config.buttonD}`}
                </button>
              </div>
              <div style={{
                flex: 1, background: bindingField === 'buttonB' ? 'rgba(124, 58, 237, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                border: bindingField === 'buttonB' ? '1px solid #7c3aed' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px', padding: '10px', transition: 'all 0.2s'
              }}>
                <div style={{ fontSize: '9px', color: '#f87171', fontWeight: 800, letterSpacing: '0.5px' }}>CÍRCULO (●)</div>
                <button onClick={() => setBindingField('buttonB')} style={{ width: '100%', marginTop: '6px', padding: '6px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'buttonB' ? '#7c3aed' : 'rgba(255, 255, 255, 0.06)', color: bindingField === 'buttonB' ? '#fff' : 'rgba(255,255,255,0.8)', cursor: 'pointer', transition: 'all 0.2s' }}>
                  {bindingField === 'buttonB' ? '...' : `B${config.buttonB}`}
                </button>
              </div>
            </div>

            {/* Ações X e Quadrado */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{
                flex: 1, background: bindingField === 'buttonA' ? 'rgba(124, 58, 237, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                border: bindingField === 'buttonA' ? '1px solid #7c3aed' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px', padding: '10px', transition: 'all 0.2s'
              }}>
                <div style={{ fontSize: '9px', color: '#60a5fa', fontWeight: 800, letterSpacing: '0.5px' }}>CRUZ / X (✖)</div>
                <button onClick={() => setBindingField('buttonA')} style={{ width: '100%', marginTop: '6px', padding: '6px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'buttonA' ? '#7c3aed' : 'rgba(255, 255, 255, 0.06)', color: bindingField === 'buttonA' ? '#fff' : 'rgba(255,255,255,0.8)', cursor: 'pointer', transition: 'all 0.2s' }}>
                  {bindingField === 'buttonA' ? '...' : `B${config.buttonA}`}
                </button>
              </div>
              <div style={{
                flex: 1, background: bindingField === 'buttonC' ? 'rgba(124, 58, 237, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                border: bindingField === 'buttonC' ? '1px solid #7c3aed' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px', padding: '10px', transition: 'all 0.2s'
              }}>
                <div style={{ fontSize: '9px', color: '#f472b6', fontWeight: 800, letterSpacing: '0.5px' }}>QUADRADO (■)</div>
                <button onClick={() => setBindingField('buttonC')} style={{ width: '100%', marginTop: '6px', padding: '6px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'buttonC' ? '#7c3aed' : 'rgba(255, 255, 255, 0.06)', color: bindingField === 'buttonC' ? '#fff' : 'rgba(255,255,255,0.8)', cursor: 'pointer', transition: 'all 0.2s' }}>
                  {bindingField === 'buttonC' ? '...' : `B${config.buttonC}`}
                </button>
              </div>
            </div>

            {/* Analógico R (Olhar) */}
            <div style={{
              background: bindingField === 'lookAxisX' || bindingField === 'lookAxisY' ? 'rgba(124, 58, 237, 0.1)' : 'rgba(255, 255, 255, 0.02)',
              border: bindingField === 'lookAxisX' || bindingField === 'lookAxisY' ? '1px solid #7c3aed' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: '14px', padding: '12px', transition: 'all 0.2s'
            }}>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.5px' }}>ANALÓGICO DIREITO (R)</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>Olhar Câmera (Eixo X/Y)</div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button onClick={() => setBindingField('lookAxisX')} style={{ flex: 1, padding: '6px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'lookAxisX' ? '#7c3aed' : 'rgba(255, 255, 255, 0.06)', color: bindingField === 'lookAxisX' ? '#fff' : 'rgba(255,255,255,0.8)', cursor: 'pointer', transition: 'all 0.2s' }}>
                  {bindingField === 'lookAxisX' ? 'X...' : `X: ${config.lookAxisX}`}
                </button>
                <button onClick={() => setBindingField('lookAxisY')} style={{ flex: 1, padding: '6px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'lookAxisY' ? '#7c3aed' : 'rgba(255, 255, 255, 0.06)', color: bindingField === 'lookAxisY' ? '#fff' : 'rgba(255,255,255,0.8)', cursor: 'pointer', transition: 'all 0.2s' }}>
                  {bindingField === 'lookAxisY' ? 'Y...' : `Y: ${config.lookAxisY}`}
                </button>
              </div>
            </div>

            {/* R3 Clique */}
            <div style={{
              background: bindingField === 'buttonR3' ? 'rgba(124, 58, 237, 0.1)' : 'rgba(255, 255, 255, 0.02)',
              border: bindingField === 'buttonR3' ? '1px solid #7c3aed' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.2s'
            }}>
              <div>
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.5px' }}>CLIQUE R3</div>
                <div style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 600 }}>Reset Câmera / Mira</div>
              </div>
              <button onClick={() => setBindingField('buttonR3')} style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: bindingField === 'buttonR3' ? '#7c3aed' : 'rgba(255, 255, 255, 0.06)', color: bindingField === 'buttonR3' ? '#fff' : 'rgba(255,255,255,0.8)', cursor: 'pointer', transition: 'all 0.2s' }}>
                {bindingField === 'buttonR3' ? '...' : `B${config.buttonR3}`}
              </button>
            </div>

          </div>

        </div>

        {/* Rodapé - Ações Globais */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px', marginTop: '10px' }}>

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
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', color: '#fff',
              padding: '10px 25px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
              cursor: 'pointer', boxShadow: '0 4px 14px rgba(124, 58, 237, 0.3)', outline: 'none', transition: 'all 0.2s'
            }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 20px rgba(124, 58, 237, 0.45)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 14px rgba(124, 58, 237, 0.3)'}
            >
              Salvar e Fechar
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
