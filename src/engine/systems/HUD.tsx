import { useEffect, useState, useRef, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Input } from './InputManager';
import { useEngineStore, getEngineStore } from '../runtime/runtimeStore';
import { Network } from './NetworkManager';

// ── Interface de Estado do HUD ───────────────────────────────
export interface HUDState {
  score: { home: number; away: number } | null;
  timer: string;
  phase: string; // 'waiting' | 'countdown' | 'match' | 'goal' | 'endgame'
  winner?: string; // 'home' | 'away' | 'draw'
  notification?: string | null;
}

// Helpers para resolver HUD
export const getSceneHUDEnabled = (scene: any) => {
  if (!scene) return false;
  if (scene.hudEnabled !== undefined) return scene.hudEnabled;
  return false;
};

export const getSceneHUDConfig = (scene: any) => {
  const baseConfig = scene?.hudConfig || {};
  return {
    showLobby: baseConfig.showLobby ?? false,
    showScoreboard: baseConfig.showScoreboard ?? false,
    showTimer: baseConfig.showTimer ?? false,
    showMatchOverlay: baseConfig.showMatchOverlay ?? false,
    labelHome: baseConfig.labelHome || "P1",
    labelAway: baseConfig.labelAway || "P2",
    themeColor: baseConfig.themeColor || "#00f3ff"
  };
};

// Helper para escutar e inicializar o estado comum do HUD
function useHUDState() {
  const activeSceneId = useEngineStore(s => s.activeSceneId);
  const activeScene = useEngineStore(s => s.scenes[activeSceneId]);
  const hudConfig = useMemo(() => getSceneHUDConfig(activeScene), [activeScene]);

  const [score, setScore] = useState<{ home: number; away: number; labelHome?: string; labelAway?: string }>({
    home: 0,
    away: 0,
    labelHome: "P1",
    labelAway: "P2"
  });
  const [timer, setTimer] = useState<string>("00:00");
  const [phaseInfo, setPhaseInfo] = useState<{ phase: string; winner?: string }>({ phase: "waiting" });
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    const handleScoreUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setScore({
          home: customEvent.detail.home ?? 0,
          away: customEvent.detail.away ?? 0,
          labelHome: customEvent.detail.labelHome || hudConfig.labelHome,
          labelAway: customEvent.detail.labelAway || hudConfig.labelAway
        });
      }
    };

    const handleTimerUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.formattedTime) {
        setTimer(customEvent.detail.formattedTime);
      }
    };

    const handlePhaseUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setPhaseInfo({
          phase: customEvent.detail.phase,
          winner: customEvent.detail.winner
        });
      }
    };

    const handleNotification = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.text) {
        setNotification(customEvent.detail.text);
        // Auto-limpa notificação após 5 segundos
        const timerId = setTimeout(() => setNotification(null), 5000);
        return () => clearTimeout(timerId);
      }
    };

    // Inicialização com valores globais de fallback (caso já existam na window)
    if (typeof window !== 'undefined') {
      if (window.gameScore) {
        setScore({
          home: window.gameScore.home ?? 0,
          away: window.gameScore.away ?? 0,
          labelHome: window.gameScore.labelHome || hudConfig.labelHome,
          labelAway: window.gameScore.labelAway || hudConfig.labelAway
        });
      } else if (hudConfig) {
        setScore({
          home: 0,
          away: 0,
          labelHome: hudConfig.labelHome || "P1",
          labelAway: hudConfig.labelAway || "P2"
        });
      }
    }

    window.addEventListener('game-score-updated', handleScoreUpdate);
    window.addEventListener('game-timer-updated', handleTimerUpdate);
    window.addEventListener('game-phase-changed', handlePhaseUpdate);
    window.addEventListener('hud-notification', handleNotification);

    return () => {
      window.removeEventListener('game-score-updated', handleScoreUpdate);
      window.removeEventListener('game-timer-updated', handleTimerUpdate);
      window.removeEventListener('game-phase-changed', handlePhaseUpdate);
      window.removeEventListener('hud-notification', handleNotification);
    };
  }, [hudConfig.labelHome, hudConfig.labelAway]);

  return { score, timer, phaseInfo, notification, setNotification };
}

export function HUD2D({ isGameView, isStandalone }: { isGameView: boolean; isStandalone?: boolean }) {
  const activeSceneId = useEngineStore(s => s.activeSceneId);
  const activeScene = useEngineStore(s => s.scenes[activeSceneId]);
  const hudEnabled = getSceneHUDEnabled(activeScene);
  const hudConfig = useMemo(() => getSceneHUDConfig(activeScene), [activeScene]);

  const { score, timer, phaseInfo, notification } = useHUDState();
  const [isVR, setIsVR] = useState(false);

  // Estados de rede
  const [roomName, setRoomName] = useState<string>("default-room");
  const [connected, setConnected] = useState<boolean>(false);
  const [players, setPlayers] = useState<Array<{ id: string; name: string; role: string; isLocal: boolean; ready: boolean }>>([]);
  const [localRole, setLocalRole] = useState<string>("red");
  const [localReady, setLocalReady] = useState<boolean>(false);

  const hasScoreboard = !!hudConfig.showScoreboard;

  const updateNetStates = () => {
    if (typeof window === 'undefined') return;
    const isConn = Network.isConnected();
    setConnected(isConn);
    
    const r = window.playerRole || (hasScoreboard ? 'red' : 'player');
    const adjustedRole = !hasScoreboard && (r === 'red' || r === 'blue') ? 'player' : (hasScoreboard && r === 'player' ? 'red' : r);
    if (adjustedRole !== r) {
      window.playerRole = adjustedRole;
    }
    setLocalRole(adjustedRole);
    setLocalReady(!!window.localReady);

    const list = [];
    const myId = Network.getPlayerId() || 'local-player';
    
    // Jogador local
    list.push({
      id: myId,
      name: `Você (${myId.substring(0, 6)})`,
      role: adjustedRole,
      isLocal: true,
      ready: !!window.localReady
    });

    // Fantasmas remotos
    const state = getEngineStore().getState();
    const scene = state.activeScene();
    if (scene) {
      Object.values(scene.entities).forEach((entity) => {
        if (entity && entity.tags && entity.tags.includes('multiplayer-ghost')) {
          const remoteId = entity.id.replace('ghost-', '');
          const ghostRole = entity.components.Network?.role || (hasScoreboard ? 'red' : 'player');
          const ghostReady = !!entity.components.Network?.ready;
          list.push({
            id: remoteId,
            name: `Player_${remoteId.substring(0, 6)}`,
            role: ghostRole,
            isLocal: false,
            ready: ghostReady
          });
        }
      });
    }
    setPlayers(list);
  };

  useEffect(() => {
    const checkVR = () => {
      if (typeof window !== 'undefined') {
        setIsVR(!!window.isVRActive);
      }
    };
    checkVR();
    const interval = setInterval(checkVR, 200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    updateNetStates();
    window.addEventListener('multiplayer-players-update', updateNetStates);
    const interval = setInterval(updateNetStates, 1000);
    return () => {
      window.removeEventListener('multiplayer-players-update', updateNetStates);
      clearInterval(interval);
    };
  }, [hasScoreboard]);

  const handleConnect = () => {
    if (connected) {
      Network.disconnect();
    } else {
      Network.connect({ roomName });
    }
    setTimeout(updateNetStates, 300);
  };

  const handleChangeRole = (role: string) => {
    window.playerRole = role;
    setLocalRole(role);
    
    if (role === 'spectator') {
      window.localReady = false;
      setLocalReady(false);
      if (Network.isConnected()) {
        Network.send({ type: 'player-ready', ready: false });
      }
    }

    window.dispatchEvent(new CustomEvent('game-role-changed', { detail: role }));
    if (Network.isConnected()) {
      Network.send({
        type: 'role-update',
        role: role
      });
    }
    updateNetStates();
  };

  // Se o HUD estiver desabilitado para esta cena, não renderiza nada!
  if (!hudEnabled) return null;

  // Se o jogo não estiver rodando, ou estiver em modo VR ativo, não exibe
  if (!isGameView || isVR) return null;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 90 }}>
      
      {/* Painel de Multiplayer e Seleção de Time (Canto Superior Esquerdo) */}
      {hudConfig.showLobby && (
        <div 
          style={{
            position: 'absolute',
            top: isStandalone ? '20px' : '48px',
            left: '20px',
            width: '280px',
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(12px)',
            border: `1px solid ${hudConfig.themeColor || 'rgba(0, 243, 255, 0.25)'}`,
            borderRadius: '16px',
            padding: '16px',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4), 0 0 15px rgba(0, 243, 255, 0.05)',
            fontFamily: 'Inter, sans-serif',
            color: '#ffffff',
            pointerEvents: 'auto',
            zIndex: 99
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: hudConfig.themeColor || '#00f3ff', letterSpacing: '0.05em' }}>LOBBY MULTIPLAYER</span>
            <span style={{ 
              fontSize: '9px', 
              fontWeight: 900, 
              padding: '2px 6px', 
              borderRadius: '4px',
              background: connected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: connected ? '#10b981' : '#ef4444',
              border: `1px solid ${connected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
            }}>
              {connected ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <input 
              type="text" 
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              disabled={connected}
              placeholder="Nome da sala..."
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '6px 12px',
                color: '#ffffff',
                fontSize: '13px',
                outline: 'none'
              }}
            />
            <button 
              onClick={handleConnect}
              style={{
                background: connected ? 'rgba(239, 68, 68, 0.2)' : `linear-gradient(135deg, ${hudConfig.themeColor || '#00f3ff'}, #00adff)`,
                border: connected ? '1px solid rgba(239, 68, 68, 0.4)' : 'none',
                color: connected ? '#ef4444' : '#06080d',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {connected ? 'Sair' : 'Entrar'}
            </button>
          </div>

          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', marginBottom: '6px', letterSpacing: '0.05em' }}>
            {hasScoreboard ? 'Escolha seu Time' : 'Selecione seu Papel'}
          </div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
            {hasScoreboard ? (
              <>
                <button
                  onClick={() => handleChangeRole('red')}
                  style={{
                    flex: 1,
                    background: localRole === 'red' ? '#ff4b4b' : 'rgba(255,75,75,0.1)',
                    border: localRole === 'red' ? '1px solid #ff4b4b' : '1px solid rgba(255,75,75,0.3)',
                    color: localRole === 'red' ? '#06080d' : '#ff4b4b',
                    borderRadius: '8px',
                    padding: '6px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Vermelho
                </button>
                <button
                  onClick={() => handleChangeRole('blue')}
                  style={{
                    flex: 1,
                    background: localRole === 'blue' ? '#00adff' : 'rgba(0,173,255,0.1)',
                    border: localRole === 'blue' ? '1px solid #00adff' : '1px solid rgba(0,173,255,0.3)',
                    color: localRole === 'blue' ? '#06080d' : '#00adff',
                    borderRadius: '8px',
                    padding: '6px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Azul
                </button>
              </>
            ) : (
              <button
                onClick={() => handleChangeRole('player')}
                style={{
                  flex: 1,
                  background: localRole === 'player' ? '#10b981' : 'rgba(16,185,129,0.1)',
                  border: localRole === 'player' ? '1px solid #10b981' : '1px solid rgba(16,185,129,0.3)',
                  color: localRole === 'player' ? '#06080d' : '#10b981',
                  borderRadius: '8px',
                  padding: '6px',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Jogador
              </button>
            )}
            <button
              onClick={() => handleChangeRole('spectator')}
              style={{
                flex: 1,
                background: localRole === 'spectator' ? '#94a3b8' : 'rgba(148,163,184,0.1)',
                border: localRole === 'spectator' ? '1px solid #94a3b8' : '1px solid rgba(148,163,184,0.3)',
                color: localRole === 'spectator' ? '#06080d' : '#94a3b8',
                borderRadius: '8px',
                padding: '6px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Espectador
            </button>
          </div>

          {/* Botão de Pronto (exibido apenas se for jogador ativo) */}
          {localRole !== 'spectator' && (
            <button
              onClick={() => {
                const nextReady = !localReady;
                window.localReady = nextReady;
                setLocalReady(nextReady);
                if (Network.isConnected()) {
                  Network.send({ type: 'player-ready', ready: nextReady });
                }
                updateNetStates();
              }}
              style={{
                width: '100%',
                marginBottom: '16px',
                background: localReady ? 'rgba(16, 185, 129, 0.25)' : `linear-gradient(135deg, ${hudConfig.themeColor || '#00f3ff'}, #00adff)`,
                border: localReady ? '1px solid #10b981' : 'none',
                color: localReady ? '#10b981' : '#06080d',
                borderRadius: '8px',
                padding: '8px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {localReady ? '✓ PRONTO' : 'MARCAR COMO PRONTO'}
            </button>
          )}

          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', marginBottom: '6px', letterSpacing: '0.05em' }}>
            Jogadores na Sala ({players.length})
          </div>
          <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {players.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '6px', fontSize: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontWeight: p.isLocal ? 'bold' : 'normal', color: p.isLocal ? '#00f3ff' : '#ffffff' }}>
                    {p.name}
                  </span>
                  {p.role !== 'spectator' && (
                    <span style={{
                      fontSize: '9px',
                      fontWeight: 'bold',
                      color: p.ready ? '#10b981' : '#ef4444',
                      marginLeft: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px'
                    }}>
                      <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: p.ready ? '#10b981' : '#ef4444' }} />
                    </span>
                  )}
                </div>
                <span style={{
                  fontSize: '9px',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: p.role === 'red' ? 'rgba(255,75,75,0.15)' : p.role === 'blue' ? 'rgba(0,173,255,0.15)' : p.role === 'player' ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.15)',
                  color: p.role === 'red' ? '#ff4b4b' : p.role === 'blue' ? '#00adff' : p.role === 'player' ? '#10b981' : '#94a3b8',
                  border: `1px solid ${p.role === 'red' ? 'rgba(255,75,75,0.3)' : p.role === 'blue' ? 'rgba(0,173,255,0.3)' : p.role === 'player' ? 'rgba(16,185,129,0.3)' : 'rgba(148,163,184,0.3)'}`
                }}>
                  {p.role === 'red' ? 'VER' : p.role === 'blue' ? 'AZL' : p.role === 'player' ? 'JOG' : 'ESP'}
                </span>
              </div>
            ))}
          </div>

          {hasScoreboard && (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('game-restart-requested'))}
              style={{
                width: '100%',
                marginTop: '12px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '6px',
                color: 'rgba(255,255,255,0.7)',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            >
              Reiniciar Partida 🔄
            </button>
          )}
        </div>
      )}

      {/* Placar Premium de Topo */}
      {hudConfig.showScoreboard && (
        <div
          style={{
            position: 'absolute',
            top: isStandalone ? '20px' : '48px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(12px)',
            border: `1px solid ${hudConfig.themeColor || 'rgba(0, 243, 255, 0.25)'}`,
            borderRadius: '16px',
            padding: '10px 24px',
            boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.4), 0 0 15px ${hudConfig.themeColor ? `${hudConfig.themeColor}1a` : 'rgba(0, 243, 255, 0.1)'}`,
            fontFamily: 'Inter, sans-serif',
            transition: 'all 0.3s ease-in-out',
          }}
        >
          {/* Time Vermelho (Home) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: '#ff4b4b', fontWeight: 900, fontSize: '20px', letterSpacing: '0.05em', textShadow: '0 0 8px rgba(255, 75, 75, 0.4)' }}>
              {score?.labelHome || "VER"}
            </span>
            <span style={{ background: 'rgba(255, 75, 75, 0.15)', padding: '4px 14px', borderRadius: '8px', fontSize: '24px', fontWeight: 900, color: '#ffffff', border: '1px solid rgba(255, 75, 75, 0.3)', minWidth: '40px', textAlign: 'center' }}>
              {score?.home ?? 0}
            </span>
          </div>

          {/* Temporizador Central */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 20px', minWidth: '90px' }}>
            {hudConfig.showTimer !== false && (
              <span style={{ color: hudConfig.themeColor || '#00f3ff', fontWeight: 900, fontSize: '22px', letterSpacing: '0.05em', textShadow: `0 0 8px ${hudConfig.themeColor || 'rgba(0, 243, 255, 0.5)'}` }}>
                {timer}
              </span>
            )}
            <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 'bold', fontSize: '9px', textTransform: 'uppercase', marginTop: '1px', letterSpacing: '0.1em' }}>
              {phaseInfo.phase === 'countdown' ? 'Esquenta' : phaseInfo.phase === 'goal' ? 'GOL!' : phaseInfo.phase === 'endgame' ? 'Fim' : 'Partida'}
            </span>
          </div>

          {/* Time Azul (Away) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ background: 'rgba(0, 173, 255, 0.15)', padding: '4px 14px', borderRadius: '8px', fontSize: '24px', fontWeight: 900, color: '#ffffff', border: '1px solid rgba(0, 173, 255, 0.3)', minWidth: '40px', textAlign: 'center' }}>
              {score?.away ?? 0}
            </span>
            <span style={{ color: '#00adff', fontWeight: 900, fontSize: '20px', letterSpacing: '0.05em', textShadow: '0 0 8px rgba(0, 173, 255, 0.4)' }}>
              {score?.labelAway || "AZL"}
            </span>
          </div>
        </div>
      )}

      {/* Mira (Crosshair) 2D central para Desktop */}
      {Input.mouse.isLocked && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 95
          }}
        >
          {/* Círculo central minimalista */}
          <div
            style={{
              width: '6px',
              height: '6px',
              backgroundColor: hudConfig.themeColor || '#00f3ff',
              borderRadius: '50%',
              boxShadow: `0 0 8px ${hudConfig.themeColor || '#00f3ff'}`
            }}
          />
          {/* Linhas cruzadas */}
          <div style={{ position: 'absolute', width: '2px', height: '8px', backgroundColor: hudConfig.themeColor || '#00f3ff', top: '-10px', boxShadow: `0 0 5px ${hudConfig.themeColor || '#00f3ff'}` }} />
          <div style={{ position: 'absolute', width: '2px', height: '8px', backgroundColor: hudConfig.themeColor || '#00f3ff', bottom: '-10px', boxShadow: `0 0 5px ${hudConfig.themeColor || '#00f3ff'}` }} />
          <div style={{ position: 'absolute', width: '8px', height: '2px', backgroundColor: hudConfig.themeColor || '#00f3ff', left: '-10px', boxShadow: `0 0 5px ${hudConfig.themeColor || '#00f3ff'}` }} />
          <div style={{ position: 'absolute', width: '8px', height: '2px', backgroundColor: hudConfig.themeColor || '#00f3ff', right: '-10px', boxShadow: `0 0 5px ${hudConfig.themeColor || '#00f3ff'}` }} />
        </div>
      )}

      {/* Notificação Central Fluida */}
      {notification && (
        <div
          style={{
            position: 'absolute',
            bottom: '120px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(16, 185, 129, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            padding: '12px 24px',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '15px',
            fontFamily: 'Inter, sans-serif',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            animation: 'fadeInUp 0.3s ease-out',
            textAlign: 'center',
            zIndex: 100
          }}
        >
          {notification}
        </div>
      )}

      {/* Overlay Premium de Fim de Jogo */}
      {hudConfig.showMatchOverlay && phaseInfo.phase === 'endgame' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(9, 13, 24, 0.85)',
            backdropFilter: 'blur(20px)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Inter, sans-serif',
            color: '#ffffff',
            pointerEvents: 'auto'
          }}
        >
          <div
            style={{
              background: 'rgba(20, 28, 48, 0.75)',
              border: `1px solid ${hudConfig.themeColor || 'rgba(0, 243, 255, 0.3)'}`,
              borderRadius: '24px',
              padding: '40px 60px',
              textAlign: 'center',
              boxShadow: `0 20px 50px rgba(0, 0, 0, 0.6), inset 0 0 30px ${hudConfig.themeColor ? `${hudConfig.themeColor}1a` : 'rgba(0, 243, 255, 0.05)'}`,
              maxWidth: '480px',
              width: '90%',
            }}
          >
            <h2
              style={{
                fontSize: '32px',
                fontWeight: 900,
                letterSpacing: '1px',
                background: `linear-gradient(135deg, #ffffff, ${hudConfig.themeColor || '#00f3ff'})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: '10px',
              }}
            >
              FIM DE PARTIDA
            </h2>
            
            <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '30px' }}>
              Placar Final
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '30px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ color: '#ff4b4b', fontWeight: 900, fontSize: '18px', marginBottom: '4px' }}>{score?.labelHome || "VER"}</span>
                <span style={{ background: 'rgba(255, 75, 75, 0.15)', padding: '10px 24px', borderRadius: '12px', fontSize: '36px', fontWeight: 900, border: '1px solid rgba(255, 75, 75, 0.3)' }}>
                  {score?.home ?? 0}
                </span>
              </div>
              
              <span style={{ color: 'rgba(255, 255, 255, 0.3)', fontWeight: 900, fontSize: '24px', alignSelf: 'flex-end', marginBottom: '14px' }}>VS</span>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ color: '#00adff', fontWeight: 900, fontSize: '18px', marginBottom: '4px' }}>{score?.labelAway || "AZL"}</span>
                <span style={{ background: 'rgba(0, 173, 255, 0.15)', padding: '10px 24px', borderRadius: '12px', fontSize: '36px', fontWeight: 900, border: '1px solid rgba(0, 173, 255, 0.3)' }}>
                  {score?.away ?? 0}
                </span>
              </div>
            </div>

            <div
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: phaseInfo.winner === 'home' ? '#ff4b4b' : phaseInfo.winner === 'away' ? '#00adff' : '#e2e8f0',
                textShadow: phaseInfo.winner === 'home' ? '0 0 10px rgba(255, 75, 75, 0.3)' : phaseInfo.winner === 'away' ? '0 0 10px rgba(0, 173, 255, 0.3)' : 'none',
                marginBottom: '40px',
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '12px 20px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              {phaseInfo.winner === 'home' 
                ? (score?.labelHome ? `🎉 VITÓRIA: ${score.labelHome}!` : '🔴 VITÓRIA DO TIME VERMELHO!')
                : phaseInfo.winner === 'away' 
                ? (score?.labelAway ? `🎉 VITÓRIA: ${score.labelAway}!` : '🔵 VITÓRIA DO TIME AZUL!')
                : '🤝 EMPATE! BELO JOGO!'}
            </div>

            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('game-restart-requested'));
              }}
              style={{
                background: `linear-gradient(135deg, ${hudConfig.themeColor || '#00f3ff'}, #00adff)`,
                color: '#06080d',
                border: 'none',
                padding: '16px 36px',
                fontSize: '16px',
                fontWeight: 800,
                letterSpacing: '1px',
                borderRadius: '14px',
                cursor: 'pointer',
                boxShadow: `0 4px 20px ${hudConfig.themeColor ? `${hudConfig.themeColor}4d` : 'rgba(0, 243, 255, 0.3)'}`,
                transition: 'all 0.2s ease',
                outline: 'none',
                width: '100%',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.03)';
                e.currentTarget.style.boxShadow = `0 6px 25px ${hudConfig.themeColor ? `${hudConfig.themeColor}80` : 'rgba(0, 243, 255, 0.5)'}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = `0 4px 20px ${hudConfig.themeColor ? `${hudConfig.themeColor}4d` : 'rgba(0, 243, 255, 0.3)'}`;
              }}
            >
              JOGAR NOVAMENTE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── COMPONENTE HUD 3D (WebXR World-Space Mesh HUD) ───────────
// Renderizado na tela tridimensional interna do óculos de VR
export function HUD3D() {
  const activeSceneId = useEngineStore(s => s.activeSceneId);
  const activeScene = useEngineStore(s => s.scenes[activeSceneId]);
  const hudEnabled = getSceneHUDEnabled(activeScene);
  const hudConfig = useMemo(() => getSceneHUDConfig(activeScene), [activeScene]);

  const { camera } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const { score, timer, phaseInfo, notification } = useHUDState();

  // Se o HUD estiver desabilitado para esta cena ou não tiver placar, não renderiza nada!
  if (!hudEnabled || !hudConfig.showScoreboard) return null;

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Gradiente de fundo escuro e sofisticado
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, 'rgba(8, 12, 28, 0.95)');
    bgGrad.addColorStop(1, 'rgba(18, 26, 50, 0.95)');
    ctx.fillStyle = bgGrad;
    
    // Borda brilhante superior
    const isEndgame = phaseInfo.phase === 'endgame';
    ctx.strokeStyle = isEndgame 
      ? (phaseInfo.winner === 'home' ? 'rgba(255, 75, 75, 0.8)' : phaseInfo.winner === 'away' ? 'rgba(0, 173, 255, 0.8)' : 'rgba(255, 255, 255, 0.6)')
      : (hudConfig.themeColor || 'rgba(0, 255, 200, 0.4)');
    ctx.lineWidth = 4;
    
    const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };

    // Configura sombra para o brilho neon das bordas
    ctx.shadowColor = isEndgame
      ? (phaseInfo.winner === 'home' ? 'rgba(255, 75, 75, 0.5)' : phaseInfo.winner === 'away' ? 'rgba(0, 173, 255, 0.5)' : 'rgba(255, 255, 255, 0.3)')
      : (hudConfig.themeColor || 'rgba(0, 255, 200, 0.3)');
    ctx.shadowBlur = 10;
    drawRoundedRect(8, 8, canvas.width - 16, canvas.height - 16, 24);
    
    // Reset de sombra para textos
    ctx.shadowBlur = 0;

    if (isEndgame) {
      // Desenhar tela de FIM DE JOGO
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('FIM DE PARTIDA', 256, 45);

      // Linha separadora
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(50, 70, canvas.width - 100, 2);

      // Placar Final
      ctx.fillStyle = '#ff4b4b';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'right';
      ctx.fillText((score?.home ?? 0).toString(), 220, 105);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('vs', 256, 105);

      ctx.fillStyle = '#00adff';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'left';
      ctx.fillText((score?.away ?? 0).toString(), 292, 105);

      // Vencedor
      ctx.textAlign = 'center';
      if (phaseInfo.winner === 'home') {
        ctx.fillStyle = '#ff4b4b';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(score?.labelHome ? `🎉 VITÓRIA: ${score.labelHome}!` : '🔴 VITÓRIA DO TIME VERMELHO!', 256, 160);
      } else if (phaseInfo.winner === 'away') {
        ctx.fillStyle = '#00adff';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(score?.labelAway ? `🎉 VITÓRIA: ${score.labelAway}!` : '🔵 VITÓRIA DO TIME AZUL!', 256, 160);
      } else {
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('🤝 EMPATE!', 256, 160);
      }

      // Instrução para reiniciar
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '500 16px sans-serif';
      ctx.fillText('Pressione Gatilho (A) para reiniciar', 256, 210);

    } else {
      // Placar normal de futebol com cronômetro
      
      // Cronômetro central
      if (hudConfig.showTimer !== false) {
        ctx.fillStyle = hudConfig.themeColor || '#00f3ff';
        ctx.font = 'bold 32px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = hudConfig.themeColor ? `${hudConfig.themeColor}80` : 'rgba(0, 243, 255, 0.5)';
        ctx.shadowBlur = 6;
        ctx.fillText(timer, 256, 50);
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        phaseInfo.phase === 'countdown' ? 'ESQUENTA' : phaseInfo.phase === 'goal' ? 'GOL!' : 'PARTIDA',
        256,
        hudConfig.showTimer !== false ? 85 : 60
      );

      // Linha divisória horizontal
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(40, 115, canvas.width - 80, 2);

      // --- TIME VERMELHO (Home) ---
      ctx.fillStyle = '#ff4b4b';
      ctx.font = 'bold 40px sans-serif';
      ctx.textAlign = 'right';
      ctx.shadowColor = 'rgba(255, 75, 75, 0.4)';
      ctx.shadowBlur = 6;
      ctx.fillText(score?.labelHome || 'VER', 160, 180);

      // Score Vermelho
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 54px monospace';
      ctx.textAlign = 'right';
      ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
      ctx.shadowBlur = 8;
      ctx.fillText((score?.home ?? 0).toString(), 220, 180);

      // Divisor vertical inferior
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(254, 135, 4, 90);

      // --- TIME AZUL (Away) ---
      // Score Azul
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 54px monospace';
      ctx.textAlign = 'left';
      ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
      ctx.shadowBlur = 8;
      ctx.fillText((score?.away ?? 0).toString(), 292, 180);

      // Nome do Time
      ctx.fillStyle = '#00adff';
      ctx.font = 'bold 40px sans-serif';
      ctx.textAlign = 'left';
      ctx.shadowColor = 'rgba(0, 173, 255, 0.4)';
      ctx.shadowBlur = 6;
      ctx.fillText(score?.labelAway || 'AZL', 352, 180);
      
      ctx.shadowBlur = 0;

      // Desenha Notificação na base se houver
      if (notification) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.95)';
        ctx.fillRect(40, 222, canvas.width - 80, 26);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(notification, 256, 235);
      }
    }

    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshBasicMaterial;
      if (mat) {
        if (textureRef.current) {
          textureRef.current.dispose();
        }
        const tex = new THREE.CanvasTexture(canvas);
        mat.map = tex;
        mat.needsUpdate = true;
        textureRef.current = tex;
      }
    }
  }, [score, timer, phaseInfo, notification, hudConfig]);

  useEffect(() => {
    return () => {
      if (textureRef.current) {
        textureRef.current.dispose();
      }
    };
  }, []);

  useFrame(() => {
    if (meshRef.current) {
      // Fixa a 1.2 unidades à frente da câmera e 0.22 unidades acima dela para não atrapalhar o centro do olhar
      const dir = new THREE.Vector3(0, 0, -1.25).applyQuaternion(camera.quaternion);
      const up = new THREE.Vector3(0, 0.22, 0).applyQuaternion(camera.quaternion);
      meshRef.current.position.copy(camera.position).add(dir).add(up);
      meshRef.current.quaternion.copy(camera.quaternion);
    }

    // Escuta gatilhos/botão A do VR gamepad para reiniciar quando estiver em FIM DE JOGO
    if (phaseInfo.phase === 'endgame') {
      const restartPressed = Input.getGamepadButton("A") || Input.getGamepadButton("R1") || Input.getKey("Space");
      if (restartPressed) {
        window.dispatchEvent(new CustomEvent('soccer-restart-requested'));
      }
    }
  });

  // Só renderiza no espaço 3D se as pontuações e estado de jogo estiverem ativos
  if (!score) return null;

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[0.8, 0.4]} />
      <meshBasicMaterial transparent={true} depthTest={false} depthWrite={false} />
    </mesh>
  );
}
