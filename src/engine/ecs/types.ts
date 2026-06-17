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

export type AnyComponent =
  | TransformComponent
  | MeshRendererComponent
  | LightComponent
  | CameraComponent
  | ScriptComponent
  | RigidBodyComponent
  | AudioComponent;

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
