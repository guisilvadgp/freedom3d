import { StandalonePlayer } from './engine/StandalonePlayer';
import { Toolbar } from './editor/panels/Toolbar';
import { HierarchyPanel } from './editor/panels/HierarchyPanel';
import { SceneView } from './editor/panels/SceneView';
import { InspectorPanel } from './editor/panels/InspectorPanel';
import { ConsolePanel } from './editor/panels/ConsolePanel';
import { AssetBrowser } from './editor/panels/AssetBrowser';
import { ScriptEditor } from './editor/panels/ScriptEditor';
import { ProjectExplorer } from './editor/panels/ProjectExplorer';
import { SaveLoadModal } from './editor/panels/SaveLoadModal';
import { TitleBar } from './editor/panels/TitleBar';
import { MenuBar } from './editor/panels/MenuBar';
import { Toast } from './editor/panels/Toast';
import { useEditorStore } from './editor/store/editorStore';
import { DedicatedCodeEditor } from './editor/panels/DedicatedCodeEditor';
import './index.css';
import { useEffect, useState } from 'react';
import { Terminal, FolderOpen, Code, Files } from 'lucide-react';

export default function App() {
  if (window.location.pathname.startsWith('/preview') || (window as any).__freedom3d_standalone__) {
    return <StandalonePlayer />;
  }
  if (window.location.pathname.startsWith('/code-editor')) {
    return <DedicatedCodeEditor />;
  }
  const { bottomTab, setBottomTab } = useEditorStore();
  const activeSceneId = useEditorStore(state => state.activeSceneId);

  useEffect(() => {
    if (!activeSceneId) return;
    const store = useEditorStore.getState();
    const scene = store.activeScene();
    if (!scene) return;

    const channel = new BroadcastChannel('freedom3d-editor-sync');
    
    const scriptsList: any[] = [];
    for (const e of Object.values(scene.entities)) {
      if (!e.components.Script) continue;
      
      const mainScript = e.components.Script as any;
      scriptsList.push({
        entityId: e.id,
        entityName: e.name,
        scriptId: 'main',
        scriptName: mainScript.scriptName || 'Main',
        code: mainScript.code || '',
        variables: mainScript.variables || []
      });

      if (mainScript.scripts && Array.isArray(mainScript.scripts)) {
        for (const s of mainScript.scripts) {
          scriptsList.push({
            entityId: e.id,
            entityName: e.name,
            scriptId: s.id,
            scriptName: s.scriptName,
            code: s.code || '',
            variables: s.variables || [],
            isAdditional: true
          });
        }
      }
    }

    channel.postMessage({
      type: 'INITIAL_DATA',
      scriptsList,
      currentScript: scriptsList[0] || null
    });

    channel.close();
  }, [activeSceneId]);

  const [hierarchyWidth, setHierarchyWidth] = useState(260);
  const [inspectorWidth, setInspectorWidth] = useState(300);
  const [bottomHeight, setBottomHeight] = useState(220);

  const handleHierarchyResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = hierarchyWidth;

    const doDrag = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(500, startWidth + (moveEvent.clientX - startX)));
      setHierarchyWidth(newWidth);
    };

    const stopDrag = () => {
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
    };

    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
  };

  const handleInspectorResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = inspectorWidth;

    const doDrag = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(600, startWidth - (moveEvent.clientX - startX)));
      setInspectorWidth(newWidth);
    };

    const stopDrag = () => {
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
    };

    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
  };

  const handleBottomResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = bottomHeight;

    const doDrag = (moveEvent: MouseEvent) => {
      const newHeight = Math.max(100, Math.min(500, startHeight - (moveEvent.clientY - startY)));
      setBottomHeight(newHeight);
    };

    const stopDrag = () => {
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
    };

    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
  };

  useEffect(() => {
    const loadProjectsList = async () => {
      try {
        const store = useEditorStore.getState();
        await store.refreshSavedScenes();
      } catch (err) {
        console.error('Falha ao inicializar lista de projetos:', err);
      }
    };
    loadProjectsList();
  }, []);

  useEffect(() => {
    const channel = new BroadcastChannel('freedom3d-editor-sync');
    
    const handleMessage = (event: MessageEvent) => {
      const store = useEditorStore.getState();
      
      const broadcastScriptsList = () => {
        const scene = store.activeScene();
        if (!scene) return;
        
        const scriptsList: any[] = [];
        for (const e of Object.values(scene.entities)) {
          if (!e.components.Script) continue;
          
          const mainScript = e.components.Script as any;
          // Adiciona o script principal
          scriptsList.push({
            entityId: e.id,
            entityName: e.name,
            scriptId: 'main',
            scriptName: mainScript.scriptName || 'Main',
            code: mainScript.code || '',
            variables: mainScript.variables || []
          });

          // Adiciona os scripts adicionais se houver
          if (mainScript.scripts && Array.isArray(mainScript.scripts)) {
            for (const s of mainScript.scripts) {
              scriptsList.push({
                entityId: e.id,
                entityName: e.name,
                scriptId: s.id,
                scriptName: s.scriptName,
                code: s.code || '',
                variables: s.variables || [],
                isAdditional: true
              });
            }
          }
        }

        const currentEntity = store.selectedEntity();
        let currentScript = null;
        if (currentEntity && currentEntity.components.Script) {
          const mainScript = currentEntity.components.Script as any;
          currentScript = {
            entityId: currentEntity.id,
            entityName: currentEntity.name,
            scriptId: 'main',
            scriptName: mainScript.scriptName || 'Main',
            code: mainScript.code || '',
            variables: mainScript.variables || []
          };
        }

        channel.postMessage({
          type: 'INITIAL_DATA',
          scriptsList,
          currentScript
        });
      };

      if (event.data.type === 'REQUEST_INITIAL_DATA') {
        broadcastScriptsList();
      } else if (event.data.type === 'UPDATE_SCRIPT') {
        const { entityId, scriptId, patch } = event.data;
        const scene = store.activeScene();
        if (!scene) return;
        const entity = scene.entities[entityId];
        if (!entity || !entity.components.Script) return;
        
        const mainScript = entity.components.Script as any;
        if (!scriptId || scriptId === 'main') {
          store.updateComponent(entityId, 'Script', {
            code: patch.code,
            scriptName: patch.scriptName
          });
        } else {
          const updatedScripts = (mainScript.scripts || []).map((s: any) => {
            if (s.id === scriptId) {
              return { ...s, code: patch.code, scriptName: patch.scriptName };
            }
            return s;
          });
          store.updateComponent(entityId, 'Script', {
            scripts: updatedScripts
          });
        }
        
        channel.postMessage({
          type: 'SCRIPT_UPDATED_IN_EDITOR',
          entityId,
          scriptId: scriptId || 'main',
          code: patch.code,
          scriptName: patch.scriptName
        });
      } else if (event.data.type === 'CREATE_ADDITIONAL_SCRIPT') {
        const { entityId, scriptId, scriptName } = event.data;
        const scene = store.activeScene();
        if (!scene) return;
        const entity = scene.entities[entityId];
        if (!entity || !entity.components.Script) return;

        const mainScript = entity.components.Script as any;
        const newScript = {
          id: scriptId,
          scriptName: scriptName,
          code: `// Comportamento adicional\nexport function onAwake() {\n  // Chamado na inicialização\n}\n\nexport function onUpdate(delta) {\n  // Chamado a cada frame\n}`,
          variables: []
        };

        const updatedScripts = [...(mainScript.scripts || []), newScript];
        store.updateComponent(entityId, 'Script', {
          scripts: updatedScripts
        });

        broadcastScriptsList();
      } else if (event.data.type === 'DELETE_ADDITIONAL_SCRIPT') {
        const { entityId, scriptId } = event.data;
        const scene = store.activeScene();
        if (!scene) return;
        const entity = scene.entities[entityId];
        if (!entity || !entity.components.Script) return;

        const mainScript = entity.components.Script as any;
        const updatedScripts = (mainScript.scripts || []).filter((s: any) => s.id !== scriptId);
        
        store.updateComponent(entityId, 'Script', {
          scripts: updatedScripts
        });

        broadcastScriptsList();
      } else if (event.data.type === 'SAVE_PROJECT_SCENE') {
        store.saveCurrentScene();
      }
    };

    channel.addEventListener('message', handleMessage);

    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
    };
  }, []);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl && 
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.classList.contains('inputarea'))
      ) {
        return;
      }

      const store = useEditorStore.getState();

      // Ctrl + S (Salvar)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        store.saveCurrentScene();
      }

      // Ctrl + P (Publicar)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        store.publishToPreview();
      }

      // Ctrl + Z (Desfazer / Undo)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        store.undo();
      }

      // Ctrl + Y (Refazer / Redo)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        store.redo();
      }

      // Ctrl + D (Duplicar)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (store.selectedEntityId) {
          store.duplicateEntity(store.selectedEntityId);
        }
      }

      // Delete (Excluir)
      if (e.key === 'Delete') {
        e.preventDefault();
        if (store.selectedEntityId) {
          store.deleteEntity(store.selectedEntityId);
        }
      }

      // Alt + 1, 2, 3 (Navegar abas inferiores)
      if (e.altKey && e.key === '1') {
        e.preventDefault();
        store.setBottomTab('console');
      }
      if (e.altKey && e.key === '2') {
        e.preventDefault();
        store.setBottomTab('assets');
      }
      if (e.altKey && e.key === '3') {
        e.preventDefault();
        store.setBottomTab('script');
      }
      if (e.altKey && e.key === '4') {
        e.preventDefault();
        store.setBottomTab('explorer');
      }

      // G (Grid)
      if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        store.toggleGrid();
      }

      // H (Gizmos)
      if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        store.toggleGizmos();
      }

      // Q, W, E, R (Modos do Gizmo)
      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'q') {
          e.preventDefault();
          store.setEditorMode('select');
        } else if (key === 'w') {
          e.preventDefault();
          store.setEditorMode('translate');
        } else if (key === 'e') {
          e.preventDefault();
          store.setEditorMode('rotate');
        } else if (key === 'r') {
          e.preventDefault();
          store.setEditorMode('scale');
        }
      }

      // Tab (Alterna entre translate, rotate, scale)
      if (e.key === 'Tab') {
        e.preventDefault();
        const currentMode = store.editorMode;
        if (currentMode === 'translate') {
          store.setEditorMode('rotate');
        } else if (currentMode === 'rotate') {
          store.setEditorMode('scale');
        } else {
          store.setEditorMode('translate');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!activeSceneId) {
    return (
      <div className="editor-root native-theme">
        <TitleBar />
        <SaveLoadModal isHub={true} />
        <Toast />
      </div>
    );
  }

  return (
    <div className="editor-root native-theme">
      <TitleBar />
      <MenuBar />
      <Toolbar />
      <div className="editor-body">
        <HierarchyPanel style={{ width: hierarchyWidth }} />
        <div className="resizer-col" onMouseDown={handleHierarchyResize} />

        <div className="editor-center">
          <SceneView />
          <div className="resizer-row" onMouseDown={handleBottomResize} />
          <div className="bottom-panel" style={{ height: bottomHeight }}>
            <div className="bottom-tabs">
              {(['console', 'assets', 'script', 'explorer'] as const).map((tab) => (
                <button
                  key={tab}
                  className={`bottom-tab ${bottomTab === tab ? 'active' : ''}`}
                  onClick={() => setBottomTab(tab)}
                >
                  {tab === 'console' && <Terminal size={14} />}
                  {tab === 'assets' && <FolderOpen size={14} />}
                  {tab === 'script' && <Code size={14} />}
                  {tab === 'explorer' && <Files size={14} />}
                  <span style={{ textTransform: 'capitalize' }}>{tab === 'explorer' ? 'Explorer' : tab}</span>
                </button>
              ))}
            </div>
            <div className="bottom-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {bottomTab === 'console' && <ConsolePanel />}
              {bottomTab === 'assets' && <AssetBrowser />}
              {bottomTab === 'script' && <ScriptEditor />}
              {bottomTab === 'explorer' && <ProjectExplorer />}
            </div>
          </div>
        </div>

        <div className="resizer-col" onMouseDown={handleInspectorResize} />
        <InspectorPanel style={{ width: inspectorWidth }} />
      </div>
      <SaveLoadModal />
      <Toast />
    </div>
  );
}