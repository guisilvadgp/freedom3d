import { useEditorStore } from '../store/editorStore';
import { Terminal, Info, AlertTriangle, AlertCircle, Trash2 } from 'lucide-react';

export function ConsolePanel() {
  const { consoleLogs, clearConsole } = useEditorStore();

  const typeColor: Record<string, string> = {
    log: '#c8d0da',
    info: '#6ab0f5',
    warn: '#f5c842',
    error: '#f56342',
  };

  const renderTypeIcon = (type: string) => {
    switch (type) {
      case 'info':
        return <Info size={13} style={{ color: typeColor.info }} />;
      case 'warn':
        return <AlertTriangle size={13} style={{ color: typeColor.warn }} />;
      case 'error':
        return <AlertCircle size={13} style={{ color: typeColor.error }} />;
      default:
        return <Terminal size={13} style={{ color: typeColor.log }} />;
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('pt-BR', { hour12: false });
  };

  return (
    <div className="console-panel">
      <div className="console-toolbar">
        <span className="console-count">{consoleLogs.length} logs</span>
        <button className="panel-btn small" onClick={clearConsole} title="Limpar Console">
          <Trash2 size={12} />
        </button>
      </div>
      <div className="console-output">
        {consoleLogs.map((log) => (
          <div key={log.id} className="console-line" style={{ color: typeColor[log.type] }}>
            <span className="console-time">[{formatTime(log.timestamp)}]</span>
            <span className="console-type">{renderTypeIcon(log.type)}</span>
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
