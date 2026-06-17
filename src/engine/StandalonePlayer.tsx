import { useEffect, useState } from 'react';
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
  const [showDebug, setShowDebug] = useState(false);

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

    // Entrar no modo VR diretamente ao iniciar
    xrStore.enterVR().catch(err => {
      console.warn('Não foi possível entrar no modo VR automaticamente:', err);
    });
    setTimeout(() => {
      setShowOverlay(false);
    }, 650);
  };

  useEffect(() => {
    // Forçar modo Jogo
    setActiveViewport('game');
    // Garante que inicia pausado enquanto carrega os recursos
    if (useEditorStore.getState().isPlaying) {
      togglePlay();
    }

    // Capture global errors
    const handleError = (e: ErrorEvent) => {
      addLog('error', 'Global: ' + e.message);
    };
    window.addEventListener('error', handleError);
    const origError = console.error;
    console.error = (...args) => {
      addLog('error', args.join(' '));
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
      })
      .catch(() => {
        setSceneLoaded(true);
      });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' || (e.ctrlKey && e.shiftKey && e.key === 'D')) {
        setShowDebug(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
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
          onClick={() => {
            if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
              document.documentElement.requestFullscreen().catch(() => {});
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
              {loading ? 'Carregando recursos...' : 'Pronto para iniciar'}
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
