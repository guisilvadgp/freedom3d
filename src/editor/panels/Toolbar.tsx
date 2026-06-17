import { useEditorStore } from '../store/editorStore';

export function Toolbar() {
  const {
    editorMode, setEditorMode,
    isPlaying, togglePlay,
    showGrid, toggleGrid,
    showGizmos, toggleGizmos,
    snapEnabled, toggleSnap, snapValue, setSnapValue,
    viewMode, setViewMode,
  } = useEditorStore();

  return (
    <div className="toolbar">
      {/* Logo */}
      <div className="toolbar-logo">
        <span className="logo-icon">⬡</span>
        <span className="logo-text">Orion</span>
        <span className="logo-version">v0.1</span>
      </div>

      <div className="toolbar-divider" />

      {/* Transform modes */}
      <div className="toolbar-group">
        {[
          { mode: 'translate', icon: '⇔', title: 'Translate (W)' },
          { mode: 'rotate', icon: '↻', title: 'Rotate (E)' },
          { mode: 'scale', icon: '⊞', title: 'Scale (R)' },
        ].map(({ mode, icon, title }) => (
          <button
            key={mode}
            className={`toolbar-btn ${editorMode === mode ? 'active' : ''}`}
            onClick={() => setEditorMode(mode as any)}
            title={title}
          >
            <span>{icon}</span>
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
          <span>⊡</span>
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
          <span>⋮⋮</span>
          <span className="btn-label">Grid</span>
        </button>
        <button
          className={`toolbar-btn ${showGizmos ? 'active' : ''}`}
          onClick={toggleGizmos}
          title="Toggle Gizmos"
        >
          <span>✚</span>
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
      <div className="toolbar-group play-group">
        <button
          className={`play-btn ${isPlaying ? 'playing' : ''}`}
          onClick={togglePlay}
          title={isPlaying ? 'Stop' : 'Play'}
        >
          {isPlaying ? (
            <>
              <span>⏹</span>
              <span className="btn-label">Stop</span>
            </>
          ) : (
            <>
              <span>▶</span>
              <span className="btn-label">Play</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
