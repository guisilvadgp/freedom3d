import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, Stats, useProgress } from '@react-three/drei';
import { useRef, Suspense, useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';
import { SceneEntities } from './SceneEntities';
import { GLTFViewers } from './GLTFViewer';
import { GameLoop } from '../../engine/systems/GameLoop';
import { Physics } from '@react-three/rapier';
import { XR, createXRStore } from '@react-three/xr';
import * as THREE from 'three';
import { Eye, Gamepad } from 'lucide-react';

export const xrStore = createXRStore();

let lastTeleportTime = 0;
export function attemptTeleport(): boolean {
  const now = Date.now();
  if (now - lastTeleportTime < 600) return false;
  lastTeleportTime = now;
  return true;
}

function XRAspectCorrector() {
  const { gl, camera } = useThree();

  useFrame(() => {
    if (gl.xr.isPresenting) {
      const aspect = window.innerWidth / window.innerHeight;
      if (camera.aspect !== aspect) {
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
      }

      const xrCamera = gl.xr.getCamera();
      if (xrCamera) {
        xrCamera.cameras.forEach((subCam) => {
          if (subCam.aspect !== 1) {
            subCam.aspect = 1;
            subCam.updateProjectionMatrix();
          }
        });
      }
    }
  });

  return null;
}

function LoadingTracker({ 
  sceneLoaded,
  onProgress, 
  onLoaded 
}: { 
  sceneLoaded: boolean;
  onProgress?: (progress: number) => void;
  onLoaded?: () => void;
}) {
  const { active, progress } = useProgress();

  useEffect(() => {
    if (onProgress) {
      onProgress(Math.round(progress));
    }
  }, [progress, onProgress]);

  useEffect(() => {
    // Só considera carregado se a estrutura da cena do servidor já foi injetada no Zustand,
    // e os loaders de assets terminaram (ou a fila está vazia após a injeção).
    if (sceneLoaded && (!active || progress === 100)) {
      if (onLoaded) {
        const timer = setTimeout(() => {
          onLoaded();
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [active, progress, sceneLoaded, onLoaded]);

  return null;
}



export function SceneView({ 
  isStandalone,
  sceneLoaded = true,
  onProgress,
  onLoaded
}: { 
  isStandalone?: boolean;
  sceneLoaded?: boolean;
  onProgress?: (progress: number) => void;
  onLoaded?: () => void;
}) {
  const showGrid = useEditorStore(s => s.showGrid);
  const isPlaying = useEditorStore(s => s.isPlaying);
  const showGizmos = useEditorStore(s => s.showGizmos);
  const activeViewport = useEditorStore(s => s.activeViewport);
  const setActiveViewport = useEditorStore(s => s.setActiveViewport);
  const scene = useEditorStore(s => s.scenes[s.activeSceneId]);
  const isGameView = isStandalone || activeViewport === 'game';
  
  const isDragging = useRef(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) return;
    
    try {
      const data = JSON.parse(dataStr);
      const store = useEditorStore.getState();
      
      if (data.type === 'prefab') {
        store.instantiatePrefab(data.index);
      } else if (data.type === 'gltf') {
        store.instantiateAsset(data.fileName);
      }
    } catch (err) {
      console.error('Failed to handle drop', err);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const content = (
    <>
      <XRAspectCorrector />
      <LoadingTracker sceneLoaded={sceneLoaded} onProgress={onProgress} onLoaded={onLoaded} />
      {/* Background */}
      <color attach="background" args={[scene.backgroundColor]} />

      {/* Fog */}
      {scene.fogEnabled && (
        <fog attach="fog" args={[scene.fogColor, scene.fogNear, scene.fogFar]} />
      )}

      {/* Ambient */}
      <ambientLight color={scene.ambientColor} intensity={scene.ambientIntensity} />

      {/* Entities and Physics */}
      <Suspense fallback={null}>
        <Physics paused={!isPlaying} debug={showGizmos && !isGameView}>
          <SceneEntities />
          <GLTFViewers />
          {/* Systems */}
          <GameLoop />
        </Physics>
      </Suspense>

      {/* Grid */}
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

      {/* Controls */}
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

      {/* Gizmos */}
      {showGizmos && !isGameView && (
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport
            axisColors={['#f55', '#5f5', '#55f']}
            labelColor="white"
          />
        </GizmoHelper>
      )}

      {/* Performance stats in play mode */}
      {isPlaying && <Stats />}
    </>
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
        </div>
      )}

      {isStandalone && (
        <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', gap: '10px' }}>
          <button className="panel-btn" onClick={() => xrStore.enterVR()}>Enter VR</button>
          <button className="panel-btn" onClick={() => xrStore.enterAR()}>Enter AR</button>
        </div>
      )}

      {/* Cursor de mira HTML puro — zero custo de processamento no game loop */}
      {isStandalone && (
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

      <div
        style={
          isStandalone || isGameView
            ? {
                // Preview e Game View: letterbox 16:9 centralizado com barras pretas
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                background: '#000',
              }
            : {
                width: '100%',
                height: '100%',
                position: 'relative',
              }
        }
      >
        {/* Container 16:9 interno — faz o letterbox real */}
        <div
          style={
            isStandalone || isGameView
              ? {
                  aspectRatio: '16 / 9',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  width: '100%',
                  position: 'relative',
                  overflow: 'hidden',
                }
              : {
                  width: '100%',
                  height: '100%',
                  position: 'relative',
                }
          }
        >
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
          camera={{ fov: 60, near: 0.1, far: 1000, position: [5, 5, 8] }}
          onPointerMissed={() => {
            if (!isGameView && !isDragging.current) {
              useEditorStore.getState().selectEntity(null);
            }
          }}
          style={{
            width: '100%',
            height: '100%'
          }}
        >
          {isStandalone ? <XR store={xrStore}>{content}</XR> : content}
        </Canvas>
        </div>
      </div>
    </div>
  );
}