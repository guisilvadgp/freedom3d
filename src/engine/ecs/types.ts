// ============================================================
// Orion Engine – ECS Types
// ============================================================

export type EntityId = string;

export interface TransformComponent {
  type: 'Transform';
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface MeshRendererComponent {
  type: 'MeshRenderer';
  geometry: 'box' | 'sphere' | 'plane' | 'cylinder' | 'torus' | 'cone';
  material: 'standard' | 'basic' | 'phong' | 'wireframe';
  color: string;
  castShadow: boolean;
  receiveShadow: boolean;
}

export interface LightComponent {
  type: 'Light';
  lightType: 'directional' | 'point' | 'spot' | 'ambient';
  color: string;
  intensity: number;
  castShadow: boolean;
}

export interface CameraComponent {
  type: 'Camera';
  fov: number;
  near: number;
  far: number;
  isMain: boolean;
}

export interface ScriptComponent {
  type: 'Script';
  scriptName: string;
  code: string;
}

export interface RigidBodyComponent {
  type: 'RigidBody';
  mass: number;
  isStatic: boolean;
  useGravity: boolean;
}

export interface AudioComponent {
  type: 'Audio';
  src: string;
  loop: boolean;
  volume: number;
  playOnStart: boolean;
}

export interface ParticleSystemComponent {
  type: 'ParticleSystem';
  count: number;
  color: string;
  size: number;
  speed: number;
}

export interface GLTFModelComponent {
  type: 'GLTFModel';
  src: string;       // blob URL (sessão atual)
  fileName: string;  // nome original do arquivo
  modelScale: number;
  castShadow: boolean;
  receiveShadow: boolean;
}

export type AnyComponent =
  | TransformComponent
  | MeshRendererComponent
  | LightComponent
  | CameraComponent
  | ScriptComponent
  | RigidBodyComponent
  | AudioComponent
  | ParticleSystemComponent
  | GLTFModelComponent;

export type ComponentType = AnyComponent['type'];

export interface Entity {
  id: EntityId;
  name: string;
  parentId: EntityId | null;
  childrenIds: EntityId[];
  active: boolean;
  components: Partial<Record<ComponentType, AnyComponent>>;
  tags: string[];
}

export type SceneId = string;

export interface Scene {
  id: SceneId;
  name: string;
  entities: Record<EntityId, Entity>;
  rootEntityIds: EntityId[];
  backgroundColor: string;
  ambientColor: string;
  ambientIntensity: number;
  fogEnabled: boolean;
  fogColor: string;
  fogNear: number;
  fogFar: number;
}
