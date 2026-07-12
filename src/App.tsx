import { StandalonePlayer } from './engine/StandalonePlayer';
import { Toolbar } from './editor/panels/Toolbar';
import { HierarchyPanel } from './editor/panels/HierarchyPanel';
import { SceneView } from './engine/render/SceneView';
import { InspectorPanel } from './editor/panels/InspectorPanel';
import { ConsolePanel } from './editor/panels/ConsolePanel';
import { AssetBrowser } from './editor/panels/AssetBrowser';
import { ProjectExplorer } from './editor/panels/ProjectExplorer';
import { SaveLoadModal } from './editor/panels/SaveLoadModal';
import { TitleBar } from './editor/panels/TitleBar';
import { MenuBar } from './editor/panels/MenuBar';
import { Toast } from './editor/panels/Toast';
import { useEditorStore } from './editor/store/editorStore';
import { DedicatedCodeEditor } from './editor/panels/DedicatedCodeEditor';
import { HandTrackingTest } from './editor/panels/HandTrackingTest';
import { AIAssistantPanel } from './editor/panels/AIAssistantPanel';
import { DiscoverPage } from './pages/DiscoverPage';
import './index.css';
import { useEffect, useState } from 'react';
import { Terminal, FolderOpen, Files, ScanSearch, Bot } from 'lucide-react';

// ── Roteador simples baseado em pathname ──────────────────────────────────
function getRouteInfo() {
  const pathname = window.location.pathname;

  // /room/:roomId  → Room Player
  const roomMatch = pathname.match(/^\/room\/(.+)$/);
  if (roomMatch) {
    return { route: 'room', roomId: decodeURIComponent(roomMatch[1]) };
  }

  // /preview  → alias retrocompatível (standalone sem roomId)
  if (pathname.startsWith('/preview') || (window as any).__freedom3d_standalone__) {
    return { route: 'preview', roomId: null };
  }

  // /discover  → Discover
  if (pathname.startsWith('/discover')) {
    return { route: 'discover', roomId: null };
  }

  // /code-editor  → Editor de código dedicado
  if (pathname.startsWith('/code-editor')) {
    return { route: 'code-editor', roomId: null };
  }

  // /hand-tracking
  if (pathname.startsWith('/hand-tracking')) {
    return { route: 'hand-tracking', roomId: null };
  }

  // /  → Editor
  return { route: 'editor', roomId: null };
}


export default function App() {
  const { route, roomId } = getRouteInfo();

  // ── Módulo: Room Player (/room/:roomId)
  if (route === 'room') {
    return <StandalonePlayer roomId={roomId!} />;
  }

  // ── Módulo: Preview legacy (/preview)
  if (route === 'preview') {
    return <StandalonePlayer />;
  }

  // ── Módulo: Discover (/discover)
  if (route === 'discover') {
    return <DiscoverPage />;
  }

  // ── Módulo: Code Editor (/code-editor)
  if (route === 'code-editor') {
    return <DedicatedCodeEditor />;
  }

  // ── Módulo: Hand Tracking (/hand-tracking)
  if (route === 'hand-tracking') {
    return <HandTrackingTest />;
  }

  // ── Módulo: Editor (/)
  const { bottomTab, setBottomTab } = useEditorStore();
  const activeSceneId = useEditorStore(state => state.activeSceneId);
  const showGrid = useEditorStore(s => s.showGrid);
  const showGizmos = useEditorStore(s => s.showGizmos);
  const showLighting = useEditorStore(s => s.showLighting);
  const editorMode = useEditorStore(s => s.editorMode);
  const snapEnabled = useEditorStore(s => s.snapEnabled);
  const snapValue = useEditorStore(s => s.snapValue);
  const toggleLighting = useEditorStore(s => s.toggleLighting);
  const instantiateAsset = useEditorStore(s => s.instantiateAsset);
  const instantiatePrefab = useEditorStore(s => s.instantiatePrefab);

  // Aba do painel direito: 'inspector' | 'ai'
  const [rightTab, setRightTab] = useState<'inspector' | 'ai'>('inspector');
  const [hierarchyWidth, setHierarchyWidth] = useState(260);
  const [inspectorWidth, setInspectorWidth] = useState(300);
  const [bottomHeight, setBottomHeight] = useState(220);

  // ── Broadcast de scripts para o editor de código externo ──
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
      scriptsList.push({ entityId: e.id, entityName: e.name, scriptId: 'main', scriptName: mainScript.scriptName || 'Main', code: mainScript.code || '', variables: mainScript.variables || [] });
      if (mainScript.scripts && Array.isArray(mainScript.scripts)) {
        for (const s of mainScript.scripts) {
          scriptsList.push({ entityId: e.id, entityName: e.name, scriptId: s.id, scriptName: s.scriptName, code: s.code || '', variables: s.variables || [], isAdditional: true });
        }
      }
    }
    channel.postMessage({ type: 'INITIAL_DATA', scriptsList, currentScript: scriptsList[0] || null });
    channel.close();
  }, [activeSceneId]);

  // ── Resize handlers ──
  const handleHierarchyResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX, startWidth = hierarchyWidth;
    const doDrag = (mv: MouseEvent) => setHierarchyWidth(Math.max(180, Math.min(500, startWidth + (mv.clientX - startX))));
    const stop = () => { document.removeEventListener('mousemove', doDrag); document.removeEventListener('mouseup', stop); };
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stop);
  };

  const handleInspectorResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX, startWidth = inspectorWidth;
    const doDrag = (mv: MouseEvent) => setInspectorWidth(Math.max(200, Math.min(600, startWidth - (mv.clientX - startX))));
    const stop = () => { document.removeEventListener('mousemove', doDrag); document.removeEventListener('mouseup', stop); };
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stop);
  };

  const handleBottomResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY, startHeight = bottomHeight;
    const doDrag = (mv: MouseEvent) => setBottomHeight(Math.max(100, Math.min(500, startHeight - (mv.clientY - startY))));
    const stop = () => { document.removeEventListener('mousemove', doDrag); document.removeEventListener('mouseup', stop); };
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stop);
  };

  // ── Carrega lista de projetos ──
  useEffect(() => {
    useEditorStore.getState().refreshSavedScenes().catch(console.error);
  }, []);

  // ── Canal BroadcastChannel para sincronizar scripts com editor externo ──
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
          scriptsList.push({ entityId: e.id, entityName: e.name, scriptId: 'main', scriptName: mainScript.scriptName || 'Main', code: mainScript.code || '', variables: mainScript.variables || [] });
          if (mainScript.scripts && Array.isArray(mainScript.scripts)) {
            for (const s of mainScript.scripts) {
              scriptsList.push({ entityId: e.id, entityName: e.name, scriptId: s.id, scriptName: s.scriptName, code: s.code || '', variables: s.variables || [], isAdditional: true });
            }
          }
        }
        const currentEntity = store.selectedEntity();
        let currentScript = null;
        if (currentEntity?.components.Script) {
          const ms = currentEntity.components.Script as any;
          currentScript = { entityId: currentEntity.id, entityName: currentEntity.name, scriptId: 'main', scriptName: ms.scriptName || 'Main', code: ms.code || '', variables: ms.variables || [] };
        }
        channel.postMessage({ type: 'INITIAL_DATA', scriptsList, currentScript });
      };

      if (event.data.type === 'REQUEST_INITIAL_DATA') {
        broadcastScriptsList();
      } else if (event.data.type === 'UPDATE_SCRIPT') {
        const { entityId, scriptId, patch } = event.data;
        const scene = store.activeScene();
        if (!scene) return;
        const entity = scene.entities[entityId];
        if (!entity?.components.Script) return;
        const mainScript = entity.components.Script as any;
        if (!scriptId || scriptId === 'main') {
          store.updateComponent(entityId, 'Script', { code: patch.code, scriptName: patch.scriptName });
        } else {
          const updatedScripts = (mainScript.scripts || []).map((s: any) => s.id === scriptId ? { ...s, code: patch.code, scriptName: patch.scriptName } : s);
          store.updateComponent(entityId, 'Script', { scripts: updatedScripts });
        }
        channel.postMessage({ type: 'SCRIPT_UPDATED_IN_EDITOR', entityId, scriptId: scriptId || 'main', code: patch.code, scriptName: patch.scriptName });
      } else if (event.data.type === 'CREATE_ADDITIONAL_SCRIPT') {
        const { entityId, scriptId, scriptName } = event.data;
        const scene = store.activeScene();
        const entity = scene?.entities[entityId];
        if (!entity?.components.Script) return;
        const mainScript = entity.components.Script as any;
        const newScript = { id: scriptId, scriptName, code: `// Comportamento adicional\nexport function onAwake() {}\nexport function onUpdate(delta) {}`, variables: [] };
        store.updateComponent(entityId, 'Script', { scripts: [...(mainScript.scripts || []), newScript] });
        broadcastScriptsList();
      } else if (event.data.type === 'DELETE_ADDITIONAL_SCRIPT') {
        const { entityId, scriptId } = event.data;
        const scene = store.activeScene();
        const entity = scene?.entities[entityId];
        if (!entity?.components.Script) return;
        const mainScript = entity.components.Script as any;
        store.updateComponent(entityId, 'Script', { scripts: (mainScript.scripts || []).filter((s: any) => s.id !== scriptId) });
        broadcastScriptsList();
      } else if (event.data.type === 'SAVE_PROJECT_SCENE') {
        store.saveCurrentScene();
      }
    };
    channel.addEventListener('message', handleMessage);
    return () => { channel.removeEventListener('message', handleMessage); channel.close(); };
  }, []);

  // ── Atalhos de teclado ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.classList.contains('inputarea'))) return;
      const store = useEditorStore.getState();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); store.saveCurrentScene(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') { e.preventDefault(); store.publishToPreview(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); store.undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); store.redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); if (store.selectedEntityId) store.duplicateEntity(store.selectedEntityId); }
      if (e.key === 'Delete') { e.preventDefault(); if (store.selectedEntityId) store.deleteEntity(store.selectedEntityId); }
      if (e.altKey && e.key === '1') { e.preventDefault(); store.setBottomTab('console'); }
      if (e.altKey && e.key === '2') { e.preventDefault(); store.setBottomTab('assets'); }
      if (e.altKey && e.key === '3') { e.preventDefault(); store.setBottomTab('script'); }
      if (e.altKey && e.key === '4') { e.preventDefault(); store.setBottomTab('explorer'); }
      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === 'g') { e.preventDefault(); store.toggleGrid(); }
        if (k === 'h') { e.preventDefault(); store.toggleGizmos(); }
        if (k === 'q') { e.preventDefault(); store.setEditorMode('select'); }
        if (k === 'w') { e.preventDefault(); store.setEditorMode('translate'); }
        if (k === 'e') { e.preventDefault(); store.setEditorMode('rotate'); }
        if (k === 'r') { e.preventDefault(); store.setEditorMode('scale'); }
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const m = store.editorMode;
        store.setEditorMode(m === 'translate' ? 'rotate' : m === 'rotate' ? 'scale' : 'translate');
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
          <SceneView
            showGrid={showGrid}
            showGizmos={showGizmos}
            showLighting={showLighting}
            editorMode={editorMode}
            snapEnabled={snapEnabled}
            snapValue={snapValue}
            onToggleLighting={toggleLighting}
            onDropAsset={instantiateAsset}
            onDropPrefab={instantiatePrefab}
          />
          <div className="resizer-row" onMouseDown={handleBottomResize} />
          <div className="bottom-panel" style={{ height: bottomHeight }}>
            <div className="bottom-tabs">
              {(['explorer', 'assets', 'console'] as const).map((tab) => (
                <button key={tab} className={`bottom-tab ${bottomTab === tab ? 'active' : ''}`} onClick={() => setBottomTab(tab)}>
                  {tab === 'console' && <Terminal size={14} />}
                  {tab === 'assets' && <FolderOpen size={14} />}
                  {tab === 'explorer' && <Files size={14} />}
                  <span style={{ textTransform: 'capitalize' }}>{tab === 'explorer' ? 'Explorer' : tab}</span>
                </button>
              ))}
            </div>
            <div className="bottom-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {bottomTab === 'console' && <ConsolePanel />}
              {bottomTab === 'assets' && <AssetBrowser />}
              {bottomTab === 'explorer' && <ProjectExplorer />}
            </div>
          </div>
        </div>

        <div className="resizer-col" onMouseDown={handleInspectorResize} />

        {/* ── Coluna direita: Inspector + Assistente IA ── */}
        <div className="right-panel panel" style={{ width: inspectorWidth, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="right-panel-tabs">
            <button className={`right-panel-tab ${rightTab === 'inspector' ? 'active' : ''}`} onClick={() => setRightTab('inspector')}>
              <ScanSearch size={13} /><span>Inspector</span>
            </button>
            <button className={`right-panel-tab ${rightTab === 'ai' ? 'active' : ''}`} onClick={() => setRightTab('ai')}>
              <Bot size={13} /><span>Assistente IA</span>
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {rightTab === 'inspector'
              ? <InspectorPanel style={{ width: '100%', flex: 1 }} />
              : <AIAssistantPanel />
            }
          </div>
        </div>
      </div>
      <SaveLoadModal />
      <Toast />
    </div>
  );
}