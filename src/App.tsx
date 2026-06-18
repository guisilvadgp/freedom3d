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

  const saveCurrentScene = useEditorStore(state => state.saveCurrentScene);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl && 
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.classList.contains('inputarea'))
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveCurrentScene();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveCurrentScene]);

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