import { useState, useEffect, useRef, Suspense, useContext } from 'react';
import type { ReactNode } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { TransformControls } from '@react-three/drei';
import { RigidBody, MeshCollider, CuboidCollider, BallCollider, CapsuleCollider, CylinderCollider, ConeCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useEngineStore, getEngineStore, checkIsStandalone } from '../runtime/runtimeStore';
import { EditorConfigContext } from './SceneView';
import { useShallow } from 'zustand/react/shallow';
import type { Entity } from '../../engine/ecs/types';

THREE.Cache.enabled = false;

if (typeof window !== 'undefined' && THREE.ImageBitmapLoader) {
  const originalImageBitmapLoaderLoad = THREE.ImageBitmapLoader.prototype.load;
  THREE.ImageBitmapLoader.prototype.load = function (
    url: string,
    onLoad?: (image: ImageBitmap) => void,
    onProgress?: (event: any) => void,
    onError?: (err: any) => void
  ) {
    const imageLoader = new THREE.ImageLoader(this.manager);
    if (this.crossOrigin) imageLoader.setCrossOrigin(this.crossOrigin);
    if (this.path) imageLoader.setPath(this.path);

    imageLoader.load(
      url,
      (image) => {
        createImageBitmap(image)
          .then((imageBitmap) => {
            if (onLoad) onLoad(imageBitmap);
          })
          .catch((err) => {
            console.warn('[ImageBitmapLoader Patch] Fallback para load original (erro ao criar ImageBitmap):', err);
            originalImageBitmapLoaderLoad.call(this, url, onLoad, onProgress, onError);
          });
      },
      onProgress,
      (err) => {
        console.warn('[ImageBitmapLoader Patch] Fallback para load original (erro ao carregar imagem):', err);
        originalImageBitmapLoaderLoad.call(this, url, onLoad, onProgress, onError);
      }
    );
  };
}

const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator.userAgent);
const modelCache = new Map<string, any>();
const pendingLoads = new Map<string, Promise<any>>();
// const EMPTY_ANIMATIONS: THREE.AnimationClip[] = [];
let loadQueue: Promise<any> = Promise.resolve();

export function clearModelCache() {
  modelCache.forEach((model) => {
    const scene = model.scene || model;
    scene.traverse((child: any) => {
      if (child.isMesh) {
        if (child.geometry) {
          try {
            child.geometry.dispose();
          } catch (e) {}
        }
        if (child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((mat: any) => {
            const textureKeys = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'];
            textureKeys.forEach((key) => {
              if (mat[key] && mat[key].isTexture) {
                try {
                  mat[key].dispose();
                } catch (e) {}
              }
            });
            try {
              mat.dispose();
            } catch (e) {}
          });
        }
      }
    });
  });
  modelCache.clear();
}

function sanitizeFBXUserData(object: THREE.Object3D) {
  object.traverse((child: any) => {
    if (child.userData) {
      delete child.userData.connections;
      delete child.userData.relations;
      for (const key in child.userData) {
        const val = child.userData[key];
        if (val && typeof val === 'object') {
          if (val.isObject3D || (val.parent && val.children)) {
            delete child.userData[key];
          }
        }
      }
    }
  });
}

function optimizeAnimations(animations: THREE.AnimationClip[]) {
  if (!animations) return;
  for (let i = 0; i < animations.length; i++) {
    const clip = animations[i];
    if (!clip || !clip.tracks) continue;
    
    clip.tracks = clip.tracks.filter(track => {
      if (track.name.endsWith('.scale')) {
        let isStaticOne = true;
        if (track.values) {
          for (let j = 0; j < track.values.length; j++) {
            if (Math.abs(track.values[j] - 1.0) > 0.01) {
              isStaticOne = false;
              break;
            }
          }
        }
        if (isStaticOne) return false;
      }
      return true;
    });

    (clip as any)._cacheKey = null;
  }
}

function stripAnimationsFromFBXBuffer(buffer: ArrayBuffer): ArrayBuffer {
  const view = new Uint8Array(buffer);
  const targets = [
    [65, 110, 105, 109, 97, 116, 105, 111, 110, 83, 116, 97, 99, 107], // AnimationStack
    [65, 110, 105, 109, 97, 116, 105, 111, 110, 76, 97, 121, 101, 114], // AnimationLayer
    [65, 110, 105, 109, 97, 116, 105, 111, 110, 67, 117, 114, 118, 101, 78, 111, 100, 101], // AnimationCurveNode
    [65, 110, 105, 109, 97, 116, 105, 111, 110, 67, 117, 114, 118, 101] // AnimationCurve
  ];
  
  for (let t = 0; t < targets.length; t++) {
    const bytes = targets[t];
    const len = bytes.length;
    
    for (let i = 0; i <= view.length - len; i++) {
      let match = true;
      for (let j = 0; j < len; j++) {
        if (view[i + j] !== bytes[j]) {
          match = false;
          break;
        }
      }
      
      if (match) {
        for (let j = 0; j < len; j++) {
          view[i + j] = 88;
        }
        i += len - 1;
      }
    }
  }
  return buffer;
}

async function loadModelAsync(src: string, isFbx: boolean): Promise<any> {
  if (modelCache.has(src)) {
    return modelCache.get(src);
  }
  if (pendingLoads.has(src)) {
    return pendingLoads.get(src);
  }

  const promise = (async () => {
    await loadQueue;

    if (isFbx) {
      try {
        const response = await fetch(src);
        let buffer = await response.arrayBuffer();
        
        if (isMobile) {
          console.log('[Mobile Safeguard] Limpando animações pesadas do binário FBX para evitar crash...');
          buffer = stripAnimationsFromFBXBuffer(buffer);
        }
        
        const loader = new FBXLoader(THREE.DefaultLoadingManager);
        const fbx = loader.parse(buffer, src);
        
        sanitizeFBXUserData(fbx);
        
        if (fbx.animations) {
          optimizeAnimations(fbx.animations);
        }
        
        shrinkModelTextures(fbx);
        
        modelCache.set(src, fbx);
        return fbx;
      } catch (err) {
        console.warn('[FBX Custom Parse] Falha no parse binário, tentando carregar via loadAsync tradicional:', err);
        const loader = new FBXLoader(THREE.DefaultLoadingManager);
        const fbx = await loader.loadAsync(src);
        
        sanitizeFBXUserData(fbx);
        if (fbx.animations) {
          optimizeAnimations(fbx.animations);
        }
        shrinkModelTextures(fbx);
        
        modelCache.set(src, fbx);
        return fbx;
      }
    } else {
      const loader = new GLTFLoader(THREE.DefaultLoadingManager);
      const gltf = await loader.loadAsync(src);
      
      if (gltf.animations) {
        optimizeAnimations(gltf.animations);
      }

      shrinkModelTextures(gltf.scene);
      
      modelCache.set(src, gltf);
      return gltf;
    }
  })();

  loadQueue = promise.then(() => {}, () => {});

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

      if (img && typeof img.close === 'function') {
        try {
          img.close();
        } catch (e) {
          console.warn('[Texture Shrink] Falha ao fechar ImageBitmap:', e);
        }
      }

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

function shrinkModelTextures(object: THREE.Object3D) {
  object.traverse((child: any) => {
    if (child.isMesh && child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((mat: any) => {
        const textureKeys = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'];
        textureKeys.forEach((key) => {
          if (mat[key] && mat[key].isTexture) {
            shrinkTexture(mat[key], 512);
          }
        });
      });
    }
  });
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
    isPlaying,
    updateComponent,
    activeViewport
  } = useEngineStore(useShallow(s => ({
    selectedEntityId: s.selectedEntityId,
    selectEntity: s.selectEntity,
    isPlaying: s.isPlaying,
    updateComponent: s.updateComponent,
    activeViewport: s.activeViewport
  })));

  const { editorMode, snapEnabled, snapValue } = useContext(EditorConfigContext);

  const isGameView = activeViewport === 'game';
  const isStandalone = checkIsStandalone();

  const transform = entity.components.Transform!;
  const model = entity.components.GLTFModel!;
  const rigidBody = entity.components.RigidBody;
  const isSelected = selectedEntityId === entity.id;
  const customCollider = entity.components.Collider as any;

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
  const [hasSkinnedMesh, setHasSkinnedMesh] = useState(false);
  const { gl: renderer } = useThree();

  useEffect(() => {
    if (loadedData?.scene) {
      let skinned = false;
      loadedData.scene.traverse((child: any) => {
        if ((child as any).isSkinnedMesh) skinned = true;
      });
      setHasSkinnedMesh(skinned);
    } else {
      setHasSkinnedMesh(false);
    }
  }, [loadedData]);

  useEffect(() => {
    let isMounted = true;

    const loadAndPrepare = async () => {
      if (!model.src) return;
      try {
        const rawModel = await loadModelAsync(model.src, isFbx);
        if (!isMounted) return;

        const rawScene = isFbx ? rawModel : rawModel.scene;
        const animations = rawModel.animations || [];

        const clone = SkeletonUtils.clone(rawScene);
        clone.userData.entityId = entity.id;

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
              });
            }
          }
        });

        if (isMounted) {
          setLoadedData({ scene: clone, animations });
        }
      } catch (err) {
        console.error('[UnifiedModelRender] Erro de carregamento:', model.src, err);
      }
    };

    loadAndPrepare();

    return () => {
      isMounted = false;
    };
  }, [model.src, isFbx]);

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

  useEffect(() => {
    if (!loadedData?.scene) return;
    const clonedScene = loadedData.scene;

    const getTextureUrl = (fileName: string) => {
      if (!fileName) return '';
      if (fileName.startsWith('/') || fileName.startsWith('http') || fileName.startsWith('blob:') || fileName.startsWith('data:')) {
        return fileName;
      }
      const sceneActive = getEngineStore().getState().scenes[getEngineStore().getState().activeSceneId];
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
                  
                  if (mat.map && mat.map.isTexture && (!mesh.userData.originalMaterial || mat.map !== mesh.userData.originalMaterial.map)) {
                    mat.map.dispose();
                  }

                  mat.map = tex;
                  mat.needsUpdate = true;
                });
              } else if (model.textureUrl === '') {
                if (mat.map && mat.map.isTexture && (!mesh.userData.originalMaterial || mat.map !== mesh.userData.originalMaterial.map)) {
                  mat.map.dispose();
                }
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

                  if (mat.normalMap && mat.normalMap.isTexture && (!mesh.userData.originalMaterial || mat.normalMap !== mesh.userData.originalMaterial.normalMap)) {
                    mat.normalMap.dispose();
                  }

                  mat.normalMap = tex;
                  if (typeof model.normalScale === 'number' && mat.normalScale) {
                    mat.normalScale.set(model.normalScale, model.normalScale);
                  }
                  mat.needsUpdate = true;
                });
              } else if (model.normalMapUrl === '') {
                if (mat.normalMap && mat.normalMap.isTexture && (!mesh.userData.originalMaterial || mat.normalMap !== mesh.userData.originalMaterial.normalMap)) {
                  mat.normalMap.dispose();
                }
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
  const [actions, setActions] = useState<Record<string, THREE.AnimationAction>>({});
  const [names, setNames] = useState<string[]>([]);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  useEffect(() => {
    if (!loadedData?.scene) {
      mixerRef.current = null;
      setActions({});
      setNames([]);
      return;
    }

    const scene = loadedData.scene;
    const animations = loadedData.animations || [];
    const mixer = new THREE.AnimationMixer(scene);
    mixerRef.current = mixer;

    const acts: Record<string, THREE.AnimationAction> = {};
    const clipNames: string[] = [];

    animations.forEach((clip) => {
      try {
        if (clip) {
          const action = mixer.clipAction(clip);
          if (action) {
            acts[clip.name] = action;
            clipNames.push(clip.name);
          }
        }
      } catch (err) {
        console.warn('[UnifiedModelRender] Erro ao carregar animação:', clip?.name, err);
      }
    });

    setActions(acts);
    setNames(clipNames);

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(scene);
      mixerRef.current = null;

      scene.traverse((child: any) => {
        if (child.isMesh) {
          if (child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((mat: any) => {
              const textureKeys = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'];
              textureKeys.forEach((key) => {
                if (mat[key] && mat[key].isTexture) {
                  const origMat = child.userData.originalMaterial;
                  if (!origMat || mat[key] !== origMat[key]) {
                    mat[key].dispose();
                  }
                }
              });
              mat.dispose();
            });
          }
        }
      });
    };
  }, [loadedData]);

  useFrame((_, delta) => {
    if (mixerRef.current) {
      try {
        const safeDelta = isNaN(delta) || delta < 0 || delta > 0.5 ? 0 : delta;
        mixerRef.current.update(safeDelta);
      } catch (err) {
        console.error('[UnifiedModelRender] Falha ao atualizar mixer de animações:', err);
      }
    }
  });

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
    if (!animator || !actions || Object.keys(actions).length === 0) return;
    
    try {
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
            try { a.stop(); } catch (e) {}
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
          try { a.fadeOut(0.3); } catch (e) {}
        }
      });

      if (action) {
        action.reset();
        action.paused = false;
        action.setLoop(targetLoop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
        action.timeScale = targetTimeScale;
        action.fadeIn(0.3).play();
      }
    } catch (err) {
      console.warn('[UnifiedModelRender] Falha ao setar clipe de animação ativo:', err);
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

  if (!loadedData) {
    return (
      <group
        ref={groupRef}
        position={pos}
        rotation={rot}
        scale={scale}
        userData={{ entityId: entity.id }}
      >
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#6366f1" wireframe transparent opacity={0.2} />
        </mesh>
        {children}
      </group>
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
      userData={{ entityId: entity.id }}
    >
      <primitive object={loadedData.scene} />

      {isSelected && (
        <mesh visible={false}>
          <boxGeometry />
          <meshBasicMaterial color="#44aaff" wireframe />
        </mesh>
      )}

      {customCollider && !isGameView && (
        <mesh position={customCollider.offset}>
          {customCollider.shape === 'cuboid' && <boxGeometry args={[customCollider.scale[0]*2, customCollider.scale[1]*2, customCollider.scale[2]*2]} />}
          {customCollider.shape === 'ball' && <sphereGeometry args={[customCollider.scale[0]]} />}
          {customCollider.shape === 'capsule' && <capsuleGeometry args={[customCollider.scale[0], customCollider.scale[1]*2, 4, 8]} />}
          {customCollider.shape === 'cylinder' && <cylinderGeometry args={[customCollider.scale[0], customCollider.scale[0], customCollider.scale[1]*2, 8]} />}
          {customCollider.shape === 'cone' && <coneGeometry args={[customCollider.scale[0], customCollider.scale[1]*2, 8]} />}
          <meshBasicMaterial wireframe color="#00ff00" transparent opacity={0.3} depthTest={false} />
        </mesh>
      )}

      {children}
    </group>
  );

  const renderSkinnedCollider = () => {
    const box = new THREE.Box3().setFromObject(loadedData.scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const hx = Math.max(size.x * 0.5 * scale[0], 0.1);
    const hy = Math.max(size.y * 0.5 * scale[1], 0.1);
    const hz = Math.max(size.z * 0.5 * scale[2], 0.1);

    return (
      <CuboidCollider 
        args={[hx, hy, hz]} 
        position={[center.x * scale[0], center.y * scale[1], center.z * scale[2]]} 
      />
    );
  };

  const renderCustomColliderPhysics = (entityScale: [number, number, number]) => {
    if (!customCollider) return null;
    const args: any = [];
    if (customCollider.shape === 'cuboid') {
      args.push(
        customCollider.scale[0] * entityScale[0],
        customCollider.scale[1] * entityScale[1],
        customCollider.scale[2] * entityScale[2]
      );
    }
    if (customCollider.shape === 'ball') {
      const maxScale = Math.max(entityScale[0], entityScale[1], entityScale[2]);
      args.push(customCollider.scale[0] * maxScale);
    }
    if (customCollider.shape === 'capsule') {
      const radiusScale = Math.max(entityScale[0], entityScale[2]);
      args.push(
        customCollider.scale[1] * entityScale[1],
        customCollider.scale[0] * radiusScale
      );
    }
    if (customCollider.shape === 'cylinder') {
      const radiusScale = Math.max(entityScale[0], entityScale[2]);
      args.push(
        customCollider.scale[1] * entityScale[1],
        customCollider.scale[0] * radiusScale
      );
    }
    if (customCollider.shape === 'cone') {
      const radiusScale = Math.max(entityScale[0], entityScale[2]);
      args.push(
        customCollider.scale[1] * entityScale[1],
        customCollider.scale[0] * radiusScale
      );
    }

    const scaledOffset: [number, number, number] = [
      customCollider.offset[0] * entityScale[0],
      customCollider.offset[1] * entityScale[1],
      customCollider.offset[2] * entityScale[2]
    ];

    const props = {
      args,
      position: scaledOffset,
      sensor: customCollider.isTrigger
    };

    if (customCollider.shape === 'cuboid') return <CuboidCollider {...props} />;
    if (customCollider.shape === 'ball') return <BallCollider {...props} />;
    if (customCollider.shape === 'capsule') return <CapsuleCollider {...props} />;
    if (customCollider.shape === 'cylinder') return <CylinderCollider {...props} />;
    if (customCollider.shape === 'cone') return <ConeCollider {...props} />;
    return null;
  };

  const collidersProp = hasSkinnedMesh ? false : (customCollider ? false : mapColliderType(rigidBody?.collider));

  return (
    <>
      {(rigidBody && isPlaying) ? (
        <RigidBody
          position={pos}
          rotation={rot}
          type={rigidBody.isStatic ? 'fixed' : (rigidBody.isKinematic ? 'kinematicPosition' : 'dynamic')}
          mass={rigidBody.mass}
          gravityScale={rigidBody.useGravity ? 1 : 0}
          linearDamping={rigidBody.drag ?? 0}
          angularDamping={rigidBody.angularDrag ?? 0.05}
          ccd={rigidBody.collisionDetection === 'continuous'}
          enabledTranslations={[
            !(rigidBody.freezePositionX ?? false),
            !(rigidBody.freezePositionY ?? false),
            !(rigidBody.freezePositionZ ?? false)
          ]}
          enabledRotations={[
            !(rigidBody.freezeRotationX ?? false),
            !(rigidBody.freezeRotationY ?? false),
            !(rigidBody.freezeRotationZ ?? false)
          ]}
          colliders={collidersProp}
        >
          {hasSkinnedMesh && renderSkinnedCollider()}

          {(!hasSkinnedMesh && rigidBody.collider === 'trimesh') ? (
            <MeshCollider type="trimesh">
              <group ref={groupRef} scale={scale} userData={{ entityId: entity.id }}>
                <primitive object={loadedData.scene} />
                {children}
              </group>
            </MeshCollider>
          ) : (
            <group ref={groupRef} scale={scale} userData={{ entityId: entity.id }}>
              <primitive object={loadedData.scene} />
              {children}
            </group>
          )}
          {customCollider && renderCustomColliderPhysics(scale)}
        </RigidBody>
      ) : (customCollider && isPlaying && !rigidBody) ? (
        <RigidBody type="fixed" colliders={false} position={pos} rotation={rot}>
          <group ref={groupRef} scale={scale} userData={{ entityId: entity.id }}>
            <primitive object={loadedData.scene} />
            {children}
          </group>
          {renderCustomColliderPhysics(scale)}
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

export function GLTFErrorFallback({ fileName }: { fileName: string }) {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#f54040" wireframe />
      <primitive object={new THREE.Object3D()} name={`missing:${fileName}`} />
    </mesh>
  );
}

export function GLTFViewers() {
  const scene = useEngineStore(s => s.scenes[s.activeSceneId]);
  const activeSceneId = useEngineStore(s => s.activeSceneId);

  useEffect(() => {
    return () => {
      clearModelCache();
    };
  }, [activeSceneId]);

  if (!scene) return null;

  return (
    <>
      {scene.rootEntityIds.map((id: string) => {
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
