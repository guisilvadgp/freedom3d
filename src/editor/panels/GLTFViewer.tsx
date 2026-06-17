import { Suspense, useMemo, useRef } from 'react';
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useEditorStore } from '../store/editorStore';
import type { Entity } from '../../engine/ecs/types';

// ── Um modelo GLTF carregado ─────────────────────────────────

function GLTFMesh({ entity }: { entity: Entity }) {
  const groupRef = useRef<THREE.Group>(null!);
  const {
    selectedEntityId, selectEntity,
    editorMode, isPlaying,
    updateComponent, snapEnabled, snapValue,
  } = useEditorStore();

  const transform = entity.components.Transform!;
  const model = entity.components.GLTFModel!;
  const isSelected = selectedEntityId === entity.id;

  const gltf = useLoader(GLTFLoader, model.src);
  const clonedScene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    // Aplicar shadow em todos os meshes internos
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).castShadow = model.castShadow;
        (child as THREE.Mesh).receiveShadow = model.receiveShadow;
      }
    });
    return clone;
  }, [gltf.scene, model.castShadow, model.receiveShadow]);

  const pos = transform.position as [number, number, number];
  const rot = (transform.rotation as [number, number, number]).map(
    (d) => (d * Math.PI) / 180,
  ) as [number, number, number];
  const s = model.modelScale;

  const handleChange = () => {
    if (!groupRef.current || isPlaying) return;
    const obj = groupRef.current;
    updateComponent(entity.id, 'Transform', {
      position: [+obj.position.x.toFixed(3), +obj.position.y.toFixed(3), +obj.position.z.toFixed(3)],
      rotation: [
        +((obj.rotation.x * 180) / Math.PI).toFixed(2),
        +((obj.rotation.y * 180) / Math.PI).toFixed(2),
        +((obj.rotation.z * 180) / Math.PI).toFixed(2),
      ],
      scale: transform.scale, // scale é controlada via modelScale no inspector
    });
  };

  return (
    <>
      <group
        ref={groupRef}
        position={pos}
        rotation={rot}
        scale={[s, s, s]}
        onClick={(e) => { e.stopPropagation(); selectEntity(entity.id); }}
      >
        <primitive object={clonedScene} />

        {/* Selection highlight */}
        {isSelected && (
          <mesh visible={false}>
            <boxGeometry />
            <meshBasicMaterial color="#44aaff" wireframe />
          </mesh>
        )}
      </group>

      {isSelected && !isPlaying && (
        <TransformControls
          object={groupRef}
          mode={editorMode as any}
          translationSnap={snapEnabled ? snapValue : null}
          rotationSnap={snapEnabled ? Math.PI / 12 : null}
          onChange={handleChange}
        />
      )}
    </>
  );
}

// ── Error boundary simples ───────────────────────────────────

function GLTFErrorFallback({ fileName }: { fileName: string }) {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#f54040" wireframe />
      <primitive object={new THREE.Object3D()} name={`missing:${fileName}`} />
    </mesh>
  );
}

// ── Renderiza todos os GLTF da cena ─────────────────────────

export function GLTFViewers() {
  const { activeScene } = useEditorStore();
  const scene = activeScene();

  return (
    <>
      {scene.rootEntityIds.map((id) => {
        const entity = scene.entities[id];
        if (!entity?.components.GLTFModel || !entity.active) return null;

        return (
          <Suspense key={id} fallback={null}>
            <GLTFMesh entity={entity} />
          </Suspense>
        );
      })}
    </>
  );
}
