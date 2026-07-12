import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Entity, EntityId, Scene, SceneId, AnyComponent, ComponentType } from '../ecs/types';
import {
  createCube,
  createSphere,
  createPlane,
  createDirectionalLight,
  createCylinder,
  createTorus,
  createPointLight,
  createFirstPersonPlayer,
  createThirdPersonPlayer,
  createVRPosition,
  createEmpty,
  createCapsule,
  createCamera,
  createHUDPlane,
  createVideoMesh,
} from '../ecs/EntityFactory';

export interface ConsoleLog {
  id: string;
  type: 'log' | 'warn' | 'error' | 'info';
  message: string;
  timestamp: number;
}

export const checkIsStandalone = () => {
  if (typeof window === 'undefined') return false;
  const pathname = window.location.pathname;
  return pathname.startsWith('/preview') || pathname.startsWith('/room/') || !!(window as any).__freedom3d_standalone__;
};

export function makeDefaultScene(): Scene {
  const light = createDirectionalLight();
  const plane = createPlane();
  plane.components.RigidBody = {
    type: 'RigidBody',
    mass: 0,
    drag: 0,
    angularDrag: 0.05,
    isStatic: true,
    isKinematic: false,
    useGravity: false,
    collider: 'cuboid'
  };
  const player = createFirstPersonPlayer();

  const entities: Record<EntityId, Entity> = {
    [light.id]: light,
    [plane.id]: plane,
    [player.id]: player,
  };

  return {
    id: uuidv4(),
    name: 'Main Scene',
    roomId: uuidv4(),
    coverImage: '',
    entities,
    rootEntityIds: [light.id, plane.id, player.id],
    backgroundColor: '#87CEEB',
    ambientColor: '#ffffff',
    ambientIntensity: 0.6,
    fogEnabled: false,
    fogColor: '#1a1a2e',
    fogNear: 10,
    fogFar: 100,
  };
}

interface RuntimeStore {
  // Scenes
  scenes: Record<SceneId, Scene>;
  activeSceneId: SceneId;
  activeScene: () => Scene;

  // Selection
  selectedEntityId: EntityId | null;
  selectEntity: (id: EntityId | null) => void;
  selectedEntity: () => Entity | null;
  focusTrigger: { entityId: string; timestamp: number } | null;
  focusEntity: (id: string) => void;

  // Viewport & Playback
  activeViewport: 'scene' | 'game';
  setActiveViewport: (viewport: 'scene' | 'game') => void;
  isPlaying: boolean;
  playModeBackupScene: Scene | null;
  togglePlay: () => void;

  // Console / Logs
  consoleLogs: ConsoleLog[];
  addLog: (type: ConsoleLog['type'], message: string) => void;
  clearConsole: () => void;

  // Entity operations
  createEntity: (type: string) => void;
  deleteEntity: (id: EntityId) => void;
  duplicateEntity: (id: EntityId) => void;
  renameEntity: (id: EntityId, name: string) => void;
  toggleEntityActive: (id: EntityId) => void;
  updateEntityTags: (id: EntityId, tags: string[]) => void;
  reparentEntity: (childId: EntityId, newParentId: EntityId | null) => void;

  // Component operations
  addComponent: (entityId: EntityId, component: AnyComponent) => void;
  removeComponent: (entityId: EntityId, type: ComponentType) => void;
  updateComponent: (entityId: EntityId, type: ComponentType, patch: Partial<AnyComponent>) => void;

  // Scene settings
  updateSceneSettings: (patch: Partial<Scene>) => void;

  // Physical RigidBody references
  rigidBodyRefs: Record<string, any>;
  setRigidBodyRef: (id: string, ref: any) => void;

  // Hook decoupled with the Editor (History / Undo-Redo)
  onBeforeMutate: (() => void) | null;
  setOnBeforeMutate: (cb: (() => void) | null) => void;
  triggerBeforeMutate: () => void;
}

export const useRuntimeStore = create<RuntimeStore>((set, get) => {
  return {
    scenes: {},
    activeSceneId: '',
    activeScene: () => get().scenes[get().activeSceneId],

    selectedEntityId: null,
    selectEntity: (id) => set({ selectedEntityId: id }),
    selectedEntity: () => {
      const { selectedEntityId, activeScene } = get();
      if (!selectedEntityId) return null;
      return activeScene().entities[selectedEntityId] ?? null;
    },
    focusTrigger: null,
    focusEntity: (id) => set({ focusTrigger: { entityId: id, timestamp: Date.now() } }),

    activeViewport: 'scene',
    setActiveViewport: (viewport) => set({ activeViewport: viewport }),
    isPlaying: false,
    playModeBackupScene: null,
    togglePlay: () => set((s) => {
      const isNowPlaying = !s.isPlaying;
      
      if (isNowPlaying) {
        // Backup current scene before starting play mode
        const activeScene = s.scenes[s.activeSceneId];
        const backup = activeScene ? JSON.parse(JSON.stringify(activeScene)) : null;

        setTimeout(() => {
          const container = document.querySelector('.scene-view') || document.body;
          const canvas = document.querySelector('.scene-view canvas') || document.querySelector('canvas');
          
          if (container && container.requestFullscreen) {
            container.requestFullscreen().catch((err) => {
              console.warn("Falha ao entrar em tela cheia:", err);
            });
          }
          if (canvas && canvas.requestPointerLock) {
            try {
              const res = canvas.requestPointerLock();
              if (res && typeof res.catch === 'function') {
                res.catch((err: any) => {
                  console.warn("Pointer Lock automático recusado pelo navegador (o usuário deve clicar na tela para travar o mouse):", err);
                });
              }
            } catch (err) {
              console.warn("Falha ao solicitar Pointer Lock:", err);
            }
          }
        }, 150);

        return {
          isPlaying: true,
          playModeBackupScene: backup,
          activeViewport: 'game',
          consoleLogs: []
        };
      } else {
        // Restore backup scene
        const backup = s.playModeBackupScene;
        const updatedScenes = backup ? { ...s.scenes, [s.activeSceneId]: backup } : s.scenes;

        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }

        return {
          isPlaying: false,
          scenes: updatedScenes,
          playModeBackupScene: null,
          activeViewport: 'scene',
          selectedEntityId: null,
          rigidBodyRefs: {} // Reset physical rigidbodies
        };
      }
    }),

    consoleLogs: [
      { id: uuidv4(), type: 'info', message: '🚀 Orion Engine v0.1.0 iniciado.', timestamp: Date.now() },
      { id: uuidv4(), type: 'log', message: 'Cena "Main Scene" carregada com sucesso.', timestamp: Date.now() },
    ],
    addLog: (type, message) =>
      set((s) => ({
        consoleLogs: [
          ...s.consoleLogs.slice(-99),
          { id: uuidv4(), type, message, timestamp: Date.now() },
        ],
      })),
    clearConsole: () => set({ consoleLogs: [] }),

    rigidBodyRefs: {},
    setRigidBodyRef: (id, ref) => {
      set((s) => ({
        rigidBodyRefs: { ...s.rigidBodyRefs, [id]: ref }
      }));
    },

    onBeforeMutate: null,
    setOnBeforeMutate: (cb) => set({ onBeforeMutate: cb }),
    triggerBeforeMutate: () => {
      const mutateCb = get().onBeforeMutate;
      if (mutateCb) mutateCb();
    },

    createEntity: (type) => {
      const mutateCb = get().onBeforeMutate;
      if (mutateCb) mutateCb();

      const scene = get().activeScene();
      let entity: Entity;
      switch (type) {
        case 'cube': entity = createCube(); break;
        case 'sphere': entity = createSphere(); break;
        case 'plane': entity = createPlane('Plane'); entity.components.Transform!.scale = [1,1,1]; break;
        case 'cylinder': entity = createCylinder(); break;
        case 'torus': entity = createTorus(); break;
        case 'capsule': entity = createCapsule(); break;
        case 'empty': entity = createEmpty(); break;
        case 'directional': entity = createDirectionalLight(); break;
        case 'point': entity = createPointLight(); break;
        case 'camera': entity = createCamera(); break;
        case 'first-person': entity = createFirstPersonPlayer(); break;
        case 'third-person': entity = createThirdPersonPlayer(); break;
        case 'vr-position': entity = createVRPosition(); break;
        case 'hud-plane': entity = createHUDPlane(); break;
        case 'video-mesh': entity = createVideoMesh(); break;
        default: entity = createCube();
      }
      get().addLog('log', `Entidade criada: "${entity.name}"`);
      set((s) => ({
        scenes: {
          ...s.scenes,
          [scene.id]: {
            ...scene,
            entities: { ...scene.entities, [entity.id]: entity },
            rootEntityIds: [...scene.rootEntityIds, entity.id],
          },
        },
        selectedEntityId: entity.id,
      }));
    },

    deleteEntity: (id) => {
      const mutateCb = get().onBeforeMutate;
      if (mutateCb) mutateCb();

      const scene = get().activeScene();
      const entity = scene.entities[id];
      if (!entity) return;
      const newEntities = { ...scene.entities };
      delete newEntities[id];
      get().addLog('warn', `Entidade deletada: "${entity.name}"`);
      set((s) => ({
        scenes: {
          ...s.scenes,
          [scene.id]: {
            ...scene,
            entities: newEntities,
            rootEntityIds: scene.rootEntityIds.filter((eid) => eid !== id),
          },
        },
        selectedEntityId: s.selectedEntityId === id ? null : s.selectedEntityId,
      }));
    },

    duplicateEntity: (id) => {
      const mutateCb = get().onBeforeMutate;
      if (mutateCb) mutateCb();

      const scene = get().activeScene();
      const original = scene.entities[id];
      if (!original) return;
      const clone: Entity = JSON.parse(JSON.stringify(original));
      clone.id = uuidv4();
      clone.name = original.name + ' (copy)';
      if (clone.components.Transform) {
        clone.components.Transform.position = [
          clone.components.Transform.position[0] + 1,
          clone.components.Transform.position[1],
          clone.components.Transform.position[2],
        ];
      }
      get().addLog('log', `Entidade duplicada: "${clone.name}"`);
      set((s) => ({
        scenes: {
          ...s.scenes,
          [scene.id]: {
            ...scene,
            entities: { ...scene.entities, [clone.id]: clone },
            rootEntityIds: [...scene.rootEntityIds, clone.id],
          },
        },
        selectedEntityId: clone.id,
      }));
    },

    renameEntity: (id, name) => {
      const mutateCb = get().onBeforeMutate;
      if (mutateCb) mutateCb();

      const scene = get().activeScene();
      set((s) => ({
        scenes: {
          ...s.scenes,
          [scene.id]: {
            ...scene,
            entities: {
              ...scene.entities,
              [id]: { ...scene.entities[id], name },
            },
          },
        },
      }));
    },

    updateEntityTags: (id, tags) => {
      const scene = get().activeScene();
      set((s) => ({
        scenes: {
          ...s.scenes,
          [scene.id]: {
            ...scene,
            entities: {
              ...scene.entities,
              [id]: { ...scene.entities[id], tags },
            },
          },
        },
      }));
    },

    toggleEntityActive: (id) => {
      const mutateCb = get().onBeforeMutate;
      if (mutateCb) mutateCb();

      const scene = get().activeScene();
      const entity = scene.entities[id];
      set((s) => ({
        scenes: {
          ...s.scenes,
          [scene.id]: {
            ...scene,
            entities: {
              ...scene.entities,
              [id]: { ...entity, active: !entity.active },
            },
          },
        },
      }));
    },

    reparentEntity: (childId, newParentId) => {
      const mutateCb = get().onBeforeMutate;
      if (mutateCb) mutateCb();

      const scene = get().activeScene();
      const child = scene.entities[childId];
      if (!child) return;

      // Prevent cyclical parenting
      if (newParentId) {
        let curr = scene.entities[newParentId];
        while (curr) {
          if (curr.id === childId) return; // Cycle detected
          if (!curr.parentId) break;
          curr = scene.entities[curr.parentId];
        }
      }

      const newEntities = { ...scene.entities };
      const newRootIds = [...scene.rootEntityIds];

      // Remove from old parent
      if (child.parentId) {
        const oldParent = newEntities[child.parentId];
        if (oldParent) {
          newEntities[child.parentId] = {
            ...oldParent,
            childrenIds: oldParent.childrenIds.filter(id => id !== childId)
          };
        }
      } else {
        const idx = newRootIds.indexOf(childId);
        if (idx !== -1) newRootIds.splice(idx, 1);
      }

      // Add to new parent
      newEntities[childId] = { ...child, parentId: newParentId };
      if (newParentId) {
        const newParent = newEntities[newParentId];
        if (newParent) {
          newEntities[newParentId] = {
            ...newParent,
            childrenIds: [...newParent.childrenIds, childId]
          };
        }
      } else {
        if (!newRootIds.includes(childId)) {
          newRootIds.push(childId);
        }
      }

      set((s) => ({
        scenes: {
          ...s.scenes,
          [scene.id]: {
            ...scene,
            entities: newEntities,
            rootEntityIds: newRootIds,
          },
        },
      }));
    },

    addComponent: (entityId, component) => {
      const mutateCb = get().onBeforeMutate;
      if (mutateCb) mutateCb();

      const scene = get().activeScene();
      const entity = scene.entities[entityId];
      if (!entity) return;
      set((s) => ({
        scenes: {
          ...s.scenes,
          [scene.id]: {
            ...scene,
            entities: {
              ...scene.entities,
              [entityId]: {
                ...entity,
                components: { ...entity.components, [component.type]: component },
              },
            },
          },
        },
      }));
    },

    removeComponent: (entityId, type) => {
      const mutateCb = get().onBeforeMutate;
      if (mutateCb) mutateCb();

      const scene = get().activeScene();
      const entity = scene.entities[entityId];
      if (!entity) return;
      const comps = { ...entity.components };
      delete comps[type];
      set((s) => ({
        scenes: {
          ...s.scenes,
          [scene.id]: {
            ...scene,
            entities: { ...scene.entities, [entityId]: { ...entity, components: comps } },
          },
        },
      }));
    },

    updateComponent: (entityId, type, patch) => {
      const scene = get().activeScene();
      const entity = scene.entities[entityId];
      if (!entity) return;
      const existing = entity.components[type];
      if (!existing) return;
      set((s) => ({
        scenes: {
          ...s.scenes,
          [scene.id]: {
            ...scene,
            entities: {
              ...scene.entities,
              [entityId]: {
                ...entity,
                components: {
                  ...entity.components,
                  [type]: { ...existing, ...patch },
                },
              },
            },
          },
        },
      }));
    },

    updateSceneSettings: (patch) => {
      const scene = get().activeScene();
      set((s) => ({
        scenes: { ...s.scenes, [scene.id]: { ...scene, ...patch } },
      }));
    },
  };
});

let editorStoreInstance: import('zustand').UseBoundStore<import('zustand').StoreApi<RuntimeStore>> | null = null;

export const registerEditorStore = (store: any) => {
  editorStoreInstance = store;
};

export const getEngineStore = (): import('zustand').UseBoundStore<import('zustand').StoreApi<RuntimeStore>> => {
  if (checkIsStandalone() || !editorStoreInstance) {
    return useRuntimeStore as any;
  }
  return editorStoreInstance;
};

export function useEngineStore<T>(selector: (state: RuntimeStore) => T): T {
  const store = getEngineStore();
  return store(selector);
}
