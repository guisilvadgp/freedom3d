import { useEditorStore } from '../store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { FolderOpen, Save, Maximize2, Minimize2, Circle } from 'lucide-react';
import { useState, useEffect } from 'react';

export function TitleBar() {
  const {
    activeScene,
    saveCurrentScene,
    setShowSaveModal,
    hasUnpublishedChanges,
    isSaving
  } = useEditorStore(useShallow(s => ({
    activeScene: s.scenes[s.activeSceneId],
    saveCurrentScene: s.saveCurrentScene,
    setShowSaveModal: s.setShowSaveModal,
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

  const handleClose = () => {
    if (confirm('Deseja fechar o Freedom3D Editor? Certifique-se de salvar suas alterações.')) {
      window.close();
      // Se não fechar por restrições do navegador:
      alert('Para fechar, você pode fechar esta aba do navegador.');
    }
  };

  return (
    <div className="native-titlebar">
      {/* macOS-style Window Controls */}
      <div className="window-controls">
        <button className="control-btn close" onClick={handleClose} title="Fechar" />
        <button className="control-btn minimize" onClick={() => alert('Para minimizar o editor, utilize o atalho de janela do seu sistema operacional.')} title="Minimizar" />
        <button className="control-btn maximize" onClick={toggleFullscreen} title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'} />
      </div>

      {/* Project Status & Title */}
      <div className="window-title">
        <span className="app-name">Freedom3D Editor</span>
        <span className="title-separator">—</span>
        <span className="project-name">{activeScene?.name || 'Projeto Sem Nome'}</span>
        
        {/* Status indicator */}
        <div className={`status-dot ${hasUnpublishedChanges ? 'unsaved' : 'saved'}`} title={hasUnpublishedChanges ? 'Alterações pendentes de publicação' : 'Salvo e Publicado'}>
          <Circle size={8} fill="currentColor" />
        </div>
      </div>

      {/* Titlebar Action Buttons */}
      <div className="titlebar-actions">
        <button className="titlebar-btn" onClick={() => setShowSaveModal(true)} title="Gerenciar Projetos (Salvar / Carregar / Criar)">
          <FolderOpen size={14} />
          <span>Projetos</span>
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
      </div>
    </div>
  );
}
