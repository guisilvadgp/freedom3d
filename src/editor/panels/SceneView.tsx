import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, TransformControls, Stats } from '@react-three/drei';
import { useRef, Suspense } from 'react';
import { useEditorStore } from '../store/editorStore';
import { SceneEntities } from './SceneEntities';
import { GLTFViewers } from './GLTFViewer';
import { GameLoop } from '../../engine/systems/GameLoop';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three';

export function SceneView() {
  const { showGrid, isPlaying, activeScene, showGizmos } = useEditorStore();
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

  return (
    <div className="scene-view" onDrop={handleDrop} onDragOver={handleDragOver}>
      <Canvas
        shadows
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        camera={{ fov: 60, near: 0.1, far: 1000, position: [5, 5, 8] }}
      >
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
          <Physics paused={!isPlaying} debug={showGizmos}>
            <SceneEntities />
            <GLTFViewers />
          </Physics>
        </Suspense>

        {/* Systems */}
        <GameLoop />

        {/* Grid */}
        {showGrid && (
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
        {!isPlaying && (
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.05}
            minDistance={1}
            maxDistance={200}
          />
        )}

        {/* Gizmos */}
        {showGizmos && (
          <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
            <GizmoViewport
              axisColors={['#f55', '#5f5', '#55f']}
              labelColor="white"
            />
          </GizmoHelper>
        )}

        {/* Performance stats in play mode */}
        {isPlaying && <Stats />}
      </Canvas>
    </div>
  );
}
