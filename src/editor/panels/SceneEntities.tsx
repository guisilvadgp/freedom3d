import { XROrigin, useXRStore } from '@react-three/xr';
import { useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { TransformControls, Edges, PositionalAudio, Sparkles, PerspectiveCamera } from '@react-three/drei';
import { RigidBody, MeshCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useEditorStore } from '../store/editorStore';
import type { Entity } from '../../engine/ecs/types';

// ── VR Teleport Ring ──────────────────────────────────────────
// Only rendered in /preview (StandalonePlayer), inside <XR>.
function VRTeleportRing({ entity }: { entity: Entity }) {
  const xrStore = useXRStore();
  const transform = entity.components.Transform;
  const [hovered, setHovered] = useState(false);
  if (!transform) return null;

  const pos = transform.position as [number, number, number];
  const rot = (transform.rotation as [number, number, number]).map((d) => (d * Math.PI) / 180) as [number, number, number];
  const scale = transform.scale as [number, number, number];

  const handleClick = () => {
    // Teleporta o jogador para a posição do anel
    xrStore.setState(state => ({
      ...state,
      originReferenceSpace: undefined, // reseta para forçar re-posicionamento
    }));
    // Move a câmera via atualização da entidade que tem Camera principal
    const scene = useEditorStore.getState().activeScene();
    Object.values(scene.entities).forEach(e => {
      if (e.tags?.includes('player') || e.components.Camera?.isMain) {
        useEditorStore.getState().updateComponent(e.id, 'Transform', {
          position: [pos[0], pos[1], pos[2]],
        });
      }
    });
  };

  return (
    <mesh
      position={pos}
      rotation={rot}
      scale={scale}
      onClick={handleClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <torusGeometry args={[0.6, 0.06, 16, 64]} />
      <meshStandardMaterial
        color={hovered ? '#ffffff' : '#00ffff'}
        emissive={hovered ? '#00ffff' : '#007777'}
        emissiveIntensity={hovered ? 2 : 1}
        roughness={0.2}
        metalness={0.8}
      />
      {/* Disco de chão translúcido */}
      <mesh rotation={[0, 0, 0]}>
        <circleGeometry args={[0.55, 64]} />
        <meshBasicMaterial color={hovered ? '#00ffff' : '#004444'} transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>
    </mesh>
  );
}

function EntityMesh({ entity }: { entity: Entity }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const { selectedEntityId, selectEntity, editorMode, isPlaying, updateComponent, snapEnabled, snapValue, setRigidBodyRef, activeViewport } = useEditorStore();
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
  const mouseDownPos = useRef<{x: number; y: number} | null>(null);
  const handlePointerDown = (e: any) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
  };
  const handlePointerUp = (e: any) => {
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
        <mesh
          ref={meshRef}
          position={pos}
          rotation={rot}
          scale={scale}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        >
          <torusGeometry args={[0.6, 0.06, 16, 64]} />
          <meshStandardMaterial color="#00ffff" emissive={isSelected ? '#00ffff' : '#007777'} emissiveIntensity={isSelected ? 1.5 : 0.8} />
          {isSelected && <Edges scale={1.05} color="#44aaff" />}
        </mesh>
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

  const renderMaterial = () => {
    if (!mesh) return null;
    const color = mesh.color;
    switch (mesh.material) {
      case 'basic': return <meshBasicMaterial color={color} />;
      case 'phong': return <meshPhongMaterial color={color} />;
      case 'wireframe': return <meshBasicMaterial color={color} wireframe />;
      default: return <meshStandardMaterial color={color} roughness={0.6} metalness={0.1} />;
    }
  };

  const renderLight = () => {
    if (!light) return null;
    const lp = transform.position as [number, number, number];
    switch (light.lightType) {
      case 'directional':
        return (
          <directionalLight
            position={lp}
            color={light.color}
            intensity={light.intensity}
            castShadow={light.castShadow}
          />
        );
      case 'point':
        return (
          <pointLight
            position={lp}
            color={light.color}
            intensity={light.intensity}
            castShadow={light.castShadow}
          />
        );
      case 'spot':
        return (
          <spotLight
            position={lp}
            color={light.color}
            intensity={light.intensity}
            castShadow={light.castShadow}
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
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshBasicMaterial color={light ? light.color : "#ffffff"} wireframe opacity={0.3} transparent visible={!isGameView} />
        
        {renderLight()}
        {audio && audio.src && (
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
          <>
            {isStandalone && <XROrigin position={camera.offset || [0, 0, 0]} />}
            <PerspectiveCamera 
              makeDefault={isGameView && camera.isMain} 
              position={camera.offset || [0, 0, 0]}
              rotation={camera.rotation || [0, 0, 0]}
              fov={camera.fov} 
              near={camera.near} 
              far={camera.far} 
            />
          </>
        )}
        {entity.childrenIds && entity.childrenIds.map(id => {
          const childEntity = useEditorStore.getState().activeScene().entities[id];
          if (!childEntity) return null;
          return <EntityMesh key={id} entity={childEntity} />;
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
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
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
        <>
          {isStandalone && <XROrigin position={camera.offset || [0, 0, 0]} />}
          <PerspectiveCamera 
            makeDefault={isGameView && camera.isMain} 
            position={camera.offset || [0, 0, 0]}
            rotation={camera.rotation || [0, 0, 0]}
            fov={camera.fov} 
            near={camera.near} 
            far={camera.far} 
          />
        </>
      )}
      {/* Selection outline */}
      {isSelected && !isGameView && (
        <Edges scale={1.01} color="#44aaff" />
      )}
      {entity.childrenIds && entity.childrenIds.map(id => {
        const childEntity = useEditorStore.getState().activeScene().entities[id];
        if (!childEntity) return null;
        return <EntityMesh key={id} entity={childEntity} />;
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
        />
      )}
    </>
  );
}

export function SceneEntities() {
  const { activeScene } = useEditorStore();
  const scene = activeScene();

  return (
    <>
      {scene.rootEntityIds.map((id) => {
        const entity = scene.entities[id];
        if (!entity) return null;
        return <EntityMesh key={id} entity={entity} />;
      })}
    </>
  );
}



