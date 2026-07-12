import React, { useRef, Suspense, useEffect, useState } from 'react';
import { Canvas, useThree, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, Stats } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { XR } from '@react-three/xr';
import * as THREE from 'three';
import { Eye, Gamepad, Sun } from 'lucide-react';
import { useEngineStore, getEngineStore } from '../runtime/runtimeStore';
import { xrStore } from '../runtime/xrStore';
import { SceneEntities } from './SceneEntities';
import { GameLoop } from '../systems/GameLoop';
import { HUD2D } from '../systems/HUD';
import { VirtualARScreen } from './VirtualARScreen';

let lastTeleportTime = 0;
export function attemptTeleport(): boolean {
  const now = Date.now();
  if (now - lastTeleportTime < 600) return false;
  lastTeleportTime = now;
  return true;
}

function LoadingTracker({
  sceneLoaded,
  onProgress,
  onLoaded
}: {
  sceneLoaded: boolean;
  onProgress?: (progress: number, statusText?: string) => void;
  onLoaded?: () => void;
}) {
  const [loadingState, setLoadingState] = useState({ active: false, progress: 0 });

  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  useEffect(() => {
    let timeout: any;
    
    const updateState = (active: boolean, loaded: number, total: number, url?: string) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const progress = total > 0 ? (loaded / total) * 100 : 0;
        setLoadingState({ active, progress });
        if (onProgressRef.current) {
          let statusText = '';
          if (url) {
            const parts = url.split('/');
            let filename = parts[parts.length - 1] || '';
            if (filename.includes('?')) {
              filename = filename.split('?')[0];
            }
            statusText = filename ? `Carregando: ${decodeURIComponent(filename)}` : 'Carregando recursos...';
          } else {
            statusText = active ? 'Carregando recursos...' : 'Pronto!';
          }
          onProgressRef.current(Math.round(progress), statusText);
        }
      }, 0);
    };

    const manager = THREE.DefaultLoadingManager;
    const origStart = manager.onStart;
    const origProgress = manager.onProgress;
    const origLoad = manager.onLoad;
    const origError = manager.onError;

    manager.onStart = (url, loaded, total) => {
      updateState(true, loaded, total, url);
      if (origStart) origStart(url, loaded, total);
    };
    manager.onProgress = (url, loaded, total) => {
      updateState(true, loaded, total, url);
      if (origProgress) origProgress(url, loaded, total);
    };
    manager.onLoad = () => {
      updateState(false, 1, 1, '');
      if (origLoad) origLoad();
    };
    manager.onError = (url) => {
      updateState(false, 1, 1, '');
      if (origError) origError(url);
    };

    updateState(false, 1, 1);

    return () => {
      clearTimeout(timeout);
      manager.onStart = origStart;
      manager.onProgress = origProgress;
      manager.onLoad = origLoad;
      manager.onError = origError;
    };
  }, []);

  const { active, progress } = loadingState;

  useEffect(() => {
    if (sceneLoaded && (!active || progress === 100)) {
      if (onLoadedRef.current) {
        const timer = setTimeout(() => {
          if (onLoadedRef.current) onLoadedRef.current();
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [active, progress, sceneLoaded]);

  return null;
}

function EditorCameraHandler() {
  const { controls } = useThree();
  const focusTrigger = useEngineStore(s => s.focusTrigger);
  const activeSceneId = useEngineStore(s => s.activeSceneId);
  const scene = useEngineStore(s => s.scenes[activeSceneId]);
  
  const targetPos = useRef<THREE.Vector3 | null>(null);
  const animateTo = useRef<boolean>(false);

  useEffect(() => {
    if (focusTrigger && scene) {
      const entity = scene.entities[focusTrigger.entityId];
      if (entity && entity.components.Transform) {
        const pos = entity.components.Transform.position;
        targetPos.current = new THREE.Vector3(pos[0], pos[1], pos[2]);
        animateTo.current = true;
      }
    }
  }, [focusTrigger]);

  useFrame((state) => {
    const gl = state.gl;
    (window as any).__freedom3d_webgl_info = {
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures
    };

    if (animateTo.current && targetPos.current) {
      if (controls) {
        const orbit = controls as any;
        orbit.target.lerp(targetPos.current, 0.1);
      }
      
      const offset = new THREE.Vector3(4, 4, 6);
      const camTargetPos = targetPos.current.clone().add(offset);
      state.camera.position.lerp(camTargetPos, 0.1);
      
      const currentTarget = controls ? (controls as any).target : new THREE.Vector3();
      if (
        (!controls || currentTarget.distanceTo(targetPos.current) < 0.05) &&
        state.camera.position.distanceTo(camTargetPos) < 0.05
      ) {
        animateTo.current = false;
      }
    }
  });

  return null;
}

function Skybox({ url }: { url: string }) {
  const { scene } = useThree();
  const texture = useLoader(THREE.TextureLoader, url);

  useEffect(() => {
    if (texture) {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      scene.background = texture;
      scene.environment = texture;
      return () => {
        scene.background = null;
        scene.environment = null;
      };
    }
  }, [texture, scene]);

  return null;
}

export const EditorConfigContext = React.createContext<{
  editorMode: string;
  snapEnabled: boolean;
  snapValue: number;
  showLighting: boolean;
}>({
  editorMode: 'translate',
  snapEnabled: false,
  snapValue: 0.5,
  showLighting: true,
});

export function SceneView({
  isStandalone,
  sceneLoaded = true,
  onProgress,
  onLoaded,
  roomId,
  showGrid = false,
  showGizmos = false,
  showLighting = true,
  editorMode = 'translate',
  snapEnabled = false,
  snapValue = 0.5,
  onToggleLighting,
  onDropAsset,
  onDropPrefab,
}: {
  isStandalone?: boolean;
  sceneLoaded?: boolean;
  onProgress?: (progress: number, statusText?: string) => void;
  onLoaded?: () => void;
  roomId?: string;
  showGrid?: boolean;
  showGizmos?: boolean;
  showLighting?: boolean;
  editorMode?: string;
  snapEnabled?: boolean;
  snapValue?: number;
  onToggleLighting?: () => void;
  onDropAsset?: (fileName: string) => void;
  onDropPrefab?: (index: number) => void;
}) {
  const isPlaying = useEngineStore(s => s.isPlaying);
  const activeViewport = useEngineStore(s => s.activeViewport);
  const setActiveViewport = useEngineStore(s => s.setActiveViewport);
  const scene = useEngineStore(s => s.scenes[s.activeSceneId]);
  const isGameView = isStandalone || activeViewport === 'game';
  const isDragging = useRef(false);



  if (!scene) return null;

  const mainCameraEntity = (Object.values(scene.entities) as any[]).find(
    entity => entity.active && entity.components.Camera?.isMain
  );
  const showCrosshair = mainCameraEntity?.components.Camera?.showCrosshair ?? false;
  const antialias = mainCameraEntity?.components.Camera?.antialias ?? (!isStandalone || !('ontouchstart' in window));

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) return;

    try {
      const data = JSON.parse(dataStr);
      if (data.type === 'prefab' && onDropPrefab) {
        onDropPrefab(data.index);
      } else if (data.type === 'gltf' && onDropAsset) {
        onDropAsset(data.fileName);
      }
    } catch (err) {
      console.error('Failed to handle drop', err);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const getSkyboxUrl = (fileName: string) => {
    if (!fileName) return '';
    if (fileName.startsWith('/') || fileName.startsWith('http') || fileName.startsWith('blob:') || fileName.startsWith('data:')) {
      return fileName;
    }
    const projectName = scene.name || 'default';
    if (isStandalone) {
      const isOffline = (window as any).__freedom3d_standalone__;
      return isOffline ? './assets/' + fileName : `/api/asset/${encodeURIComponent(fileName)}`;
    }
    return `/api/project/get-asset?project=${encodeURIComponent(projectName)}&file=${encodeURIComponent(fileName)}`;
  };

  const content = (
    <EditorConfigContext.Provider value={{ editorMode, snapEnabled, snapValue, showLighting }}>
      {!isGameView && <EditorCameraHandler />}
      <LoadingTracker sceneLoaded={sceneLoaded} onProgress={onProgress} onLoaded={onLoaded} />
      {isStandalone && <VirtualARScreen roomId={roomId} />}
      
      {scene.skyboxUrl ? (
        <Suspense fallback={<color attach="background" args={[scene.backgroundColor]} />}>
          <Skybox url={getSkyboxUrl(scene.skyboxUrl)} />
        </Suspense>
      ) : (
        <color attach="background" args={[scene.backgroundColor]} />
      )}

      {scene.fogEnabled && (
        <fog attach="fog" args={[scene.fogColor, scene.fogNear, scene.fogFar]} />
      )}

      {showLighting || isGameView ? (
        <ambientLight color={scene.ambientColor} intensity={scene.ambientIntensity} />
      ) : (
        <ambientLight color="#ffffff" intensity={1.5} />
      )}

      <Suspense fallback={null}>
        <Physics paused={!isPlaying} debug={showGizmos && !isGameView}>
          <SceneEntities />
          <GameLoop />
        </Physics>
      </Suspense>

      {showGrid && !isGameView && (
        <Grid
          position={[0, -0.001, 0]}
          args={[40, 40]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#3a4a5a"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#4a6a8a"
          fadeDistance={60}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid
        />
      )}

      {!isGameView && (
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.05}
          minDistance={1}
          maxDistance={200}
          onStart={() => { isDragging.current = true; }}
          onEnd={() => { isDragging.current = false; }}
        />
      )}

      {showGizmos && !isGameView && (
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport
            axisColors={['#f55', '#5f5', '#55f']}
            labelColor="white"
          />
        </GizmoHelper>
      )}

      {isPlaying && !isStandalone && <Stats />}
    </EditorConfigContext.Provider>
  );

  return (
    <div
      className="scene-view"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#040508',
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {!isStandalone && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, background: '#1e293b', display: 'flex', padding: '4px 8px', gap: '8px', borderBottom: '1px solid #334155' }}>
          <button className="panel-btn" style={{ background: activeViewport === 'scene' ? '#3b82f6' : 'transparent', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => setActiveViewport('scene')}><Eye size={14} /> Scene</button>
          <button className="panel-btn" style={{ background: activeViewport === 'game' ? '#3b82f6' : 'transparent', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => setActiveViewport('game')}><Gamepad size={14} /> Game</button>
          {onToggleLighting && (
            <button
              className="panel-btn"
              style={{
                marginLeft: 'auto',
                background: showLighting ? 'transparent' : '#b45309',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              onClick={onToggleLighting}
              title={showLighting ? "Desativar Iluminação no Editor" : "Ativar Iluminação no Editor"}
            >
              <Sun size={14} color={showLighting ? "#ffffff" : "#cbd5e1"} />
              {showLighting ? "Luzes: Ligadas" : "Luzes: Desligadas"}
            </button>
          )}
        </div>
      )}

      {isStandalone && (
        <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', gap: '10px' }}>
          <button className="panel-btn" onClick={() => xrStore.enterVR()}>Enter VR</button>
          <button className="panel-btn" onClick={() => xrStore.enterAR()}>Enter AR</button>
        </div>
      )}

      {isGameView && showCrosshair && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 20,
            pointerEvents: 'none',
            width: 32,
            height: 32,
          }}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="7" stroke="#00ffff" strokeWidth="2" fill="none" opacity="0.9" />
            <line x1="16" y1="2" x2="16" y2="10" stroke="#00ffff" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
            <line x1="16" y1="22" x2="16" y2="30" stroke="#00ffff" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
            <line x1="2" y1="16" x2="10" y2="16" stroke="#00ffff" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
            <line x1="22" y1="16" x2="30" y2="16" stroke="#00ffff" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
          </svg>
        </div>
      )}

      <HUD2D isGameView={isGameView} isStandalone={isStandalone} />

      <div
        onClick={() => {
          if (isPlaying && isGameView) {
            const canvas = document.querySelector('.scene-view canvas') as HTMLCanvasElement | null;
            if (canvas && canvas.requestPointerLock) {
              try {
                const res = canvas.requestPointerLock();
                if (res && typeof res.catch === 'function') {
                  res.catch((err: any) => {
                    console.warn("Pointer Lock recusado:", err);
                  });
                }
              } catch (err) {
                console.warn("Falha ao solicitar Pointer Lock:", err);
              }
            }
          }
        }}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
      >
        <Canvas
          shadows={{ type: THREE.PCFShadowMap }}
          dpr={[1, isStandalone ? Math.min(window.devicePixelRatio, 1.5) : 2]}
          gl={{ antialias: antialias, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
          camera={{ fov: 60, near: 0.1, far: 1000, position: [5, 5, 8] }}
          onPointerMissed={() => {
            if (!isGameView && !isDragging.current) {
              getEngineStore().getState().selectEntity(null);
            }
          }}
          style={{
            width: '100%',
            height: '100%',
          }}
        >
          {isStandalone ? <XR store={xrStore}>{content}</XR> : content}
        </Canvas>
      </div>
    </div>
  );
}
