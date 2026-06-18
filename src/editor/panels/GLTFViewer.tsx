import { Suspense, useMemo, useRef, useEffect, useState } from 'react';
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TransformControls, useAnimations } from '@react-three/drei';
import { RigidBody, MeshCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useEditorStore } from '../store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import type { Entity } from '../../engine/ecs/types';

// ── Um modelo GLTF carregado ─────────────────────────────────

// Habilitar cache global do Three.js para evitar requisições redundantes de rede
THREE.Cache.enabled = true;

function shrinkTexture(texture: THREE.Texture, maxSize = 512) {
  if (!texture || !texture.image) return;

  const img = texture.image as any;
  // Obter dimensões originais da imagem da textura
  const width = img.width || img.naturalWidth || 0;
  const height = img.height || img.naturalHeight || 0;

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

// ── IndexedDB Caching Helpers (ArrayBuffer) ──────────────────
function initIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    // Incrementado versão para 2 para forçar a limpeza de possíveis dados inválidos anteriores
    const request = indexedDB.open('freedom3d-assets-db', 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (db.objectStoreNames.contains('assets')) {
        db.deleteObjectStore('assets');
      }
      db.createObjectStore('assets');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getArrayBufferFromDB(db: IDBDatabase, key: string): Promise<ArrayBuffer | null> {
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction('assets', 'readonly');
      const store = transaction.objectStore('assets');
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

function saveArrayBufferToDB(db: IDBDatabase, key: string, buffer: ArrayBuffer): Promise<void> {
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction('assets', 'readwrite');
      const store = transaction.objectStore('assets');
      const request = store.put(buffer, key);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    } catch (e) {
      resolve();
    }
  });
}

const urlCache = new Map<string, string>();

async function getCachedUrl(src: string): Promise<string> {
  if (typeof window === 'undefined') return src;
  
  if (urlCache.has(src)) {
    return urlCache.get(src)!;
  }

  try {
    // Intercepta endpoints de assets (/api/asset/ ou /api/project/get-asset)
    const isAssetUrl = src.includes('/api/asset/') || src.includes('/api/project/get-asset');
    if (!isAssetUrl) {
      urlCache.set(src, src);
      return src;
    }

    // Tenta extrair um identificador único (nome do arquivo ou hash)
    let fileKey = '';
    if (src.includes('/api/asset/')) {
      fileKey = src.split('/api/asset/')[1]?.split('?')[0] || '';
    } else if (src.includes('/api/project/get-asset')) {
      const urlParams = new URL(src, window.location.href);
      const project = urlParams.searchParams.get('project') || '';
      const file = urlParams.searchParams.get('file') || '';
      fileKey = `${project}:${file}`;
    }

    if (!fileKey) {
      urlCache.set(src, src);
      return src;
    }

    const db = await initIndexedDB();
    const cachedBuffer = await getArrayBufferFromDB(db, fileKey);
    if (cachedBuffer) {
      // Valida se o buffer é um GLB ou GLTF válido (previne salvar tela de aviso do ngrok)
      const header = new Uint8Array(cachedBuffer.slice(0, 4));
      const magic = String.fromCharCode(header[0], header[1], header[2], header[3]);
      const isValid = magic === 'glTF' || magic.trim().startsWith('{');
      
      if (isValid) {
        const blob = new Blob([cachedBuffer], { type: 'model/gltf-binary' });
        const blobUrl = URL.createObjectURL(blob);
        urlCache.set(src, blobUrl);
        return blobUrl;
      } else {
        console.warn('[AssetCache] Cache inválido ou corrompido para', fileKey, '. Deletando...');
        try {
          const transaction = db.transaction('assets', 'readwrite');
          transaction.objectStore('assets').delete(fileKey);
        } catch (err) {}
      }
    }

    // Se não estiver no IndexedDB, baixa do servidor
    const res = await fetch(src);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    
    // Valida se o conteúdo baixado é um GLB ou GLTF válido antes de salvar
    const header = new Uint8Array(arrayBuffer.slice(0, 4));
    const magic = String.fromCharCode(header[0], header[1], header[2], header[3]);
    const isValid = magic === 'glTF' || magic.trim().startsWith('{');
    
    if (!isValid) {
      throw new Error('Retrieved content is not a valid GLTF/GLB file.');
    }

    await saveArrayBufferToDB(db, fileKey, arrayBuffer);
    
    const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' });
    const blobUrl = URL.createObjectURL(blob);
    urlCache.set(src, blobUrl);
    return blobUrl;
  } catch (e) {
    console.warn('[AssetCache] Fallback para URL original devido a erro:', e);
    urlCache.set(src, src);
    return src;
  }
}

export function GLTFMesh({ entity }: { entity: Entity }) {
  const model = entity.components.GLTFModel!;
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getCachedUrl(model.src).then((url) => {
      if (active) {
        setResolvedSrc(url);
      }
    });
    return () => {
      active = false;
    };
  }, [model.src]);

  if (!resolvedSrc) return null;

  return <GLTFMeshInner entity={entity} resolvedSrc={resolvedSrc} />;
}

function GLTFMeshInner({ entity, resolvedSrc }: { entity: Entity; resolvedSrc: string }) {
  const groupRef = useRef<THREE.Group>(null!);

  const {
    selectedEntityId,
    selectEntity,
    editorMode,
    isPlaying,
    updateComponent,
    snapEnabled,
    snapValue,
    activeViewport
  } = useEditorStore(useShallow(s => ({
    selectedEntityId: s.selectedEntityId,
    selectEntity: s.selectEntity,
    editorMode: s.editorMode,
    isPlaying: s.isPlaying,
    updateComponent: s.updateComponent,
    snapEnabled: s.snapEnabled,
    snapValue: s.snapValue,
    activeViewport: s.activeViewport
  })));

  const isGameView = activeViewport === 'game';
  const isStandalone = typeof window !== 'undefined' && window.location.pathname === '/preview';

  const transform = entity.components.Transform!;
  const model = entity.components.GLTFModel!;
  const rigidBody = entity.components.RigidBody;
  const isSelected = selectedEntityId === entity.id;

  // Drag detection: evita seleção acidental ao arrastar a câmera
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  const handlePointerDown = (e: any) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
  };
  const handlePointerUp = (e: any) => {
    if (isStandalone) return;
    if (!mouseDownPos.current) return;
    const dx = Math.abs(e.clientX - mouseDownPos.current.x);
    const dy = Math.abs(e.clientY - mouseDownPos.current.y);
    mouseDownPos.current = null;
    if (dx < 5 && dy < 5) {
      e.stopPropagation();
      selectEntity(entity.id);
    }
  };


  const gltf = useLoader(GLTFLoader, resolvedSrc);
  const clonedScene = useMemo(() => {
    const clone = gltf.scene.clone(true);

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
                // Limita texturas agressivamente em todas as plataformas (desktop e mobile) para evitar lag
                shrinkTexture(tex, 512);
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
      onPointerDown={isStandalone ? undefined : handlePointerDown}
      onPointerUp={isStandalone ? undefined : handlePointerUp}
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
          colliders={rigidBody.collider === 'trimesh' || rigidBody.collider === 'none' ? false : (rigidBody.collider || 'cuboid')}
        >
          {rigidBody.collider === 'trimesh' ? (
            <MeshCollider type="trimesh">
              <group scale={scale}>
                <primitive object={clonedScene} />
              </group>
            </MeshCollider>
          ) : (
            <group scale={scale}>
              <primitive object={clonedScene} />
            </group>
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


