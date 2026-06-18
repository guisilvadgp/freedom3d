import { useEffect, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { FolderOpen, X, Plus, Trash2, Edit3, Check, Calendar, Layers, Folder } from 'lucide-react';

export function SaveLoadModal({ isHub = false }: { isHub?: boolean }) {
  const {
    showSaveModal,
    setShowSaveModal,
    savedScenes,
    refreshSavedScenes,
    createNewProject,
    loadSavedScene,
    deleteSavedScene,
    renameProject,
    activeSceneId
  } = useEditorStore(useShallow(s => ({
    showSaveModal: s.showSaveModal,
    setShowSaveModal: s.setShowSaveModal,
    savedScenes: s.savedScenes,
    refreshSavedScenes: s.refreshSavedScenes,
    createNewProject: s.createNewProject,
    loadSavedScene: s.loadSavedScene,
    deleteSavedScene: s.deleteSavedScene,
    renameProject: s.renameProject,
    activeSceneId: s.activeSceneId
  })));

  const [newProjectName, setNewProjectName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    if (isHub || showSaveModal) refreshSavedScenes();
  }, [showSaveModal, isHub]);

  if (!isHub && !showSaveModal) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    createNewProject(newProjectName);
    setNewProjectName('');
  };

  const startRename = (id: string, currentName: string) => {
    setEditingId(id);
    setRenameValue(currentName);
  };

  const submitRename = (id: string) => {
    if (renameValue.trim()) {
      renameProject(id, renameValue);
    }
    setEditingId(null);
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  // Gera uma cor de degradê determinística com base no ID
  const getGradientClass = (id: string) => {
    const sum = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const gradients = [
      'linear-gradient(135deg, #6366f1, #a855f7)',
      'linear-gradient(135deg, #ec4899, #f43f5e)',
      'linear-gradient(135deg, #10b981, #059669)',
      'linear-gradient(135deg, #f59e0b, #d97706)',
      'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      'linear-gradient(135deg, #06b6d4, #0891b2)',
    ];
    return gradients[sum % gradients.length];
  };

  return (
    <div className="project-dashboard-overlay">
      <div className="project-dashboard-container">
        
        {/* Sidebar */}
        <div className="project-dashboard-sidebar">
          <div className="sidebar-brand">
            <FolderOpen className="brand-icon" size={24} />
            <h2>Orion Engine</h2>
          </div>
          
          <div className="sidebar-stats">
            <div className="stat-card">
              <span className="stat-val">{savedScenes.length}</span>
              <span className="stat-label">Projetos Salvos</span>
            </div>
          </div>

          <form className="new-project-form" onSubmit={handleCreate}>
            <h3>Novo Projeto</h3>
            <div className="form-group">
              <input
                type="text"
                placeholder="Nome do Projeto..."
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                maxLength={40}
              />
            </div>
            <button type="submit" className="create-btn" disabled={!newProjectName.trim()}>
              <Plus size={16} />
              <span>Criar Projeto</span>
            </button>
          </form>

          <div className="sidebar-footer">
            <span>Freedom3D Mobile Preview v0.1</span>
          </div>
        </div>

        {/* Content Area */}
        <div className="project-dashboard-content">
          <div className="content-header">
            <div>
              <h1>Projetos Recentes</h1>
              <p>Gerencie, edite ou crie novos cenários 3D</p>
            </div>
            {!isHub && (
              <button className="close-dashboard-btn" onClick={() => setShowSaveModal(false)} title="Fechar Gerenciador">
                <X size={20} />
              </button>
            )}
          </div>

          <div className="projects-grid">
            {savedScenes.length === 0 && (
              <div className="projects-empty-state">
                <Folder size={48} className="empty-icon" />
                <h3>Nenhum projeto encontrado</h3>
                <p>Use o painel lateral para criar seu primeiro projeto ou importar um modelo.</p>
              </div>
            )}

            {savedScenes.map((sc) => {
              const isCurrent = sc.id === activeSceneId;
              const isEditing = sc.id === editingId;

              return (
                <div key={sc.id} className={`project-card ${isCurrent ? 'current-active' : ''}`}>
                  {/* Card Cover Gradient */}
                  <div className="project-card-cover" style={{ background: getGradientClass(sc.id) }}>
                    {isCurrent && <span className="active-badge">ATIVO</span>}
                  </div>

                  {/* Card Body */}
                  <div className="project-card-body">
                    <div className="project-card-title-row">
                      {isEditing ? (
                        <div className="rename-input-wrapper">
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && submitRename(sc.id)}
                            autoFocus
                          />
                          <button className="rename-confirm-btn" onClick={() => submitRename(sc.id)}>
                            <Check size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <h3 onClick={() => startRename(sc.id, sc.name)} title="Clique para renomear">{sc.name}</h3>
                          <button className="rename-btn" onClick={() => startRename(sc.id, sc.name)} title="Renomear">
                            <Edit3 size={13} />
                          </button>
                        </>
                      )}
                    </div>

                    <div className="project-card-meta">
                      <div className="meta-item">
                        <Layers size={13} />
                        <span>{sc.entityCount} Entidades</span>
                      </div>
                      <div className="meta-item">
                        <Calendar size={13} />
                        <span>{formatDate(sc.savedAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="project-card-actions">
                    <button
                      className="open-project-btn"
                      onClick={() => loadSavedScene(sc.id)}
                      disabled={isCurrent}
                    >
                      <FolderOpen size={14} />
                      <span>{isCurrent ? 'Aberto' : 'Abrir'}</span>
                    </button>
                    <button
                      className="delete-project-btn"
                      onClick={() => {
                        if (confirm(`Tem certeza de que deseja deletar o projeto "${sc.name}"?`)) {
                          deleteSavedScene(sc.id);
                        }
                      }}
                      title="Deletar Projeto"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
