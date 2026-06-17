import { useEditorStore } from '../store/editorStore';

export function ConsolePanel() {
  const { consoleLogs, clearConsole } = useEditorStore();

  const typeColor: Record<string, string> = {
    log: '#c8d0da',
    info: '#6ab0f5',
    warn: '#f5c842',
    error: '#f56342',
  };

  const typePrefix: Record<string, string> = {
    log: '›',
    info: 'ℹ',
    warn: '⚠',
    error: '✕',
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('pt-BR', { hour12: false });
  };

  return (
    <div className="console-panel">
      <div className="console-toolbar">
        <span className="console-count">{consoleLogs.length} logs</span>
        <button className="panel-btn small" onClick={clearConsole}>Clear</button>
      </div>
      <div className="console-output">
        {consoleLogs.map((log) => (
          <div key={log.id} className="console-line" style={{ color: typeColor[log.type] }}>
            <span className="console-time">[{formatTime(log.timestamp)}]</span>
            <span className="console-type">{typePrefix[log.type]}</span>
            <span className="console-msg">{log.message}</span>
          </div>
        ))}
        {consoleLogs.length === 0 && (
          <div className="console-empty">Console vazio.</div>
        )}
      </div>
    </div>
  );
}
