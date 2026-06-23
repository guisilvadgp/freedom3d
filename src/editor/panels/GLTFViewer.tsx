import { Suspense, useMemo, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { TransformControls, useAnimations, useFBX } from '@react-three/drei';
import { RigidBody, MeshCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useEditorStore } from '../store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import type { Entity } from '../../engine/ecs/types';

// ── Um modelo GLTF carregado ─────────────────────────────────

// Desabilitar cache interno do Three.js em memoria RAM para evitar duplicacao de buffers gigantes no JS.
// O cacheamento persistente e ultrarrapido ja e feito nativamente pelo Cache Storage no patch do fetch.
THREE.Cache.enabled = false;

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

export function GLTFModelRender({ entity, children }: { entity: Entity; children?: ReactNode }) {
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


  const gltf = useLoader(GLTFLoader, model.src);
  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(gltf.scene);

    // Aplicar shadow em todos os meshes internos e otimizar texturas no mobile/desktop para economizar VRAM
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = model.castShadow;
        mesh.receiveShadow = model.receiveShadow;

        // Otimização de texturas por meio do redimensionamento dinâmico
        if (mesh.material) {
          // Clona os materiais para isolar a instância e permitir customizações individuais sem afetar o cache
          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map((mat) => mat.clone());
          } else {
            mesh.material = mesh.material.clone();
          }

          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((mat: any) => {
            // Salva o material original
            if (!mesh.userData.originalMaterial) {
              mesh.userData.originalMaterial = mat;
            }
            if (!mesh.userData.originalColor && mat.color) {
              mesh.userData.originalColor = mat.color.clone();
            }
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

  // Efeito reativo para modificar materiais e texturas do clone em tempo real sem clonar a cena inteira novamente
  useEffect(() => {
    if (!clonedScene) return;

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

    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        
        if (mesh.material) {
          let materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          
          const newMaterials = materials.map((origMat: any) => {
            let mat = origMat;
            
            // Se o usuário optou por um material de override diferente de 'none'
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

              // Aplica cor (albedo)
              if (model.color) {
                if (mat.color) mat.color.set(model.color);
              }

              // Rugosidade e Metal
              if (typeof model.roughness === 'number') {
                if ('roughness' in mat) mat.roughness = model.roughness;
              }
              if (typeof model.metalness === 'number') {
                if ('metalness' in mat) mat.metalness = model.metalness;
              }

              // Carrega e atribui mapa de albedo (textura)
              if (model.textureUrl) {
                const texUrl = getTextureUrl(model.textureUrl);
                new THREE.TextureLoader().load(texUrl, (tex) => {
                  tex.wrapS = THREE.RepeatWrapping;
                  tex.wrapT = THREE.RepeatWrapping;
                  shrinkTexture(tex, 512); // Otimização
                  mat.map = tex;
                  mat.needsUpdate = true;
                });
              } else if (model.textureUrl === '') {
                mat.map = null;
                mat.needsUpdate = true;
              }

              // Carrega e atribui mapa de normais
              if (model.normalMapUrl) {
                const normUrl = getTextureUrl(model.normalMapUrl);
                new THREE.TextureLoader().load(normUrl, (tex) => {
                  tex.wrapS = THREE.RepeatWrapping;
                  tex.wrapT = THREE.RepeatWrapping;
                  shrinkTexture(tex, 512);
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
              // Se voltou para 'none', restaura o material original do GLTF
              mat = mesh.userData.originalMaterial || origMat;

              // Aplica coloração no material original (multiplica pela textura)
              if (model.color && mat.color) {
                if (model.color.toLowerCase() === '#ffffff') {
                  // Se a cor for o branco padrão, restaura a cor original do GLB
                  if (mesh.userData.originalColor) {
                    mat.color.copy(mesh.userData.originalColor);
                  } else {
                    mat.color.set('#ffffff');
                  }
                } else {
                  // Caso contrário, tingi o material com a cor customizada
                  mat.color.set(model.color);
                }
              }

              // Rugosidade e Metal no material original do GLTF
              if (typeof model.roughness === 'number') {
                if ('roughness' in mat) mat.roughness = model.roughness;
              }
              if (typeof model.metalness === 'number') {
                if ('metalness' in mat) mat.metalness = model.metalness;
              }

              // No material original, só aplicamos textura customizada se o usuário especificou uma
              if (model.textureUrl) {
                const texUrl = getTextureUrl(model.textureUrl);
                new THREE.TextureLoader().load(texUrl, (tex) => {
                  tex.wrapS = THREE.RepeatWrapping;
                  tex.wrapT = THREE.RepeatWrapping;
                  shrinkTexture(tex, 512);
                  mat.map = tex;
                  mat.needsUpdate = true;
                });
              } else {
                // Se textureUrl for vazia ou nula, garante que a textura original do GLTF seja mantida
                if (mesh.userData.originalMaterial) {
                  mat.map = mesh.userData.originalMaterial.map;
                }
              }

              // Só aplicamos normal map customizado se o usuário especificou um
              if (model.normalMapUrl) {
                const normUrl = getTextureUrl(model.normalMapUrl);
                new THREE.TextureLoader().load(normUrl, (tex) => {
                  tex.wrapS = THREE.RepeatWrapping;
                  tex.wrapT = THREE.RepeatWrapping;
                  shrinkTexture(tex, 512);
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
  }, [clonedScene, model.color, model.roughness, model.metalness, model.overrideMaterial, model.textureUrl, model.normalMapUrl, model.normalScale]);

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
  const { ref: animRef, actions, names } = useAnimations(gltf.animations);

  // Sincroniza a lista de animações encontradas no GLTF com o AnimatorComponent
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

  // Lógica do Animator (incluindo State Machine e Transições Suaves)
  useEffect(() => {
    if (!animator || !actions) return;
    
    if (!isPlaying) {
      Object.keys(actions).forEach(key => {
        const a = actions[key];
        if (a) {
          a.stop();
        }
      });
      return;
    }

    // Determinar qual clipe tocar e suas propriedades
    let targetClipName = animator.currentAnimation;
    let targetLoop = animator.loop;
    let targetTimeScale = animator.timeScale;

    // Se houver um estado ativo válido, ele sobrescreve o clipe padrão
    if (animator.currentState && animator.states && animator.states[animator.currentState]) {
      const activeState = animator.states[animator.currentState];
      targetClipName = activeState.clipName;
      targetLoop = activeState.loop;
      targetTimeScale = activeState.timeScale;
    }

    const action = actions[targetClipName];

    // Para todos os outros clipes que estão rodando, faz um fadeOut suave
    Object.keys(actions).forEach(key => {
      const a = actions[key];
      if (a && key !== targetClipName) {
        a.fadeOut(0.3);
      }
    });

    if (action) {
      action.reset();
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
      <primitive ref={animRef} object={clonedScene} />

      {/* Selection highlight */}
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
                <primitive ref={animRef} object={clonedScene} />
                {children}
              </group>
            </MeshCollider>
          ) : (
            <group ref={groupRef} scale={scale}>
              <primitive ref={animRef} object={clonedScene} />
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

export function FBXModelRender({ entity, children }: { entity: Entity; children?: ReactNode }) {
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

  const fbx = useFBX(model.src);
  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(fbx);

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = model.castShadow;
        mesh.receiveShadow = model.receiveShadow;

        if (mesh.material) {
          // Clona os materiais para isolar a instância e permitir customizações individuais sem afetar o cache
          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map((mat) => mat.clone());
          } else {
            mesh.material = mesh.material.clone();
          }

          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((mat: any) => {
            if (!mesh.userData.originalMaterial) {
              mesh.userData.originalMaterial = mat;
            }
            if (!mesh.userData.originalColor && mat.color) {
              mesh.userData.originalColor = mat.color.clone();
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
    return clone;
  }, [fbx, model.castShadow, model.receiveShadow, isStandalone]);

  useEffect(() => {
    if (!clonedScene) return;

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

    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
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
  }, [clonedScene, model.color, model.roughness, model.metalness, model.overrideMaterial, model.textureUrl, model.normalMapUrl, model.normalScale]);

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
  const { ref: animRef, actions, names } = useAnimations(fbx.animations);

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
    
    if (!isPlaying) {
      Object.keys(actions).forEach(key => {
        const a = actions[key];
        if (a) {
          a.stop();
        }
      });
      return;
    }

    let targetClipName = animator.currentAnimation;
    let targetLoop = animator.loop;
    let targetTimeScale = animator.timeScale;

    if (animator.currentState && animator.states && animator.states[animator.currentState]) {
      const activeState = animator.states[animator.currentState];
      targetClipName = activeState.clipName;
      targetLoop = activeState.loop;
      targetTimeScale = activeState.timeScale;
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

  const group = (
    <group
      ref={groupRef}
      position={pos}
      rotation={rot}
      scale={scale}
      onPointerDown={isStandalone ? undefined : handlePointerDown}
      onPointerUp={isStandalone ? undefined : handlePointerUp}
    >
      <primitive ref={animRef} object={clonedScene} />

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
                <primitive ref={animRef} object={clonedScene} />
                {children}
              </group>
            </MeshCollider>
          ) : (
            <group ref={groupRef} scale={scale}>
              <primitive ref={animRef} object={clonedScene} />
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


