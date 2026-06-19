import { useState, useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';
import type { TransformComponent, MeshRendererComponent, LightComponent, GLTFModelComponent, RigidBodyComponent, AudioComponent, ParticleSystemComponent, ScriptComponent, CameraComponent } from '../../engine/ecs/types';
import { 
  Move, 
  Box, 
  Sun, 
  Layers, 
  Activity, 
  Volume2, 
  Sparkles, 
  Film, 
  Wifi, 
  Video, 
  Code, 
  Plus, 
  Package,
  Settings
} from 'lucide-react';

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
        <span className="component-icon"><Move size={14} /></span>
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
        <span className="component-icon"><Box size={14} /></span>
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
          <option value="invisible">Invisible</option>
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
        <span className="component-icon"><Sun size={14} /></span>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={l.intensity}
            onChange={(e) => updateComponent(entityId, 'Light', { intensity: parseFloat(e.target.value) })}
            className="field-range"
            style={{ flex: 1 }}
          />
          <input
            type="number"
            min={0}
            step={0.1}
            value={l.intensity}
            onChange={(e) => updateComponent(entityId, 'Light', { intensity: parseFloat(e.target.value) || 0 })}
            className="field-input"
            style={{ width: '60px', padding: '2px 4px', fontSize: '12px' }}
          />
        </div>
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
        <span className="component-icon"><Layers size={14} /></span>
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
        <span className="component-icon"><Activity size={14} /></span>
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
          <option value="cuboid">Cuboid (Box)</option>
          <option value="ball">Ball (Sphere)</option>
          <option value="hull">Convex Hull</option>
          <option value="trimesh">Mesh Collider (Trimesh)</option>
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
        <span className="component-icon"><Volume2 size={14} /></span>
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
        <span className="component-icon"><Sparkles size={14} /></span>
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

  const animations = anim.animationsList || [];
  const states = anim.states || {};
  const currentState = anim.currentState || '';

  // Estado local para adicionar novo estado
  const [newStateName, setNewStateName] = useState('');
  const [newStateClip, setNewStateClip] = useState(animations[0] || anim.currentAnimation || '');
  const [newStateSpeed, setNewStateSpeed] = useState(1);
  const [newStateLoop, setNewStateLoop] = useState(true);

  // Sincroniza o clipe padrão se a lista de animações carregar
  useEffect(() => {
    if (animations.length > 0 && !newStateClip) {
      setNewStateClip(animations[0]);
    }
  }, [animations, newStateClip]);

  const handleAddState = () => {
    if (!newStateName.trim()) return;
    const updatedStates = {
      ...states,
      [newStateName.trim()]: {
        clipName: newStateClip || anim.currentAnimation || '',
        loop: newStateLoop,
        timeScale: newStateSpeed
      }
    };
    updateComponent(entityId, 'Animator', { states: updatedStates });
    setNewStateName('');
  };

  const handleRemoveState = (name: string) => {
    const updatedStates = { ...states };
    delete updatedStates[name];
    
    const nextActive = currentState === name ? '' : currentState;
    updateComponent(entityId, 'Animator', { 
      states: updatedStates,
      currentState: nextActive
    });
  };

  return (
    <div className="component-block animation-inspector">
      <div className="component-header">
        <span className="component-icon"><Film size={14} /></span>
        <span className="component-title">Animator</span>
      </div>

      <div className="field-row">
        <label className="field-label">Default Clip</label>
        {animations.length > 0 ? (
          <select
            className="field-input select-dark"
            value={anim.currentAnimation}
            onChange={(e) => updateComponent(entityId, 'Animator', { currentAnimation: e.target.value })}
          >
            <option value="">(Nenhuma)</option>
            {animations.map((name: string) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            className="field-input"
            placeholder="Nome do clip..."
            value={anim.currentAnimation}
            onChange={(e) => updateComponent(entityId, 'Animator', { currentAnimation: e.target.value })}
          />
        )}
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

      {/* STATE MACHINE SECTION */}
      <div className="animator-sm-section">
        <div className="sm-header">
          <span>State Machine</span>
        </div>

        {/* Escolha do estado ativo */}
        <div className="field-row">
          <label className="field-label">Active State</label>
          <select
            className="field-input select-dark"
            value={currentState}
            onChange={(e) => updateComponent(entityId, 'Animator', { currentState: e.target.value })}
          >
            <option value="">(Default Clip)</option>
            {Object.keys(states).map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        {/* Listagem de estados cadastrados */}
        {Object.keys(states).length > 0 && (
          <div className="sm-states-list">
            {Object.entries(states).map(([name, data]: [string, any]) => (
              <div key={name} className="sm-state-item">
                <div className="state-info">
                  <span className="state-name">{name}</span>
                  <span className="state-clip">({data.clipName})</span>
                </div>
                <button className="remove-state-btn" onClick={() => handleRemoveState(name)} title="Remover estado">
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Formulário para adicionar estado */}
        <div className="sm-add-form">
          <span className="form-title">Novo Estado</span>
          <div className="form-row">
            <input
              type="text"
              className="form-input text-field"
              placeholder="Ex: Andar"
              value={newStateName}
              onChange={(e) => setNewStateName(e.target.value)}
            />
          </div>
          <div className="form-row split">
            <div className="form-sub-row">
              <label>Clip</label>
              {animations.length > 0 ? (
                <select
                  className="form-input select-dark"
                  value={newStateClip}
                  onChange={(e) => setNewStateClip(e.target.value)}
                >
                  {animations.map((name: string) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="form-input"
                  placeholder="Nome do clip..."
                  value={newStateClip}
                  onChange={(e) => setNewStateClip(e.target.value)}
                />
              )}
            </div>
            <div className="form-sub-row speed">
              <label>Speed</label>
              <input
                type="number"
                className="form-input"
                step={0.1}
                value={newStateSpeed}
                onChange={(e) => setNewStateSpeed(parseFloat(e.target.value) || 1)}
              />
            </div>
            <div className="form-sub-row loop-cb">
              <label>Loop</label>
              <input
                type="checkbox"
                checked={newStateLoop}
                onChange={(e) => setNewStateLoop(e.target.checked)}
              />
            </div>
          </div>
          <button className="add-state-action-btn" onClick={handleAddState}>
            + Adicionar Estado
          </button>
        </div>
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
        <span className="component-icon"><Wifi size={14} /></span>
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

function CameraInspector({ entityId }: { entityId: string }) {
  const { selectedEntity, updateComponent } = useEditorStore();
  const entity = selectedEntity();
  if (!entity) return null;
  const c = entity.components.Camera as CameraComponent;

  return (
    <div className="component-block">
      <div className="component-header">
        <span className="component-icon"><Video size={14} /></span>
        <span className="component-title">Camera</span>
      </div>
      <div className="field-row">
        <label className="field-label">Is Main Camera</label>
        <input
          type="checkbox"
          checked={c.isMain}
          onChange={(e) => updateComponent(entityId, 'Camera', { isMain: e.target.checked })}
        />
      </div>
      <div className="field-row">
        <label className="field-label">FOV</label>
        <input
          type="number"
          className="field-input"
          value={c.fov}
          step={1}
          onChange={(e) => updateComponent(entityId, 'Camera', { fov: parseFloat(e.target.value) || 60 })}
        />
      </div>
      <div className="field-row">
        <label className="field-label">Near</label>
        <input
          type="number"
          className="field-input"
          value={c.near}
          step={0.1}
          onChange={(e) => updateComponent(entityId, 'Camera', { near: parseFloat(e.target.value) || 0.1 })}
        />
      </div>
      <div className="field-row">
        <label className="field-label">Far</label>
        <input
          type="number"
          className="field-input"
          value={c.far}
          step={10}
          onChange={(e) => updateComponent(entityId, 'Camera', { far: parseFloat(e.target.value) || 1000 })}
        />
      </div>
      <Vec3Field
        label="Offset"
        value={c.offset || [0, 0, 0]}
        onChange={(v) => updateComponent(entityId, 'Camera', { offset: v })}
      />
      <Vec3Field
        label="Rotation"
        value={c.rotation || [0, 0, 0]}
        onChange={(v) => updateComponent(entityId, 'Camera', { rotation: v })}
      />
    </div>
  );
}

function ScriptInspector({ entityId }: { entityId: string }) {
  const { selectedEntity, updateComponent } = useEditorStore();
  const entity = selectedEntity();
  if (!entity) return null;
  const s = entity.components.Script as ScriptComponent;

  // Extract variables (let name = value)
  const vars: Record<string, { type: 'number' | 'string' | 'boolean', value: any }> = {};
  const regex = /^(?:export\s+)?let\s+([a-zA-Z0-9_]+)\s*=\s*(.+?);?$/gm;
  let match;
  while ((match = regex.exec(s.code)) !== null) {
    const name = match[1];
    const rawVal = match[2].trim();
    if (rawVal === 'true' || rawVal === 'false') {
      vars[name] = { type: 'boolean', value: rawVal === 'true' };
    } else if (!isNaN(Number(rawVal))) {
      vars[name] = { type: 'number', value: Number(rawVal) };
    } else if (rawVal.startsWith('"') || rawVal.startsWith("'")) {
      vars[name] = { type: 'string', value: rawVal.replace(/^["']|["']$/g, '') };
    }
  }

  const updateVariable = (key: string, newVal: any, type: string) => {
    let valStr = newVal;
    if (type === 'string') valStr = `"${newVal}"`;
    const replaceRegex = new RegExp(`^((?:export\\s+)?let\\s+${key}\\s*=\\s*).+?(;?)$`, 'm');
    const newCode = s.code.replace(replaceRegex, `$1${valStr}$2`);
    updateComponent(entityId, 'Script', { code: newCode });
  };

  return (
    <div className="component-block">
      <div className="component-header">
        <span className="component-icon"><Code size={14} /></span>
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

      {Object.keys(vars).length > 0 && (
        <div className="field-row" style={{ display: 'block', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
          <label className="field-label" style={{ fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>Public Variables</label>
          
          {Object.keys(vars).map(key => {
            const { type, value } = vars[key];
            return (
              <div key={key} className="field-row" style={{ marginBottom: '4px' }}>
                <label className="field-label" style={{ width: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{key}</label>
                {type === 'boolean' ? (
                  <input 
                    type="checkbox" 
                    checked={value} 
                    onChange={e => updateVariable(key, e.target.checked, type)}
                  />
                ) : type === 'number' ? (
                  <input 
                    type="number" 
                    className="field-input"
                    value={value} 
                    step={0.1}
                    onChange={e => updateVariable(key, parseFloat(e.target.value) || 0, type)}
                  />
                ) : (
                  <input 
                    type="text" 
                    className="field-input"
                    value={value} 
                    onChange={e => updateVariable(key, e.target.value, type)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
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
          <div className="scene-settings-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Settings size={14} /> Scene Settings
          </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <input type="range" min={0} max={20} step={0.1} className="field-range" value={scene.ambientIntensity}
                onChange={(e) => updateSceneSettings({ ambientIntensity: parseFloat(e.target.value) })} style={{ flex: 1 }} />
              <input type="number" min={0} step={0.1} className="field-input" value={scene.ambientIntensity}
                onChange={(e) => updateSceneSettings({ ambientIntensity: parseFloat(e.target.value) || 0 })} style={{ width: '60px', padding: '2px 4px', fontSize: '12px' }} />
            </div>
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
              style={{ padding: '2px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Package size={11} /> To Prefab
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
        {entity.components.Camera && (
          <CameraInspector entityId={selectedEntityId} />
        )}

        <div className="add-component-wrapper" style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {!entity.components.RigidBody && (
            <button 
              className="panel-btn" 
              onClick={() => useEditorStore.getState().addComponent(selectedEntityId, { type: 'RigidBody', mass: 1, isStatic: false, useGravity: true, collider: 'cuboid' })}
            >
              <Plus size={12} /> Add RigidBody
            </button>
          )}
          {!entity.components.Script && (
            <button 
              className="panel-btn" 
              onClick={() => useEditorStore.getState().addComponent(selectedEntityId, { type: 'Script', scriptName: 'NewScript', code: '' })}
            >
              <Plus size={12} /> Add Script
            </button>
          )}
          {!entity.components.Audio && (
            <button 
              className="panel-btn" 
              onClick={() => useEditorStore.getState().addComponent(selectedEntityId, { type: 'Audio', src: '', loop: true, playOnStart: true, volume: 1 })}
            >
              <Plus size={12} /> Add Audio
            </button>
          )}
          {!entity.components.ParticleSystem && (
            <button 
              className="panel-btn" 
              onClick={() => useEditorStore.getState().addComponent(selectedEntityId, { type: 'ParticleSystem', count: 100, color: '#ffffff', size: 10, speed: 1 })}
            >
              <Plus size={12} /> Add Particles
            </button>
          )}
          {!entity.components.Animator && (
            <button 
              className="panel-btn" 
              onClick={() => useEditorStore.getState().addComponent(selectedEntityId, { type: 'Animator', currentAnimation: '', loop: true, timeScale: 1 })}
            >
              <Plus size={12} /> Add Animator
            </button>
          )}
          {!entity.components.Camera && (
            <button 
              className="panel-btn" 
              onClick={() => useEditorStore.getState().addComponent(selectedEntityId, { type: 'Camera', fov: 75, near: 0.1, far: 1000, isMain: true, offset: [0, 0.4, 0], rotation: [0, 0, 0] })}
            >
              <Plus size={12} /> Add Camera
            </button>
          )}
          {!entity.components.Network && (
            <button 
              className="panel-btn" 
              onClick={() => useEditorStore.getState().addComponent(selectedEntityId, { type: 'Network', isLocal: true, syncPosition: true, syncRotation: true, syncAnimation: false, sendRate: 20 })}
            >
              <Plus size={12} /> Add Network
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
