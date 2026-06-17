import { useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';

export function SaveLoadModal() {
  const {
    showSaveModal, setShowSaveModal,
    savedScenes, refreshSavedScenes,
    saveCurrentScene, loadSavedScene, deleteSavedScene,
    isSaving, activeScene,
  } = useEditorStore();

  const scene = activeScene();

  useEffect(() => {
    if (showSaveModal) refreshSavedScenes();
  }, [showSaveModal]);

  if (!showSaveModal) return null;

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });

  return (
    <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">💾 Salvar / Carregar Cena</span>
          <button className="modal-close" onClick={() => setShowSaveModal(false)}>✕</button>
        </div>

        {/* Save current */}
        <div className="modal-section">
          <div className="modal-section-title">Salvar cena atual</div>
          <div className="modal-save-row">
            <span className="modal-scene-name">"{scene.name}"</span>
            <button
              className="modal-btn primary"
              onClick={saveCurrentScene}
              disabled={isSaving}
            >
              {isSaving ? 'Salvando...' : '💾 Salvar'}
            </button>
          </div>
        </div>

        {/* Load list */}
        <div className="modal-section">
          <div className="modal-section-title">Cenas salvas ({savedScenes.length})</div>
          {savedScenes.length === 0 && (
            <div className="modal-empty">Nenhuma cena salva ainda.</div>
          )}
          {savedScenes.map((sc) => (
            <div key={sc.id} className="modal-scene-row">
              <div className="modal-scene-info">
                <span className="modal-scene-label">{sc.name}</span>
                <span className="modal-scene-meta">
                  {sc.entityCount} entidades · {formatDate(sc.savedAt)}
                </span>
              </div>
              <div className="modal-scene-actions">
                <button
                  className="modal-btn small"
                  onClick={() => loadSavedScene(sc.id)}
                >
                  📂 Abrir
                </button>
                <button
                  className="modal-btn small danger"
                  onClick={() => deleteSavedScene(sc.id)}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
