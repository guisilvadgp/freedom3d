import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { SceneView, xrStore } from '../editor/panels/SceneView';
import { useEditorStore } from '../editor/store/editorStore';

// ── Debug UI ─────────────────────────────────────────────────
function DebugUI({ onClose }: { onClose: () => void }) {
  const consoleLogs = useEditorStore(state => state.consoleLogs);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para o último log
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [consoleLogs]);

  const handleCopy = () => {
    const text = consoleLogs.map(l => `[${l.type.toUpperCase()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
    alert('Logs copiados!');
  };

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(0,0,0,0.92)',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'monospace',
      fontSize: '12px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(99,102,241,0.15)',
        flexShrink: 0,
      }}>
        <span style={{ color: '#818cf8', fontWeight: 700, fontSize: '13px' }}>
          🛠 Console de Diagnóstico — {consoleLogs.length} entradas
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleCopy}
            style={{ background: '#334155', color: '#94a3b8', border: 'none', padding: '4px 10px', cursor: 'pointer', borderRadius: '4px', fontSize: '11px' }}
          >
            Copiar
          </button>
          <button
            onClick={onClose}
            style={{ background: '#7f1d1d', color: '#fca5a5', border: 'none', padding: '4px 10px', cursor: 'pointer', borderRadius: '4px', fontSize: '11px' }}
          >
            Fechar ✕
          </button>
        </div>
      </div>

      {/* Log list */}
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {consoleLogs.length === 0 && (
          <div style={{ color: '#64748b', marginTop: '20px', textAlign: 'center' }}>Nenhum log ainda...</div>
        )}
        {consoleLogs.map(log => (
          <div
            key={log.id}
            style={{
              color: log.type === 'error' ? '#f87171' : log.type === 'warn' ? '#fbbf24' : '#4ade80',
              borderLeft: `2px solid ${log.type === 'error' ? '#f87171' : log.type === 'warn' ? '#fbbf24' : '#4ade80'}`,
              paddingLeft: '8px',
              lineHeight: 1.5,
              wordBreak: 'break-all',
            }}
          >
            {log.message}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Botão WebXR Flutuante ─────────────────────────────────────
function XRFloatingButton() {
  const [vrSupported, setVrSupported] = useState(false);
  const [arSupported, setArSupported] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!navigator.xr) return;
    navigator.xr.isSessionSupported('immersive-vr').then(ok => setVrSupported(ok)).catch(() => {});
    navigator.xr.isSessionSupported('immersive-ar').then(ok => setArSupported(ok)).catch(() => {});
  }, []);

  if (!vrSupported && !arSupported) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '24px',
        right: '20px',
        zIndex: 9998,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '10px',
      }}
    >
      {/* Sub-botões expandidos */}
      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
          {vrSupported && (
            <button
              onClick={() => { xrStore.enterVR().catch(() => {}); setExpanded(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: '#fff',
                border: 'none',
                borderRadius: '24px',
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(99,102,241,0.5)',
                backdropFilter: 'blur(8px)',
                whiteSpace: 'nowrap',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8zm5 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
              </svg>
              Entrar no VR
            </button>
          )}
          {arSupported && (
            <button
              onClick={() => { xrStore.enterAR().catch(() => {}); setExpanded(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                border: 'none',
                borderRadius: '24px',
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(16,185,129,0.5)',
                backdropFilter: 'blur(8px)',
                whiteSpace: 'nowrap',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
                <rect x="7" y="7" width="10" height="10" rx="1"/>
              </svg>
              Entrar no AR
            </button>
          )}
        </div>
      )}

      {/* Botão principal XR */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        title="WebXR"
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: expanded
            ? 'rgba(99,102,241,0.9)'
            : 'rgba(10,10,20,0.7)',
          color: '#fff',
          border: '1.5px solid rgba(99,102,241,0.6)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(10px)',
          boxShadow: expanded
            ? '0 0 0 3px rgba(99,102,241,0.3), 0 8px 24px rgba(0,0,0,0.4)'
            : '0 4px 16px rgba(0,0,0,0.4)',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Ícone de óculos VR */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2 8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8zm5 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
        </svg>
      </button>
    </div>
  );
}

// ── StandalonePlayer ──────────────────────────────────────────
export function StandalonePlayer() {
  const setActiveViewport = useEditorStore(state => state.setActiveViewport);
  const togglePlay = useEditorStore(state => state.togglePlay);
  const addLog = useEditorStore(state => state.addLog);

  const [showDebug, setShowDebug] = useState(false);
  const [loading, setLoading] = useState(true);
  const [progressVal, setProgressVal] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [sceneLoaded, setSceneLoaded] = useState(false);

  // Toque triplo no canto superior esquerdo abre o debug (mobile-friendly)
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleCornerTap = () => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 700);
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      setShowDebug(prev => !prev);
    }
  };

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    setGameStarted(true);
    if (!useEditorStore.getState().isPlaying) {
      togglePlay();
    }

    // Auto-entrar VR se suportado
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr').then(supported => {
        if (supported) {
          xrStore.enterVR().catch(() => {});
        } else {
          addLog('info', 'ℹ️ WebXR imersivo não suportado. Rodando em tela cheia.');
        }
      });
    }

    setTimeout(() => setShowOverlay(false), 650);
  };

  useEffect(() => {
    setActiveViewport('game');

    const isFirstLoad = !window.sessionStorage.getItem('firstLoadDone');
    if (isFirstLoad) {
      window.sessionStorage.setItem('firstLoadDone', 'true');
      if (useEditorStore.getState().isPlaying) togglePlay();
    }

    // ── Captura erros globais ─────────────────────────────────
    const handleError = (e: ErrorEvent) => {
      addLog('error', `[Global] ${e.message} @ ${e.filename}:${e.lineno}`);
    };
    const handleUnhandledRejection = (e: PromiseRejectionEvent) => {
      addLog('error', `[Promise] ${String(e.reason)}`);
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    const origError = console.error;
    const origWarn = console.warn;
    const loggedMessages = new Map<string, number>();

    const throttledLog = (type: 'error' | 'warn', msg: string) => {
      const now = Date.now();
      const last = loggedMessages.get(msg) || 0;
      if (now - last > 2000) {
        loggedMessages.set(msg, now);
        addLog(type, msg);
      }
    };

    console.error = (...args) => {
      throttledLog('error', args.join(' '));
      origError.apply(console, args);
    };
    console.warn = (...args) => {
      throttledLog('warn', args.join(' '));
      origWarn.apply(console, args);
    };

    // ── Monitorar THREE.DefaultLoadingManager ─────────────────
    const manager = THREE.DefaultLoadingManager;
    const origStart = manager.onStart;
    const origProgress = manager.onProgress;
    const origLoad = manager.onLoad;
    const origManagerError = manager.onError;

    manager.onStart = (url, loaded, total) => {
      addLog('info', `⬇️ Iniciando download: ${url.split('/').pop()} (${loaded}/${total})`);
      if (origStart) origStart(url, loaded, total);
    };
    manager.onProgress = (url, loaded, total) => {
      // Só loga a cada arquivo completo para não poluir
      addLog('info', `📦 Carregado: ${url.split('/').pop()} (${loaded}/${total})`);
      if (origProgress) origProgress(url, loaded, total);
    };
    manager.onLoad = () => {
      addLog('info', '✅ Todos os assets foram carregados pelo THREE.DefaultLoadingManager');
      if (origLoad) origLoad();
    };
    manager.onError = (url) => {
      addLog('error', `❌ FALHA ao carregar asset: ${url}`);
      if (origManagerError) origManagerError(url);
    };

    // ── Carregar cena inicial ─────────────────────────────────
    addLog('info', '🌐 Buscando cena em /api/sync...');
    fetch('/api/sync')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(scene => {
        if (!scene || !scene.id) {
          addLog('warn', '⚠️ /api/sync retornou cena vazia ou inválida');
          setSceneLoaded(true);
          return;
        }

        // Reescreve URLs de blob para URLs de rede
        const entities = Object.values(scene.entities || {}) as any[];
        const gltfEntities = entities.filter(e => e.components?.GLTFModel?.fileName);

        addLog('info', `🎬 Cena carregada: ${scene.id} — ${entities.length} entidades, ${gltfEntities.length} modelos GLTF`);

        gltfEntities.forEach((e: any) => {
          const fileName = e.components.GLTFModel.fileName;
          const url = '/api/asset/' + encodeURIComponent(fileName);
          e.components.GLTFModel.src = url;
          addLog('info', `🔗 Modelo mapeado: "${e.name || e.id}" → ${url}`);
        });

        useEditorStore.setState(state => ({
          scenes: { ...state.scenes, [scene.id]: scene },
          activeSceneId: scene.id
        }));
        setSceneLoaded(true);

        if (scene.publishedAt) {
          window.sessionStorage.setItem('lastPublishedAt', scene.publishedAt.toString());
        }

        // ── Preload silencioso dos assets GLTF ─────────────────
        if (gltfEntities.length > 0) {
          addLog('info', `🔄 Iniciando preload de ${gltfEntities.length} modelo(s)...`);
          gltfEntities.forEach((e: any) => {
            const url = e.components.GLTFModel.src;
            if (THREE.Cache.get(url)) {
              addLog('info', `✅ Cache HIT: ${url.split('/').pop()}`);
              return;
            }
            fetch(url, { priority: 'low' } as any)
              .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                addLog('info', `📥 Preload OK: ${url.split('/').pop()} (${Math.round((r.headers.get('content-length') ? parseInt(r.headers.get('content-length')!) : 0) / 1024)} KB)`);
                return r.arrayBuffer();
              })
              .then(buf => {
                THREE.Cache.add(url, buf);
                addLog('info', `💾 Cache salvo: ${url.split('/').pop()} (${Math.round(buf.byteLength / 1024)} KB)`);
              })
              .catch(err => {
                addLog('error', `❌ Falha no preload de "${url.split('/').pop()}": ${err.message}`);
              });
          });
        }
      })
      .catch(err => {
        addLog('error', `❌ Falha ao buscar /api/sync: ${err.message}`);
        setSceneLoaded(true);
      });

    // ── Polling só no modo editor ─────────────────────────────
    const isEditorMode = window.location.search.includes('editor') || document.referrer.includes('editor');
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    if (isEditorMode) {
      addLog('info', '🔁 Modo editor detectado — polling ativo (3s)');
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch('/api/sync', { cache: 'no-store' });
          const scene = await res.json();
          if (scene?.publishedAt) {
            const last = window.sessionStorage.getItem('lastPublishedAt');
            if (last && last !== scene.publishedAt.toString()) {
              addLog('info', '🔄 Nova versão detectada! Atualizando cena...');
              window.sessionStorage.setItem('lastPublishedAt', scene.publishedAt.toString());
              const entities = Object.values(scene.entities || {}) as any[];
              entities.forEach((e: any) => {
                if (e.components?.GLTFModel?.fileName) {
                  e.components.GLTFModel.src = '/api/asset/' + encodeURIComponent(e.components.GLTFModel.fileName);
                }
              });
              useEditorStore.setState(s => ({
                scenes: { ...s.scenes, [scene.id]: scene },
                activeSceneId: scene.id
              }));
            }
          }
        } catch {}
      }, 3000);
    }

    // ── Teclado ───────────────────────────────────────────────
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' || (e.ctrlKey && e.shiftKey && e.key === 'D')) {
        setShowDebug(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('keydown', handleKeyDown);
      console.error = origError;
      console.warn = origWarn;
      manager.onStart = origStart;
      manager.onProgress = origProgress;
      manager.onLoad = origLoad;
      manager.onError = origManagerError;
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

      {/* Debug Panel — sobrepõe tudo */}
      {showDebug && <DebugUI onClose={() => setShowDebug(false)} />}

      {/* Área invisível para toque triplo — canto superior esquerdo */}
      {!showDebug && (
        <div
          onClick={handleCornerTap}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '60px',
            height: '60px',
            zIndex: 9997,
            cursor: 'default',
          }}
        />
      )}

      {/* Botão Atualizar — canto superior direito */}
      {gameStarted && (
        <button
          onClick={() => window.location.reload()}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            zIndex: 9996,
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

      {/* Botão WebXR — canto inferior direito (visível após Play) */}
      {gameStarted && <XRFloatingButton />}

      {/* Overlay de carregamento + botão PLAY */}
      {showOverlay && (
        <div
          onClick={() => {
            if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
              document.documentElement.requestFullscreen().then(() => {
                const orientation = window.screen && (window.screen.orientation as any);
                if (orientation?.lock) {
                  orientation.lock('landscape').catch(() => {});
                }
              }).catch(() => {});
            }
          }}
          style={{
            position: 'absolute',
            top: 0, left: 0,
            width: '100vw', height: '100vh',
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
              {loading ? 'Carregando recursos...' : 'Pronto para iniciar'}
            </p>

            {loading ? (
              <div style={{ width: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 auto' }}>
                <div style={{
                  width: '100%', height: '6px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '3px', overflow: 'hidden',
                  marginBottom: '12px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  <div style={{
                    width: `${progressVal}%`, height: '100%',
                    background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                    borderRadius: '3px',
                    transition: 'width 0.3s ease',
                    boxShadow: '0 0 10px rgba(99,102,241,0.5)'
                  }} />
                </div>
                <span style={{ fontFamily: 'monospace', fontSize: '13px', color: '#818cf8', fontWeight: 600 }}>
                  {progressVal}%
                </span>
              </div>
            ) : (
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
                  boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  outline: 'none',
                  margin: '0 auto'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 6px 25px rgba(99,102,241,0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.4)';
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                PLAY GAME
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
