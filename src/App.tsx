import { Toolbar } from './editor/panels/Toolbar';
import { HierarchyPanel } from './editor/panels/HierarchyPanel';
import { SceneView } from './editor/panels/SceneView';
import { InspectorPanel } from './editor/panels/InspectorPanel';
import { ConsolePanel } from './editor/panels/ConsolePanel';
import { AssetBrowser } from './editor/panels/AssetBrowser';
import { SaveLoadModal } from './editor/panels/SaveLoadModal';
import { useEditorStore } from './editor/store/editorStore';
import './index.css';

export default function App() {
  const { bottomTab, setBottomTab } = useEditorStore();

  return (
    <div className="editor-root">
      <Toolbar />
      <div className="editor-body">
        <HierarchyPanel />
        <div className="editor-center">
          <SceneView />
          <div className="bottom-panel">
            <div className="bottom-tabs">
              {(['console', 'assets'] as const).map((tab) => (
                <button
                  key={tab}
                  className={`bottom-tab ${bottomTab === tab ? 'active' : ''}`}
                  onClick={() => setBottomTab(tab)}
                >
                  {tab === 'console' ? '⌨ Console' : '📁 Assets'}
                </button>
              ))}
            </div>
            <div className="bottom-content">
              {bottomTab === 'console' && <ConsolePanel />}
              {bottomTab === 'assets' && <AssetBrowser />}
            </div>
          </div>
        </div>
        <InspectorPanel />
      </div>
      <SaveLoadModal />
    </div>
  );
}
