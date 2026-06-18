import { useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import {
  FolderOpen,
  Upload,
  Move,
  RotateCw,
  Maximize,
  Magnet,
  Grid,
  Eye,
  Send,
  Play,
  Square,
  Hexagon,
  Save
} from 'lucide-react';

export function Toolbar() {
  const {
    editorMode, setEditorMode,
    isPlaying, togglePlay,
    showGrid, toggleGrid,
    showGizmos, toggleGizmos,
    snapEnabled, toggleSnap, snapValue, setSnapValue,
    viewMode, setViewMode,
    saveCurrentScene, isSaving, importGLTF, publishToPreview, hasUnpublishedChanges
  } = useEditorStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importGLTF(file);
      e.target.value = '';
    }
  };

  return (
    <div className="toolbar">
      {/* Logo */}
      <div className="toolbar-logo">
        <Hexagon className="logo-icon" size={20} />
        <span className="logo-text">Orion</span>
        <span className="logo-version">v0.1</span>
      </div>

      <div className="toolbar-divider" />

      {/* Project Actions */}
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={saveCurrentScene} title="Salvar Projeto (Ctrl + S)" disabled={isSaving}>
          <Save size={15} />
          <span className="btn-label">{isSaving ? 'Salvando...' : 'Salvar'}</span>
        </button>
        <button className="toolbar-btn" onClick={() => fileInputRef.current?.click()} title="Import GLTF Model">
          <Upload size={15} />
          <span className="btn-label">Import GLTF</span>
        </button>
        <input type="file" accept=".gltf,.glb" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImport} />
      </div>

      <div className="toolbar-divider" />

      {/* Transform modes */}
      <div className="toolbar-group">
        {[
          { mode: 'translate', icon: <Move size={15} />, title: 'Translate (W)' },
          { mode: 'rotate', icon: <RotateCw size={15} />, title: 'Rotate (E)' },
          { mode: 'scale', icon: <Maximize size={15} />, title: 'Scale (R)' },
        ].map(({ mode, icon, title }) => (
          <button
            key={mode}
            className={`toolbar-btn ${editorMode === mode ? 'active' : ''}`}
            onClick={() => setEditorMode(mode as any)}
            title={title}
          >
            {icon}
            <span className="btn-label">{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
          </button>
        ))}
      </div>

      <div className="toolbar-divider" />

      {/* Snap */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${snapEnabled ? 'active' : ''}`}
          onClick={toggleSnap}
          title="Toggle Snap"
        >
          <Magnet size={15} />
          <span className="btn-label">Snap</span>
        </button>
        {snapEnabled && (
          <input
            type="number"
            className="snap-input"
            value={snapValue}
            min={0.1}
            step={0.1}
            onChange={(e) => setSnapValue(parseFloat(e.target.value))}
          />
        )}
      </div>

      <div className="toolbar-divider" />

      {/* View options */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${showGrid ? 'active' : ''}`}
          onClick={toggleGrid}
          title="Toggle Grid"
        >
          <Grid size={15} />
          <span className="btn-label">Grid</span>
        </button>
        <button
          className={`toolbar-btn ${showGizmos ? 'active' : ''}`}
          onClick={toggleGizmos}
          title="Toggle Gizmos"
        >
          <Eye size={15} />
          <span className="btn-label">Gizmos</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* View mode */}
      <div className="toolbar-group">
        <select
          className="view-select"
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as any)}
        >
          <option value="perspective">Perspective</option>
          <option value="top">Top</option>
          <option value="front">Front</option>
          <option value="right">Right</option>
        </select>
      </div>

      {/* Spacer */}
      <div className="toolbar-spacer" />

      {/* Play controls */}
      <button
        className={`toolbar-btn publish-btn ${!hasUnpublishedChanges ? 'disabled' : ''}`}
        onClick={publishToPreview}
        disabled={!hasUnpublishedChanges}
        title="Publish to Preview"
        style={{ opacity: hasUnpublishedChanges ? 1 : 0.5, cursor: hasUnpublishedChanges ? 'pointer' : 'not-allowed' }}
      >
        <Send size={15} />
        <span className="btn-label">{hasUnpublishedChanges ? 'Salvar Cena' : 'Salvo!'}</span>
      </button>

      <div className="toolbar-divider" />

      <div className="toolbar-group play-group">
        <button
          className={`play-btn ${isPlaying ? 'playing' : ''}`}
          onClick={togglePlay}
          title={isPlaying ? 'Stop' : 'Play'}
        >
          {isPlaying ? (
            <>
              <Square size={15} fill="white" />
              <span className="btn-label">Stop</span>
            </>
          ) : (
            <>
              <Play size={15} fill="white" />
              <span className="btn-label">Play</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
