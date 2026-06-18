import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { SceneView, xrStore } from '../editor/panels/SceneView';
import { useEditorStore } from '../editor/store/editorStore';

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

    const handleSceneUpdate = (scene: any) => {
      if (scene && scene.id) {
        // Rewrite blob URLs to network URLs for mobile preview
        Object.values(scene.entities).forEach((e: any) => {
          if (e.components?.GLTFModel?.fileName) {
            e.components.GLTFModel.src = '/api/asset/' + encodeURIComponent(e.components.GLTFModel.fileName);
          }
        });
        useEditorStore.setState(state => ({
          scenes: { ...state.scenes, [scene.id]: scene },
          activeSceneId: scene.id
        }));
      }
    };

    // Load initial scene state once
    fetch('/api/sync')
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
              const url = '/api/asset/' + encodeURIComponent(e.components.GLTFModel.fileName);
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

    // Polling para atualizações — apenas quando o editor está ativo
    // (detectado pelo parâmetro ?editor na URL ou pelo header Referer)
    const isEditorMode = window.location.search.includes('editor') || document.referrer.includes('editor');
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

  const getFieldLabel = (field: keyof GamepadConfig) => {
    switch (field) {
      case 'triggerButton': return 'Gatilho / Clique (Teleporte)';
      case 'moveAxisX': return 'Analógico X (Esquerda/Direita)';
      case 'moveAxisY': return 'Analógico Y (Frente/Trás)';
      case 'buttonA': return 'Botão A';
      case 'buttonB': return 'Botão B';
      case 'buttonC': return 'Botão C';
      case 'buttonD': return 'Botão D';
    }
  };

  const isAxis = (field: keyof GamepadConfig) => {
    return field === 'moveAxisX' || field === 'moveAxisY';
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
      fontFamily: 'sans-serif', padding: '20px'
    }} onClick={onClose}>
      <div style={{
        background: 'rgba(30, 41, 59, 0.95)', border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '20px', width: '100%', maxWidth: '500px', padding: '30px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)', color: '#fff',
        display: 'flex', flexDirection: 'column', gap: '20px'
      }} onClick={e => e.stopPropagation()}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>
            Configurar Controles Bluetooth
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#94a3b8', fontSize: '24px', cursor: 'pointer', outline: 'none'
          }}>&times;</button>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '15px',
          border: '1px solid rgba(255,255,255,0.05)', fontSize: '13px', color: '#94a3b8'
        }}>
          <strong>Controle Ativo:</strong>
          <div style={{ color: '#818cf8', marginTop: '4px', fontWeight: 600 }}>{activeGamepadName}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto', paddingRight: '5px' }}>
          {(Object.keys(config) as Array<keyof GamepadConfig>)
            .filter(field => field !== 'invertX' && field !== 'invertY')
            .map((field) => (
              <div key={field} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', background: 'rgba(255,255,255,0.02)',
                borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)'
              }}>
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#cbd5e1' }}>
                  {getFieldLabel(field)}
                </span>
                <button
                  onClick={() => setBindingField(field)}
                  style={{
                    background: bindingField === field ? '#f59e0b' : 'rgba(99, 102, 241, 0.15)',
                    color: bindingField === field ? '#000' : '#818cf8',
                    border: bindingField === field ? 'none' : '1px solid rgba(99, 102, 241, 0.3)',
                    padding: '6px 16px', fontSize: '13px', fontWeight: 600,
                    borderRadius: '6px', cursor: 'pointer', minWidth: '120px', textAlign: 'center',
                    transition: 'all 0.2s ease', outline: 'none'
                  }}
                >
                  {bindingField === field 
                    ? (isAxis(field) ? 'Mova analógico...' : 'Pressione botão...') 
                    : (isAxis(field) ? `Eixo ${config[field]}` : `Botão ${config[field]}`)}
                </button>
              </div>
            ))}

          {/* Inversão de Eixos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)', marginTop: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '14px', cursor: 'pointer', color: '#cbd5e1' }}>
              <span>Inverter Horizontal (Eixo X)</span>
              <input 
                type="checkbox" 
                checked={config.invertX || false} 
                onChange={e => {
                  const next = { ...config, invertX: e.target.checked };
                  setConfig(next);
                  localStorage.setItem('freedom3d_gamepad_config', JSON.stringify(next));
                }}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#818cf8' }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '14px', cursor: 'pointer', color: '#cbd5e1', marginTop: '4px' }}>
              <span>Inverter Vertical (Eixo Y)</span>
              <input 
                type="checkbox" 
                checked={config.invertY || false} 
                onChange={e => {
                  const next = { ...config, invertY: e.target.checked };
                  setConfig(next);
                  localStorage.setItem('freedom3d_gamepad_config', JSON.stringify(next));
                }}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#818cf8' }}
              />
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '10px' }}>
          <button onClick={handleReset} style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8',
            padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
            cursor: 'pointer', transition: 'background 0.2s ease', outline: 'none'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            Resetar Padrão
          </button>
          <button onClick={onClose} style={{
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none', color: '#fff',
            padding: '10px 25px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)', outline: 'none'
          }}>
            Salvar e Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
