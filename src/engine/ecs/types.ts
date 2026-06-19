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
  material: 'standard' | 'basic' | 'phong' | 'wireframe' | 'invisible' | 'emissive';
  color: string;
  castShadow: boolean;
  receiveShadow: boolean;
  emissiveIntensity?: number;
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
  offset: [number, number, number];
  rotation?: [number, number, number];
}

export interface ScriptVariable {
  name: string;
  type: 'entity' | 'component' | 'number' | 'string' | 'boolean';
  value: string;
  entityId?: string;
  componentType?: string;
}

export interface ScriptItem {
  id: string;
  scriptName: string;
  code: string;
  variables?: ScriptVariable[];
}

export interface ScriptComponent {
  type: 'Script';
  scriptName: string;
  code: string;
  variables?: ScriptVariable[];
  scripts?: ScriptItem[];
}

export interface RigidBodyComponent {
  type: 'RigidBody';
  mass: number;
  isStatic: boolean;
  useGravity: boolean;
  collider: 'cuboid' | 'ball' | 'hull' | 'trimesh' | 'none';
}

export interface AudioComponent {
  type: 'Audio';
  src: string;
  loop: boolean;
  volume: number;
  playOnStart: boolean;
  is3D?: boolean;
  delay?: number;
  refDistance?: number;
  rolloffFactor?: number;
  maxDistance?: number;
  distanceModel?: 'linear' | 'inverse' | 'exponential';
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

export interface AnimatorComponent {
  type: 'Animator';
  currentAnimation: string;
  loop: boolean;
  timeScale: number;
  animationsList?: string[];
  currentState?: string;
  states?: {
    [stateName: string]: {
      clipName: string;
      loop: boolean;
      timeScale: number;
    }
  };
}

export interface NetworkComponent {
  type: 'Network';
  isLocal: boolean; // Se é o jogador local ou um "ghost" recebido pela rede
  syncPosition: boolean;
  syncRotation: boolean;
  syncAnimation: boolean;
  sendRate: number; // updates por segundo
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
  | GLTFModelComponent
  | AnimatorComponent
  | NetworkComponent;

export type ComponentType = AnyComponent['type'];

export type ComponentsMap = {
  Transform: TransformComponent;
  MeshRenderer: MeshRendererComponent;
  Light: LightComponent;
  Camera: CameraComponent;
  Script: ScriptComponent;
  RigidBody: RigidBodyComponent;
  Audio: AudioComponent;
  ParticleSystem: ParticleSystemComponent;
  GLTFModel: GLTFModelComponent;
  Animator: AnimatorComponent;
  Network: NetworkComponent;
};

export interface Entity {
  id: EntityId;
  name: string;
  parentId: EntityId | null;
  childrenIds: EntityId[];
  active: boolean;
  components: Partial<ComponentsMap>;
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

