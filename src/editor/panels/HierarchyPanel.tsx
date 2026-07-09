import { useState, useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';
import { 
  Box, 
  Circle, 
  Square, 
  Database, 
  Disc, 
  Sun, 
  Lightbulb, 
  User, 
  Users, 
  Target, 
  Eye, 
  EyeOff, 
  Copy, 
  Trash2, 
  Plus,
  Video,
  Cpu,
  Edit2,
  CircleDot,
  Film
} from 'lucide-react';

function CapsuleIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="8" y="3" width="8" height="18" rx="4" ry="4" />
    </svg>
  );
}

const ENTITY_TYPES = [
  { id: 'empty', label: 'Empty', icon: <CircleDot size={14} /> },
  { id: 'cube', label: 'Cube', icon: <Box size={14} /> },
  { id: 'sphere', label: 'Sphere', icon: <Circle size={14} /> },
  { id: 'plane', label: 'Plane', icon: <Square size={14} /> },
  { id: 'cylinder', label: 'Cylinder', icon: <Database size={14} /> },
  { id: 'capsule', label: 'Capsule', icon: <CapsuleIcon size={14} /> },
  { id: 'torus', label: 'Torus', icon: <Disc size={14} /> },
];

const LIGHT_TYPES = [
  { id: 'directional', label: 'Directional Light', icon: <Sun size={14} /> },
  { id: 'point', label: 'Point Light', icon: <Lightbulb size={14} /> },
];

const PLAYER_TYPES = [
  { id: 'first-person', label: 'First Person Player', icon: <User size={14} /> },
  { id: 'third-person', label: 'Third Person Player', icon: <Users size={14} /> },
];

const XR_TYPES = [
  { id: 'vr-position', label: 'VR Position', icon: <Target size={14} /> },
  { id: 'hud-plane', label: 'HUD Visor', icon: <Cpu size={14} /> },
  { id: 'video-mesh', label: 'Video Mesh', icon: <Film size={14} /> },
];

export function HierarchyPanel({ style }: { style?: React.CSSProperties }) {
  const {
    activeScene,
    createEntity,
    renameEntity,
    currentProjectName,
  } = useEditorStore();
  const scene = activeScene();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  // Fecha o menu de criação ao clicar fora
  useEffect(() => {
    const handleGlobalClick = () => {
      setShowCreateMenu(false);
    };
    if (showCreateMenu) {
      window.addEventListener('click', handleGlobalClick);
    }
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [showCreateMenu]);

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
    <div className="panel hierarchy-panel" style={style}>
      <div className="panel-header">
        <span className="panel-title">Hierarchy</span>
        <button
          className="panel-btn"
          onClick={(e) => { e.stopPropagation(); setShowCreateMenu(!showCreateMenu); }}
          title="Criar Entidade"
        >
          <Plus size={13} />
        </button>
      </div>

      {showCreateMenu && (
        <div className="create-menu">
          <div className="create-menu-section">3D Objects</div>
          {ENTITY_TYPES.map((t) => (
            <button key={t.id} className="create-menu-item" onClick={() => handleCreate(t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
          <div className="create-menu-section">Lights</div>
          {LIGHT_TYPES.map((t) => (
            <button key={t.id} className="create-menu-item" onClick={() => handleCreate(t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
          <div className="create-menu-section">Cameras</div>
          <button className="create-menu-item" onClick={() => handleCreate('camera')}>
            <Video size={14} /> Camera
          </button>
          <div className="create-menu-section">Players</div>
          {PLAYER_TYPES.map((t) => (
            <button key={t.id} className="create-menu-item" onClick={() => handleCreate(t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
          <div className="create-menu-section">XR / VR</div>
          {XR_TYPES.map((t) => (
            <button key={t.id} className="create-menu-item" onClick={() => handleCreate(t.id)}>
              {t.icon} {t.label}
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
  const { selectedEntityId, selectEntity, toggleEntityActive, duplicateEntity, deleteEntity, activeScene, reparentEntity, currentProjectName } = useEditorStore();
  const scene = activeScene();
  const [isDragOver, setIsDragOver] = useState(false);
  const entity = scene.entities[entityId];
  if (!entity) return null;

  const isSelected = selectedEntityId === entityId;
  
  // Decide the icon dynamically based on entity components
  const renderIcon = () => {
    if (entity.components.Light) return <Sun size={14} />;
    if (entity.components.Camera) return <Video size={14} />;
    if (entity.components.MeshRenderer) {
      if (entity.components.MeshRenderer.geometry === 'capsule') {
        return <CapsuleIcon size={14} />;
      }
      return <Box size={14} />;
    }
    if (entity.components.Script) return <Cpu size={14} />;
    return <CircleDot size={14} />;
  };

  return (
    <>
      <div
        className={`hierarchy-item ${isSelected ? 'selected' : ''} ${!entity.active ? 'inactive' : ''} ${isDragOver ? 'drag-over' : ''}`}
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
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);
        }}
        onDrop={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);

          // Handle file drop (script, audio, model)
          const fileDataStr = e.dataTransfer.getData('application/orion-file');
          if (fileDataStr) {
            try {
              const fileData = JSON.parse(fileDataStr);
              if (fileData && !fileData.isDir) {
                const ext = fileData.name.split('.').pop()?.toLowerCase();
                const store = useEditorStore.getState();
                const targetEntity = scene.entities[entityId];

                if (ext === 'js' || ext === 'ts') {
                  const sceneName = currentProjectName || 'default';
                  const res = await fetch(`/api/explorer/read-file?project=${encodeURIComponent(sceneName)}&subpath=${encodeURIComponent(fileData.path)}`);
                  if (res.ok) {
                    const data = await res.json();
                    const code = data.content || '';
                    const scriptName = fileData.name.replace(/\.(js|ts)$/i, '');
                    
                    if (targetEntity) {
                      if (targetEntity.components.Script) {
                        const mainScript = targetEntity.components.Script as any;
                        if (!mainScript.code || mainScript.scriptName === 'NewScript' || mainScript.scriptName === '') {
                          store.updateComponent(entityId, 'Script', {
                            scriptName,
                            code
                          });
                          store.addLog('info', `Script principal do objeto "${targetEntity.name}" atualizado para "${scriptName}".`);
                          store.showToast(`Script "${scriptName}" adicionado!`);
                        } else {
                          const currentScripts = mainScript.scripts || [];
                          if (currentScripts.some((s: any) => s.scriptName === scriptName)) {
                            store.showToast(`Script "${scriptName}" já está anexado.`, 'warning');
                          } else {
                            const newScript = {
                              id: Math.random().toString(36).substring(2, 9),
                              scriptName,
                              code,
                              variables: []
                            };
                            store.updateComponent(entityId, 'Script', {
                              scripts: [...currentScripts, newScript]
                            });
                            store.addLog('info', `Script adicional "${scriptName}" anexado ao objeto "${targetEntity.name}".`);
                            store.showToast(`Script adicional "${scriptName}" adicionado!`);
                          }
                        }
                      } else {
                        store.addComponent(entityId, {
                          type: 'Script',
                          scriptName,
                          code,
                          variables: [],
                          scripts: []
                        });
                        store.addLog('info', `Componente Script adicionado ao objeto "${targetEntity.name}" com o arquivo "${fileData.name}".`);
                        store.showToast(`Script "${scriptName}" adicionado ao objeto!`);
                      }
                    }
                  } else {
                    store.showToast('Erro ao ler arquivo de script.', 'error');
                  }
                } else if (ext === 'mp3' || ext === 'wav' || ext === 'ogg') {
                  const sceneName = currentProjectName || 'default';
                  const src = `/api/explorer/load-file?project=${encodeURIComponent(sceneName)}&subpath=${encodeURIComponent(fileData.path)}`;
                  if (targetEntity) {
                    if (targetEntity.components.Audio) {
                      store.updateComponent(entityId, 'Audio', { src, fileName: fileData.path });
                      store.addLog('info', `Áudio de "${targetEntity.name}" atualizado para "${fileData.name}".`);
                    } else {
                      store.addComponent(entityId, {
                        type: 'Audio',
                        src,
                        fileName: fileData.path,
                        loop: true,
                        playOnStart: true,
                        volume: 1,
                        is3D: true,
                        delay: 0,
                        refDistance: 5,
                        rolloffFactor: 1,
                        maxDistance: 100,
                        distanceModel: 'linear'
                      });
                      store.addLog('info', `Componente Audio Source adicionado a "${targetEntity.name}".`);
                    }
                    store.showToast(`Áudio "${fileData.name}" anexado!`);
                  }
                } else if (ext === 'gltf' || ext === 'glb') {
                  const sceneName = activeScene().name || 'default';
                  const src = `/api/project/get-asset?project=${encodeURIComponent(sceneName)}&file=${encodeURIComponent(fileData.name)}`;
                  if (targetEntity) {
                    if (targetEntity.components.GLTFModel) {
                      store.updateComponent(entityId, 'GLTFModel', { src, fileName: fileData.name });
                      store.addLog('info', `Modelo GLTF de "${targetEntity.name}" atualizado para "${fileData.name}".`);
                    } else {
                      store.addComponent(entityId, {
                        type: 'GLTFModel',
                        src,
                        fileName: fileData.name,
                        modelScale: 1,
                        castShadow: true,
                        receiveShadow: true,
                        overrideMaterial: 'none',
                        color: '#ffffff',
                        roughness: 0.5,
                        metalness: 0.1,
                        textureUrl: '',
                        normalMapUrl: '',
                        normalScale: 1,
                      });
                      store.addLog('info', `Componente GLTFModel adicionado a "${targetEntity.name}".`);
                    }
                    store.showToast(`Modelo "${fileData.name}" anexado!`);
                  }
                } else {
                  store.showToast(`Tipo de arquivo não suportado para o objeto.`, 'info');
                }
              }
            } catch (err) {
              console.error('Failed to handle drop of file in hierarchy', err);
            }
            return;
          }

          // Handle reparenting drop
          const draggedId = e.dataTransfer.getData('application/orion-entity');
          if (draggedId && draggedId !== entityId) {
            reparentEntity(draggedId, entityId);
          }
        }}
        onClick={(e) => { e.stopPropagation(); selectEntity(entityId); }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          useEditorStore.getState().focusEntity(entityId);
        }}
      >
        <span className="entity-toggle" onClick={(e) => {
          e.stopPropagation();
          toggleEntityActive(entityId);
        }}>
          {entity.active ? <Eye size={13} /> : <EyeOff size={13} />}
        </span>
        <span className="entity-icon">{renderIcon()}</span>

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
              title="Renomear"
              onClick={(e) => { e.stopPropagation(); startRename(entityId, entity.name); }}
            >
              <Edit2 size={12} />
            </button>
            <button
              className="entity-action-btn"
              title="Duplicate"
              onClick={(e) => { e.stopPropagation(); duplicateEntity(entityId); }}
            >
              <Copy size={13} />
            </button>
            <button
              className="entity-action-btn delete"
              title="Delete"
              onClick={(e) => { e.stopPropagation(); deleteEntity(entityId); }}
            >
              <Trash2 size={13} />
            </button>
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
