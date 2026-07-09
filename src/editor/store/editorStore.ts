import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Entity, EntityId, Scene, SceneId, AnyComponent, ComponentType } from '../../engine/ecs/types';
import type { SceneMetadata } from '../../engine/core/persistence';
import {
  createDirectionalLight,
  createPlane,
  createFirstPersonPlayer,
} from '../../engine/ecs/EntityFactory';
import {
  useRuntimeStore,
  type ConsoleLog,
  type EditorMode,
  type ViewMode,
} from '../../engine/runtime/runtimeStore';

export type PanelTab = 'hierarchy' | 'assets' | 'console' | 'script' | 'explorer' | 'ai-assistant';

function makeDefaultScene(): Scene {
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
    roomId: uuidv4(),   // ID único da sala gerado automaticamente
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

// ── Editor Store (facade) ────────────────────────────────────────────────
// The Editor is a "client" of the engine. The shared, single source of truth
// (scenes, play state, view flags, selection, console, history, prefabs) lives
// in `runtimeStore`. This store:
//   • keeps editor-only UI/authoring state (panels, project CRUD, save/load,
//     asset browser, toast),
//   • delegates scene/runtime mutations to `useRuntimeStore`,
//   • mirrors the shared keys from `useRuntimeStore` so the ~185 panel usages
//     that read `useEditorStore(s => s.scenes[...])` keep working unchanged.
// Engine code MUST NOT import this store (direction: editor → engine only).
interface EditorStore {
  // Scenes (mirrored from runtime)
  scenes: Record<SceneId, Scene>;
  activeSceneId: SceneId;
  activeScene: () => Scene;

  // Selection (mirrored from runtime)
  selectedEntityId: EntityId | null;
  selectEntity: (id: EntityId | null) => void;
  selectedEntity: () => Entity | null;
  focusTrigger: { entityId: string; timestamp: number } | null;
  focusEntity: (id: string) => void;

  // Editor preview helpers (mirrored from runtime)
  editorMode: EditorMode;
  setEditorMode: (mode: EditorMode) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  activeViewport: 'scene' | 'game';
  setActiveViewport: (viewport: 'scene' | 'game') => void;
  isPlaying: boolean;
  playModeBackupScene: Scene | null;
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

  // Bottom panel (editor-only)
  bottomTab: PanelTab;
  setBottomTab: (tab: PanelTab) => void;

  // Console (mirrored from runtime)
  consoleLogs: ConsoleLog[];
  addLog: (type: ConsoleLog['type'], message: string) => void;
  clearConsole: () => void;

  // Entity operations (delegate to runtime)
  createEntity: (type: string) => void;
  deleteEntity: (id: EntityId) => void;
  duplicateEntity: (id: EntityId) => void;
  renameEntity: (id: EntityId, name: string) => void;
  toggleEntityActive: (id: EntityId) => void;
  updateEntityTags: (id: EntityId, tags: string[]) => void;
  reparentEntity: (childId: EntityId, newParentId: EntityId | null) => void;

  // Component operations (delegate to runtime)
  addComponent: (entityId: EntityId, component: AnyComponent) => void;
  removeComponent: (entityId: EntityId, type: ComponentType) => void;
  updateComponent: (entityId: EntityId, type: ComponentType, patch: Partial<AnyComponent>) => void;

  // Runtime references (mirrored from runtime)
  rigidBodyRefs: Record<string, any>;
  setRigidBodyRef: (id: string, ref: any) => void;

  // Scene settings (delegate to runtime)
  updateSceneSettings: (patch: Partial<Scene>) => void;

  publishToPreview: () => Promise<void>;

  // GLTF Import (editor-only, mutates runtime scenes)
  importGLTF: (file: File) => Promise<void>;

  // Prefabs (mirrored from runtime)
  prefabs: Entity[];
  createPrefab: (id: EntityId) => void;
  instantiatePrefab: (index: number) => void;
  instantiateAsset: (fileName: string) => Promise<void>;

  // Persistence (editor-only)
  savedScenes: SceneMetadata[];
  isSaving: boolean;
  saveCurrentScene: () => Promise<void>;
  loadSavedScene: (id: string) => Promise<void>;
  deleteSavedScene: (id: string) => Promise<void>;
  refreshSavedScenes: () => Promise<void>;
  showSaveModal: boolean;
  setShowSaveModal: (v: boolean) => void;

  // Toast notifications (editor-only)
  toast: { message: string; type: 'success' | 'info' | 'error' | 'warning' } | null;
  showToast: (message: string, type?: 'success' | 'info' | 'error' | 'warning') => void;

  // Projects / Scenes management (editor-only)
  createNewProject: (name: string) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;

  currentProjectName: string;
  activeSceneName: string;
  projectScenes: string[];
  refreshProjectScenes: () => Promise<void>;
  createNewScene: (sceneName: string) => Promise<void>;
  loadProjectScene: (sceneName: string) => Promise<void>;
  deleteProjectScene: (sceneName: string) => Promise<void>;
  duplicateProjectScene: (sceneName: string) => Promise<void>;

  hasUnpublishedChanges: boolean;

  // Undo / Redo (mirrored from runtime)
  historyPast: Scene[];
  historyFuture: Scene[];
  takeHistorySnapshot: () => void;
  undo: () => void;
  redo: () => void;
}

export const useEditorStore = create<EditorStore>((set, get) => {
  // Seed the mirrored shared fields with the runtime's current values.
  const rt0 = useRuntimeStore.getState();

  return {
    // ── Mirrored shared fields ──
    scenes: rt0.scenes,
    activeSceneId: rt0.activeSceneId,
    activeScene: () => useRuntimeStore.getState().scenes[useRuntimeStore.getState().activeSceneId],

    selectedEntityId: rt0.selectedEntityId,
    selectEntity: (id) => useRuntimeStore.getState().selectEntity(id),
    selectedEntity: () => {
      const { selectedEntityId, activeScene } = useRuntimeStore.getState();
      if (!selectedEntityId) return null;
      return activeScene().entities[selectedEntityId] ?? null;
    },
    focusTrigger: rt0.focusTrigger,
    focusEntity: (id) => useRuntimeStore.getState().focusEntity(id),

    editorMode: rt0.editorMode,
    setEditorMode: (mode) => useRuntimeStore.getState().setEditorMode(mode),
    viewMode: 'perspective',
    setViewMode: (mode) => set({ viewMode: mode }),
    activeViewport: rt0.activeViewport,
    setActiveViewport: (viewport) => useRuntimeStore.getState().setActiveViewport(viewport),
    isPlaying: rt0.isPlaying,
    playModeBackupScene: null,
    showGrid: rt0.showGrid,
    toggleGrid: () => useRuntimeStore.getState().toggleGrid(),
    showGizmos: rt0.showGizmos,
    toggleGizmos: () => useRuntimeStore.getState().toggleGizmos(),
    showLighting: rt0.showLighting,
    toggleLighting: () => useRuntimeStore.getState().toggleLighting(),
    snapEnabled: rt0.snapEnabled,
    toggleSnap: () => useRuntimeStore.getState().toggleSnap(),
    snapValue: rt0.snapValue,
    setSnapValue: (v) => useRuntimeStore.getState().setSnapValue(v),

    bottomTab: 'explorer',
    setBottomTab: (tab) => set({ bottomTab: tab }),

    consoleLogs: rt0.consoleLogs,
    addLog: (type, message) => useRuntimeStore.getState().addLog(type, message),
    clearConsole: () => useRuntimeStore.getState().clearConsole(),

    createEntity: (type) => useRuntimeStore.getState().createEntity(type),
    deleteEntity: (id) => useRuntimeStore.getState().deleteEntity(id),
    duplicateEntity: (id) => useRuntimeStore.getState().duplicateEntity(id),
    renameEntity: (id, name) => useRuntimeStore.getState().renameEntity(id, name),
    toggleEntityActive: (id) => useRuntimeStore.getState().toggleEntityActive(id),
    updateEntityTags: (id, tags) => useRuntimeStore.getState().updateEntityTags(id, tags),
    reparentEntity: (childId, newParentId) => useRuntimeStore.getState().reparentEntity(childId, newParentId),

    addComponent: (entityId, component) => useRuntimeStore.getState().addComponent(entityId, component),
    removeComponent: (entityId, type) => useRuntimeStore.getState().removeComponent(entityId, type),
    updateComponent: (entityId, type, patch) => useRuntimeStore.getState().updateComponent(entityId, type, patch),

    rigidBodyRefs: rt0.rigidBodyRefs,
    setRigidBodyRef: (id, ref) => useRuntimeStore.getState().setRigidBodyRef(id, ref),

    updateSceneSettings: (patch) => useRuntimeStore.getState().updateSceneSettings(patch),

    prefabs: rt0.prefabs,
    createPrefab: (id) => {
      const scene = get().activeScene();
      const entity = scene.entities[id];
      if (!entity) return;

      const prefab = JSON.parse(JSON.stringify(entity));
      useRuntimeStore.setState((s) => ({ prefabs: [...s.prefabs, prefab] }));
      get().addLog('info', `🎯 Prefab "${entity.name}" criado com sucesso.`);
    },
    instantiatePrefab: (index) => useRuntimeStore.getState().instantiatePrefab(index),
    instantiateAsset: (fileName) => useRuntimeStore.getState().instantiateAsset(fileName),

    historyPast: rt0.historyPast,
    historyFuture: rt0.historyFuture,
    takeHistorySnapshot: () => useRuntimeStore.getState().takeHistorySnapshot(),
    undo: () => useRuntimeStore.getState().undo(),
    redo: () => useRuntimeStore.getState().redo(),

    // ── Editor-only state / actions ──
    toast: null,
    showToast: (message, type = 'success') => {
      set({ toast: { message, type } });
      setTimeout(() => {
        set((s) => s.toast?.message === message ? { toast: null } : {});
      }, 3000);
    },

    currentProjectName: '',
    activeSceneName: 'Main Scene',
    projectScenes: [],

    hasUnpublishedChanges: false,

    savedScenes: [],
    isSaving: false,
    showSaveModal: false,
    setShowSaveModal: (v) => set({ showSaveModal: v }),

    saveCurrentScene: async () => {
      const { activeScene, currentProjectName, activeSceneName, addLog, showToast } = get();
      set({ isSaving: true });
      try {
        const scene = activeScene();

        // Filtra as entidades ghosts de multiplayer para não salvar no arquivo da cena
        const cleanedEntities = { ...scene.entities };
        Object.keys(cleanedEntities).forEach(id => {
          if (id.startsWith('ghost-')) {
            delete cleanedEntities[id];
          }
        });

        const cleanedScene = {
          ...scene,
          entities: cleanedEntities,
          rootEntityIds: scene.rootEntityIds.filter(id => !id.startsWith('ghost-'))
        };

        const finalProjName = currentProjectName || scene.name;
        const finalSceneName = activeSceneName || 'Main Scene';

        const response = await fetch('/api/project/save-scene', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectName: finalProjName,
            sceneName: finalSceneName,
            scene: cleanedScene
          })
        });
        if (!response.ok) throw new Error('Falha ao salvar no servidor');

        addLog('info', `💾 Projeto "${finalProjName}" (Cena: "${finalSceneName}") salvo no disco com sucesso.`);
        showToast(`Cena "${finalSceneName}" salva com sucesso!`, 'success');
        set({ hasUnpublishedChanges: false });
        await get().refreshSavedScenes();
        await get().refreshProjectScenes();
      } catch (err) {
        get().addLog('error', `Falha ao salvar no disco: ${String(err)}`);
        showToast('Falha ao salvar o projeto!', 'error');
      } finally {
        set({ isSaving: false });
      }
    },

    loadSavedScene: async (id) => {
      const { addLog, showToast } = get();
      try {
        const response = await fetch(`/api/project/load-scene?name=${encodeURIComponent(id)}&sceneName=Main Scene`);
        if (!response.ok) throw new Error('Projeto não encontrado no disco');
        const scene = await response.json();

        if (!scene.rootEntityIds || !Array.isArray(scene.rootEntityIds)) {
          scene.rootEntityIds = Object.values(scene.entities || {})
            .filter((e: any) => !e.parentId)
            .map((e: any) => e.id);
        }

        if (!scene.roomId) {
          scene.roomId = id;
        }

        for (const entity of Object.values(scene.entities || {}) as any[]) {
          if (entity.components.GLTFModel) {
            const { fileName } = entity.components.GLTFModel;
            entity.components.GLTFModel.src = `/api/project/get-asset?project=${encodeURIComponent(id)}&file=${encodeURIComponent(fileName)}`;
          }
        }

        useRuntimeStore.setState({
          scenes: { ...useRuntimeStore.getState().scenes, [scene.id]: scene },
          activeSceneId: scene.id,
          selectedEntityId: null,
        });
        set({
          currentProjectName: id,
          activeSceneName: 'Main Scene',
          showSaveModal: false,
          hasUnpublishedChanges: false,
        });
        addLog('info', `📂 Projeto "${id}" carregado.`);
        showToast(`Projeto "${id}" carregado!`);
        await get().refreshProjectScenes();
      } catch (err) {
        get().addLog('error', `Falha ao carregar do disco: ${String(err)}`);
        showToast('Erro ao carregar o projeto', 'error');
      }
    },

    deleteSavedScene: async (id) => {
      const { refreshSavedScenes, showToast } = get();
      try {
        const response = await fetch('/api/project/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: id })
        });
        if (!response.ok) throw new Error('Erro ao deletar projeto');

        await refreshSavedScenes();
        showToast('Projeto removido do disco', 'warning');
        get().addLog('warn', `Pasta do projeto "${id}" excluída com sucesso.`);
      } catch (err) {
        get().addLog('error', `Falha ao excluir projeto do disco: ${String(err)}`);
        showToast('Erro ao excluir projeto', 'error');
      }
    },

    refreshSavedScenes: async () => {
      try {
        const response = await fetch('/api/projects');
        if (response.ok) {
          const list = await response.json();
          set({ savedScenes: list });
        }
      } catch (_) { }
    },

    publishToPreview: async () => {
      const { activeScene, addLog, saveCurrentScene, showToast } = get();
      try {
        await saveCurrentScene();

        const scene = activeScene();
        const payload = { ...scene, publishedAt: Date.now() };
        await fetch('/api/sync', { method: 'POST', body: JSON.stringify(payload) });
        addLog('info', '🚀 Jogo publicado para o Preview com sucesso!');
        showToast('Jogo publicado e salvo com sucesso!');
        set({ hasUnpublishedChanges: false });
      } catch (err) {
        addLog('error', 'Falha ao publicar para o Preview.');
        showToast('Falha ao publicar para o Preview.', 'error');
      }
    },

    importGLTF: async (file: File) => {
      const { addLog, activeScene } = get();
      try {
        const scene = activeScene();
        const buffer = await file.arrayBuffer();

        const uploadUrl = `/api/project/upload-asset?project=${encodeURIComponent(scene.name)}&file=${encodeURIComponent(file.name)}`;
        const res = await fetch(uploadUrl, {
          method: 'POST',
          body: buffer,
          headers: { 'Content-Type': 'application/octet-stream' }
        });
        if (!res.ok) throw new Error('Falha no upload do asset para o servidor.');

        const src = `/api/project/get-asset?project=${encodeURIComponent(scene.name)}&file=${encodeURIComponent(file.name)}`;

        const entity: Entity = {
          id: uuidv4(),
          name: file.name.replace(/\.(gltf|glb|fbx)$/i, ''),
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

        addLog('info', `📦 Modelo importado no projeto: "${file.name}" (${(file.size / 1024).toFixed(1)} KB)`);
        useRuntimeStore.setState((s) => ({
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
        addLog('error', `Falha ao importar "${file.name}": ${String(err)}`);
      }
    },

    createNewProject: async (name: string) => {
      const { refreshSavedScenes, showToast, addLog } = get();
      try {
        const cleanName = name.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Novo Projeto';

        const response = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: cleanName })
        });
        if (!response.ok) throw new Error('Erro ao criar pasta no disco');
        const data = await response.json();
        const finalName = data.name;

        const newScene = makeDefaultScene();
        newScene.id = finalName;
        newScene.name = finalName;
        if (!newScene.roomId) newScene.roomId = uuidv4();

        const saveResponse = await fetch('/api/project/save-scene', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectName: finalName, sceneName: 'Main Scene', scene: newScene })
        });
        if (!saveResponse.ok) throw new Error('Erro ao inicializar scene.json do projeto');

        useRuntimeStore.setState({
          scenes: { ...useRuntimeStore.getState().scenes, [finalName]: newScene },
          activeSceneId: finalName,
          selectedEntityId: null,
        });
        set({
          currentProjectName: finalName,
          activeSceneName: 'Main Scene',
          showSaveModal: false,
          hasUnpublishedChanges: false,
        });

        addLog('info', `📁 Novo projeto criado no disco: "${finalName}"`);
        showToast(`Projeto "${finalName}" criado!`);
        await refreshSavedScenes();
        await get().refreshProjectScenes();
      } catch (err) {
        addLog('error', `Falha ao criar projeto no disco: ${String(err)}`);
        showToast('Erro ao criar novo projeto', 'error');
      }
    },

    renameProject: async (id: string, name: string) => {
      const { addLog, refreshSavedScenes, showToast } = get();
      try {
        const cleanName = name.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Sem nome';

        const response = await fetch('/api/project/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldName: id, newName: cleanName })
        });
        if (!response.ok) throw new Error('Erro ao renomear pasta de projeto no servidor');
        const data = await response.json();
        const finalNewName = data.name;

        if (get().activeSceneId === id || get().currentProjectName === id) {
          const currentScene = useRuntimeStore.getState().scenes[id] || get().activeScene();
          const updatedScene = { ...currentScene, id: finalNewName, name: finalNewName };
          useRuntimeStore.setState({
            scenes: { ...useRuntimeStore.getState().scenes, [finalNewName]: updatedScene },
            activeSceneId: finalNewName,
            selectedEntityId: null,
          });
        }

        set({ currentProjectName: finalNewName, hasUnpublishedChanges: false });

        addLog('info', `✏️ Pasta do projeto renomeada de "${id}" para "${finalNewName}".`);
        showToast(`Projeto renomeado para "${finalNewName}"`);
        await refreshSavedScenes();
      } catch (err) {
        addLog('error', `Falha ao renomear pasta: ${String(err)}`);
        showToast('Erro ao renomear projeto', 'error');
      }
    },

    loadProjectScene: async (sceneName: string) => {
      const { currentProjectName, addLog, showToast } = get();
      if (!currentProjectName) return;
      try {
        const response = await fetch(`/api/project/load-scene?name=${encodeURIComponent(currentProjectName)}&sceneName=${encodeURIComponent(sceneName)}`);
        if (!response.ok) throw new Error('Cena não encontrada no disco');
        const scene = await response.json();

        for (const entity of Object.values(scene.entities) as any[]) {
          if (entity.components.GLTFModel) {
            const { fileName } = entity.components.GLTFModel;
            entity.components.GLTFModel.src = `/api/project/get-asset?project=${encodeURIComponent(currentProjectName)}&file=${encodeURIComponent(fileName)}`;
          }
        }

        useRuntimeStore.setState({
          scenes: { ...useRuntimeStore.getState().scenes, [scene.id]: scene },
          activeSceneId: scene.id,
          selectedEntityId: null,
        });
        set({ activeSceneName: sceneName, hasUnpublishedChanges: false });
        addLog('info', `🎬 Cena "${sceneName}" carregada.`);
        showToast(`Cena "${sceneName}" carregada!`);
      } catch (err) {
        addLog('error', `Falha ao carregar cena: ${String(err)}`);
        showToast('Erro ao carregar cena', 'error');
      }
    },

    createNewScene: async (sceneName: string) => {
      const { currentProjectName, addLog, showToast, refreshProjectScenes } = get();
      if (!currentProjectName) return;

      const sceneNameClean = sceneName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Nova Cena';

      const newScene = makeDefaultScene();
      newScene.id = uuidv4();
      newScene.name = sceneNameClean;

      try {
        const response = await fetch('/api/project/save-scene', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectName: currentProjectName,
            sceneName: sceneNameClean,
            scene: newScene
          })
        });
        if (!response.ok) throw new Error('Erro ao salvar nova cena no servidor');

        useRuntimeStore.setState({
          scenes: { ...useRuntimeStore.getState().scenes, [newScene.id]: newScene },
          activeSceneId: newScene.id,
          selectedEntityId: null,
        });

        set({ activeSceneName: sceneNameClean, hasUnpublishedChanges: false });

        addLog('info', `🎬 Nova cena "${sceneNameClean}" criada no projeto "${currentProjectName}".`);
        showToast(`Cena "${sceneNameClean}" criada!`, 'success');
        await refreshProjectScenes();
      } catch (err) {
        addLog('error', `Falha ao criar cena: ${String(err)}`);
        showToast('Erro ao criar cena', 'error');
      }
    },

    deleteProjectScene: async (sceneName: string) => {
      const { currentProjectName, activeSceneName, refreshProjectScenes, addLog, showToast } = get();
      if (!currentProjectName) return;
      if (sceneName === 'Main Scene' || sceneName === activeSceneName) {
        showToast('Não é possível excluir a cena ativa ou a cena principal', 'error');
        return;
      }
      try {
        const response = await fetch('/api/project/delete-scene', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectName: currentProjectName, sceneName })
        });
        if (!response.ok) throw new Error('Erro ao deletar cena');

        await refreshProjectScenes();
        showToast(`Cena "${sceneName}" removida`, 'warning');
        addLog('warn', `Cena "${sceneName}" excluída do projeto.`);
      } catch (err) {
        addLog('error', `Falha ao excluir cena: ${String(err)}`);
        showToast('Erro ao excluir cena', 'error');
      }
    },

    duplicateProjectScene: async (newSceneName: string) => {
      const { activeScene, currentProjectName, addLog, showToast, refreshProjectScenes } = get();
      if (!currentProjectName) return;
      const cleanName = newSceneName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Cena Duplicada';
      const scene = activeScene();
      const clonedScene = {
        ...scene,
        id: uuidv4(),
        name: cleanName
      };
      try {
        const response = await fetch('/api/project/save-scene', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectName: currentProjectName,
            sceneName: cleanName,
            scene: clonedScene
          })
        });
        if (!response.ok) throw new Error('Erro ao salvar cena duplicada');
        useRuntimeStore.setState({
          scenes: { ...useRuntimeStore.getState().scenes, [clonedScene.id]: clonedScene },
          activeSceneId: clonedScene.id,
          selectedEntityId: null,
        });
        set({ activeSceneName: cleanName, hasUnpublishedChanges: false });
        addLog('info', `🎬 Cena duplicada com sucesso para "${cleanName}" no projeto "${currentProjectName}".`);
        showToast(`Cena duplicada como "${cleanName}"!`, 'success');
        await refreshProjectScenes();
      } catch (err) {
        addLog('error', `Falha ao duplicar cena: ${String(err)}`);
        showToast('Erro ao duplicar cena', 'error');
      }
    },

    refreshProjectScenes: async () => {
      const { currentProjectName } = get();
      if (!currentProjectName) return;
      try {
        const response = await fetch(`/api/project/scenes?project=${encodeURIComponent(currentProjectName)}`);
        if (response.ok) {
          const list = await response.json();
          set({ projectScenes: list });
        }
      } catch (_) { }
    },

    togglePlay: () => {
      const rt = useRuntimeStore.getState();
      const isNowPlaying = !rt.isPlaying;

      if (isNowPlaying) {
        const activeScene = rt.scenes[rt.activeSceneId];
        const backup = activeScene ? JSON.parse(JSON.stringify(activeScene)) : null;

        setTimeout(() => {
          const container = document.querySelector('.scene-view') || document.body;
          const canvas = document.querySelector('.scene-view canvas') || document.querySelector('canvas');

          if (container && container.requestFullscreen) {
            container.requestFullscreen().catch(() => { });
          }
          if (canvas && canvas.requestPointerLock) {
            try {
              const res = canvas.requestPointerLock();
              if (res && typeof res.catch === 'function') {
                res.catch(() => { });
              }
            } catch (err) {
              console.warn("Falha ao solicitar Pointer Lock:", err);
            }
          }
        }, 150);

        set({ playModeBackupScene: backup });
        useRuntimeStore.setState({
          isPlaying: true,
          activeViewport: 'game',
          consoleLogs: [],
        });
      } else {
        const backup = get().playModeBackupScene;
        const updatedScenes = backup ? { ...rt.scenes, [rt.activeSceneId]: backup } : rt.scenes;

        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => { });
        }
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }

        set({ playModeBackupScene: null });
        useRuntimeStore.setState({
          isPlaying: false,
          scenes: updatedScenes,
          activeViewport: 'scene',
          selectedEntityId: null,
          rigidBodyRefs: {},
        });
      }
    },
  };
});

// ── Mirror runtime shared state → editor store ─────────────────────────────
// This keeps the editor's view of the shared keys (scenes, activeSceneId,
// selectedEntityId, consoleLogs, etc.) in sync with the engine's single source
// of truth, so the panels that read `useEditorStore` need no edits. The
// subscription is one-directional (runtime → editor); editor mutations go
// through the wrappers/delegations above, which write into the runtime store
// and thus trigger this mirror back into the editor — no infinite loop.
const MIRRORED_KEYS = [
  'scenes',
  'activeSceneId',
  'isPlaying',
  'showGrid',
  'showGizmos',
  'showLighting',
  'activeViewport',
  'selectedEntityId',
  'focusTrigger',
  'editorMode',
  'snapEnabled',
  'snapValue',
  'consoleLogs',
  'rigidBodyRefs',
  'prefabs',
  'historyPast',
  'historyFuture',
] as const;

function mirrorRuntimeToEditor() {
  const s = useRuntimeStore.getState();
  const patch: Partial<EditorStore> = {};
  for (const k of MIRRORED_KEYS) {
    (patch as any)[k] = (s as any)[k];
  }
  useEditorStore.setState(patch);
}

// Seed initial state, then keep it synced on every runtime change.
mirrorRuntimeToEditor();
useRuntimeStore.subscribe(mirrorRuntimeToEditor);
