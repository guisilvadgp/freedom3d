import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { TransformControls, useAnimations } from '@react-three/drei';
import { RigidBody, MeshCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useEditorStore } from '../store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import type { Entity } from '../../engine/ecs/types';

// Desabilitar cache interno do Three.js em memoria RAM para evitar duplicacao de buffers gigantes no JS.
// O cacheamento persistente e ultrarrapido ja e feito nativamente pelo Cache Storage no patch do fetch.
THREE.Cache.enabled = false;

// Cache global para evitar carregar e decodificar o mesmo arquivo múltiplas vezes
const modelCache = new Map<string, any>();
const pendingLoads = new Map<string, Promise<any>>();

async function loadModelAsync(src: string, isFbx: boolean): Promise<any> {
  if (modelCache.has(src)) {
    return modelCache.get(src);
  }
  if (pendingLoads.has(src)) {
    return pendingLoads.get(src);
  }

  const promise = (async () => {
    if (isFbx) {
      const loader = new FBXLoader(THREE.DefaultLoadingManager);
      const fbx = await loader.loadAsync(src);
      modelCache.set(src, fbx);
      return fbx;
    } else {
      const loader = new GLTFLoader(THREE.DefaultLoadingManager);
      const gltf = await loader.loadAsync(src);
      modelCache.set(src, gltf);
      return gltf;
    }
  })();

  pendingLoads.set(src, promise);
  try {
    return await promise;
  } finally {
    pendingLoads.delete(src);
  }
}

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

const mapColliderType = (type: string | undefined): 'cuboid' | 'ball' | 'hull' | 'trimesh' | false => {
  if (!type || type === 'none') return false;
  const t = type.toLowerCase();
  if (t === 'cuboid' || t === 'box') return 'cuboid';
  if (t === 'ball' || t === 'sphere') return 'ball';
  if (t === 'trimesh') return false;
  if (t === 'hull' || t === 'cylinder' || t === 'capsule') return 'hull';
  return 'cuboid';
};

export function UnifiedModelRender({ entity, isFbx, children }: { entity: Entity; isFbx: boolean; children?: ReactNode }) {
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

  const [loadedData, setLoadedData] = useState<{ scene: THREE.Group | THREE.Object3D; animations: THREE.AnimationClip[] } | null>(null);
  const { gl: renderer, camera } = useThree();

  // 1. Carregamento Assíncrono do Modelo e Compilação GPU em Background
  useEffect(() => {
    let isMounted = true;

    const loadAndCompile = async () => {
      if (!model.src) return;
      try {
        const rawModel = await loadModelAsync(model.src, isFbx);
        if (!isMounted) return;

        const rawScene = isFbx ? rawModel : rawModel.scene;
        const animations = rawModel.animations || [];

        // Clona a cena original para isolar esta instância
        const clone = SkeletonUtils.clone(rawScene);

        // Aplica configurações iniciais e reduz texturas
        clone.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = model.castShadow;
            child.receiveShadow = model.receiveShadow;

            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material = child.material.map((mat: any) => mat.clone());
              } else {
                child.material = child.material.clone();
              }

              const materials = Array.isArray(child.material) ? child.material : [child.material];
              materials.forEach((mat: any) => {
                if (!child.userData.originalMaterial) {
                  child.userData.originalMaterial = mat;
                }
                if (!child.userData.originalColor && mat.color) {
                  child.userData.originalColor = mat.color.clone();
                }
                const textureKeys = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'];
                textureKeys.forEach((key) => {
                  if (mat[key] && mat[key].isTexture) {
                    shrinkTexture(mat[key], 512);
                  }
                });
              });
            }
          }
        });

        // Pré-compilação e upload assíncrono para a GPU de todas as texturas e shaders
        // Isso evita que a thread principal trave ao instanciar o modelo 3D
        await renderer.compileAsync(clone, camera);

        if (isMounted) {
          setLoadedData({ scene: clone, animations });
        }
      } catch (err) {
        console.error('[UnifiedModelRender] Erro de carregamento/compilação:', model.src, err);
      }
    };

    loadAndCompile();

    return () => {
      isMounted = false;
    };
  }, [model.src, isFbx, renderer, camera]);

  // 2. Atualiza sombras de forma reativa sem recarregar/recompilar o modelo inteiro
  useEffect(() => {
    if (loadedData?.scene) {
      loadedData.scene.traverse((child: any) => {
        if (child.isMesh) {
          child.castShadow = model.castShadow;
          child.receiveShadow = model.receiveShadow;
        }
      });
    }
  }, [loadedData, model.castShadow, model.receiveShadow]);

  // 3. Efeito reativo para modificar materiais e texturas do clone em tempo real sem clonar a cena inteira novamente
  useEffect(() => {
    if (!loadedData?.scene) return;
    const clonedScene = loadedData.scene;

    const getTextureUrl = (fileName: string) => {
      if (!fileName) return '';
      if (fileName.startsWith('/') || fileName.startsWith('http') || fileName.startsWith('blob:') || fileName.startsWith('data:')) {
        return fileName;
      }
      const sceneActive = useEditorStore.getState().scenes[useEditorStore.getState().activeSceneId];
      const projectName = sceneActive?.name || 'default';
      
      if (isStandalone) {
        const isOffline = (window as any).__freedom3d_standalone__;
        return isOffline ? './assets/' + fileName : `/api/asset/${encodeURIComponent(fileName)}`;
      }
      
      return `/api/project/get-asset?project=${encodeURIComponent(projectName)}&file=${encodeURIComponent(fileName)}`;
    };

    clonedScene.traverse((child: any) => {
      if (child.isMesh) {
        const mesh = child as THREE.Mesh;
        
        if (mesh.material) {
          let materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          
          const newMaterials = materials.map((origMat: any) => {
            let mat = origMat;
            
            if (model.overrideMaterial && model.overrideMaterial !== 'none') {
              const cacheKey = `overrideMaterial_${model.overrideMaterial}`;
              if (!mesh.userData[cacheKey]) {
                let newMat;
                switch (model.overrideMaterial) {
                  case 'basic':
                    newMat = new THREE.MeshBasicMaterial();
                    break;
                  case 'phong':
                    newMat = new THREE.MeshPhongMaterial();
                    break;
                  case 'emissive':
                    newMat = new THREE.MeshStandardMaterial({
                      emissive: new THREE.Color('#ffffff'),
                      emissiveIntensity: 1.0
                    });
                    break;
                  case 'standard':
                  default:
                    newMat = new THREE.MeshStandardMaterial();
                    break;
                }
                newMat.name = 'orion-override-material';
                mesh.userData[cacheKey] = newMat;
              }
              mat = mesh.userData[cacheKey];

              if (model.color) {
                if (mat.color) mat.color.set(model.color);
              }

              if (typeof model.roughness === 'number') {
                if ('roughness' in mat) mat.roughness = model.roughness;
              }
              if (typeof model.metalness === 'number') {
                if ('metalness' in mat) mat.metalness = model.metalness;
              }

              if (model.textureUrl) {
                const texUrl = getTextureUrl(model.textureUrl);
                new THREE.TextureLoader().load(texUrl, (tex) => {
                  tex.wrapS = THREE.RepeatWrapping;
                  tex.wrapT = THREE.RepeatWrapping;
                  shrinkTexture(tex, 512);
                  if (renderer.initTexture) renderer.initTexture(tex);
                  mat.map = tex;
                  mat.needsUpdate = true;
                });
              } else if (model.textureUrl === '') {
                mat.map = null;
                mat.needsUpdate = true;
              }

              if (model.normalMapUrl) {
                const normUrl = getTextureUrl(model.normalMapUrl);
                new THREE.TextureLoader().load(normUrl, (tex) => {
                  tex.wrapS = THREE.RepeatWrapping;
                  tex.wrapT = THREE.RepeatWrapping;
                  shrinkTexture(tex, 512);
                  if (renderer.initTexture) renderer.initTexture(tex);
                  mat.normalMap = tex;
                  if (typeof model.normalScale === 'number' && mat.normalScale) {
                    mat.normalScale.set(model.normalScale, model.normalScale);
                  }
                  mat.needsUpdate = true;
                });
              } else if (model.normalMapUrl === '') {
                mat.normalMap = null;
                mat.needsUpdate = true;
              }
            } else {
              mat = mesh.userData.originalMaterial || origMat;

              if (model.color && mat.color) {
                if (model.color.toLowerCase() === '#ffffff') {
                  if (mesh.userData.originalColor) {
                    mat.color.copy(mesh.userData.originalColor);
                  } else {
                    mat.color.set('#ffffff');
                  }
                } else {
                  mat.color.set(model.color);
                }
              }

              if (typeof model.roughness === 'number') {
                if ('roughness' in mat) mat.roughness = model.roughness;
              }
              if (typeof model.metalness === 'number') {
                if ('metalness' in mat) mat.metalness = model.metalness;
              }

              if (model.textureUrl) {
                const texUrl = getTextureUrl(model.textureUrl);
                new THREE.TextureLoader().load(texUrl, (tex) => {
                  tex.wrapS = THREE.RepeatWrapping;
                  tex.wrapT = THREE.RepeatWrapping;
                  shrinkTexture(tex, 512);
                  if (renderer.initTexture) renderer.initTexture(tex);
                  mat.map = tex;
                  mat.needsUpdate = true;
                });
              } else {
                if (mesh.userData.originalMaterial) {
                  mat.map = mesh.userData.originalMaterial.map;
                }
              }

              if (model.normalMapUrl) {
                const normUrl = getTextureUrl(model.normalMapUrl);
                new THREE.TextureLoader().load(normUrl, (tex) => {
                  tex.wrapS = THREE.RepeatWrapping;
                  tex.wrapT = THREE.RepeatWrapping;
                  shrinkTexture(tex, 512);
                  if (renderer.initTexture) renderer.initTexture(tex);
                  mat.normalMap = tex;
                  if (typeof model.normalScale === 'number' && mat.normalScale) {
                    mat.normalScale.set(model.normalScale, model.normalScale);
                  }
                  mat.needsUpdate = true;
                });
              } else {
                if (mesh.userData.originalMaterial) {
                  mat.normalMap = mesh.userData.originalMaterial.normalMap;
                }
              }
            }

            mat.needsUpdate = true;
            return mat;
          });

          mesh.material = Array.isArray(mesh.material) ? newMaterials : newMaterials[0];
        }
      }
    });
  }, [loadedData, model.color, model.roughness, model.metalness, model.overrideMaterial, model.textureUrl, model.normalMapUrl, model.normalScale, isStandalone, renderer]);

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
  const { ref: animRef, actions, names } = useAnimations(loadedData?.animations || [], groupRef);

  useEffect(() => {
    if (animator && names && names.length > 0) {
      const currentList = animator.animationsList || [];
      const hasChanged = names.length !== currentList.length || !names.every((n, i) => n === currentList[i]);
      if (hasChanged) {
        updateComponent(entity.id, 'Animator', {
          animationsList: names
        });
      }
    }
  }, [names, animator, entity.id]);

  useEffect(() => {
    if (!animator || !actions) return;
    
    let targetClipName = animator.currentAnimation;
    let targetLoop = animator.loop;
    let targetTimeScale = animator.timeScale;

    if (animator.currentState && animator.states && animator.states[animator.currentState]) {
      const activeState = animator.states[animator.currentState];
      targetClipName = activeState.clipName;
      targetLoop = activeState.loop;
      targetTimeScale = activeState.timeScale;
    }

    if (!isPlaying) {
      Object.keys(actions).forEach(key => {
        const a = actions[key];
        if (a && key !== targetClipName) {
          a.stop();
        }
      });

      const action = actions[targetClipName];
      if (action) {
        action.reset();
        action.paused = true;
        action.time = 0;
        action.play();
      }
      return;
    }

    const action = actions[targetClipName];

    Object.keys(actions).forEach(key => {
      const a = actions[key];
      if (a && key !== targetClipName) {
        a.fadeOut(0.3);
      }
    });

    if (action) {
      action.reset();
      action.paused = false;
      action.setLoop(targetLoop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      action.timeScale = targetTimeScale;
      action.fadeIn(0.3).play();
    }
  }, [
    animator?.currentAnimation, 
    animator?.loop, 
    animator?.timeScale, 
    animator?.currentState,
    JSON.stringify(animator?.states),
    actions, 
    isPlaying
  ]);

  // Se os dados do modelo ainda não foram carregados e compilados, renderiza o placeholder
  if (!loadedData) {
    return (
      <mesh position={pos} rotation={rot} scale={scale}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#6366f1" wireframe transparent opacity={0.2} />
      </mesh>
    );
  }

  const group = (
    <group
      ref={groupRef}
      position={pos}
      rotation={rot}
      scale={scale}
      onPointerDown={isStandalone ? undefined : handlePointerDown}
      onPointerUp={isStandalone ? undefined : handlePointerUp}
    >
      <primitive ref={animRef} object={loadedData.scene} />

      {isSelected && (
        <mesh visible={false}>
          <boxGeometry />
          <meshBasicMaterial color="#44aaff" wireframe />
        </mesh>
      )}

      {children}
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
          colliders={mapColliderType(rigidBody.collider)}
        >
          {rigidBody.collider === 'trimesh' ? (
            <MeshCollider type="trimesh">
              <group ref={groupRef} scale={scale}>
                <primitive ref={animRef} object={loadedData.scene} />
                {children}
              </group>
            </MeshCollider>
          ) : (
            <group ref={groupRef} scale={scale}>
              <primitive ref={animRef} object={loadedData.scene} />
              {children}
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

export function GLTFModelRender({ entity, children }: { entity: Entity; children?: ReactNode }) {
  return <UnifiedModelRender entity={entity} isFbx={false} children={children} />;
}

export function FBXModelRender({ entity, children }: { entity: Entity; children?: ReactNode }) {
  return <UnifiedModelRender entity={entity} isFbx={true} children={children} />;
}

export function GLTFMesh({ entity, children }: { entity: Entity; children?: ReactNode }) {
  const model = entity.components.GLTFModel!;
  const isFbx = (model.fileName || model.src || '').toLowerCase().split('?')[0].endsWith('.fbx');

  if (isFbx) {
    return <FBXModelRender entity={entity} children={children} />;
  } else {
    return <GLTFModelRender entity={entity} children={children} />;
  }
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
