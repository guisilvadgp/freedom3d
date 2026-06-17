import { useState } from 'react';
import { useEditorStore } from '../store/editorStore';

const ENTITY_TYPES = [
  { id: 'cube', label: '📦 Cube', icon: '📦' },
  { id: 'sphere', label: '🔵 Sphere', icon: '🔵' },
  { id: 'plane', label: '▬ Plane', icon: '▬' },
  { id: 'cylinder', label: '🔵 Cylinder', icon: '⬜' },
  { id: 'torus', label: '🟣 Torus', icon: '🟣' },
];

const LIGHT_TYPES = [
  { id: 'directional', label: '☀️ Directional Light' },
  { id: 'point', label: '💡 Point Light' },
];

const PLAYER_TYPES = [
  { id: 'first-person', label: '🚶 First Person Player' },
  { id: 'third-person', label: '🏃 Third Person Player' },
];

export function HierarchyPanel() {
  const {
    activeScene, selectedEntityId, selectEntity,
    createEntity, deleteEntity, duplicateEntity,
    renameEntity, toggleEntityActive,
  } = useEditorStore();
  const scene = activeScene();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  const handleCreate = (type: string) => {
    createEntity(type);
    setShowCreateMenu(false);
  };

  const startRename = (id: string, name: string) => {
    setRenamingId(id);
    setRenameVal(name);
  };

  const finishRename = () => {
    if (renamingId && renameVal.trim()) {
      renameEntity(renamingId, renameVal.trim());
    }
    setRenamingId(null);
  };

  return (
    <div className="panel hierarchy-panel">
      <div className="panel-header">
        <span className="panel-title">Hierarchy</span>
        <button
          className="panel-btn"
          onClick={() => setShowCreateMenu(!showCreateMenu)}
          title="Create Entity"
        >
          + Create
        </button>
      </div>

      {showCreateMenu && (
        <div className="create-menu">
          <div className="create-menu-section">3D Objects</div>
          {ENTITY_TYPES.map((t) => (
            <button key={t.id} className="create-menu-item" onClick={() => handleCreate(t.id)}>
              {t.label}
            </button>
          ))}
          <div className="create-menu-section">Lights</div>
          {LIGHT_TYPES.map((t) => (
            <button key={t.id} className="create-menu-item" onClick={() => handleCreate(t.id)}>
              {t.label}
            </button>
          ))}
          <div className="create-menu-section">Players</div>
          {PLAYER_TYPES.map((t) => (
            <button key={t.id} className="create-menu-item" onClick={() => handleCreate(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="hierarchy-list">
        {scene.rootEntityIds.map((id) => {
          const entity = scene.entities[id];
          if (!entity) return null;
          const isSelected = selectedEntityId === id;
          const icon = entity.components.Light ? '💡'
            : entity.components.Camera ? '🎥'
            : entity.components.MeshRenderer ? '📦'
            : '📁';

          return (
            <div
              key={id}
              className={`hierarchy-item ${isSelected ? 'selected' : ''} ${!entity.active ? 'inactive' : ''}`}
              onClick={() => selectEntity(id)}
              onDoubleClick={() => startRename(id, entity.name)}
            >
              <span className="entity-toggle" onClick={(e) => {
                e.stopPropagation();
                toggleEntityActive(id);
              }}>
                {entity.active ? '👁' : '🚫'}
              </span>
              <span className="entity-icon">{icon}</span>

              {renamingId === id ? (
                <input
                  className="rename-input"
                  value={renameVal}
                  autoFocus
                  onChange={(e) => setRenameVal(e.target.value)}
                  onBlur={finishRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') finishRename();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="entity-name">{entity.name}</span>
              )}

              {isSelected && (
                <div className="entity-actions">
                  <button
                    className="entity-action-btn"
                    title="Duplicate"
                    onClick={(e) => { e.stopPropagation(); duplicateEntity(id); }}
                  >⧉</button>
                  <button
                    className="entity-action-btn delete"
                    title="Delete"
                    onClick={(e) => { e.stopPropagation(); deleteEntity(id); }}
                  >✕</button>
                </div>
              )}
            </div>
          );
        })}

        {scene.rootEntityIds.length === 0 && (
          <div className="hierarchy-empty">Cena vazia. Crie um objeto.</div>
        )}
      </div>
    </div>
  );
}
