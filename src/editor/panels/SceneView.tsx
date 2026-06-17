import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, TransformControls, Stats } from '@react-three/drei';
import { useRef, Suspense } from 'react';
import { useEditorStore } from '../store/editorStore';
import { SceneEntities } from './SceneEntities';
import { GLTFViewers } from './GLTFViewer';
import { GameLoop } from '../../engine/systems/GameLoop';
import { Physics } from '@react-three/rapier';
import { XR, createXRStore } from '@react-three/xr';
import * as THREE from 'three';

const store = createXRStore();

export function SceneView({ isStandalone }: { isStandalone?: boolean }) {
  const { showGrid, isPlaying, activeScene, showGizmos, activeViewport, setActiveViewport } = useEditorStore();
  const isGameView = isStandalone || activeViewport === 'game';
  const scene = activeScene();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) return;
    
    try {
      const data = JSON.parse(dataStr);
      // Pega a store atual
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
    e.preventDefault(); // Necessário para permitir o drop
  };

  const content = (
    <>
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
    <div className="scene-view" onDrop={handleDrop} onDragOver={handleDragOver}>
      {!isStandalone && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, background: '#1e293b', display: 'flex', padding: '4px 8px', gap: '8px', borderBottom: '1px solid #334155' }}>
          <button className={ "panel-btn"  } style={{ background: activeViewport === 'scene' ? '#3b82f6' : 'transparent' }} onClick={() => setActiveViewport('scene')}>📹 Scene</button>
          <button className={ "panel-btn"  } style={{ background: activeViewport === 'game' ? '#3b82f6' : 'transparent' }} onClick={() => setActiveViewport('game')}>🎮 Game</button>
        </div>
      )}

      {isStandalone && (
        <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', gap: '10px' }}>
          <button className="panel-btn" onClick={() => store.enterVR()}>Enter VR</button>
          <button className="panel-btn" onClick={() => store.enterAR()}>Enter AR</button>
        </div>
      )}

      <Canvas
        shadows
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        camera={{ fov: 60, near: 0.1, far: 1000, position: [5, 5, 8] }}
      >
        {isStandalone ? <XR store={store}>{content}</XR> : content}
      </Canvas>
    </div>
  );
}






