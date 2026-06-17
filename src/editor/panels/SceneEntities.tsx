import { useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { TransformControls, Edges, PositionalAudio, Sparkles, PerspectiveCamera } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useEditorStore } from '../store/editorStore';
import type { Entity } from '../../engine/ecs/types';

function EntityMesh({ entity }: { entity: Entity }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const { selectedEntityId, selectEntity, editorMode, isPlaying, updateComponent, snapEnabled, snapValue } = useEditorStore();
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
    return (
      <group position={pos} rotation={rot} scale={scale}>
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
          <PerspectiveCamera 
            makeDefault={isPlaying && camera.isMain} 
            position={camera.offset || [0, 0, 0]}
            fov={camera.fov} 
            near={camera.near} 
            far={camera.far} 
          />
        )}
        {/* Helper visual representation for selection when there is no mesh */}
        <mesh
          ref={meshRef}
          onClick={(e) => { e.stopPropagation(); selectEntity(entity.id); }}
        >
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshBasicMaterial color={light ? light.color : "#ffffff"} wireframe opacity={0.3} transparent />
        </mesh>
        
        {isSelected && !isPlaying && (
          <TransformControls
            object={meshRef}
            mode={editorMode as any}
            translationSnap={snapEnabled ? snapValue : null}
            rotationSnap={snapEnabled ? (Math.PI / 12) : null}
            scaleSnap={snapEnabled ? snapValue : null}
            onChange={handleChange}
          />
        )}
      </group>
    );
  }

  const innerMesh = (
    <mesh
      ref={meshRef}
      position={!rigidBody ? pos : undefined}
      rotation={!rigidBody ? rot : undefined}
      scale={scale}
      castShadow={mesh.castShadow}
      receiveShadow={mesh.receiveShadow}
      onClick={(e) => { e.stopPropagation(); selectEntity(entity.id); }}
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
        <PerspectiveCamera 
          makeDefault={isPlaying && camera.isMain} 
          position={camera.offset || [0, 0, 0]}
          fov={camera.fov} 
          near={camera.near} 
          far={camera.far} 
        />
      )}
      {/* Selection outline */}
      {isSelected && (
        <Edges scale={1.01} color="#44aaff" />
      )}
    </mesh>
  );

  return (
    <>
      {rigidBody ? (
        <RigidBody 
          position={pos}
          rotation={rot}
          type={rigidBody.isStatic ? 'fixed' : 'dynamic'} 
          mass={rigidBody.mass}
          gravityScale={rigidBody.useGravity ? 1 : 0}
          colliders={rigidBody.collider === 'none' ? false : (rigidBody.collider || 'cuboid')}
        >
          {innerMesh}
        </RigidBody>
      ) : innerMesh}
      
      {isSelected && !isPlaying && (
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
