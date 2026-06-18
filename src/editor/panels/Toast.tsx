import { useEditorStore } from '../store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export function Toast() {
  const toast = useEditorStore(useShallow(s => s.toast));

  if (!toast) return null;

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 size={16} className="toast-icon success" />;
      case 'error':
        return <AlertCircle size={16} className="toast-icon error" />;
      case 'warning':
        return <AlertTriangle size={16} className="toast-icon warning" />;
      case 'info':
      default:
        return <Info size={16} className="toast-icon info" />;
    }
  };

  return (
    <div className={`toast-notification ${toast.type}`}>
      {getIcon()}
      <span className="toast-message">{toast.message}</span>
    </div>
  );
}
