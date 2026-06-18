import { useEditorStore } from '../store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { FolderOpen, Save, Circle } from 'lucide-react';
import { useState, useEffect } from 'react';

export function TitleBar() {
  const {
    activeScene,
    activeSceneId,
    saveCurrentScene,
    hasUnpublishedChanges,
    isSaving
  } = useEditorStore(useShallow(s => ({
    activeScene: s.activeSceneId ? s.scenes[s.activeSceneId] : null,
    activeSceneId: s.activeSceneId,
    saveCurrentScene: s.saveCurrentScene,
    hasUnpublishedChanges: s.hasUnpublishedChanges,
    isSaving: s.isSaving
  })));

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // @ts-ignore
  const electronAPI = window.electronAPI;

  const handleClose = () => {
    if (electronAPI) {
      electronAPI.windowControl('close');
    } else {
      if (confirm('Deseja fechar o Freedom3D Editor? Certifique-se de salvar suas alterações.')) {
        window.close();
        // Se não fechar por restrições do navegador:
        alert('Para fechar, você pode fechar esta aba do navegador.');
      }
    }
  };

  const handleMinimize = () => {
    if (electronAPI) {
      electronAPI.windowControl('minimize');
    } else {
      alert('Para minimizar o editor, utilize o atalho de janela do seu sistema operacional.');
    }
  };

  const handleMaximize = () => {
    if (electronAPI) {
      electronAPI.windowControl('maximize');
    } else {
      toggleFullscreen();
    }
  };

  return (
    <div className="native-titlebar">
      {/* macOS-style Window Controls */}
      <div className="window-controls">
        <button className="control-btn close" onClick={handleClose} title="Fechar" />
        <button className="control-btn minimize" onClick={handleMinimize} title="Minimizar" />
        <button className="control-btn maximize" onClick={handleMaximize} title={electronAPI ? 'Maximizar' : (isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia')} />
      </div>

      {/* Project Status & Title */}
      <div className="window-title">
        <span className="app-name">Freedom3D Editor</span>
        {activeScene && (
          <>
            <span className="title-separator">—</span>
            <span className="project-name">{activeScene.name}</span>
            <div className={`status-dot ${hasUnpublishedChanges ? 'unsaved' : 'saved'}`} title={hasUnpublishedChanges ? 'Alterações pendentes de publicação' : 'Salvo e Publicado'}>
              <Circle size={8} fill="currentColor" />
            </div>
          </>
        )}
      </div>

      {/* Titlebar Action Buttons */}
      <div className="titlebar-actions">
        {activeSceneId ? (
          <>
            <button className="titlebar-btn" onClick={() => useEditorStore.setState({ activeSceneId: '' })} title="Voltar ao Gerenciador de Projetos (Hub)">
              <FolderOpen size={14} />
              <span>Sair do Projeto</span>
            </button>

            <button 
              className={`titlebar-btn save-btn ${isSaving ? 'saving' : ''}`} 
              onClick={saveCurrentScene} 
              disabled={isSaving}
              title="Salvar Projeto (Ctrl + S)"
            >
              <Save size={14} />
              <span>{isSaving ? 'Salvando...' : 'Salvar'}</span>
            </button>
          </>
        ) : (
          <span className="hub-badge" style={{ fontSize: '10px', fontWeight: 'bold', background: 'rgba(255,255,255,0.08)', padding: '3px 8px', borderRadius: '4px', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.5px' }}>HUB DE PROJETOS</span>
        )}
      </div>
    </div>
  );
}
