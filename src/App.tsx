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
import './index.css';
import { useEffect } from 'react';
import { Terminal, FolderOpen, Code } from 'lucide-react';

export default function App() {
  if (window.location.pathname.startsWith('/preview')) {
    return <StandalonePlayer />;
  }
  const { bottomTab, setBottomTab } = useEditorStore();

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
        <HierarchyPanel />
        <div className="editor-center">
          <SceneView />
          <div className="bottom-panel">
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
        <InspectorPanel />
      </div>
      <SaveLoadModal />
      <Toast />
    </div>
  );
}