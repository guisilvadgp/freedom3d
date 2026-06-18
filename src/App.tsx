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
    const loadLatestScene = async () => {
      try {
        const store = useEditorStore.getState();
        // Tenta obter a cena mais recente do servidor (/api/sync)
        const res = await fetch('/api/sync');
        let loadedFromServer = false;
        
        if (res.ok) {
          try {
            const scene = await res.json();
            if (scene && scene.id && Object.keys(scene).length > 0) {
              // Reidrata as blob URLs de modelos GLTF
              for (const entity of Object.values(scene.entities) as any[]) {
                if (entity.components?.GLTFModel?.fileName) {
                  entity.components.GLTFModel.src = '/api/asset/' + encodeURIComponent(entity.components.GLTFModel.fileName);
                }
              }
              useEditorStore.setState(state => ({
                scenes: { ...state.scenes, [scene.id]: scene },
                activeSceneId: scene.id
              }));
              loadedFromServer = true;
              store.addLog('info', `📂 Carregada cena ativa do servidor: "${scene.name || 'Sem nome'}"`);
            }
          } catch (_) {
            // Ignora erro se JSON vier vazio ou invalido
          }
        }

        // Se nao carregou do servidor, tenta carregar a mais recente do IndexedDB
        if (!loadedFromServer) {
          await store.refreshSavedScenes();
          const saved = useEditorStore.getState().savedScenes;
          if (saved && saved.length > 0) {
            await store.loadSavedScene(saved[0].id);
          }
        }
      } catch (err) {
        console.error('Falha ao inicializar cena:', err);
      }
    };
    loadLatestScene();
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