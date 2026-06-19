import { XROrigin } from '@react-three/xr';
import { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { TransformControls, Edges, PositionalAudio, Sparkles, PerspectiveCamera } from '@react-three/drei';
import { RigidBody, MeshCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useEditorStore } from '../store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import type { Entity } from '../../engine/ecs/types';
import { attemptTeleport } from './SceneView';

// ── Perspective Camera Wrapper ──────────────────────────────
// Updates position and rotation on every frame (60fps) directly in Three.js
// avoiding React re-renders while keeping script mutations synchronized.
// Cache global de anéis de teleporte — evita scene.traverse() a cada frame
const _teleportRingCache = new Map<string, THREE.Object3D[]>();
let _teleportRingCacheKey = '';

function getTeleportRings(scene: THREE.Scene, sceneKey: string): THREE.Object3D[] {
  if (_teleportRingCacheKey === sceneKey && _teleportRingCache.has(sceneKey)) {
    return _teleportRingCache.get(sceneKey)!;
  }
  const rings: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (o.userData?.isTeleportRing) rings.push(o);
  });
  _teleportRingCache.set(sceneKey, rings);
  _teleportRingCacheKey = sceneKey;
  return rings;
}

// Invalida o cache quando a cena mudar (chamado externamente)
export function invalidateTeleportRingCache() {
  _teleportRingCacheKey = '';
}

function PerspectiveCameraWrapper({ entity, camera, isGameView, isStandalone }: { entity: Entity; camera: any; isGameView: boolean; isStandalone: boolean }) {
  const ref = useRef<THREE.PerspectiveCamera>(null);
  const [initialHeadsetHeight, setInitialHeadsetHeight] = useState<number | null>(null);

  const { gl, scene, camera: defaultCamera } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const hoveredRing = useRef<any>(null);
  const crosshairRef = useRef<THREE.Mesh>(null);
  const sceneActiveId = useEditorStore(s => s.activeSceneId);

  // Seletores reativos via ref para evitar getState() por frame
  const rigidBodyRefs = useEditorStore(s => s.rigidBodyRefs);
  const rigidBodyRefsRef = useRef(rigidBodyRefs);
  rigidBodyRefsRef.current = rigidBodyRefs;

  const updateComponent = useEditorStore(s => s.updateComponent);
  const updateComponentRef = useRef(updateComponent);
  updateComponentRef.current = updateComponent;

  // Cache de vetores para evitar garbage collection a 60fps
  const forwardVec = useRef(new THREE.Vector3());
  const rightVec = useRef(new THREE.Vector3());
  const moveVec = useRef(new THREE.Vector3());

  // Rastreamento local da rotação Y
  const currentRotationY = useRef(entity.components.Transform?.rotation?.[1] || 0);
  useEffect(() => {
    currentRotationY.current = entity.components.Transform?.rotation?.[1] || 0;
  }, [entity.id]);

  // Timestamps para throttling
  const lastRotationUpdate = useRef(0);
  const lastPositionUpdate = useRef(0);
  const handleSelectRef = useRef<() => void>(null!);
  const lastTriggerPressed = useRef(false);
  const gazeDirectionRef = useRef(new THREE.Vector3(0, 0, -1));
  const gazeOriginRef = useRef(new THREE.Vector3(0, 0, 0));

  // Setup WebXR "Tap" Event
  useEffect(() => {
    if (!isStandalone) return;
    const xr = gl.xr;
    let session: any = null;

    const handleSelect = () => {
      // Usa a direção e origem sincronizadas no loop principal (useFrame)
      raycaster.current.ray.origin.copy(gazeOriginRef.current);
      raycaster.current.ray.direction.copy(gazeDirectionRef.current);

      // Usa cache de anéis para evitar intersectObjects em toda a cena
      const rings = getTeleportRings(scene as any, sceneActiveId);
      const intersects = raycaster.current.intersectObjects(rings, false);
      const hit = intersects.find(i => i.object.userData?.isTeleportRing);
      if (hit && hit.object.userData.onClick) {
        hit.object.userData.onClick({ stopPropagation: () => { } });
        return;
      }

      // Se não clicou em um anel, move o jogador para frente (apenas na horizontal XZ) na direção do olhar
      const forward = gazeDirectionRef.current.clone();
      forward.y = 0; // Mantém no plano do chão (apenas movimento horizontal)
      forward.normalize();

      const stepDistance = 1.5; // Distância do passo em metros
      const moveStep = forward.multiplyScalar(stepDistance);

      const storeState = useEditorStore.getState();
      const currentScene = storeState.activeScene();
      Object.values(currentScene.entities).forEach(e => {
        if (e.tags?.includes('player') || e.components.Camera?.isMain) {
          const rb = storeState.rigidBodyRefs[e.id];
          let currentPos = e.components.Transform?.position || [0, 0, 0];
          if (rb) {
            const trans = rb.translation();
            currentPos = [trans.x, trans.y, trans.z];
          }

          const targetPos: [number, number, number] = [
            currentPos[0] + moveStep.x,
            currentPos[1],
            currentPos[2] + moveStep.z
          ];

          storeState.updateComponent(e.id, 'Transform', {
            position: targetPos,
          });

          if (rb) {
            rb.setTranslation({ x: targetPos[0], y: targetPos[1], z: targetPos[2] }, true);
            rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
            rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
          }
        }
      });
    };

    handleSelectRef.current = handleSelect;

    const onSessionStart = () => {
      session = xr.getSession();
      if (session) session.addEventListener('select', handleSelect);
    };

    const onSessionEnd = () => {
      if (session) session.removeEventListener('select', handleSelect);
      session = null;
    };

    xr.addEventListener('sessionstart', onSessionStart);
    xr.addEventListener('sessionend', onSessionEnd);

    return () => {
      xr.removeEventListener('sessionstart', onSessionStart);
      xr.removeEventListener('sessionend', onSessionEnd);
      if (session) session.removeEventListener('select', handleSelect);
    };
  }, [gl, scene, defaultCamera, isStandalone, sceneActiveId]);

  useFrame((state, delta) => {
    if (ref.current && camera) {
      if (camera.offset) {
        ref.current.position.set(camera.offset[0], camera.offset[1], camera.offset[2]);
      }
      if (camera.rotation) {
        ref.current.rotation.set(camera.rotation[0], camera.rotation[1], camera.rotation[2]);
      }
    }

    if (state.gl.xr.isPresenting) {
      if (typeof window !== 'undefined') {
        (window as any).isVRActive = true;
      }

      const xrCamera = (state.gl.xr as any).getCamera(state.camera);
      const subCam = xrCamera.cameras?.[0] || xrCamera;
      
      const subCamPos = new THREE.Vector3();
      const subCamQuat = new THREE.Quaternion();
      const subCamScale = new THREE.Vector3();
      if (subCam) {
        subCam.matrixWorld.decompose(subCamPos, subCamQuat, subCamScale);
      }

      if (subCam && initialHeadsetHeight === null) {
        const y = subCamPos.y;
        if (y > 0.1) {
          setInitialHeadsetHeight(y);
        }
      }

      // Sincroniza a posição e direção do olhar a cada frame
      if (subCam) {
        gazeOriginRef.current.copy(subCamPos);
        const e = subCam.matrixWorld.elements;
        gazeDirectionRef.current.set(-e[8], -e[9], -e[10]).normalize();
      }

      // VR Gaze (Hovering) — throttle a 10 frames/s e usa cache de rings
      if (isStandalone) {
        const now = performance.now();
        const lastRaycast = (raycaster.current as any).lastTime || 0;

        if (now - lastRaycast > 100) { // Throttle: 10fps é suficiente para hover de anéis
          (raycaster.current as any).lastTime = now;
          raycaster.current.ray.origin.copy(gazeOriginRef.current);
          raycaster.current.ray.direction.copy(gazeDirectionRef.current);

          // Cache de anéis — sem traverse toda frame!
          const rings = getTeleportRings(state.scene as any, sceneActiveId);
          const intersects = raycaster.current.intersectObjects(rings, false);
          const hit = intersects[0];
          if (hit) {
            if (hoveredRing.current !== hit.object) {
              if (hoveredRing.current?.userData.setHovered) hoveredRing.current.userData.setHovered(false);
              hoveredRing.current = hit.object;
              if (hoveredRing.current?.userData.setHovered) hoveredRing.current.userData.setHovered(true);
            }
          } else {
            if (hoveredRing.current) {
              if (hoveredRing.current.userData.setHovered) hoveredRing.current.userData.setHovered(false);
              hoveredRing.current = null;
            }
          }
        }

        // Atualizar a posicao do crosshair para grudar no rosto do jogador usando a pose sincronizada
        if (crosshairRef.current && subCam) {
          crosshairRef.current.position.copy(subCamPos);
          crosshairRef.current.quaternion.copy(subCamQuat);
          crosshairRef.current.translateZ(-1.5);
        }
      }

      // VR Locomotion (Smooth movement + turning)
      const session = state.gl.xr.getSession();
      if (session) {
        let moveX = 0;
        let moveZ = 0;
        let turnX = 0;

        for (const source of session.inputSources) {
          if (source.gamepad) {
            const axes = source.gamepad.axes;
            if (source.handedness === 'left') {
              if (axes.length >= 4) {
                moveX = axes[2];
                moveZ = axes[3];
              }
            } else if (source.handedness === 'right') {
              if (axes.length >= 4) {
                turnX = axes[2];
              }
            }
          }
        }

        // Lê a configuração salva do gamepad Bluetooth (VRBox)
        const configStr = typeof window !== 'undefined' ? localStorage.getItem('freedom3d_gamepad_config') : null;
        const config = configStr ? JSON.parse(configStr) : {
          triggerButton: 0,
          moveAxisX: 0,
          moveAxisY: 1,
          invertX: false,
          invertY: false,
          buttonA: 0,
          buttonB: 1,
          buttonC: 2,
          buttonD: 3
        };

        const gamepads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
        let extTriggerPressed = false;

        for (const gp of gamepads) {
          if (gp && gp.connected) {
            if (gp.axes.length > Math.max(config.moveAxisX, config.moveAxisY)) {
              const gpX = gp.axes[config.moveAxisX];
              const gpY = gp.axes[config.moveAxisY];
              const finalX = config.invertX ? -gpX : gpX;
              const finalY = config.invertY ? -gpY : gpY;
              if (Math.abs(finalX) > 0.05) moveX = finalX;
              if (Math.abs(finalY) > 0.05) moveZ = finalY;
            }

            if (gp.buttons.length > config.triggerButton) {
              const btn = gp.buttons[config.triggerButton];
              if (btn.pressed || btn.value > 0.5) {
                extTriggerPressed = true;
              }
            }
            break;
          }
        }

        // Dispara o clique do gatilho configurado
        if (extTriggerPressed) {
          if (!lastTriggerPressed.current) {
            lastTriggerPressed.current = true;
            if (handleSelectRef.current) {
              handleSelectRef.current();
            }
          }
        } else {
          lastTriggerPressed.current = false;
        }

        const rb = rigidBodyRefsRef.current[entity.id];

        const turnSpeed = 1.5;
        if (Math.abs(turnX) > 0.05) {
          currentRotationY.current -= turnX * turnSpeed * delta * (180 / Math.PI);
          const newEulerY = currentRotationY.current;

          if (rb) {
            const qRot = new THREE.Quaternion().setFromEuler(
              new THREE.Euler(0, (newEulerY * Math.PI) / 180, 0)
            );
            rb.setRotation(qRot, true);
          } else {
            // Se não houver RB, atualiza a store de forma throttlada (10Hz) para evitar lags no render
            const now = performance.now();
            if (now - lastRotationUpdate.current > 100) {
              lastRotationUpdate.current = now;
              const currentRot = entity.components.Transform?.rotation || [0, 0, 0];
              updateComponentRef.current(entity.id, 'Transform', {
                rotation: [currentRot[0], newEulerY, currentRot[2]]
              });
            }
          }
        }

        const forward = forwardVec.current.copy(gazeDirectionRef.current);
        forward.y = 0;
        forward.normalize();

        const right = rightVec.current;
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0));
        right.normalize();

        const moveSpeed = 4.0;
        const move = moveVec.current
          .set(0, 0, 0)
          .addScaledVector(forward, -moveZ)
          .addScaledVector(right, moveX)
          .multiplyScalar(moveSpeed);

        if (rb) {
          const currentVel = rb.linvel();
          rb.setLinvel({ x: move.x, y: currentVel.y, z: move.z }, true);
        } else {
          const currentPos = entity.components.Transform?.position || [0, 0, 0];
          const newPos: [number, number, number] = [
            currentPos[0] + move.x * delta,
            currentPos[1],
            currentPos[2] + move.z * delta
          ];
          
          // Atualiza a store de forma throttlada (10Hz) se não tiver física ativa
          const now = performance.now();
          if (now - lastPositionUpdate.current > 100) {
            lastPositionUpdate.current = now;
            updateComponentRef.current(entity.id, 'Transform', { position: newPos });
          }
        }
      }
    } else {
      if (typeof window !== 'undefined' && (window as any).isVRActive) {
        (window as any).isVRActive = false;
      }
      if (initialHeadsetHeight !== null) {
        setInitialHeadsetHeight(null);
      }
    }
  });

  return (
    <>
      <PerspectiveCamera
        ref={ref}
        makeDefault={isGameView && camera.isMain}
        position={camera.offset || [0, 0, 0]}
        rotation={camera.rotation || [0, 0, 0]}
        fov={camera.fov}
        near={camera.near}
        far={camera.far}
      />
    </>
  );
}

// ── VR Teleport Ring ──────────────────────────────────────────
// Only rendered in /preview (StandalonePlayer), inside <XR>.
function VRTeleportRing({ entity }: { entity: Entity }) {
  const transform = entity.components.Transform;
  const [hovered, setHovered] = useState(false);
  if (!transform) return null;

  const pos = transform.position as [number, number, number];
  const rot = (transform.rotation as [number, number, number]).map((d) => (d * Math.PI) / 180) as [number, number, number];
  const scale = transform.scale as [number, number, number];

  const handleClick = (e: any) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!attemptTeleport()) return;

    // Move a câmera via atualização da entidade que tem Camera principal
    const storeState = useEditorStore.getState();
    const scene = storeState.activeScene();
    Object.values(scene.entities).forEach(e => {
      if (e.tags?.includes('player') || e.components.Camera?.isMain) {
        const targetPos = [pos[0], pos[1] + 1.05, pos[2]] as [number, number, number];
        storeState.updateComponent(e.id, 'Transform', {
          position: targetPos,
        });

        // Se houver um RigidBody físico ativo, teleporta e zera a velocidade dele
        const rb = storeState.rigidBodyRefs[e.id];
        if (rb) {
          rb.setTranslation({ x: targetPos[0], y: targetPos[1], z: targetPos[2] }, true);
          rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
          rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
        }
      }
    });
  };

  return (
    <group
      position={pos}
      rotation={rot}
      scale={scale}
    >
      {/* Torus */}
      <mesh
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        userData={{ isTeleportRing: true, onClick: handleClick, setHovered }}
      >
        <torusGeometry args={[0.6, 0.06, 16, 64]} />
        <meshStandardMaterial
          color={hovered ? '#ffffff' : '#00ffff'}
          emissive={hovered ? '#00ffff' : '#007777'}
          emissiveIntensity={hovered ? 2 : 1}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
      {/* Disco de chão translúcido para capturar cliques de raycast de forma perfeita */}
      <mesh
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        userData={{ isTeleportRing: true, onClick: handleClick, setHovered }}
      >
        <circleGeometry args={[0.58, 64]} />
        <meshBasicMaterial
          color={hovered ? '#ffffff' : '#00ffff'}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function EntityMesh({ entity, entities }: { entity: Entity; entities: Record<string, Entity> }) {
  const meshRef = useRef<THREE.Mesh>(null!);

  const {
    selectedEntityId,
    selectEntity,
    editorMode,
    isPlaying,
    updateComponent,
    snapEnabled,
    snapValue,
    setRigidBodyRef,
    activeViewport
  } = useEditorStore(useShallow(s => ({
    selectedEntityId: s.selectedEntityId,
    selectEntity: s.selectEntity,
    editorMode: s.editorMode,
    isPlaying: s.isPlaying,
    updateComponent: s.updateComponent,
    snapEnabled: s.snapEnabled,
    snapValue: s.snapValue,
    setRigidBodyRef: s.setRigidBodyRef,
    activeViewport: s.activeViewport
  })));

  const isGameView = activeViewport === 'game';
  const isStandalone = typeof window !== 'undefined' && window.location.pathname === '/preview';
  const transform = entity.components.Transform;
  const mesh = entity.components.MeshRenderer;
  const light = entity.components.Light;
  const rigidBody = entity.components.RigidBody;
  const audio = entity.components.Audio;
  const particles = entity.components.ParticleSystem;
  const camera = entity.components.Camera;

  if (!transform) return null;
  if (!entity.active) return null;

  const isSelected = selectedEntityId === entity.id;
  const pos = transform.position as [number, number, number];
  const rot = (transform.rotation as [number, number, number]).map((d) => (d * Math.PI) / 180) as [number, number, number];
  const scale = transform.scale as [number, number, number];

  // ── Drag detection: evita seleção acidental ao arrastar a câmera ──
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  const isPlayer = entity.tags?.includes('player') || !!entity.components.Camera?.isMain;

  const handlePointerDown = (e: any) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: any) => {
    if (isStandalone) return;

    if (!mouseDownPos.current) return;
    const dx = Math.abs(e.clientX - mouseDownPos.current.x);
    const dy = Math.abs(e.clientY - mouseDownPos.current.y);
    mouseDownPos.current = null;
    if (dx < 5 && dy < 5) { // só seleciona se não houve arrasto
      e.stopPropagation();
      selectEntity(entity.id);
    }
  };


  const handleChange = () => {
    if (isPlaying) return;
    const obj = meshRef.current;
    if (!obj) return;
    updateComponent(entity.id, 'Transform', {
      position: [
        parseFloat(obj.position.x.toFixed(3)),
        parseFloat(obj.position.y.toFixed(3)),
        parseFloat(obj.position.z.toFixed(3)),
      ],
      rotation: [
        parseFloat(((obj.rotation.x * 180) / Math.PI).toFixed(2)),
        parseFloat(((obj.rotation.y * 180) / Math.PI).toFixed(2)),
        parseFloat(((obj.rotation.z * 180) / Math.PI).toFixed(2)),
      ],
      scale: [
        parseFloat(obj.scale.x.toFixed(3)),
        parseFloat(obj.scale.y.toFixed(3)),
        parseFloat(obj.scale.z.toFixed(3)),
      ],
    });
  };

  const renderGeometry = () => {
    if (!mesh) return null;
    switch (mesh.geometry) {
      case 'box': return <boxGeometry args={[1, 1, 1]} />;
      case 'sphere': return <sphereGeometry args={[0.5, 32, 32]} />;
      case 'plane': return <planeGeometry args={[1, 1]} />;
      case 'cylinder': return <cylinderGeometry args={[0.5, 0.5, 1, 32]} />;
      case 'torus': return <torusGeometry args={[0.5, 0.2, 16, 64]} />;
      case 'cone': return <coneGeometry args={[0.5, 1, 32]} />;
      default: return <boxGeometry args={[1, 1, 1]} />;
    }
  };

  // ── Teleport ring: renderizado de forma especial no modo VR ──
  if (entity.tags?.includes('teleport')) {
    if (isStandalone) {
      return <VRTeleportRing entity={entity} />;
    }
    // No editor: anel com TransformControls para poder mover
    return (
      <>
        <group
          ref={meshRef}
          position={pos}
          rotation={rot}
          scale={scale}
        >
          {/* Torus */}
          <mesh
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
          >
            <torusGeometry args={[0.6, 0.06, 16, 64]} />
            <meshStandardMaterial color="#00ffff" emissive={isSelected ? '#00ffff' : '#007777'} emissiveIntensity={isSelected ? 1.5 : 0.8} />
            {isSelected && <Edges scale={1.05} color="#44aaff" />}
          </mesh>
          {/* Disco de chão translúcido para facilitar seleção no editor */}
          <mesh
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
          >
            <circleGeometry args={[0.58, 64]} />
            <meshBasicMaterial color="#00ffff" transparent opacity={0.15} side={THREE.DoubleSide} />
          </mesh>
        </group>
        {isSelected && !isGameView && (
          <TransformControls
            object={meshRef}
            mode={editorMode as any}
            translationSnap={snapEnabled ? snapValue : null}
            rotationSnap={snapEnabled ? (Math.PI / 12) : null}
            scaleSnap={snapEnabled ? snapValue : null}
            onChange={handleChange}
            onMouseDown={() => useEditorStore.getState().takeHistorySnapshot()}
          />
        )}
      </>
    );
  }

  const renderMaterial = () => {
    if (!mesh) return null;
    const color = mesh.color;
    switch (mesh.material) {
      case 'basic': return <meshBasicMaterial color={color} />;
      case 'phong': return <meshPhongMaterial color={color} />;
      case 'wireframe': return <meshBasicMaterial color={color} wireframe />;
      case 'invisible': return <meshBasicMaterial color={color} transparent opacity={0.3} wireframe visible={!isGameView && !isStandalone} />;
      case 'emissive':
        return (
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={mesh.emissiveIntensity ?? 2.0}
            roughness={0.2}
            metalness={0.1}
          />
        );
      default: return <meshStandardMaterial color={color} roughness={0.6} metalness={0.1} />;
    }
  };

  const renderLight = () => {
    if (!light) return null;
    const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const shadowMapSize = isMobile ? 512 : 1024;

    // Como esta função é renderizada dentro do container <mesh> que já possui a posição global definida em `pos`,
    // as luzes locais (point e spot) devem ter posição local [0, 0, 0] para coincidir com a posição visual da entidade no editor.
    // Também adicionamos decay={1} para melhorar a visibilidade em intensidades mais baixas.
    // Adicionamos shadow-bias e shadow-normalBias para evitar o efeito "shadow acne" (listras indesejadas no modelo 3D).
    switch (light.lightType) {
      case 'directional':
        return (
          <directionalLight
            position={pos}
            color={light.color}
            intensity={light.intensity}
            castShadow={light.castShadow}
            shadow-bias={-0.0005}
            shadow-normalBias={0.02}
            shadow-mapSize={[shadowMapSize, shadowMapSize]}
          />
        );
      case 'point':
        return (
          <pointLight
            position={[0, 0, 0]}
            color={light.color}
            intensity={light.intensity}
            castShadow={light.castShadow}
            decay={1}
            shadow-bias={-0.0005}
            shadow-normalBias={0.02}
            shadow-mapSize={[shadowMapSize, shadowMapSize]}
          />
        );
      case 'spot':
        return (
          <spotLight
            position={[0, 0, 0]}
            color={light.color}
            intensity={light.intensity}
            castShadow={light.castShadow}
            decay={1}
            shadow-bias={-0.0005}
            shadow-normalBias={0.02}
            shadow-mapSize={[shadowMapSize, shadowMapSize]}
          />
        );
      default:
        return null;
    }
  };

  if (!mesh) {
    // Entities without mesh (Light, Audio, Particles, Empty objects)
    const emptyMesh = (
      <mesh
        ref={meshRef}
        position={(!rigidBody || !isPlaying) ? pos : undefined}
        rotation={(!rigidBody || !isPlaying) ? rot : undefined}
        scale={scale}
        onPointerDown={isStandalone ? undefined : handlePointerDown}
        onPointerUp={isStandalone ? undefined : handlePointerUp}
      >
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshBasicMaterial color={light ? light.color : "#ffffff"} wireframe opacity={0.3} transparent visible={!isGameView} />

        {renderLight()}
        {audio && audio.src && isPlaying && (
          <PositionalAudio url={audio.src} loop={audio.loop} autoplay={audio.playOnStart} distance={10} />
        )}
        {particles && (
          <Sparkles
            count={particles.count}
            scale={5}
            size={particles.size}
            speed={particles.speed}
            color={particles.color}
          />
        )}
        {/* Camera */}
        {camera && (
          <PerspectiveCameraWrapper
            entity={entity}
            camera={camera}
            isGameView={isGameView}
            isStandalone={isStandalone}
          />
        )}
        {entity.childrenIds && entity.childrenIds.map(id => {
          const childEntity = entities[id];
          if (!childEntity) return null;
          return <EntityMesh key={id} entity={childEntity} entities={entities} />;
        })}
      </mesh>
    );

    return (
      <>
        {(rigidBody && isPlaying) ? (
          <RigidBody
            ref={(rb) => { if (rb) setRigidBodyRef(entity.id, rb); }}
            position={pos}
            rotation={rot}
            type={rigidBody.isStatic ? 'fixed' : 'dynamic'}
            mass={rigidBody.mass}
            gravityScale={rigidBody.useGravity ? 1 : 0}
            colliders={rigidBody.collider === 'none' || rigidBody.collider === 'trimesh' ? false : (rigidBody.collider || 'cuboid')}
          >
            {emptyMesh}
            {rigidBody.collider === 'trimesh' && (
              <MeshCollider type="trimesh">
                <mesh geometry={(meshRef.current as any)?.geometry}>
                  <meshBasicMaterial />
                </mesh>
              </MeshCollider>
            )}
          </RigidBody>
        ) : emptyMesh}

        {isSelected && !isGameView && (
          <TransformControls
            object={meshRef}
            mode={editorMode as any}
            translationSnap={snapEnabled ? snapValue : null}
            rotationSnap={snapEnabled ? (Math.PI / 12) : null}
            scaleSnap={snapEnabled ? snapValue : null}
            onChange={handleChange}
          />
        )}
      </>
    );
  }

  const innerMesh = (
    <mesh
      ref={meshRef}
      position={(!rigidBody || !isPlaying) ? pos : undefined}
      rotation={(!rigidBody || !isPlaying) ? rot : undefined}
      scale={scale}
      castShadow={mesh.castShadow}
      receiveShadow={mesh.receiveShadow}
      onPointerDown={isStandalone ? undefined : handlePointerDown}
      onPointerUp={isStandalone ? undefined : handlePointerUp}
      userData={{ isPlayer }}
    >
      {renderGeometry()}
      {renderMaterial()}
      {/* Audio */}
      {audio && audio.src && (
        <PositionalAudio url={audio.src} loop={audio.loop} autoplay={audio.playOnStart} distance={10} />
      )}
      {/* Particles */}
      {particles && (
        <Sparkles
          count={particles.count}
          scale={5}
          size={particles.size}
          speed={particles.speed}
          color={particles.color}
        />
      )}
      {/* Camera */}
      {camera && (
        <PerspectiveCameraWrapper
          entity={entity}
          camera={camera}
          isGameView={isGameView}
          isStandalone={isStandalone}
        />
      )}
      {/* Selection outline */}
      {isSelected && !isGameView && (
        <Edges scale={1.01} color="#44aaff" />
      )}
      {entity.childrenIds && entity.childrenIds.map(id => {
        const childEntity = entities[id];
        if (!childEntity) return null;
        return <EntityMesh key={id} entity={childEntity} entities={entities} />;
      })}
    </mesh>
  );

  return (
    <>
      {(rigidBody && isPlaying) ? (
        <RigidBody
          ref={(rb) => { if (rb) setRigidBodyRef(entity.id, rb); }}
          position={pos}
          rotation={rot}
          type={rigidBody.isStatic ? 'fixed' : 'dynamic'}
          mass={rigidBody.mass}
          gravityScale={rigidBody.useGravity ? 1 : 0}
          colliders={rigidBody.collider === 'none' || rigidBody.collider === 'trimesh' ? false : (rigidBody.collider || 'cuboid')}
        >
          {innerMesh}
          {rigidBody.collider === 'trimesh' && (
            <MeshCollider type="trimesh">
              {innerMesh}
            </MeshCollider>
          )}
        </RigidBody>
      ) : innerMesh}

      {isSelected && !isGameView && (
        <TransformControls
          object={meshRef}
          mode={editorMode as any}
          translationSnap={snapEnabled ? snapValue : null}
          rotationSnap={snapEnabled ? (Math.PI / 12) : null}
          scaleSnap={snapEnabled ? snapValue : null}
          onChange={handleChange}
          onMouseDown={() => useEditorStore.getState().takeHistorySnapshot()}
        />
      )}
    </>
  );
}

function XRSync() {
  const groupRef = useRef<THREE.Group>(null);
  // Cache do player para evitar Object.values().find() a cada frame
  const cachedPlayerId = useRef<string | null>(null);
  const sceneActiveId = useEditorStore(s => s.activeSceneId);

  // Seletores reativos do editorStore via ref para evitar getState() por frame
  const scene = useEditorStore(s => s.scenes[s.activeSceneId]);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  const rigidBodyRefs = useEditorStore(s => s.rigidBodyRefs);
  const rigidBodyRefsRef = useRef(rigidBodyRefs);
  rigidBodyRefsRef.current = rigidBodyRefs;

  // Recalcula o ID do player quando a cena mudar
  useEffect(() => {
    cachedPlayerId.current = null; // Reset para forçar re-lookup no próximo frame
  }, [sceneActiveId]);

  const eulerTemp = useRef(new THREE.Euler());
  const quatTemp = useRef(new THREE.Quaternion());

  useFrame((state) => {
    if (!groupRef.current) return;
    const currentScene = sceneRef.current;
    if (!currentScene) return;

    // Busca o player uma única vez por cena e armazena em cache
    if (!cachedPlayerId.current || !currentScene.entities[cachedPlayerId.current]) {
      const found = Object.values(currentScene.entities).find(e => e.tags?.includes('player') || e.components.Camera?.isMain);
      cachedPlayerId.current = found?.id ?? null;
    }
    if (!cachedPlayerId.current) return;
    const player = currentScene.entities[cachedPlayerId.current];
    if (!player) return;

    const rbRefs = rigidBodyRefsRef.current || {};
    const rb = rbRefs[player.id];
    let ePos = player.components.Transform?.position || [0, 0, 0];
    let eRot = player.components.Transform?.rotation || [0, 0, 0];

    if (rb) {
      const trans = rb.translation();
      ePos = [trans.x, trans.y, trans.z];

      const rot = rb.rotation();
      quatTemp.current.set(rot.x, rot.y, rot.z, rot.w);
      eulerTemp.current.setFromQuaternion(quatTemp.current);
      eRot = [eulerTemp.current.x * 180 / Math.PI, eulerTemp.current.y * 180 / Math.PI, eulerTemp.current.z * 180 / Math.PI];
    }

    const offset = player.components.Camera?.offset || [0, 0, 0];

    // Obtém a altura física do headset do WebXR
    let xrCamHeight = 0;
    if (state.gl.xr.isPresenting) {
      const xrCam = (state.gl.xr as any).getCamera(state.camera);
      if (xrCam) {
        xrCamHeight = xrCam.position.y;
      }
    }

    // Se o dispositivo tem tracking de altura (6DoF), a altura é maior que 0.5m.
    // Nesse caso, o XROrigin deve ficar exatamente no chão (ePos[1]).
    // Se for 3DoF (ou primeiro frame/celular simples), a altura é ~0,
    // então posicionamos no offset da câmera do player (ePos[1] + offset[1])
    // para compensar e manter o ponto de vista na altura dos olhos do avatar.
    const targetY = xrCamHeight >= 0.5 
      ? ePos[1] 
      : ePos[1] + (offset[1] || 1.6);

    groupRef.current.position.set(
      ePos[0] + offset[0],
      targetY,
      ePos[2] + offset[2]
    );
    groupRef.current.rotation.set(0, eRot[1] * Math.PI / 180, 0);
  });

  return (
    <group ref={groupRef}>
      <XROrigin />
    </group>
  );
}

export function SceneEntities() {
  const scene = useEditorStore(s => s.scenes[s.activeSceneId]);
  const isStandalone = typeof window !== 'undefined' && window.location.pathname === '/preview';

  if (!scene) return null;

  return (
    <>
      {isStandalone && <XRSync />}
      {scene.rootEntityIds.map(id => {
        const entity = scene.entities[id];
        if (!entity) return null;
        return <EntityMesh key={id} entity={entity} entities={scene.entities} />;
      })}
    </>
  );
}



