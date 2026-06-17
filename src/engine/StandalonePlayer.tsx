import { useEffect, useState } from 'react';
import { SceneView } from '../editor/panels/SceneView';
import { useEditorStore } from '../editor/store/editorStore';

function DebugUI() {
  const consoleLogs = useEditorStore(state => state.consoleLogs);

  const handleCopy = () => {
    const text = consoleLogs.map(l => l.message).join('\n');
    navigator.clipboard.writeText(text);
    alert('Log copiado para a area de transferencia!');
  };

  return (
    <div style={{
      position: 'absolute', top: '50px', right: '10px', width: '300px', height: '400px',
      background: 'rgba(0,0,0,0.8)', color: '#0f0', fontFamily: 'monospace', fontSize: '12px',
      padding: '10px', borderRadius: '8px', zIndex: 9999, display: 'flex', flexDirection: 'column'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <strong>Console Logs</strong>
        <button onClick={handleCopy} style={{ background: '#555', color: '#fff', border: 'none', padding: '4px 8px', cursor: 'pointer', borderRadius: '4px' }}>
          Copiar
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {consoleLogs.map(log => (
          <div key={log.id} style={{ color: log.type === 'error' ? '#f44' : log.type === 'warn' ? '#fd4' : '#0f0' }}>
            {log.message}
          </div>
        ))}
      </div>
    </div>
  );
}

export function StandalonePlayer() {
  const setActiveViewport = useEditorStore(state => state.setActiveViewport);
  const togglePlay = useEditorStore(state => state.togglePlay);
  const addLog = useEditorStore(state => state.addLog);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    // Force Game mode and Playing state on load
    setActiveViewport('game');
    if (!useEditorStore.getState().isPlaying) {
      togglePlay();
    }

    // Capture global errors
    const handleError = (e: ErrorEvent) => {
      addLog('error', 'Global: ' + e.message);
    };
    window.addEventListener('error', handleError);
    const origError = console.error;
    console.error = (...args) => {
      addLog('error', args.join(' '));
      origError.apply(console, args);
    };

    const handleSceneUpdate = (scene: any) => {
      if (scene && scene.id) {
        // Rewrite blob URLs to network URLs for mobile preview
        Object.values(scene.entities).forEach((e: any) => {
          if (e.components?.GLTFModel?.fileName) {
            e.components.GLTFModel.src = '/api/asset/' + encodeURIComponent(e.components.GLTFModel.fileName);
          }
        });
        useEditorStore.setState(state => ({
          scenes: { ...state.scenes, [scene.id]: scene },
          activeSceneId: scene.id
        }));
      }
    };

    // Load initial scene state once
    fetch('/api/sync')
      .then(res => res.json())
      .then(scene => {
        handleSceneUpdate(scene);
      })
      .catch(() => {});

    // Open Server-Sent Events stream for push notifications when "Publish" is clicked
    const eventSource = new EventSource('/api/sync-stream');
    eventSource.onmessage = (event) => {
      try {
        const scene = JSON.parse(event.data);
        handleSceneUpdate(scene);
      } catch (err) {
        // Parse error or keep-alive ping
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' || (e.ctrlKey && e.shiftKey && e.key === 'D')) {
        setShowDebug(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      eventSource.close();
      window.removeEventListener('error', handleError);
      window.removeEventListener('keydown', handleKeyDown);
      console.error = origError;
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
      <SceneView isStandalone={true} />
      {showDebug && <DebugUI />}
    </div>
  );
}
