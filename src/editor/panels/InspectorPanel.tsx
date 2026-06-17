import { useEditorStore } from '../store/editorStore';
import type { TransformComponent, MeshRendererComponent, LightComponent, GLTFModelComponent, RigidBodyComponent, AudioComponent, ParticleSystemComponent, ScriptComponent } from '../../engine/ecs/types';

function Vec3Field({
  label, value, onChange,
}: {
  label: string;
  value: [number, number, number];
  onChange: (v: [number, number, number]) => void;
}) {
  return (
    <div className="vec3-field">
      <span className="vec3-label">{label}</span>
      <div className="vec3-inputs">
        {(['X', 'Y', 'Z'] as const).map((axis, i) => (
          <label key={axis} className="vec3-input-wrap">
            <span className={`axis-label axis-${axis.toLowerCase()}`}>{axis}</span>
            <input
              type="number"
              className="vec3-input"
              value={value[i]}
              step={0.1}
              onChange={(e) => {
                const copy: [number, number, number] = [...value];
                copy[i] = parseFloat(e.target.value) || 0;
                onChange(copy);
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function TransformInspector({ entityId }: { entityId: string }) {
  const { selectedEntity, updateComponent } = useEditorStore();
  const entity = selectedEntity();
  if (!entity) return null;
  const t = entity.components.Transform as TransformComponent;

  return (
    <div className="component-block">
      <div className="component-header">
        <span className="component-icon">⟳</span>
        <span className="component-title">Transform</span>
      </div>
      <Vec3Field
        label="Position"
        value={t.position}
        onChange={(v) => updateComponent(entityId, 'Transform', { position: v })}
      />
      <Vec3Field
        label="Rotation"
        value={t.rotation}
        onChange={(v) => updateComponent(entityId, 'Transform', { rotation: v })}
      />
      <Vec3Field
        label="Scale"
        value={t.scale}
        onChange={(v) => updateComponent(entityId, 'Transform', { scale: v })}
      />
    </div>
  );
}

function MeshRendererInspector({ entityId }: { entityId: string }) {
  const { selectedEntity, updateComponent } = useEditorStore();
  const entity = selectedEntity();
  if (!entity) return null;
  const m = entity.components.MeshRenderer as MeshRendererComponent;

  return (
    <div className="component-block">
      <div className="component-header">
        <span className="component-icon">🔷</span>
        <span className="component-title">Mesh Renderer</span>
      </div>
      <div className="field-row">
        <label className="field-label">Geometry</label>
        <select
          className="field-select"
          value={m.geometry}
          onChange={(e) => updateComponent(entityId, 'MeshRenderer', { geometry: e.target.value as any })}
        >
          <option value="box">Box</option>
          <option value="sphere">Sphere</option>
          <option value="plane">Plane</option>
          <option value="cylinder">Cylinder</option>
          <option value="torus">Torus</option>
          <option value="cone">Cone</option>
        </select>
      </div>
      <div className="field-row">
        <label className="field-label">Material</label>
        <select
          className="field-select"
          value={m.material}
          onChange={(e) => updateComponent(entityId, 'MeshRenderer', { material: e.target.value as any })}
        >
          <option value="standard">Standard (PBR)</option>
          <option value="basic">Basic</option>
          <option value="phong">Phong</option>
          <option value="wireframe">Wireframe</option>
        </select>
      </div>
      <div className="field-row">
        <label className="field-label">Color</label>
        <input
          type="color"
          className="field-color"
          value={m.color}
          onChange={(e) => updateComponent(entityId, 'MeshRenderer', { color: e.target.value })}
        />
      </div>
      <div className="field-row">
        <label className="field-label">Cast Shadow</label>
        <input
          type="checkbox"
          checked={m.castShadow}
          onChange={(e) => updateComponent(entityId, 'MeshRenderer', { castShadow: e.target.checked })}
        />
      </div>
      <div className="field-row">
        <label className="field-label">Receive Shadow</label>
        <input
          type="checkbox"
          checked={m.receiveShadow}
          onChange={(e) => updateComponent(entityId, 'MeshRenderer', { receiveShadow: e.target.checked })}
        />
      </div>
    </div>
  );
}

function LightInspector({ entityId }: { entityId: string }) {
  const { selectedEntity, updateComponent } = useEditorStore();
  const entity = selectedEntity();
  if (!entity) return null;
  const l = entity.components.Light as LightComponent;

  return (
    <div className="component-block">
      <div className="component-header">
        <span className="component-icon">💡</span>
        <span className="component-title">Light</span>
      </div>
      <div className="field-row">
        <label className="field-label">Type</label>
        <select
          className="field-select"
          value={l.lightType}
          onChange={(e) => updateComponent(entityId, 'Light', { lightType: e.target.value as any })}
        >
          <option value="directional">Directional</option>
          <option value="point">Point</option>
          <option value="spot">Spot</option>
          <option value="ambient">Ambient</option>
        </select>
      </div>
      <div className="field-row">
        <label className="field-label">Color</label>
        <input
          type="color"
          className="field-color"
          value={l.color}
          onChange={(e) => updateComponent(entityId, 'Light', { color: e.target.value })}
        />
      </div>
      <div className="field-row">
        <label className="field-label">Intensity</label>
        <input
          type="range"
          min={0}
          max={10}
          step={0.1}
          value={l.intensity}
          onChange={(e) => updateComponent(entityId, 'Light', { intensity: parseFloat(e.target.value) })}
          className="field-range"
        />
        <span className="range-value">{l.intensity.toFixed(1)}</span>
      </div>
      <div className="field-row">
        <label className="field-label">Cast Shadow</label>
        <input
          type="checkbox"
          checked={l.castShadow}
          onChange={(e) => updateComponent(entityId, 'Light', { castShadow: e.target.checked })}
        />
      </div>
    </div>
  );
}

function GLTFModelInspector({ entityId }: { entityId: string }) {
  const { selectedEntity, updateComponent } = useEditorStore();
  const entity = selectedEntity();
  if (!entity) return null;
  const m = entity.components.GLTFModel as GLTFModelComponent;

  return (
    <div className="component-block">
      <div className="component-header">
        <span className="component-icon">📦</span>
        <span className="component-title">GLTF Model</span>
      </div>
      <div className="field-row">
        <label className="field-label">File Name</label>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{m.fileName}</span>
      </div>
      <div className="field-row">
        <label className="field-label">Scale</label>
        <input
          type="number"
          className="field-input"
          value={m.modelScale}
          step={0.1}
          onChange={(e) => updateComponent(entityId, 'GLTFModel', { modelScale: parseFloat(e.target.value) || 1 })}
        />
      </div>
      <div className="field-row">
        <label className="field-label">Cast Shadow</label>
        <input
          type="checkbox"
          checked={m.castShadow}
          onChange={(e) => updateComponent(entityId, 'GLTFModel', { castShadow: e.target.checked })}
        />
      </div>
      <div className="field-row">
        <label className="field-label">Receive Shadow</label>
        <input
          type="checkbox"
          checked={m.receiveShadow}
          onChange={(e) => updateComponent(entityId, 'GLTFModel', { receiveShadow: e.target.checked })}
        />
      </div>
    </div>
  );
}

function RigidBodyInspector({ entityId }: { entityId: string }) {
  const { selectedEntity, updateComponent } = useEditorStore();
  const entity = selectedEntity();
  if (!entity) return null;
  const rb = entity.components.RigidBody as RigidBodyComponent;

  return (
    <div className="component-block">
      <div className="component-header">
        <span className="component-icon">🎳</span>
        <span className="component-title">Rigid Body</span>
      </div>
      <div className="field-row">
        <label className="field-label">Mass</label>
        <input
          type="number"
          className="field-input"
          value={rb.mass}
          step={0.1}
          onChange={(e) => updateComponent(entityId, 'RigidBody', { mass: parseFloat(e.target.value) || 1 })}
        />
      </div>
      <div className="field-row">
        <label className="field-label">Is Static</label>
        <input
          type="checkbox"
          checked={rb.isStatic}
          onChange={(e) => updateComponent(entityId, 'RigidBody', { isStatic: e.target.checked })}
        />
      </div>
      <div className="field-row">
        <label className="field-label">Use Gravity</label>
        <input
          type="checkbox"
          checked={rb.useGravity}
          onChange={(e) => updateComponent(entityId, 'RigidBody', { useGravity: e.target.checked })}
        />
      </div>
      <div className="field-row">
        <label className="field-label">Collider</label>
        <select
          className="field-input"
          value={rb.collider || 'cuboid'}
          onChange={(e) => updateComponent(entityId, 'RigidBody', { collider: e.target.value as any })}
        >
          <option value="cuboid">Cuboid</option>
          <option value="ball">Ball (Sphere)</option>
          <option value="hull">Convex Hull</option>
          <option value="trimesh">Trimesh (Complex)</option>
          <option value="none">None</option>
        </select>
      </div>
    </div>
  );
}

function AudioInspector({ entityId }: { entityId: string }) {
  const { selectedEntity, updateComponent } = useEditorStore();
  const entity = selectedEntity();
  if (!entity) return null;
  const audio = entity.components.Audio as AudioComponent;

  return (
    <div className="component-block">
      <div className="component-header">
        <span className="component-icon">🔊</span>
        <span className="component-title">Audio Source</span>
      </div>
      <div className="field-row">
        <label className="field-label">File URL</label>
        <input
          type="text"
          className="field-input"
          value={audio.src}
          placeholder="e.g. sound.mp3"
          onChange={(e) => updateComponent(entityId, 'Audio', { src: e.target.value })}
        />
      </div>
      <div className="field-row">
        <label className="field-label">Loop</label>
        <input
          type="checkbox"
          checked={audio.loop}
          onChange={(e) => updateComponent(entityId, 'Audio', { loop: e.target.checked })}
        />
      </div>
      <div className="field-row">
        <label className="field-label">Play On Start</label>
        <input
          type="checkbox"
          checked={audio.playOnStart}
          onChange={(e) => updateComponent(entityId, 'Audio', { playOnStart: e.target.checked })}
        />
      </div>
    </div>
  );
}

function ParticleSystemInspector({ entityId }: { entityId: string }) {
  const { selectedEntity, updateComponent } = useEditorStore();
  const entity = selectedEntity();
  if (!entity) return null;
  const ps = entity.components.ParticleSystem as ParticleSystemComponent;

  return (
    <div className="component-block">
      <div className="component-header">
        <span className="component-icon">✨</span>
        <span className="component-title">Particle System</span>
      </div>
      <div className="field-row">
        <label className="field-label">Color</label>
        <input
          type="color"
          value={ps.color}
          onChange={(e) => updateComponent(entityId, 'ParticleSystem', { color: e.target.value })}
        />
      </div>
      <div className="field-row">
        <label className="field-label">Count</label>
        <input
          type="number"
          className="field-input"
          value={ps.count}
          onChange={(e) => updateComponent(entityId, 'ParticleSystem', { count: parseInt(e.target.value) || 100 })}
        />
      </div>
      <div className="field-row">
        <label className="field-label">Size</label>
        <input
          type="number"
          className="field-input"
          value={ps.size}
          step={0.1}
          onChange={(e) => updateComponent(entityId, 'ParticleSystem', { size: parseFloat(e.target.value) || 1 })}
        />
      </div>
      <div className="field-row">
        <label className="field-label">Speed</label>
        <input
          type="number"
          className="field-input"
          value={ps.speed}
          step={0.1}
          onChange={(e) => updateComponent(entityId, 'ParticleSystem', { speed: parseFloat(e.target.value) || 1 })}
        />
      </div>
    </div>
  );
}

function AnimatorInspector({ entityId }: { entityId: string }) {
  const { selectedEntity, updateComponent } = useEditorStore();
  const entity = selectedEntity();
  if (!entity) return null;
  const anim = entity.components.Animator as any;

  return (
    <div className="component-block">
      <div className="component-header">
        <span className="component-icon">🏃</span>
        <span className="component-title">Animator</span>
      </div>
      <div className="field-row">
        <label className="field-label">Current Anim</label>
        <input
          type="text"
          className="field-input"
          value={anim.currentAnimation}
          onChange={(e) => updateComponent(entityId, 'Animator', { currentAnimation: e.target.value })}
        />
      </div>
      <div className="field-row">
        <label className="field-label">Time Scale</label>
        <input
          type="number"
          className="field-input"
          value={anim.timeScale}
          step={0.1}
          onChange={(e) => updateComponent(entityId, 'Animator', { timeScale: parseFloat(e.target.value) || 1 })}
        />
      </div>
      <div className="field-row">
        <label className="field-label">Loop</label>
        <input
          type="checkbox"
          checked={anim.loop}
          onChange={(e) => updateComponent(entityId, 'Animator', { loop: e.target.checked })}
        />
      </div>
    </div>
  );
}

function NetworkInspector({ entityId }: { entityId: string }) {
  const { selectedEntity, updateComponent } = useEditorStore();
  const entity = selectedEntity();
  if (!entity) return null;
  const net = entity.components.Network as any;

  return (
    <div className="component-block">
      <div className="component-header">
        <span className="component-icon">??</span>
        <span className="component-title">Network Identity</span>
      </div>
      <div className="field-row">
        <label className="field-label">Is Local Player</label>
        <input type="checkbox" checked={net.isLocal} onChange={(e) => updateComponent(entityId, 'Network', { isLocal: e.target.checked })} />
      </div>
      <div className="field-row">
        <label className="field-label">Sync Position</label>
        <input type="checkbox" checked={net.syncPosition} onChange={(e) => updateComponent(entityId, 'Network', { syncPosition: e.target.checked })} />
      </div>
      <div className="field-row">
        <label className="field-label">Sync Rotation</label>
        <input type="checkbox" checked={net.syncRotation} onChange={(e) => updateComponent(entityId, 'Network', { syncRotation: e.target.checked })} />
      </div>
      <div className="field-row">
        <label className="field-label">Send Rate (Hz)</label>
        <input type="number" className="field-input" value={net.sendRate} onChange={(e) => updateComponent(entityId, 'Network', { sendRate: parseInt(e.target.value) || 10 })} />
      </div>
    </div>
  );
}

function ScriptInspector({ entityId }: { entityId: string }) {
  const { selectedEntity, updateComponent } = useEditorStore();
  const entity = selectedEntity();
  if (!entity) return null;
  const s = entity.components.Script as ScriptComponent;

  return (
    <div className="component-block">
      <div className="component-header">
        <span className="component-icon">📜</span>
        <span className="component-title">Script</span>
      </div>
      <div className="field-row">
        <label className="field-label">Name</label>
        <input
          type="text"
          className="field-input"
          value={s.scriptName}
          onChange={(e) => updateComponent(entityId, 'Script', { scriptName: e.target.value })}
        />
      </div>
      <div className="field-row" style={{ display: 'block', marginTop: '8px' }}>
        <label className="field-label" style={{ marginBottom: '4px', display: 'block' }}>Code</label>
        <textarea
          className="field-input"
          style={{ width: '100%', height: '150px', fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
          value={s.code}
          onChange={(e) => updateComponent(entityId, 'Script', { code: e.target.value })}
        />
      </div>

      <div className="field-row" style={{ display: 'block', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label className="field-label" style={{ fontWeight: 'bold' }}>Script Variables</label>
          <button 
            className="panel-btn" 
            style={{ padding: '2px 6px', fontSize: '10px' }}
            onClick={() => {
              const key = prompt('Variable Name (e.g., speed):');
              if (key) {
                const props = { ...(s.properties || {}) };
                if (props[key] === undefined) {
                  props[key] = 0; // Default number
                  updateComponent(entityId, 'Script', { properties: props });
                }
              }
            }}
          >
            ➕ Add
          </button>
        </div>
        
        {s.properties && Object.keys(s.properties).map(key => {
          const val = s.properties![key];
          const type = typeof val;
          return (
            <div key={key} className="field-row" style={{ marginBottom: '4px' }}>
              <label className="field-label" style={{ width: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{key}</label>
              {type === 'boolean' ? (
                <input 
                  type="checkbox" 
                  checked={val as boolean} 
                  onChange={e => updateComponent(entityId, 'Script', { properties: { ...s.properties, [key]: e.target.checked } })}
                />
              ) : type === 'number' ? (
                <input 
                  type="number" 
                  className="field-input"
                  value={val as number} 
                  onChange={e => updateComponent(entityId, 'Script', { properties: { ...s.properties, [key]: parseFloat(e.target.value) || 0 } })}
                />
              ) : (
                <input 
                  type="text" 
                  className="field-input"
                  value={val as string} 
                  onChange={e => updateComponent(entityId, 'Script', { properties: { ...s.properties, [key]: e.target.value } })}
                />
              )}
              <button 
                style={{ background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', marginLeft: '4px' }}
                onClick={() => {
                  const props = { ...s.properties };
                  delete props[key];
                  updateComponent(entityId, 'Script', { properties: props });
                }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function InspectorPanel() {
  const { selectedEntity, selectedEntityId, activeScene, updateSceneSettings, createPrefab } = useEditorStore();
  const entity = selectedEntity();
  const scene = activeScene();

  if (!selectedEntityId || !entity) {
    return (
      <div className="panel inspector-panel">
        <div className="panel-header">
          <span className="panel-title">Inspector</span>
        </div>
        <div className="inspector-scene-settings">
          <div className="scene-settings-title">⚙ Scene Settings</div>
          <div className="field-row">
            <label className="field-label">BG Color</label>
            <input type="color" className="field-color" value={scene.backgroundColor}
              onChange={(e) => updateSceneSettings({ backgroundColor: e.target.value })} />
          </div>
          <div className="field-row">
            <label className="field-label">Ambient Color</label>
            <input type="color" className="field-color" value={scene.ambientColor}
              onChange={(e) => updateSceneSettings({ ambientColor: e.target.value })} />
          </div>
          <div className="field-row">
            <label className="field-label">Ambient Intensity</label>
            <input type="range" min={0} max={5} step={0.1} className="field-range" value={scene.ambientIntensity}
              onChange={(e) => updateSceneSettings({ ambientIntensity: parseFloat(e.target.value) })} />
            <span className="range-value">{scene.ambientIntensity.toFixed(1)}</span>
          </div>
          <div className="field-row">
            <label className="field-label">Fog</label>
            <input type="checkbox" checked={scene.fogEnabled}
              onChange={(e) => updateSceneSettings({ fogEnabled: e.target.checked })} />
          </div>
          {scene.fogEnabled && (
            <>
              <div className="field-row">
                <label className="field-label">Fog Color</label>
                <input type="color" className="field-color" value={scene.fogColor}
                  onChange={(e) => updateSceneSettings({ fogColor: e.target.value })} />
              </div>
              <div className="field-row">
                <label className="field-label">Fog Near</label>
                <input type="number" className="field-input" value={scene.fogNear} step={1}
                  onChange={(e) => updateSceneSettings({ fogNear: parseFloat(e.target.value) })} />
              </div>
              <div className="field-row">
                <label className="field-label">Fog Far</label>
                <input type="number" className="field-input" value={scene.fogFar} step={1}
                  onChange={(e) => updateSceneSettings({ fogFar: parseFloat(e.target.value) })} />
              </div>
            </>
          )}
          <p className="inspector-hint">Selecione uma entidade para inspecioná-la.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel inspector-panel">
      <div className="panel-header">
        <span className="panel-title">Inspector</span>
      </div>

      {/* Entity header */}
      <div className="entity-header-block">
        <div className="field-row">
          <label className="field-label">Name</label>
          <input
            className="field-input"
            value={entity.name}
            onChange={(e) => useEditorStore.getState().renameEntity(selectedEntityId, e.target.value)}
          />
        </div>
        <div className="field-row">
          <label className="field-label">Active</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={entity.active}
              onChange={() => useEditorStore.getState().toggleEntityActive(selectedEntityId)}
            />
            <button 
              className="panel-btn small" 
              onClick={() => createPrefab(selectedEntityId)}
              title="Salvar como Prefab"
              style={{ padding: '2px 8px', fontSize: '10px' }}
            >
              🎯 To Prefab
            </button>
          </div>
        </div>
      </div>

      {/* Components */}
      <div className="inspector-components">
        {entity.components.Transform && (
          <TransformInspector entityId={selectedEntityId} />
        )}
        {entity.components.MeshRenderer && (
          <MeshRendererInspector entityId={selectedEntityId} />
        )}
        {entity.components.GLTFModel && (
          <GLTFModelInspector entityId={selectedEntityId} />
        )}
        {entity.components.Light && (
          <LightInspector entityId={selectedEntityId} />
        )}
        {entity.components.RigidBody && (
          <RigidBodyInspector entityId={selectedEntityId} />
        )}
        {entity.components.Audio && (
          <AudioInspector entityId={selectedEntityId} />
        )}
        {entity.components.ParticleSystem && (
          <ParticleSystemInspector entityId={selectedEntityId} />
        )}
        {entity.components.Animator && (
          <AnimatorInspector entityId={selectedEntityId} />
        )}
        {entity.components.Network && (
          <NetworkInspector entityId={selectedEntityId} />
        )}
        {entity.components.Script && (
          <ScriptInspector entityId={selectedEntityId} />
        )}

        <div className="add-component-wrapper" style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {!entity.components.RigidBody && (
            <button 
              className="panel-btn" 
              onClick={() => useEditorStore.getState().addComponent(selectedEntityId, { type: 'RigidBody', mass: 1, isStatic: false, useGravity: true, collider: 'cuboid' })}
            >
              ➕ Add RigidBody
            </button>
          )}
          {!entity.components.Script && (
            <button 
              className="panel-btn" 
              onClick={() => useEditorStore.getState().addComponent(selectedEntityId, { type: 'Script', scriptName: 'NewScript', code: '' })}
            >
              ➕ Add Script
            </button>
          )}
          {!entity.components.Audio && (
            <button 
              className="panel-btn" 
              onClick={() => useEditorStore.getState().addComponent(selectedEntityId, { type: 'Audio', src: '', loop: true, playOnStart: true, volume: 1 })}
            >
              ➕ Add Audio
            </button>
          )}
          {!entity.components.ParticleSystem && (
            <button 
              className="panel-btn" 
              onClick={() => useEditorStore.getState().addComponent(selectedEntityId, { type: 'ParticleSystem', count: 100, color: '#ffffff', size: 10, speed: 1 })}
            >
              ➕ Add Particles
            </button>
          )}
          {!entity.components.Animator && (
            <button 
              className="panel-btn" 
              onClick={() => useEditorStore.getState().addComponent(selectedEntityId, { type: 'Animator', currentAnimation: '', loop: true, timeScale: 1 })}
            >
              ➕ Add Animator
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

