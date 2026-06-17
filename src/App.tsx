import { loadGLTFAsset } from './engine/core/persistence';
import { StandalonePlayer } from './engine/StandalonePlayer';
import { Toolbar } from './editor/panels/Toolbar';
import { HierarchyPanel } from './editor/panels/HierarchyPanel';
import { SceneView } from './editor/panels/SceneView';
import { InspectorPanel } from './editor/panels/InspectorPanel';
import { ConsolePanel } from './editor/panels/ConsolePanel';
import { AssetBrowser } from './editor/panels/AssetBrowser';
import { ScriptEditor } from './editor/panels/ScriptEditor';
import { SaveLoadModal } from './editor/panels/SaveLoadModal';
import { useEditorStore } from './editor/store/editorStore';
import './index.css';

import { useEffect } from 'react';
export default function App() {
  if (window.location.pathname.startsWith('/preview')) {
    return <StandalonePlayer />;
  }
  const { bottomTab, setBottomTab } = useEditorStore();

  useEffect(() => {
    const state = useEditorStore.getState();
    // Sync autom·tico foi removido. Agora usa bot„o Publish.
  }, []);

  return (
    <div className="editor-root">
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
                  {tab === 'console' ? '‚å® Console' : tab === 'assets' ? 'üìÅ Assets' : 'üìù Script'}
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
    </div>
  );
}






