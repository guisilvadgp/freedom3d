import { useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import type { Entity } from '../../engine/ecs/types';

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

const XR_TYPES = [
  { id: 'vr-position', label: '🌀 VR Position' },
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
          <div className="create-menu-section">XR / VR</div>
          {XR_TYPES.map((t) => (
            <button key={t.id} className="create-menu-item" onClick={() => handleCreate(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div 
        className="hierarchy-list"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const draggedId = e.dataTransfer.getData('application/orion-entity');
          if (draggedId) {
            useEditorStore.getState().reparentEntity(draggedId, null);
          }
        }}
      >
        {scene.rootEntityIds.map((id) => (
          <HierarchyNode 
            key={id} 
            entityId={id} 
            depth={0} 
            renamingId={renamingId} 
            renameVal={renameVal} 
            setRenamingId={setRenamingId} 
            setRenameVal={setRenameVal} 
            finishRename={finishRename} 
            startRename={startRename}
          />
        ))}

        {scene.rootEntityIds.length === 0 && (
          <div className="hierarchy-empty">Cena vazia. Crie um objeto.</div>
        )}
      </div>
    </div>
  );
}

function HierarchyNode({ 
  entityId, depth, renamingId, renameVal, 
  setRenamingId, setRenameVal, finishRename, startRename 
}: { 
  entityId: string, depth: number, 
  renamingId: string | null, renameVal: string, 
  setRenamingId: (v: string | null) => void, setRenameVal: (v: string) => void, 
  finishRename: () => void, startRename: (id: string, name: string) => void 
}) {
  const { selectedEntityId, selectEntity, toggleEntityActive, duplicateEntity, deleteEntity, activeScene, reparentEntity } = useEditorStore();
  const scene = activeScene();
  const entity = scene.entities[entityId];
  if (!entity) return null;

  const isSelected = selectedEntityId === entityId;
  const icon = entity.components.Light ? '💡'
    : entity.components.Camera ? '🎥'
    : entity.components.MeshRenderer ? '📦'
    : '📁';

  return (
    <>
      <div
        className={`hierarchy-item ${isSelected ? 'selected' : ''} ${!entity.active ? 'inactive' : ''}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.setData('application/orion-entity', entityId);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const draggedId = e.dataTransfer.getData('application/orion-entity');
          if (draggedId && draggedId !== entityId) {
            reparentEntity(draggedId, entityId);
          }
        }}
        onClick={(e) => { e.stopPropagation(); selectEntity(entityId); }}
        onDoubleClick={(e) => { e.stopPropagation(); startRename(entityId, entity.name); }}
      >
        <span className="entity-toggle" onClick={(e) => {
          e.stopPropagation();
          toggleEntityActive(entityId);
        }}>
          {entity.active ? '👁' : '🚫'}
        </span>
        <span className="entity-icon">{icon}</span>

        {renamingId === entityId ? (
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
              onClick={(e) => { e.stopPropagation(); duplicateEntity(entityId); }}
            >⧉</button>
            <button
              className="entity-action-btn delete"
              title="Delete"
              onClick={(e) => { e.stopPropagation(); deleteEntity(entityId); }}
            >✕</button>
          </div>
        )}
      </div>

      {entity.childrenIds.map(childId => (
        <HierarchyNode 
          key={childId} 
          entityId={childId} 
          depth={depth + 1} 
          renamingId={renamingId} 
          renameVal={renameVal} 
          setRenamingId={setRenamingId} 
          setRenameVal={setRenameVal} 
          finishRename={finishRename} 
          startRename={startRename}
        />
      ))}
    </>
  );
}
