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
  geometry: 'box' | 'sphere' | 'plane' | 'cylinder' | 'torus' | 'cone' | 'capsule';
  material: 'standard' | 'basic' | 'phong' | 'wireframe' | 'invisible' | 'emissive';
  color: string;
  castShadow: boolean;
  receiveShadow: boolean;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
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
  showCrosshair?: boolean;
  antialias?: boolean;
  /**
   * useGyroscope (padrão: true)
   * Quando true  → modo VR usa a pose do headset para controlar a câmera (comportamento FPS/imersivo padrão).
   * Quando false → o engine NÃO substitui a câmera pelo headset no VR; os Scripts do jogo continuam
   *               controlando a câmera normalmente (câmera de 3ª pessoa, FPV de drone, orbital, etc.).
   * @deprecated use cameraType; useGyroscope=false é equivalente a cameraType='Scriptable'.
   */
  useGyroscope?: boolean;
  /**
   * cameraType (padrão: 'Headset')
   * 'Headset'    → equivalente a useGyroscope=true: VR usa a pose do headset (FPS/imersivo padrão).
   * 'Scriptable' → equivalente a useGyroscope=false: o script controla CFrame/FOV da câmera;
   *                o headset vira um offset opcional (ver headsetOffset) sobre a câmera do script.
   *                Modelo "Roblox-like": o editor tem controle total via scripts.
   */
  cameraType?: 'Headset' | 'Scriptable';
  /**
   * headsetOffset (só tem efeito quando cameraType='Scriptable' / useGyroscope=false)
   * true  → a pose do headset é aplicada como OFFSET LOCAL sobre a câmera do script
   *         (ex.: câmera de 3ª pessoa onde a cabeça do jogador vira o olhar ao redor).
   * false → câmera 100% travada no script; a pose do headset é totalmente cancelada (matriz inversa).
   */
  headsetOffset?: boolean;
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
  drag?: number;
  angularDrag?: number;
  restitution?: number;
  isKinematic?: boolean;
  interpolate?: 'none' | 'interpolate' | 'extrapolate';
  collisionDetection?: 'discrete' | 'continuous';
  freezePositionX?: boolean;
  freezePositionY?: boolean;
  freezePositionZ?: boolean;
  freezeRotationX?: boolean;
  freezeRotationY?: boolean;
  freezeRotationZ?: boolean;
}

export interface AudioComponent {
  type: 'Audio';
  src: string;
  fileName?: string;
  loop: boolean;
  volume: number;
  playOnStart: boolean;
  is3D?: boolean;
  delay?: number;
  refDistance?: number;
  rolloffFactor?: number;
  maxDistance?: number;
  distanceModel?: 'linear' | 'inverse' | 'exponential';
  playbackRate?: number;
}

export interface ParticleSystemComponent {
  type: 'ParticleSystem';
  count: number;
  color: string;
  size: number;
  speed: number;
}

export interface ColliderComponent {
  type: 'Collider';
  shape: 'cuboid' | 'ball' | 'capsule' | 'cylinder' | 'cone';
  scale: [number, number, number];
  offset: [number, number, number];
  isTrigger: boolean;
  restitution?: number;
}

export interface TextureComponent {
  type: 'Texture';
  textureUrl: string;
  fileName: string;
  tilingX?: number;
  tilingY?: number;
  offsetX?: number;
  offsetY?: number;
  normalMapUrl?: string;
  normalFileName?: string;
  normalScale?: number;
}

export interface GLTFModelComponent {
  type: 'GLTFModel';
  src: string;       // blob URL (sessão atual)
  fileName: string;  // nome original do arquivo
  modelScale: number;
  castShadow: boolean;
  receiveShadow: boolean;
  overrideMaterial?: 'none' | 'standard' | 'basic' | 'phong' | 'emissive';
  color?: string;
  roughness?: number;
  metalness?: number;
  textureUrl?: string;
  normalMapUrl?: string;
  normalScale?: number;
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
  role?: string;
  ready?: boolean;
}


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
  roomId?: string;       // Identificador único da sala (gerado automaticamente)
  coverImage?: string;   // URL da imagem de capa para o Discover
  entities: Record<EntityId, Entity>;
  rootEntityIds: EntityId[];
  backgroundColor: string;
  ambientColor: string;
  ambientIntensity: number;
  fogEnabled: boolean;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  skyboxUrl?: string;
  hudEnabled?: boolean;
  hudConfig?: {
    labelHome?: string;
    labelAway?: string;
    showTimer?: boolean;
    showLobby?: boolean;
    showScoreboard?: boolean;
    showMatchOverlay?: boolean;
    themeColor?: string;
  };
}

export interface HUDPlaneComponent {
  type: 'HUDPlane';
  opacity: number;
  color: string;
  width: number;
  height: number;
  distance: number;
}

export interface VideoMeshComponent {
  type: 'VideoMesh';
  videoUrl: string;
  fileName: string;
  autoPlay: boolean;
  loop: boolean;
  volume: number;
  muted: boolean;
  play: boolean;
  curveAmount: number;
  curveDirection: 'horizontal' | 'vertical';
  width: number;
  height: number;
  segmentsX: number;
  segmentsY: number;
  projection?: 'plane' | 'sphere360' | 'sphere180';
  stereoMode?: 'none' | 'sbs' | 'tb';
  lightInfluence?: boolean;
  lightIntensity?: number;
  lightDistance?: number;
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
  | ColliderComponent
  | GLTFModelComponent
  | AnimatorComponent
  | NetworkComponent
  | TextureComponent
  | HUDPlaneComponent
  | VideoMeshComponent;

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
  Collider: ColliderComponent;
  GLTFModel: GLTFModelComponent;
  Animator: AnimatorComponent;
  Network: NetworkComponent;
  Texture: TextureComponent;
  HUDPlane: HUDPlaneComponent;
  VideoMesh: VideoMeshComponent;
};

const hudCanvasCache: Record<string, {
  canvas: HTMLCanvasElement;
  onHUDUpdate: (() => void) | null;
}> = {};

export function getOrCreateHUDCanvas(entity: any): HTMLCanvasElement {
  const entityId = entity.id;
  if (!hudCanvasCache[entityId]) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    hudCanvasCache[entityId] = {
      canvas,
      onHUDUpdate: null
    };
  }
  
  const cached = hudCanvasCache[entityId];
  entity.HUDCanvas = cached.canvas;
  entity.updateHUDTexture = () => {
    if (typeof cached.onHUDUpdate === 'function') {
      cached.onHUDUpdate();
    }
  };
  
  return cached.canvas;
}

export function setHUDUpdateCallback(entityId: string, callback: () => void) {
  if (hudCanvasCache[entityId]) {
    hudCanvasCache[entityId].onHUDUpdate = callback;
  }
}

declare global {
  interface Window {
    // Orion / Audio properties
    __orion_audio_patched__?: boolean;
    __orion_active_audios__?: Set<any>;
    
    // Gameplay & Multiplayer properties
    playerRole?: string;
    soccerMultiplayerState?: Record<string, any>;
    gameScore?: {
      home: number;
      away: number;
      labelHome?: string;
      labelAway?: string;
    };
    localReady?: boolean;
    isVRActive?: boolean;
    isFreedom3DCrouching?: boolean;
    _soccerResetListeners?: Record<string, any>;
    _soccerBallListeners?: Record<string, any>;

    // Engine Standalone / AR / VR properties
    __freedom3d_standalone__?: boolean;
    __freedom3d_xr_presenting__?: boolean;
    __freedom3d_webgl_info?: string;
    __freedom3d_ar_video__?: HTMLVideoElement;
    __freedom3d_ar_mode__?: boolean;
    __freedom3d_ar_tv_mode__?: string | boolean;
    __freedom3d_ar_tv_quality__?: string;
    __freedom3d_simulated_ar__?: boolean;
    __orionNativeFetch__?: typeof fetch;
    __updateFreedom3DCacheSize?: (size: string) => void;

    // MediaPipe / Hand Tracking properties
    drawConnectors?: (ctx: CanvasRenderingContext2D, landmarks: any, connections: any, options: any) => void;
    drawLandmarks?: (ctx: CanvasRenderingContext2D, landmarks: any, options: any) => void;
    HAND_CONNECTIONS?: any;
  }
}

