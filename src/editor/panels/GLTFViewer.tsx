import { Suspense, useMemo, useRef, useEffect } from 'react';
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TransformControls, useAnimations } from '@react-three/drei';
import { RigidBody, MeshCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useEditorStore } from '../store/editorStore';
import type { Entity } from '../../engine/ecs/types';
import { xrStore, attemptTeleport } from './SceneView';

// ── Um modelo GLTF carregado ─────────────────────────────────

// Habilitar cache global do Three.js para evitar requisições redundantes de rede
THREE.Cache.enabled = true;

function shrinkTexture(texture: THREE.Texture, maxSize = 1024) {
  if (!texture || !texture.image) return;
  
  const img = texture.image;
  // Obter dimensões originais da imagem da textura
  const width = img.width || (img as any).naturalWidth || 0;
  const height = img.height || (img as any).naturalHeight || 0;
  
  if (width === 0 || height === 0) return;
  if (width <= maxSize && height <= maxSize) return;
  
  try {
    let newWidth = width;
    let newHeight = height;
    if (width > height) {
      if (width > maxSize) {
        newHeight = Math.round((height * maxSize) / width);
        newWidth = maxSize;
      }
    } else {
      if (height > maxSize) {
        newWidth = Math.round((width * maxSize) / height);
        newHeight = maxSize;
      }
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      
      texture.image = canvas;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
    }
  } catch (err) {
    console.error('[Texture Shrink] Erro ao redimensionar textura:', err);
  }
}

function GLTFMesh({ entity }: { entity: Entity }) {
  const groupRef = useRef<THREE.Group>(null!);
  
  const selectedEntityId = useEditorStore(s => s.selectedEntityId);
  const selectEntity = useEditorStore(s => s.selectEntity);
  const editorMode = useEditorStore(s => s.editorMode);
  const isPlaying = useEditorStore(s => s.isPlaying);
  const updateComponent = useEditorStore(s => s.updateComponent);
  const snapEnabled = useEditorStore(s => s.snapEnabled);
  const snapValue = useEditorStore(s => s.snapValue);
  const activeViewport = useEditorStore(s => s.activeViewport);
  
  const isGameView = activeViewport === 'game';
  const isStandalone = typeof window !== 'undefined' && window.location.pathname === '/preview';

  const transform = entity.components.Transform!;
  const model = entity.components.GLTFModel!;
  const rigidBody = entity.components.RigidBody;
  const isSelected = selectedEntityId === entity.id;

  // Drag detection: evita seleção acidental ao arrastar a câmera
  const mouseDownPos = useRef<{x: number; y: number} | null>(null);
  const handlePointerDown = (e: any) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
  };
  const handlePointerUp = (e: any) => {
    if (!mouseDownPos.current) return;
    const dx = Math.abs(e.clientX - mouseDownPos.current.x);
    const dy = Math.abs(e.clientY - mouseDownPos.current.y);
    mouseDownPos.current = null;
    if (dx < 5 && dy < 5) {
      e.stopPropagation();
      selectEntity(entity.id);
    }
  };

  const handleStandaloneClick = (e: any) => {
    if (!isStandalone) return;
    if (!attemptTeleport()) return;
    if (entity.tags?.includes('player') || entity.components.Camera?.isMain || entity.tags?.includes('teleport')) return;

    e.stopPropagation();

    xrStore.setState(state => ({
      ...state,
      originReferenceSpace: undefined,
    }));
    
    const clickPoint = e.point;
    const storeState = useEditorStore.getState();
    const scene = storeState.activeScene();
    Object.values(scene.entities).forEach(playerEnt => {
      if (playerEnt.tags?.includes('player') || playerEnt.components.Camera?.isMain) {
        const targetY = clickPoint.y + 1.05;
        storeState.updateComponent(playerEnt.id, 'Transform', {
          position: [clickPoint.x, targetY, clickPoint.z],
        });

        // Se houver um RigidBody físico ativo, teleporta e zera a velocidade dele
        const rb = storeState.rigidBodyRefs[playerEnt.id];
        if (rb) {
          rb.setTranslation({ x: clickPoint.x, y: targetY, z: clickPoint.z }, true);
          rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
          rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
        }
      }
    });
  };

  const gltf = useLoader(GLTFLoader, model.src);
  const clonedScene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const isMobile = isStandalone || (typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));

    // Aplicar shadow em todos os meshes internos e otimizar texturas no mobile/desktop para economizar VRAM
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = model.castShadow;
        mesh.receiveShadow = model.receiveShadow;

        // Otimização de texturas por meio do redimensionamento dinâmico
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((mat: any) => {
            const textureKeys = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'];
            textureKeys.forEach((key) => {
              if (mat[key] && mat[key].isTexture) {
                const tex = mat[key];
                // Limita texturas a 512px no mobile (economia agressiva) e 2048px no desktop (prevenção contra estouro de VRAM)
                const maxSize = isMobile ? 512 : 2048;
                shrinkTexture(tex, maxSize);
              }
            });
          });
        }
      }
    });
    return clone;
  }, [gltf.scene, model.castShadow, model.receiveShadow, isStandalone]);

  const pos = transform.position as [number, number, number];
  const rot = (transform.rotation as [number, number, number]).map(
    (d) => (d * Math.PI) / 180,
  ) as [number, number, number];
  const s = model.modelScale ?? 1;
  const scale = [
    transform.scale[0] * s,
    transform.scale[1] * s,
    transform.scale[2] * s,
  ] as [number, number, number];

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
      scale: [
        +(obj.scale.x / s).toFixed(3),
        +(obj.scale.y / s).toFixed(3),
        +(obj.scale.z / s).toFixed(3),
      ],
    });
  };

  const animator = entity.components.Animator;
  const { actions } = useAnimations(gltf.animations, groupRef);

  // Lógica do Animator
  useEffect(() => {
    if (!animator || !actions) return;
    const action = actions[animator.currentAnimation];
    
    // Stop all other actions
    Object.values(actions).forEach(a => {
      if (a && a !== action) a.stop();
    });

    if (action) {
      if (!action.isRunning()) {
        action.reset().play();
      }
      action.setLoop(animator.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      action.timeScale = isPlaying ? animator.timeScale : 0; // Pausa se não tiver isPlaying
    }
  }, [animator?.currentAnimation, animator?.loop, animator?.timeScale, actions, isPlaying]);

  // Mesh com física para GLTF
  const group = (
    <group
      ref={groupRef}
      position={pos}
      rotation={rot}
      scale={scale}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onClick={handleStandaloneClick}
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
  );

  return (
    <>
      {(rigidBody && isPlaying) ? (
        <RigidBody
          position={pos}
          rotation={rot}
          type={rigidBody.isStatic ? 'fixed' : 'dynamic'}
          mass={rigidBody.mass}
          gravityScale={rigidBody.useGravity ? 1 : 0}
          colliders={rigidBody.collider === 'none' || rigidBody.collider === 'trimesh' ? false : (rigidBody.collider || 'cuboid')}
        >
          <group scale={scale} onClick={handleStandaloneClick}>
            <primitive object={clonedScene} />
          </group>
          {rigidBody.collider === 'trimesh' && (
            <MeshCollider type="trimesh">
              <group scale={scale} onClick={handleStandaloneClick}>
                <primitive object={clonedScene} />
              </group>
            </MeshCollider>
          )}
        </RigidBody>
      ) : group}

      {isSelected && !isGameView && (
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

export function GLTFErrorFallback({ fileName }: { fileName: string }) {
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
  const scene = useEditorStore(s => s.scenes[s.activeSceneId]);

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


