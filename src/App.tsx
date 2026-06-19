import { StandalonePlayer } from './engine/StandalonePlayer';
import { Toolbar } from './editor/panels/Toolbar';
import { HierarchyPanel } from './editor/panels/HierarchyPanel';
import { SceneView } from './editor/panels/SceneView';
import { InspectorPanel } from './editor/panels/InspectorPanel';
import { ConsolePanel } from './editor/panels/ConsolePanel';
import { AssetBrowser } from './editor/panels/AssetBrowser';
import { ScriptEditor } from './editor/panels/ScriptEditor';
import { SaveLoadModal } from './editor/panels/SaveLoadModal';
import { TitleBar } from './editor/panels/TitleBar';
import { MenuBar } from './editor/panels/MenuBar';
import { Toast } from './editor/panels/Toast';
import { useEditorStore } from './editor/store/editorStore';
import { DedicatedCodeEditor } from './editor/panels/DedicatedCodeEditor';
import './index.css';
import { useEffect, useState } from 'react';
import { Terminal, FolderOpen, Code } from 'lucide-react';

export default function App() {
  if (window.location.pathname.startsWith('/preview') || (window as any).__freedom3d_standalone__) {
    return <StandalonePlayer />;
  }
  if (window.location.pathname.startsWith('/code-editor')) {
    return <DedicatedCodeEditor />;
  }
  const { bottomTab, setBottomTab } = useEditorStore();

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
      
      if (event.data.type === 'REQUEST_INITIAL_DATA') {
        const scene = store.activeScene();
        if (!scene) return;
        
        const scriptsList = Object.values(scene.entities)
          .filter(e => e.components.Script)
          .map(e => ({
            entityId: e.id,
            entityName: e.name,
            scriptName: (e.components.Script as any).scriptName,
            code: (e.components.Script as any).code
          }));
        
        const currentEntity = store.selectedEntity();
        const currentScript = currentEntity && currentEntity.components.Script ? {
          entityId: currentEntity.id,
          entityName: currentEntity.name,
          scriptName: (currentEntity.components.Script as any).scriptName,
          code: (currentEntity.components.Script as any).code
        } : null;

        channel.postMessage({
          type: 'INITIAL_DATA',
          scriptsList,
          currentScript
        });
      } else if (event.data.type === 'UPDATE_SCRIPT') {
        const { entityId, patch } = event.data;
        store.updateComponent(entityId, 'Script', patch);
        
        channel.postMessage({
          type: 'SCRIPT_UPDATED_IN_EDITOR',
          entityId,
          code: patch.code,
          scriptName: patch.scriptName
        });
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

  const activeSceneId = useEditorStore(state => state.activeSceneId);

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
              {(['console', 'assets', 'script'] as const).map((tab) => (
                <button
                  key={tab}
                  className={`bottom-tab ${bottomTab === tab ? 'active' : ''}`}
                  onClick={() => setBottomTab(tab)}
                >
                  {tab === 'console' && <Terminal size={14} />}
                  {tab === 'assets' && <FolderOpen size={14} />}
                  {tab === 'script' && <Code size={14} />}
                  <span style={{ textTransform: 'capitalize' }}>{tab}</span>
                </button>
              ))}
            </div>
            <div className="bottom-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {bottomTab === 'console' && <ConsolePanel />}
              {bottomTab === 'assets' && <AssetBrowser />}
              {bottomTab === 'script' && <ScriptEditor />}
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