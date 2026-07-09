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

export type EditorMode = 'select' | 'translate' | 'rotate' | 'scale';
export type ViewMode = 'perspective' | 'top' | 'front' | 'right';

export interface ConsoleLog {
  id: string;
  type: 'log' | 'warn' | 'error' | 'info';
  message: string;
  timestamp: number;
}

// ── Runtime store: the single source of truth shared by the renderer,
// the engine systems (GameLoop / HUD / NetworkManager) and the compiler
// (StandalonePlayer). The Editor is just another client that mirrors/delegates
// here. Engine code MUST NOT import the editor store. ──────────────────────
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

  // Editor preview helpers (shared so render + editor stay in sync)
  editorMode: EditorMode;
  setEditorMode: (mode: EditorMode) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  activeViewport: 'scene' | 'game';
  setActiveViewport: (viewport: 'scene' | 'game') => void;
  isPlaying: boolean;
  togglePlay: () => void;
  showGrid: boolean;
  toggleGrid: () => void;
  showGizmos: boolean;
  toggleGizmos: () => void;
  showLighting: boolean;
  toggleLighting: () => void;
  snapEnabled: boolean;
  toggleSnap: () => void;
  snapValue: number;
  setSnapValue: (v: number) => void;

  // Console
  consoleLogs: ConsoleLog[];
  addLog: (type: ConsoleLog['type'], message: string) => void;
  clearConsole: () => void;

  // Entity operations (mutate shared scenes)
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

  // Runtime references
  rigidBodyRefs: Record<string, any>;
  setRigidBodyRef: (id: string, ref: any) => void;

  // Scene settings
  updateSceneSettings: (patch: Partial<Scene>) => void;

  // Assets / drag-drop
  prefabs: Entity[];
  instantiatePrefab: (index: number) => void;
  instantiateAsset: (fileName: string) => Promise<void>;

  // Undo / Redo
  historyPast: Scene[];
  historyFuture: Scene[];
  takeHistorySnapshot: () => void;
  undo: () => void;
  redo: () => void;
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

    editorMode: 'translate',
    setEditorMode: (mode) => set({ editorMode: mode }),
    viewMode: 'perspective',
    setViewMode: (mode) => set({ viewMode: mode }),
    activeViewport: 'scene',
    setActiveViewport: (viewport) => set({ activeViewport: viewport }),
    isPlaying: false,
    togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
    showGrid: true,
    toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
    showGizmos: true,
    toggleGizmos: () => set((s) => ({ showGizmos: !s.showGizmos })),
    showLighting: true,
    toggleLighting: () => set((s) => ({ showLighting: !s.showLighting })),
    snapEnabled: false,
    toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
    snapValue: 0.5,
    setSnapValue: (v) => set({ snapValue: v }),

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
        rigidBodyRefs: { ...s.rigidBodyRefs, [id]: ref },
      }));
    },

    historyPast: [],
    historyFuture: [],

    takeHistorySnapshot: () => {
      const { activeSceneId, scenes } = get();
      if (!activeSceneId || !scenes[activeSceneId]) return;
      const sceneClone = JSON.parse(JSON.stringify(scenes[activeSceneId]));
      set((s) => {
        const past = [...s.historyPast];
        if (past.length >= 35) past.shift();
        return {
          historyPast: [...past, sceneClone],
          historyFuture: [],
        };
      });
    },

    undo: () => {
      const { activeSceneId, scenes, historyPast, historyFuture } = get();
      if (!activeSceneId || !scenes[activeSceneId] || historyPast.length === 0) return;

      const currentScene = scenes[activeSceneId];
      const sceneClone = JSON.parse(JSON.stringify(currentScene));

      const newPast = [...historyPast];
      const previousScene = newPast.pop()!;

      set((s) => ({
        scenes: {
          ...s.scenes,
          [activeSceneId]: previousScene,
        },
        historyPast: newPast,
        historyFuture: [...historyFuture, sceneClone],
      }));
      get().addLog('info', '↩️ Desfazer (Undo) executado.');
    },

    redo: () => {
      const { activeSceneId, scenes, historyPast, historyFuture } = get();
      if (!activeSceneId || !scenes[activeSceneId] || historyFuture.length === 0) return;

      const currentScene = scenes[activeSceneId];
      const sceneClone = JSON.parse(JSON.stringify(currentScene));

      const newFuture = [...historyFuture];
      const nextScene = newFuture.pop()!;

      set((s) => ({
        scenes: {
          ...s.scenes,
          [activeSceneId]: nextScene,
        },
        historyPast: [...historyPast, sceneClone],
        historyFuture: newFuture,
      }));
      get().addLog('info', '↪️ Refazer (Redo) executado.');
    },

    createEntity: (type) => {
      get().takeHistorySnapshot();
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
      get().takeHistorySnapshot();
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
      get().takeHistorySnapshot();
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
      get().takeHistorySnapshot();
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
      get().takeHistorySnapshot();
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
      get().takeHistorySnapshot();
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
            childrenIds: oldParent.childrenIds.filter(id => id !== childId),
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
            childrenIds: [...newParent.childrenIds, childId],
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
      get().takeHistorySnapshot();
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
      get().takeHistorySnapshot();
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

    prefabs: [],

    instantiatePrefab: (index) => {
      const prefab = get().prefabs[index];
      if (!prefab) return;

      const scene = get().activeScene();
      const newEntity: Entity = JSON.parse(JSON.stringify(prefab));
      newEntity.id = uuidv4();

      // Desloca levemente se tiver Transform
      if (newEntity.components.Transform) {
        newEntity.components.Transform.position[0] += 0.5;
        newEntity.components.Transform.position[1] += 0.5;
      }

      set((s) => ({
        scenes: {
          ...s.scenes,
          [scene.id]: {
            ...scene,
            entities: { ...scene.entities, [newEntity.id]: newEntity },
            rootEntityIds: [...scene.rootEntityIds, newEntity.id],
          },
        },
        selectedEntityId: newEntity.id,
      }));
      get().addLog('info', `🎯 Prefab instanciado: "${newEntity.name}"`);
    },

    instantiateAsset: async (fileName: string) => {
      const { addLog, activeScene } = get();
      try {
        const scene = activeScene();
        const src = `/api/project/get-asset?project=${encodeURIComponent(scene.name)}&file=${encodeURIComponent(fileName)}`;

        const entity: Entity = {
          id: uuidv4(),
          name: fileName.replace(/\.(gltf|glb|fbx)$/i, ''),
          parentId: null,
          childrenIds: [],
          active: true,
          tags: ['gltf'],
          components: {
            Transform: {
              type: 'Transform',
              position: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1],
            },
            GLTFModel: {
              type: 'GLTFModel',
              src,
              fileName,
              modelScale: 1,
              castShadow: true,
              receiveShadow: true,
              overrideMaterial: 'none',
              color: '#ffffff',
              roughness: 0.5,
              metalness: 0.1,
              textureUrl: '',
              normalMapUrl: '',
              normalScale: 1,
            },
          },
        };

        addLog('info', `📦 Instanciado do projeto: "${fileName}"`);
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
      } catch (err) {
        addLog('error', `Falha ao instanciar "${fileName}": ${String(err)}`);
      }
    },
  };
});
