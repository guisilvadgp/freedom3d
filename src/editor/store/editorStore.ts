import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Entity, EntityId, Scene, SceneId, AnyComponent, ComponentType } from '../../engine/ecs/types';
import {
  saveScene as dbSaveScene,
  loadScene as dbLoadScene,
  listScenes,
  deleteScene as dbDeleteScene,
  saveGLTFAsset,
  loadGLTFAsset,
} from '../../engine/core/persistence';
import type { SceneMetadata } from '../../engine/core/persistence';
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
} from '../../engine/ecs/EntityFactory';

export type EditorMode = 'select' | 'translate' | 'rotate' | 'scale';
export type ViewMode = 'perspective' | 'top' | 'front' | 'right';
export type PanelTab = 'hierarchy' | 'assets' | 'console' | 'script';

export interface ConsoleLog {
  id: string;
  type: 'log' | 'warn' | 'error' | 'info';
  message: string;
  timestamp: number;
}

function makeDefaultScene(): Scene {
  const light = createDirectionalLight();
  const plane = createPlane();
  plane.components.RigidBody = {
    type: 'RigidBody',
    mass: 0,
    isStatic: true,
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

interface EditorStore {
  // Scenes
  scenes: Record<SceneId, Scene>;
  activeSceneId: SceneId;
  activeScene: () => Scene;

  // Selection
  selectedEntityId: EntityId | null;
  selectEntity: (id: EntityId | null) => void;
  selectedEntity: () => Entity | null;

  // Editor state
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
  snapEnabled: boolean;
  toggleSnap: () => void;
  snapValue: number;
  setSnapValue: (v: number) => void;

  // Bottom panel
  bottomTab: PanelTab;
  setBottomTab: (tab: PanelTab) => void;

  // Console
  consoleLogs: ConsoleLog[];
  addLog: (type: ConsoleLog['type'], message: string) => void;
  clearConsole: () => void;

  // Entity operations
  createEntity: (type: string) => void;
  deleteEntity: (id: EntityId) => void;
  duplicateEntity: (id: EntityId) => void;
  renameEntity: (id: EntityId, name: string) => void;
  toggleEntityActive: (id: EntityId) => void;
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

  publishToPreview: () => Promise<void>;

  // GLTF Import & Assets
  importGLTF: (file: File) => Promise<void>;
  instantiateAsset: (fileName: string) => Promise<void>;

  // Prefabs
  prefabs: Entity[];
  createPrefab: (id: EntityId) => void;
  instantiatePrefab: (index: number) => void;

  // Persistence
  savedScenes: SceneMetadata[];
  isSaving: boolean;
  saveCurrentScene: () => Promise<void>;
  loadSavedScene: (id: string) => Promise<void>;
  deleteSavedScene: (id: string) => Promise<void>;
  refreshSavedScenes: () => Promise<void>;
  showSaveModal: boolean;
  setShowSaveModal: (v: boolean) => void;

  hasUnpublishedChanges: boolean;
}

export const useEditorStore = create<EditorStore>((set, get) => {
  const defaultScene = makeDefaultScene();

  return {
    scenes: { [defaultScene.id]: defaultScene },
    activeSceneId: defaultScene.id,
    activeScene: () => get().scenes[get().activeSceneId],

    hasUnpublishedChanges: false,

    rigidBodyRefs: {},
    setRigidBodyRef: (id, ref) => {
      set((s) => ({
        rigidBodyRefs: { ...s.rigidBodyRefs, [id]: ref }
      }));
    },

    selectedEntityId: null,
    selectEntity: (id) => set({ selectedEntityId: id }),
    selectedEntity: () => {
      const { selectedEntityId, activeScene } = get();
      if (!selectedEntityId) return null;
      return activeScene().entities[selectedEntityId] ?? null;
    },

    editorMode: 'translate',
    setEditorMode: (mode) => set({ editorMode: mode }),
    viewMode: 'perspective',
    setViewMode: (mode) => set({ viewMode: mode }),
    activeViewport: 'scene',
    setActiveViewport: (viewport) => set({ activeViewport: viewport }),
    isPlaying: false,
    togglePlay: () => set((s) => {
      const isNowPlaying = !s.isPlaying;
      return {
        isPlaying: isNowPlaying,
        activeViewport: isNowPlaying ? 'game' : 'scene',
        consoleLogs: isNowPlaying ? [] : s.consoleLogs
      };
    }),
    showGrid: true,
    toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
    showGizmos: true,
    toggleGizmos: () => set((s) => ({ showGizmos: !s.showGizmos })),
    snapEnabled: false,
    toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
    snapValue: 0.5,
    setSnapValue: (v) => set({ snapValue: v }),

    bottomTab: 'console',
    setBottomTab: (tab) => set({ bottomTab: tab }),

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

    createEntity: (type) => {
      const scene = get().activeScene();
      let entity: Entity;
      switch (type) {
        case 'cube': entity = createCube(); break;
        case 'sphere': entity = createSphere(); break;
        case 'plane': entity = createPlane('Plane'); entity.components.Transform!.scale = [1,1,1]; break;
        case 'cylinder': entity = createCylinder(); break;
        case 'torus': entity = createTorus(); break;
        case 'directional': entity = createDirectionalLight(); break;
        case 'point': entity = createPointLight(); break;
        case 'first-person': entity = createFirstPersonPlayer(); break;
        case 'third-person': entity = createThirdPersonPlayer(); break;
        case 'vr-position': entity = createVRPosition(); break;
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
        hasUnpublishedChanges: true,
      }));
    },

    deleteEntity: (id) => {
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
        hasUnpublishedChanges: true,
      }));
    },

    duplicateEntity: (id) => {
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
        hasUnpublishedChanges: true,
      }));
    },

    renameEntity: (id, name) => {
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
        hasUnpublishedChanges: true,
      }));
    },

    toggleEntityActive: (id) => {
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
        hasUnpublishedChanges: true,
      }));
    },

    reparentEntity: (childId, newParentId) => {
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
        hasUnpublishedChanges: true,
      }));
    },

    addComponent: (entityId, component) => {
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
        hasUnpublishedChanges: true,
      }));
    },

    removeComponent: (entityId, type) => {
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
        hasUnpublishedChanges: true,
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
        hasUnpublishedChanges: true,
      }));
    },

    updateSceneSettings: (patch) => {
      const scene = get().activeScene();
      set((s) => ({
        scenes: { ...s.scenes, [scene.id]: { ...scene, ...patch } },
        hasUnpublishedChanges: true,
      }));
    },

    publishToPreview: async () => {
      const { activeScene, addLog } = get();
      const scene = activeScene();
      try {
        Object.values(scene.entities).forEach(e => {
          if (e.components.GLTFModel && e.components.GLTFModel.fileName) {
            loadGLTFAsset(e.components.GLTFModel.fileName);
          }
        });
        const payload = { ...scene, publishedAt: Date.now() };
        await fetch('/api/sync', { method: 'POST', body: JSON.stringify(payload) });
        addLog('info', '🚀 Jogo publicado para o Preview com sucesso!');
        set({ hasUnpublishedChanges: false });
      } catch (err) {
        addLog('error', 'Falha ao publicar para o Preview.');
      }
    },

    // ── GLTF Import ────────────────────────────────────────────
    importGLTF: async (file: File) => {
      const { addLog, activeScene } = get();
      try {
        const buffer = await file.arrayBuffer();
        // Salva o asset no IndexedDB para persistência
        await saveGLTFAsset(file.name, buffer);
        // Cria blob URL para uso imediato
        const blob = new Blob([buffer], { type: 'model/gltf-binary' });
        const src = URL.createObjectURL(blob);
        fetch('/api/asset/' + encodeURIComponent(file.name), { method: 'POST', body: buffer, headers: {'Content-Type': 'application/octet-stream'} }).then(r => console.log('Upload result:', r.status)).catch(e => console.error('Upload failed:', e));
        

        const scene = activeScene();
        const entity: Entity = {
          id: uuidv4(),
          name: file.name.replace(/\.(gltf|glb)$/i, ''),
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
              fileName: file.name,
              modelScale: 1,
              castShadow: true,
              receiveShadow: true,
            },
          },
        };

        addLog('info', `📦 Modelo importado: "${file.name}" (${(file.size / 1024).toFixed(1)} KB)`);
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
          hasUnpublishedChanges: true,
        }));
      } catch (err) {
        addLog('error', `Falha ao importar "${file.name}": ${String(err)}`);
      }
    },

    instantiateAsset: async (fileName: string) => {
      const { addLog, activeScene } = get();
      try {
        const src = await loadGLTFAsset(fileName);
        if (!src) throw new Error('Asset não encontrado no banco.');

        const scene = activeScene();
        const entity: Entity = {
          id: uuidv4(),
          name: fileName.replace(/\.(gltf|glb)$/i, ''),
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
            },
          },
        };

        addLog('info', `📦 Instanciado: "${fileName}"`);
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
          hasUnpublishedChanges: true,
        }));
      } catch (err) {
        addLog('error', `Falha ao instanciar "${fileName}": ${String(err)}`);
      }
    },

    // ── Prefabs ─────────────────────────────────────────────────
    prefabs: [],
    createPrefab: (id) => {
      const scene = get().activeScene();
      const entity = scene.entities[id];
      if (!entity) return;
      
      const prefab = JSON.parse(JSON.stringify(entity));
      set((s) => ({ prefabs: [...s.prefabs, prefab] }));
      get().addLog('info', `🎯 Prefab "${entity.name}" criado com sucesso.`);
    },
    
    instantiatePrefab: (index) => {
      const prefab = get().prefabs[index];
      if (!prefab) return;
      
      const scene = get().activeScene();
      const newEntity: Entity = JSON.parse(JSON.stringify(prefab));
      newEntity.id = uuidv4();
      
      // Se tiver Transform, desloca levemente
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
        hasUnpublishedChanges: true,
      }));
      get().addLog('info', `🎯 Prefab instanciado: "${newEntity.name}"`);
    },

    // ── Persistence ─────────────────────────────────────────────
    savedScenes: [],
    isSaving: false,
    showSaveModal: false,
    setShowSaveModal: (v) => set({ showSaveModal: v }),

    saveCurrentScene: async () => {
      const { activeScene, addLog } = get();
      set({ isSaving: true });
      try {
        const scene = activeScene();
        await dbSaveScene(scene);
        addLog('info', `💾 Cena "${scene.name}" salva com sucesso.`);
        await get().refreshSavedScenes();
      } catch (err) {
        get().addLog('error', `Falha ao salvar: ${String(err)}`);
      } finally {
        set({ isSaving: false });
      }
    },

    loadSavedScene: async (id) => {
      const { addLog } = get();
      try {
        const record = await dbLoadScene(id);
        if (!record) { addLog('warn', 'Cena não encontrada.'); return; }

        const scene = record.scene;
        // Reidrata blob URLs de modelos GLTF
        for (const entity of Object.values(scene.entities)) {
          if (entity.components.GLTFModel) {
            const { fileName } = entity.components.GLTFModel;
            const src = await loadGLTFAsset(fileName);
            if (src) {
              entity.components.GLTFModel.src = src;
            } else {
              addLog('warn', `Asset GLTF "${fileName}" não encontrado no cache. Re-importe o arquivo.`);
              entity.active = false;
            }
          }
        }

        set((s) => ({
          scenes: { ...s.scenes, [scene.id]: scene },
          activeSceneId: scene.id,
          selectedEntityId: null,
          showSaveModal: false,
        }));
        addLog('info', `📂 Cena "${scene.name}" carregada.`);
      } catch (err) {
        get().addLog('error', `Falha ao carregar: ${String(err)}`);
      }
    },

    deleteSavedScene: async (id) => {
      await dbDeleteScene(id);
      await get().refreshSavedScenes();
      get().addLog('warn', 'Cena deletada do armazenamento.');
    },

    refreshSavedScenes: async () => {
      try {
        const list = await listScenes();
        set({ savedScenes: list });
      } catch (_) {
        // IndexedDB pode não estar disponível em alguns contextos
      }
    },
  };
});









