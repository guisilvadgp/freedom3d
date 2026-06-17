import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, TransformControls, Stats } from '@react-three/drei';
import { useRef, Suspense } from 'react';
import { useEditorStore } from '../store/editorStore';
import { SceneEntities } from './SceneEntities';
import * as THREE from 'three';

export function SceneView() {
  const { showGrid, isPlaying, activeScene, showGizmos } = useEditorStore();
  const scene = activeScene();

  return (
    <div className="scene-view">
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

        {/* Entities */}
        <Suspense fallback={null}>
          <SceneEntities />
        </Suspense>

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
