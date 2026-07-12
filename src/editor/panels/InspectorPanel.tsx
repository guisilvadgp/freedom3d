import { useState, useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';
import type { TransformComponent, MeshRendererComponent, LightComponent, GLTFModelComponent, RigidBodyComponent, AudioComponent, ParticleSystemComponent, ScriptComponent, CameraComponent, TextureComponent, VideoMeshComponent } from '../../engine/ecs/types';
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
  Settings,
  Trash2,
  Edit
} from 'lucide-react';

const parseFloat = (value: any): number => {
  if (typeof value === 'string') {
    return window.parseFloat(value.replace(',', '.'));
  }
  return window.parseFloat(value);
};

function Vec3Field({
  label, value, onChange,
}: {
  label: string;
  value: [number, number, number] | undefined;
  onChange: (v: [number, number, number]) => void;
}) {
  const safeValue = Array.isArray(value) ? value : [0, 0, 0];
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
              value={safeValue[i] ?? 0}
              step={0.1}
              onChange={(e) => {
                const copy: [number, number, number] = [safeValue[0], safeValue[1], safeValue[2]];
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
        <button className="component-remove-btn" onClick={() => useEditorStore.getState().removeComponent(entityId, 'MeshRenderer')} title="Remover Componente">
          <Trash2 size={12} />
        </button>
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
          <option value="capsule">Capsule</option>
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
          <option value="emissive">Emissive (Neon Glow)</option>
        </select>
      </div>
      {m.material === 'emissive' && (
        <div className="field-row">
          <label className="field-label" style={{ fontSize: '11px' }}>Emissive Intensity</label>
          <div className="field-slider-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
            <input
              type="range"
              min="0.1"
              max="20"
              step="0.1"
              className="field-slider"
              style={{ flex: 1 }}
              value={m.emissiveIntensity ?? 2.0}
              onChange={(e) => updateComponent(entityId, 'MeshRenderer', { emissiveIntensity: parseFloat(e.target.value) })}
            />
            <span className="field-slider-value" style={{ minWidth: '24px', fontSize: '10px' }}>{(m.emissiveIntensity ?? 2.0).toFixed(1)}</span>
          </div>
        </div>
      )}
      {(m.material === 'standard' || m.material === 'emissive') && (
        <>
          <div className="field-row">
            <label className="field-label">Roughness</label>
            <div className="field-slider-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                className="field-slider"
                style={{ flex: 1 }}
                value={m.roughness ?? (m.material === 'emissive' ? 0.2 : 0.6)}
                onChange={(e) => updateComponent(entityId, 'MeshRenderer', { roughness: parseFloat(e.target.value) })}
              />
              <span className="field-slider-value" style={{ minWidth: '28px', fontSize: '10px', textAlign: 'right' }}>
                {(m.roughness ?? (m.material === 'emissive' ? 0.2 : 0.6)).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="field-row">
            <label className="field-label">Metalness</label>
            <div className="field-slider-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                className="field-slider"
                style={{ flex: 1 }}
                value={m.metalness ?? 0.1}
                onChange={(e) => updateComponent(entityId, 'MeshRenderer', { metalness: parseFloat(e.target.value) })}
              />
              <span className="field-slider-value" style={{ minWidth: '28px', fontSize: '10px', textAlign: 'right' }}>
                {(m.metalness ?? 0.1).toFixed(2)}
              </span>
            </div>
          </div>
        </>
      )}
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

function HUDPlaneInspector({ entityId }: { entityId: string }) {
  const { selectedEntity, updateComponent } = useEditorStore();
  const entity = selectedEntity();
  if (!entity) return null;
  const h = entity.components.HUDPlane;
  if (!h) return null;

  return (
    <div className="component-block">
      <div className="component-header">
        <span className="component-icon"><Settings size={14} /></span>
        <span className="component-title">HUD Visor</span>
        <button className="component-remove-btn" onClick={() => useEditorStore.getState().removeComponent(entityId, 'HUDPlane')} title="Remover Componente">
          <Trash2 size={12} />
        </button>
      </div>
      <div className="field-row">
        <label className="field-label">Opacidade</label>
        <input
          type="number"
          className="field-input"
          value={h.opacity ?? 0.8}
          step={0.1}
          min={0}
          max={1}
          onChange={(e) => updateComponent(entityId, 'HUDPlane', { opacity: parseFloat(e.target.value) || 0 })}
        />
      </div>
      <div className="field-row">
        <label className="field-label">Cor no Editor</label>
        <input
          type="color"
          className="field-color"
          value={h.color || '#00ffff'}
          onChange={(e) => updateComponent(entityId, 'HUDPlane', { color: e.target.value })}
        />
      </div>
      <div className="field-row">
        <label className="field-label">Largura (3D)</label>
        <input
          type="number"
          className="field-input"
          value={h.width ?? 2.0}
          step={0.1}
          onChange={(e) => updateComponent(entityId, 'HUDPlane', { width: parseFloat(e.target.value) || 2.0 })}
        />
      </div>
      <div className="field-row">
        <label className="field-label">Altura (3D)</label>
        <input
          type="number"
          className="field-input"
          value={h.height ?? 1.0}
          step={0.1}
          onChange={(e) => updateComponent(entityId, 'HUDPlane', { height: parseFloat(e.target.value) || 1.0 })}
        />
      </div>
      <div className="field-row">
        <label className="field-label">Distância Olho</label>
        <input
          type="number"
          className="field-input"
          value={h.distance ?? 0.5}
          step={0.05}
          min={0.1}
          onChange={(e) => updateComponent(entityId, 'HUDPlane', { distance: parseFloat(e.target.value) || 0.5 })}
        />
      </div>
    </div>
  );
}

function VideoMeshInspector({ entityId }: { entityId: string }) {
  const { selectedEntity, updateComponent } = useEditorStore();
  const entity = selectedEntity();
  if (!entity) return null;
  const video = entity.components.VideoMesh as VideoMeshComponent;
  if (!video) return null;

  const currentProjectName = useEditorStore(s => s.currentProjectName);
  const sceneName = currentProjectName || 'default';

  const [videoFiles, setVideoFiles] = useState<string[]>([]);

  // Carrega lista de vídeos do projeto ativo
  useEffect(() => {
    let active = true;
    const fetchVideo = async () => {
      try {
        const res = await fetch(`/api/explorer-video/list?project=${encodeURIComponent(sceneName)}`);
        if (res.ok && active) {
          const files = await res.json();
          setVideoFiles(files);
        }
      } catch (err) {
        console.error('Error fetching video files:', err);
      }
    };
    fetchVideo();
    return () => { active = false; };
  }, [sceneName]);

  return (
    <div className="component-block">
      <div className="component-header">
        <span className="component-icon"><Film size={14} /></span>
        <span className="component-title">Video Mesh</span>
        <button className="component-remove-btn" onClick={() => useEditorStore.getState().removeComponent(entityId, 'VideoMesh')} title="Remover Componente">
          <Trash2 size={12} />
        </button>
      </div>
      
      <div className="field-row">
        <label className="field-label">Escolher Vídeo</label>
        <select
          className="field-input select-dark"
          value={video.fileName || ''}
          onChange={(e) => {
            const relPath = e.target.value;
            if (relPath) {
              const videoUrl = `/api/explorer/load-file?project=${encodeURIComponent(sceneName)}&subpath=${encodeURIComponent(relPath)}`;
              updateComponent(entityId, 'VideoMesh', { videoUrl, fileName: relPath });
            } else {
              updateComponent(entityId, 'VideoMesh', { videoUrl: '', fileName: '' });
            }
          }}
          style={{ width: '100%', padding: '4px', fontSize: '11px', background: '#111122', border: '1px solid var(--border)', color: '#fff', borderRadius: '4px' }}
        >
          <option value="">(Nenhum / URL manual)</option>
          {videoFiles.map((file) => (
            <option key={file} value={file}>
              {file}
            </option>
          ))}
        </select>
      </div>

      <div className="field-row">
        <label className="field-label">URL do Vídeo</label>
        <input
          type="text"
          className="field-input"
          value={video.videoUrl || ''}
          placeholder="e.g. video.mp4 ou URL externa"
          onChange={(e) => {
            const videoUrl = e.target.value;
            const isExternal = videoUrl.startsWith('http') || videoUrl.startsWith('/');
            const fileName = isExternal ? '' : videoUrl.split('/').pop() || videoUrl;
            updateComponent(entityId, 'VideoMesh', { videoUrl, fileName });
          }}
        />
      </div>

      <div className="field-row">
        <label className="field-label">Auto Play</label>
        <input
          type="checkbox"
          checked={video.autoPlay}
          onChange={(e) => updateComponent(entityId, 'VideoMesh', { autoPlay: e.target.checked })}
        />
      </div>

      <div className="field-row">
        <label className="field-label">Loop</label>
        <input
          type="checkbox"
          checked={video.loop}
          onChange={(e) => updateComponent(entityId, 'VideoMesh', { loop: e.target.checked })}
        />
      </div>

      <div className="field-row">
        <label className="field-label">Volume</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={video.volume ?? 1}
            onChange={(e) => updateComponent(entityId, 'VideoMesh', { volume: parseFloat(e.target.value) })}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: '11px', width: '28px', textAlign: 'right' }}>
            {Math.round((video.volume ?? 1) * 100)}%
          </span>
        </div>
      </div>

      <div className="field-row">
        <label className="field-label">Mudo (Muted)</label>
        <input
          type="checkbox"
          checked={video.muted}
          onChange={(e) => updateComponent(entityId, 'VideoMesh', { muted: e.target.checked })}
        />
      </div>

      <div className="field-row">
        <label className="field-label">Reproduzir (Play)</label>
        <input
          type="checkbox"
          checked={video.play}
          onChange={(e) => updateComponent(entityId, 'VideoMesh', { play: e.target.checked })}
        />
      </div>

      {/* Mapeamento e Estereoscopia 3D */}
      <div style={{ padding: '8px 14px 4px', borderTop: '1px solid var(--border)', marginTop: 4 }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          Projeção e 3D / VR
        </span>
      </div>

      <div className="field-row">
        <label className="field-label">Projeção (Shape)</label>
        <select
          className="field-select"
          value={video.projection ?? 'plane'}
          onChange={(e) => updateComponent(entityId, 'VideoMesh', { projection: e.target.value as any })}
        >
          <option value="plane">Plano (Curvável)</option>
          <option value="sphere360">Esfera 360° (Imersivo)</option>
          <option value="sphere180">Domo 180° (Fronte)</option>
        </select>
      </div>

      <div className="field-row">
        <label className="field-label">Modo Estéreo</label>
        <select
          className="field-select"
          value={video.stereoMode ?? 'none'}
          onChange={(e) => updateComponent(entityId, 'VideoMesh', { stereoMode: e.target.value as any })}
        >
          <option value="none">2D Convencional (Mono)</option>
          <option value="sbs">3D Lado-a-Lado (SBS)</option>
          <option value="tb">3D Cima-Abaixo (Top-Bottom)</option>
        </select>
      </div>

      {/* Dimensões do Plano */}
      <div style={{ padding: '8px 14px 4px', borderTop: '1px solid var(--border)', marginTop: 4 }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          Plano e Subdivisões
        </span>
      </div>

      <div className="field-row">
        <label className="field-label">Largura (Width)</label>
        <input
          type="number"
          className="field-input"
          value={video.width ?? 2.0}
          step={0.1}
          onChange={(e) => updateComponent(entityId, 'VideoMesh', { width: parseFloat(e.target.value) || 2.0 })}
        />
      </div>

      <div className="field-row">
        <label className="field-label">Altura (Height)</label>
        <input
          type="number"
          className="field-input"
          value={video.height ?? 1.125}
          step={0.1}
          onChange={(e) => updateComponent(entityId, 'VideoMesh', { height: parseFloat(e.target.value) || 1.125 })}
        />
      </div>

      <div className="field-row">
        <label className="field-label">Segs. X (H)</label>
        <input
          type="number"
          className="field-input"
          value={video.segmentsX ?? 32}
          step={1}
          min={1}
          max={256}
          onChange={(e) => updateComponent(entityId, 'VideoMesh', { segmentsX: parseInt(e.target.value) || 32 })}
        />
      </div>

      <div className="field-row">
        <label className="field-label">Segs. Y (V)</label>
        <input
          type="number"
          className="field-input"
          value={video.segmentsY ?? 32}
          step={1}
          min={1}
          max={256}
          onChange={(e) => updateComponent(entityId, 'VideoMesh', { segmentsY: parseInt(e.target.value) || 32 })}
        />
      </div>

      {/* Parâmetros de Curvatura */}
      <div style={{ padding: '8px 14px 4px', borderTop: '1px solid var(--border)', marginTop: 4 }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          Deformação de Curvatura
        </span>
      </div>

      <div className="field-row">
        <label className="field-label">Intensidade (Curve)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <input
            type="range"
            min="-5"
            max="5"
            step="0.05"
            value={video.curveAmount ?? 0}
            onChange={(e) => updateComponent(entityId, 'VideoMesh', { curveAmount: parseFloat(e.target.value) })}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: '11px', width: '32px', textAlign: 'right' }}>
            {(video.curveAmount ?? 0).toFixed(2)}
          </span>
        </div>
      </div>

      <div className="field-row">
        <label className="field-label">Direção da Curva</label>
        <select
          className="field-select"
          value={video.curveDirection ?? 'horizontal'}
          onChange={(e) => updateComponent(entityId, 'VideoMesh', { curveDirection: e.target.value as any })}
        >
          <option value="horizontal">Horizontal (Esquerda-Direita)</option>
          <option value="vertical">Vertical (Cima-Baixo)</option>
        </select>
      </div>

      {/* Iluminação Dinâmica no Ambiente */}
      <div style={{ padding: '8px 14px 4px', borderTop: '1px solid var(--border)', marginTop: 8 }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          Luz Emissiva Dinâmica
        </span>
      </div>

      <div className="field-row">
        <label className="field-label">Ativar Luz Física</label>
        <input
          type="checkbox"
          checked={video.lightInfluence ?? false}
          onChange={(e) => updateComponent(entityId, 'VideoMesh', { lightInfluence: e.target.checked })}
        />
      </div>

      {video.lightInfluence && (
        <>
          <div className="field-row">
            <label className="field-label">Intensidade</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={video.lightIntensity ?? 2.0}
                onChange={(e) => updateComponent(entityId, 'VideoMesh', { lightIntensity: parseFloat(e.target.value) })}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: '11px', width: '28px', textAlign: 'right' }}>
                {(video.lightIntensity ?? 2.0).toFixed(1)}
              </span>
            </div>
          </div>

          <div className="field-row">
            <label className="field-label">Alcance (Dist.)</label>
            <input
              type="number"
              className="field-input"
              value={video.lightDistance ?? 15.0}
              step={0.5}
              onChange={(e) => updateComponent(entityId, 'VideoMesh', { lightDistance: parseFloat(e.target.value) || 15.0 })}
            />
          </div>
        </>
      )}
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
        <button className="component-remove-btn" onClick={() => useEditorStore.getState().removeComponent(entityId, 'Light')} title="Remover Componente">
          <Trash2 size={12} />
        </button>
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

  const currentProjectName = useEditorStore(s => s.currentProjectName);
  const sceneName = currentProjectName || 'default';

  const [imageFiles, setImageFiles] = useState<string[]>([]);

  // Carrega lista de texturas/imagens do projeto
  useEffect(() => {
    let active = true;
    const fetchImages = async () => {
      try {
        const res = await fetch(`/api/explorer-image/list?project=${encodeURIComponent(sceneName)}`);
        if (res.ok && active) {
          const files = await res.json();
          setImageFiles(files);
        }
      } catch (err) {
        console.error('Error fetching image files in GLTFModelInspector:', err);
      }
    };
    fetchImages();
    return () => { active = false; };
  }, [sceneName]);

  return (
    <div className="component-block">
      <div className="component-header">
        <span className="component-icon"><Layers size={14} /></span>
        <span className="component-title">GLTF Model</span>
        <button className="component-remove-btn" onClick={() => useEditorStore.getState().removeComponent(entityId, 'GLTFModel')} title="Remover Componente">
          <Trash2 size={12} />
        </button>
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

      <div style={{ margin: '8px 0', borderTop: '1px solid #333', paddingTop: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Material & Texturas</span>
      </div>

      <div className="field-row">
        <label className="field-label">Override Material</label>
        <select
          className="field-input select-dark"
          value={m.overrideMaterial || 'none'}
          onChange={(e) => updateComponent(entityId, 'GLTFModel', { overrideMaterial: e.target.value as any })}
          style={{ width: '100%', padding: '4px', fontSize: '11px', background: '#111122', border: '1px solid var(--border)', color: '#fff', borderRadius: '4px' }}
        >
          <option value="none">Nenhum (Manter original)</option>
          <option value="standard">Standard Material</option>
          <option value="basic">Basic Material</option>
          <option value="phong">Phong Material</option>
          <option value="emissive">Emissive Material</option>
        </select>
      </div>

      <div className="field-row">
        <label className="field-label">Albedo Color</label>
        <input
          type="color"
          className="field-input"
          value={m.color || '#ffffff'}
          onChange={(e) => updateComponent(entityId, 'GLTFModel', { color: e.target.value })}
          style={{ padding: '0px', height: '24px', cursor: 'pointer' }}
        />
      </div>

      {m.overrideMaterial !== 'basic' && (
        <>
          <div className="field-row">
            <label className="field-label">Roughness</label>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '8px' }}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                className="field-input"
                value={m.roughness ?? 0.5}
                onChange={(e) => updateComponent(entityId, 'GLTFModel', { roughness: parseFloat(e.target.value) })}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: '10px', width: '28px', textAlign: 'right' }}>{(m.roughness ?? 0.5).toFixed(2)}</span>
            </div>
          </div>

          <div className="field-row">
            <label className="field-label">Metalness</label>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '8px' }}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                className="field-input"
                value={m.metalness ?? 0.1}
                onChange={(e) => updateComponent(entityId, 'GLTFModel', { metalness: parseFloat(e.target.value) })}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: '10px', width: '28px', textAlign: 'right' }}>{(m.metalness ?? 0.1).toFixed(2)}</span>
            </div>
          </div>
        </>
      )}

      <div className="field-row" style={{ marginTop: '8px' }}>
        <label className="field-label">Albedo Texture</label>
        <select
          className="field-input select-dark"
          value={m.textureUrl || ''}
          onChange={(e) => updateComponent(entityId, 'GLTFModel', { textureUrl: e.target.value })}
          style={{ width: '100%', padding: '4px', fontSize: '11px', background: '#111122', border: '1px solid var(--border)', color: '#fff', borderRadius: '4px' }}
        >
          <option value="">(Nenhuma / Usar original)</option>
          {imageFiles.map((file) => (
            <option key={file} value={file}>
              {file}
            </option>
          ))}
        </select>
      </div>

      <div className="field-row">
        <label className="field-label">Normal Map</label>
        <select
          className="field-input select-dark"
          value={m.normalMapUrl || ''}
          onChange={(e) => updateComponent(entityId, 'GLTFModel', { normalMapUrl: e.target.value })}
          style={{ width: '100%', padding: '4px', fontSize: '11px', background: '#111122', border: '1px solid var(--border)', color: '#fff', borderRadius: '4px' }}
        >
          <option value="">(Nenhum)</option>
          {imageFiles.map((file) => (
            <option key={file} value={file}>
              {file}
            </option>
          ))}
        </select>
      </div>

      {m.normalMapUrl && (
        <div className="field-row">
          <label className="field-label">Normal Scale</label>
          <input
            type="number"
            className="field-input"
            value={m.normalScale ?? 1}
            step={0.1}
            min={0}
            max={5}
            onChange={(e) => updateComponent(entityId, 'GLTFModel', { normalScale: parseFloat(e.target.value) || 1 })}
          />
        </div>
      )}
    </div>
  );
}

function ColliderInspector({ entityId }: { entityId: string }) {
  const { selectedEntity, updateComponent } = useEditorStore();
  const entity = selectedEntity();
  if (!entity) return null;
  const coll = entity.components.Collider as any;

  return (
    <div className="component-block">
      <div className="component-header">
        <span className="component-icon"><Box size={14} /></span>
        <span className="component-title">Collider</span>
        <button className="component-remove-btn" onClick={() => useEditorStore.getState().removeComponent(entityId, 'Collider')} title="Remover Componente">
          <Trash2 size={12} />
        </button>
      </div>
      <div className="field-row">
        <label className="field-label">Shape</label>
        <select
          className="field-input"
          value={coll.shape}
          onChange={(e) => updateComponent(entityId, 'Collider', { shape: e.target.value as any })}
        >
          <option value="cuboid">Cuboid</option>
          <option value="ball">Ball</option>
          <option value="capsule">Capsule</option>
          <option value="cylinder">Cylinder</option>
          <option value="cone">Cone</option>
        </select>
      </div>
      <Vec3Field
        label="Scale"
        value={coll.scale}
        onChange={(v) => updateComponent(entityId, 'Collider', { scale: v })}
      />
      <Vec3Field
        label="Offset"
        value={coll.offset}
        onChange={(v) => updateComponent(entityId, 'Collider', { offset: v })}
      />
      <div className="field-row">
        <label className="field-label">Is Trigger</label>
        <input
          type="checkbox"
          checked={coll.isTrigger}
          onChange={(e) => updateComponent(entityId, 'Collider', { isTrigger: e.target.checked })}
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
        <button className="component-remove-btn" onClick={() => useEditorStore.getState().removeComponent(entityId, 'RigidBody')} title="Remover Componente">
          <Trash2 size={12} />
        </button>
      </div>

      {/* ── Física básica ── */}
      <div className="field-row">
        <label className="field-label">Mass</label>
        <input type="number" className="field-input" value={rb.mass} step={0.1} min={0}
          onChange={(e) => updateComponent(entityId, 'RigidBody', { mass: parseFloat(e.target.value) || 1 })} />
      </div>
      <div className="field-row">
        <label className="field-label">Drag</label>
        <input type="number" className="field-input" value={rb.drag ?? 0} step={0.01} min={0}
          onChange={(e) => updateComponent(entityId, 'RigidBody', { drag: parseFloat(e.target.value) || 0 })} />
      </div>
      <div className="field-row">
        <label className="field-label">Angular Drag</label>
        <input type="number" className="field-input" value={rb.angularDrag ?? 0.05} step={0.01} min={0}
          onChange={(e) => updateComponent(entityId, 'RigidBody', { angularDrag: parseFloat(e.target.value) || 0 })} />
      </div>

      {/* ── Flags ── */}
      <div className="field-row">
        <label className="field-label">Use Gravity</label>
        <input type="checkbox" checked={rb.useGravity}
          onChange={(e) => updateComponent(entityId, 'RigidBody', { useGravity: e.target.checked })} />
      </div>
      <div className="field-row">
        <label className="field-label">Is Kinematic</label>
        <input type="checkbox" checked={rb.isKinematic ?? false}
          onChange={(e) => updateComponent(entityId, 'RigidBody', { isKinematic: e.target.checked })} />
      </div>
      <div className="field-row">
        <label className="field-label">Is Static</label>
        <input type="checkbox" checked={rb.isStatic}
          onChange={(e) => updateComponent(entityId, 'RigidBody', { isStatic: e.target.checked })} />
      </div>

      {/* ── Interpolação e detecção ── */}
      <div className="field-row">
        <label className="field-label">Interpolate</label>
        <select className="field-select" value={rb.interpolate ?? 'none'}
          onChange={(e) => updateComponent(entityId, 'RigidBody', { interpolate: e.target.value as any })}>
          <option value="none">None</option>
          <option value="interpolate">Interpolate</option>
          <option value="extrapolate">Extrapolate</option>
        </select>
      </div>
      <div className="field-row">
        <label className="field-label">Collision Detection</label>
        <select className="field-select" value={rb.collisionDetection ?? 'discrete'}
          onChange={(e) => updateComponent(entityId, 'RigidBody', { collisionDetection: e.target.value as any })}>
          <option value="discrete">Discrete</option>
          <option value="continuous">Continuous</option>
        </select>
      </div>

      {/* ── Collider embutido ── */}
      <div className="field-row">
        <label className="field-label">Collider</label>
        <select className="field-select" value={rb.collider || 'none'}
          onChange={(e) => updateComponent(entityId, 'RigidBody', { collider: e.target.value as any })}>
          <option value="cuboid">Cuboid (Box)</option>
          <option value="ball">Ball (Sphere)</option>
          <option value="hull">Convex Hull</option>
          <option value="trimesh">Mesh Collider</option>
          <option value="none">None</option>
        </select>
      </div>

      {/* ── Constraints ── */}
      <div style={{ padding: '8px 14px 4px', borderTop: '1px solid var(--border)', marginTop: 4 }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          ▾ Constraints
        </span>
      </div>

      <div className="field-row">
        <label className="field-label">Freeze Position</label>
        <div style={{ display: 'flex', gap: 10 }}>
          {(['X', 'Y', 'Z'] as const).map((axis) => {
            const key = `freezePosition${axis}` as keyof RigidBodyComponent;
            return (
              <label key={axis} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={(rb[key] as boolean) ?? false}
                  onChange={(e) => updateComponent(entityId, 'RigidBody', { [key]: e.target.checked })} />
                {axis}
              </label>
            );
          })}
        </div>
      </div>

      <div className="field-row">
        <label className="field-label">Freeze Rotation</label>
        <div style={{ display: 'flex', gap: 10 }}>
          {(['X', 'Y', 'Z'] as const).map((axis) => {
            const key = `freezeRotation${axis}` as keyof RigidBodyComponent;
            return (
              <label key={axis} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={(rb[key] as boolean) ?? false}
                  onChange={(e) => updateComponent(entityId, 'RigidBody', { [key]: e.target.checked })} />
                {axis}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AudioInspector({ entityId }: { entityId: string }) {
  const { selectedEntity, updateComponent } = useEditorStore();
  const entity = selectedEntity();
  if (!entity) return null;
  const audio = entity.components.Audio as AudioComponent;

  const currentProjectName = useEditorStore(s => s.currentProjectName);
  const sceneName = currentProjectName || 'default';

  const [audioFiles, setAudioFiles] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const [audioPreview, setAudioPreview] = useState<HTMLAudioElement | null>(null);

  // Carrega lista de áudios
  useEffect(() => {
    let active = true;
    const fetchAudio = async () => {
      try {
        const res = await fetch(`/api/explorer-audio/list?project=${encodeURIComponent(sceneName)}`);
        if (res.ok && active) {
          const files = await res.json();
          setAudioFiles(files);
        }
      } catch (err) {
        console.error('Error fetching audio files:', err);
      }
    };
    fetchAudio();
    return () => { active = false; };
  }, [sceneName]);

  // Para a prévia se o áudio selecionado mudar
  useEffect(() => {
    if (audioPreview) {
      audioPreview.pause();
      setPlaying(false);
    }
  }, [audio.src]);

  // Efeito de limpeza
  useEffect(() => {
    return () => {
      if (audioPreview) {
        audioPreview.pause();
      }
    };
  }, [audioPreview]);

  const togglePlayPreview = () => {
    if (!audio.src) return;
    
    if (playing && audioPreview) {
      audioPreview.pause();
      setPlaying(false);
    } else {
      let preview = audioPreview;
      if (!preview) {
        preview = new Audio(audio.src);
        preview.loop = audio.loop;
        preview.onended = () => setPlaying(false);
        setAudioPreview(preview);
      } else {
        preview.src = audio.src;
        preview.loop = audio.loop;
      }
      preview.play()
        .then(() => setPlaying(true))
        .catch(err => console.error("Falha ao tocar preview de áudio:", err));
    }
  };

  const stopPreview = () => {
    if (audioPreview) {
      audioPreview.pause();
      audioPreview.currentTime = 0;
      setPlaying(false);
    }
  };

  return (
    <div className="component-block">
      <div className="component-header">
        <span className="component-icon"><Volume2 size={14} /></span>
        <span className="component-title">Audio Source</span>
        <button className="component-remove-btn" onClick={() => useEditorStore.getState().removeComponent(entityId, 'Audio')} title="Remover Componente">
          <Trash2 size={12} />
        </button>
      </div>
      
      <div className="field-row">
        <label className="field-label">Escolher Áudio</label>
        <select
          className="field-input select-dark"
          value={(audio as any).fileName || ''}
          onChange={(e) => {
            const relPath = e.target.value;
            if (relPath) {
              const src = `/api/explorer/load-file?project=${encodeURIComponent(sceneName)}&subpath=${encodeURIComponent(relPath)}`;
              updateComponent(entityId, 'Audio', { src, fileName: relPath } as any);
            } else {
              updateComponent(entityId, 'Audio', { src: '', fileName: '' } as any);
            }
          }}
          style={{ width: '100%', padding: '4px', fontSize: '11px', background: '#111122', border: '1px solid var(--border)', color: '#fff', borderRadius: '4px' }}
        >
          <option value="">(Nenhum / URL manual)</option>
          {audioFiles.map((file) => (
            <option key={file} value={file}>
              {file}
            </option>
          ))}
        </select>
      </div>

      <div className="field-row">
        <label className="field-label">File URL</label>
        <input
          type="text"
          className="field-input"
          value={audio.src}
          placeholder="e.g. sound.mp3 ou URL externa"
          onChange={(e) => {
            const src = e.target.value;
            // Se for inserida uma URL manual externa, limpa o fileName
            const isExternal = src.startsWith('http') || src.startsWith('/');
            const fileName = isExternal ? '' : src.split('/').pop() || src;
            updateComponent(entityId, 'Audio', { src, fileName } as any);
          }}
        />
      </div>

      {/* Botões de visualização prévia (Play/Stop) */}
      <div className="field-row" style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={togglePlayPreview}
          disabled={!audio.src}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '6px',
            fontSize: '11px',
            fontWeight: 'bold',
            background: playing ? 'var(--accent-secondary)' : 'var(--bg-selected)',
            border: '1px solid var(--border-accent)',
            color: 'white',
            borderRadius: '4px',
            cursor: audio.src ? 'pointer' : 'not-allowed',
            opacity: audio.src ? 1 : 0.5
          }}
        >
          {playing ? 'Pausar Prévia' : 'Tocar Prévia'}
        </button>
        {playing && (
          <button
            type="button"
            onClick={stopPreview}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 'bold',
              background: '#ef4444',
              border: 'none',
              color: 'white',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Parar
          </button>
        )}
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

      <div className="field-row">
        <label className="field-label">Volume</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={audio.volume ?? 1}
            onChange={(e) => updateComponent(entityId, 'Audio', { volume: parseFloat(e.target.value) })}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: '11px', width: '28px', textAlign: 'right' }}>
            {Math.round((audio.volume ?? 1) * 100)}%
          </span>
        </div>
      </div>

      <div className="field-row">
        <label className="field-label">Som 3D (Espacial)</label>
        <input
          type="checkbox"
          checked={audio.is3D ?? true}
          onChange={(e) => updateComponent(entityId, 'Audio', { is3D: e.target.checked })}
        />
      </div>

      {(audio.is3D ?? true) && (
        <>
          <div className="field-row">
            <label className="field-label">Distância Mínima</label>
            <input
              type="number"
              className="field-input"
              min="0.1"
              step="0.5"
              value={audio.refDistance ?? 5}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                updateComponent(entityId, 'Audio', { refDistance: isNaN(val) ? 5 : val });
              }}
              style={{ width: '60px' }}
            />
          </div>
          <div className="field-row">
            <label className="field-label">Rolloff (Decaimento)</label>
            <input
              type="number"
              className="field-input"
              min="0"
              step="0.1"
              value={audio.rolloffFactor ?? 1}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                updateComponent(entityId, 'Audio', { rolloffFactor: isNaN(val) ? 1 : val });
              }}
              style={{ width: '60px' }}
            />
          </div>
          <div className="field-row">
            <label className="field-label">Distância Máxima</label>
            <input
              type="number"
              className="field-input"
              min="1"
              step="5"
              value={audio.maxDistance ?? 100}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                updateComponent(entityId, 'Audio', { maxDistance: isNaN(val) ? 100 : val });
              }}
              style={{ width: '60px' }}
            />
          </div>
          <div className="field-row">
            <label className="field-label">Modelo de Distância</label>
            <select
              className="field-input select-dark"
              value={audio.distanceModel || 'linear'}
              onChange={(e) => updateComponent(entityId, 'Audio', { distanceModel: e.target.value as any })}
              style={{ flex: 1, padding: '2px 4px', fontSize: '11px', background: '#111122', border: '1px solid var(--border)', color: '#fff', borderRadius: '4px' }}
            >
              <option value="linear">Linear (Zera além do limite)</option>
              <option value="inverse">Inversa (Decai infinitamente)</option>
              <option value="exponential">Exponencial (Decai rápido)</option>
            </select>
          </div>
        </>
      )}

      <div className="field-row">
        <label className="field-label">Delay para Iniciar (s)</label>
        <input
          type="number"
          className="field-input"
          min="0"
          step="0.5"
          value={audio.delay ?? 0}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            updateComponent(entityId, 'Audio', { delay: isNaN(val) ? 0 : val });
          }}
          placeholder="0"
          style={{ width: '60px' }}
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
        <button className="component-remove-btn" onClick={() => useEditorStore.getState().removeComponent(entityId, 'ParticleSystem')} title="Remover Componente">
          <Trash2 size={12} />
        </button>
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
        <button className="component-remove-btn" onClick={() => useEditorStore.getState().removeComponent(entityId, 'Animator')} title="Remover Componente">
          <Trash2 size={12} />
        </button>
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
        <button className="component-remove-btn" onClick={() => useEditorStore.getState().removeComponent(entityId, 'Network')} title="Remover Componente">
          <Trash2 size={12} />
        </button>
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
        <button className="component-remove-btn" onClick={() => useEditorStore.getState().removeComponent(entityId, 'Camera')} title="Remover Componente">
          <Trash2 size={12} />
        </button>
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
        <label className="field-label">Show Crosshair</label>
        <input
          type="checkbox"
          checked={c.showCrosshair ?? false}
          onChange={(e) => updateComponent(entityId, 'Camera', { showCrosshair: e.target.checked })}
        />
      </div>
      <div className="field-row">
        <label className="field-label">Antialiasing</label>
        <input
          type="checkbox"
          checked={c.antialias ?? true}
          onChange={(e) => updateComponent(entityId, 'Camera', { antialias: e.target.checked })}
        />
      </div>
      <div className="field-row">
        <label className="field-label" title="Quando ativado (padrão), o modo VR usa o headset para controlar a câmera (FPS/imersivo). Desative para que os Scripts do jogo controlem a câmera no VR — ideal para câmeras de 3ª pessoa, FPV de drone, orbital, etc.">
          Use Gyroscope (VR)
        </label>
        <input
          type="checkbox"
          checked={c.useGyroscope ?? true}
          onChange={(e) => updateComponent(entityId, 'Camera', { useGyroscope: e.target.checked, cameraType: e.target.checked ? 'Headset' : 'Scriptable' })}
        />
      </div>
      <div className="field-row">
        <label className="field-label" title="Modo de câmera no VR. 'Headset' = pose do headset controla (FPS). 'Scriptable' = scripts controlam CFrame/FOV (Roblox-like); o headset vira offset opcional.">
          Camera Type (VR)
        </label>
        <select
          className="field-input"
          value={c.cameraType || (c.useGyroscope === false ? 'Scriptable' : 'Headset')}
          onChange={(e) => {
            const t = e.target.value as 'Headset' | 'Scriptable';
            updateComponent(entityId, 'Camera', { cameraType: t, useGyroscope: t !== 'Scriptable' });
          }}
        >
          <option value="Headset">Headset (Gyro)</option>
          <option value="Scriptable">Scriptable (Scripts)</option>
        </select>
      </div>
      {(!c.useGyroscope || c.cameraType === 'Scriptable') && (
        <div className="field-row">
          <label className="field-label" title="Apenas em Scriptable: se ativo, a pose do headset vira um offset local sobre a câmera do script (ex.: olhar ao redor numa câmera de 3ª pessoa). Se desativado, a câmera fica 100% travada no script.">
            Headset Offset
          </label>
          <input
            type="checkbox"
            checked={c.headsetOffset ?? false}
            onChange={(e) => updateComponent(entityId, 'Camera', { headsetOffset: e.target.checked })}
          />
        </div>
      )}
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



  const currentProjectName = useEditorStore(s => s.currentProjectName);
  const sceneName = currentProjectName || 'default';

  const [audioFiles, setAudioFiles] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    const fetchAudio = async () => {
      try {
        const res = await fetch(`/api/explorer-audio/list?project=${encodeURIComponent(sceneName)}`);
        if (res.ok && active) {
          const files = await res.json();
          setAudioFiles(files);
        }
      } catch (err) {
        console.error('Error fetching audio files in ScriptInspector:', err);
      }
    };
    fetchAudio();
    return () => { active = false; };
  }, [sceneName]);

  const renderCodeVariablesSection = (
    code: string, 
    onUpdateCode: (newCode: string) => void
  ) => {
    const vars: Record<string, { type: 'number' | 'string' | 'boolean', value: any }> = {};
    const regex = /^export\s+let\s+([a-zA-Z0-9_]+)\s*=\s*(.+?);?$/gm;
    let match;
    const cleanCode = code || '';
    while ((match = regex.exec(cleanCode)) !== null) {
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

    if (Object.keys(vars).length === 0) return null;

    const updateVariable = (key: string, newVal: any, type: string) => {
      let valStr = newVal;
      if (type === 'string') valStr = `"${newVal}"`;
      const replaceRegex = new RegExp(`^(export\\s+let\\s+${key}\\s*=\\s*).+?(;?)$`, 'm');
      const newCode = cleanCode.replace(replaceRegex, `$1${valStr}$2`);
      onUpdateCode(newCode);
    };

    return (
      <div className="field-row" style={{ display: 'block', marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
        <label className="field-label" style={{ fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>Variáveis Públicas (Código)</label>
        {Object.keys(vars).map(key => {
          const { type, value } = vars[key];
          const isButtonField = key.toLowerCase().endsWith('button');
          const isAxisField = key.toLowerCase().endsWith('axis');
          const isAudioField = key.toLowerCase().endsWith('sound') || key.toLowerCase().endsWith('audio') || key.toLowerCase().endsWith('clip');
          const isTeamField = key.toLowerCase() === 'team' || key.toLowerCase().endsWith('team');
          const isRoleField = key.toLowerCase() === 'role' || key.toLowerCase().endsWith('role');
          
          return (
            <div key={key} className="field-row" style={{ marginBottom: '4px' }}>
              <label className="field-label" style={{ width: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={key}>{key}</label>
              {isTeamField ? (
                <select
                  className="field-input"
                  value={value}
                  onChange={e => updateVariable(key, e.target.value, 'string')}
                  style={{ flex: 1, padding: '2px 4px', fontSize: '11px', borderRadius: '3px' }}
                >
                  <option value="red">🔴 Vermelho (Red)</option>
                  <option value="blue">🔵 Azul (Blue)</option>
                </select>
              ) : isRoleField ? (
                <select
                  className="field-input"
                  value={value}
                  onChange={e => updateVariable(key, e.target.value, 'string')}
                  style={{ flex: 1, padding: '2px 4px', fontSize: '11px', borderRadius: '3px' }}
                >
                  <option value="attacker">⚡ Atacante</option>
                  <option value="winger-left">↙️ Lateral Esquerda</option>
                  <option value="winger-right">↘️ Lateral Direita</option>
                  <option value="midfielder">🔄 Meio-campo</option>
                  <option value="defender">🛡️ Defensor</option>
                  <option value="goalkeeper">🥅 Goleiro</option>
                </select>
              ) : isButtonField ? (
                <select 
                  className="field-input"
                  value={value} 
                  onChange={e => updateVariable(key, e.target.value, 'string')}
                  style={{ flex: 1, padding: '2px 4px', fontSize: '11px', borderRadius: '3px' }}
                >
                  <option value="A">Cruz / A</option>
                  <option value="B">Círculo / B</option>
                  <option value="C">Quadrado / C</option>
                  <option value="D">Triângulo / D</option>
                  <option value="L1">L1 (Ombro Esq.)</option>
                  <option value="R1">R1 (Ombro Dir.)</option>
                  <option value="L2">L2 (Gatilho Esq.)</option>
                  <option value="R2">R2 (Gatilho Dir.)</option>
                  <option value="L3">L3 (Analógico L Clique)</option>
                  <option value="R3">R3 (Analógico R Clique)</option>
                  <option value="Share">Share (Compartilhar)</option>
                  <option value="Options">Options (Opções)</option>
                </select>
              ) : isAxisField ? (
                <select 
                  className="field-input"
                  value={value} 
                  onChange={e => updateVariable(key, Number(e.target.value), 'number')}
                  style={{ flex: 1, padding: '2px 4px', fontSize: '11px', borderRadius: '3px' }}
                >
                  <option value={0}>Eixo 0 (Mov. Analógico L - X)</option>
                  <option value={1}>Eixo 1 (Mov. Analógico L - Y)</option>
                  <option value={2}>Eixo 2 (Câmera Analógico R - X)</option>
                  <option value={3}>Eixo 3 (Câmera Analógico R - Y)</option>
                </select>
              ) : isAudioField ? (
                <select
                  className="field-input"
                  value={value || ''}
                  onChange={e => updateVariable(key, e.target.value, 'string')}
                  style={{ flex: 1, padding: '2px 4px', fontSize: '11px', borderRadius: '3px' }}
                >
                  <option value="">(Nenhum)</option>
                  {audioFiles.map(file => {
                    const url = `/api/explorer/load-file?project=${encodeURIComponent(sceneName)}&subpath=${encodeURIComponent(file)}`;
                    return (
                      <option key={file} value={url}>{file}</option>
                    );
                  })}
                </select>
              ) : type === 'boolean' ? (
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
    );
  };

  /*
  const _renderVariablesSection = (
    variablesList: any[] = [], 
    onUpdateVars: (newVars: any[]) => void
  ) => {
    return (
      <div style={{ marginTop: '10px', borderTop: '1px dashed var(--border)', paddingTop: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Referências (Unity Mode)</span>
          <button 
            type="button"
            onClick={() => {
              const newVar = {
                name: `var_${Math.random().toString(36).substring(2, 7)}`,
                type: 'entity',
                value: '',
                entityId: '',
                componentType: ''
              };
              onUpdateVars([...variablesList, newVar]);
            }}
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              background: 'var(--bg-selected)',
              border: '1px solid var(--border-accent)',
              color: 'var(--text-accent)',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            + Var Reference
          </button>
        </div>
        
        {variablesList.map((v, idx) => {
          const targetEntity = allEntities.find(e => e.id === (v.type === 'component' ? v.entityId : v.value));
          const availableComponents = targetEntity ? Object.keys(targetEntity.components) : [];

          return (
            <div key={idx} style={{ background: 'var(--bg-base)', padding: '6px', borderRadius: '4px', marginBottom: '6px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '4px', alignItems: 'center' }}>
                <input 
                  type="text"
                  placeholder="Nome no código"
                  value={v.name}
                  onChange={(e) => {
                    const copy = [...variablesList];
                    copy[idx] = { ...v, name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') };
                    onUpdateVars(copy);
                  }}
                  style={{
                    flex: 1,
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border)',
                    color: 'white',
                    padding: '2px 4px',
                    fontSize: '11px',
                    borderRadius: '2px'
                  }}
                />
                <select
                  value={v.type}
                  onChange={(e) => {
                    const copy = [...variablesList];
                    copy[idx] = { ...v, type: e.target.value, value: '', entityId: '', componentType: '' };
                    onUpdateVars(copy);
                  }}
                  style={{
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border)',
                    color: 'white',
                    padding: '2px 4px',
                    fontSize: '11px',
                    borderRadius: '2px'
                  }}
                >
                  <option value="entity">Entity (GameObject)</option>
                  <option value="component">Component</option>
                  <option value="audio">Audio Clip</option>
                  <option value="number">Number</option>
                  <option value="string">String</option>
                  <option value="boolean">Boolean</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const copy = [...variablesList];
                    copy.splice(idx, 1);
                    onUpdateVars(copy);
                  }}
                  style={{
                    background: '#ef4444',
                    border: 'none',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '2px',
                    cursor: 'pointer',
                    fontSize: '10px'
                  }}
                >
                  X
                </button>
              </div>
              
              {v.type === 'entity' && (
                <select
                  value={v.value}
                  onChange={(e) => {
                    const copy = [...variablesList];
                    copy[idx] = { ...v, value: e.target.value };
                    onUpdateVars(copy);
                  }}
                  style={{
                    width: '100%',
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border)',
                    color: 'white',
                    padding: '2px 4px',
                    fontSize: '11px',
                    borderRadius: '2px'
                  }}
                >
                  <option value="">(Nenhuma)</option>
                  {allEntities.map(ent => (
                    <option key={ent.id} value={ent.id}>{ent.name}</option>
                  ))}
                </select>
              )}

              {v.type === 'audio' && (
                <select
                  value={v.value}
                  onChange={(e) => {
                    const copy = [...variablesList];
                    copy[idx] = { ...v, value: e.target.value };
                    onUpdateVars(copy);
                  }}
                  style={{
                    width: '100%',
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border)',
                    color: 'white',
                    padding: '2px 4px',
                    fontSize: '11px',
                    borderRadius: '2px'
                  }}
                >
                  <option value="">(Nenhum)</option>
                  {audioFiles.map(file => {
                    const url = `/api/explorer/load-file?project=${encodeURIComponent(sceneName)}&subpath=${encodeURIComponent(file)}`;
                    return (
                      <option key={file} value={url}>{file}</option>
                    );
                  })}
                </select>
              )}

              {v.type === 'component' && (
                <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                  <select
                    value={v.entityId || ''}
                    onChange={(e) => {
                      const copy = [...variablesList];
                      copy[idx] = { ...v, entityId: e.target.value, value: '', componentType: '' };
                      onUpdateVars(copy);
                    }}
                    style={{
                      flex: 1,
                      background: 'var(--bg-panel)',
                      border: '1px solid var(--border)',
                      color: 'white',
                      padding: '2px 4px',
                      fontSize: '11px',
                      borderRadius: '2px'
                    }}
                  >
                    <option value="">(Escolha Entidade)</option>
                    {allEntities.map(ent => (
                      <option key={ent.id} value={ent.id}>{ent.name}</option>
                    ))}
                  </select>
                  <select
                    value={v.componentType || ''}
                    onChange={(e) => {
                      const copy = [...variablesList];
                      copy[idx] = { ...v, componentType: e.target.value, value: e.target.value };
                      onUpdateVars(copy);
                    }}
                    disabled={!v.entityId}
                    style={{
                      flex: 1,
                      background: 'var(--bg-panel)',
                      border: '1px solid var(--border)',
                      color: 'white',
                      padding: '2px 4px',
                      fontSize: '11px',
                      borderRadius: '2px'
                    }}
                  >
                    <option value="">(Componente)</option>
                    {availableComponents.map(compName => (
                      <option key={compName} value={compName}>{compName}</option>
                    ))}
                  </select>
                </div>
              )}

              {v.type === 'number' && (
                v.name.toLowerCase().endsWith('axis') ? (
                  <select
                    value={v.value}
                    onChange={(e) => {
                      const copy = [...variablesList];
                      copy[idx] = { ...v, value: Number(e.target.value) };
                      onUpdateVars(copy);
                    }}
                    style={{
                      width: '100%',
                      background: 'var(--bg-panel)',
                      border: '1px solid var(--border)',
                      color: 'white',
                      padding: '2px 4px',
                      fontSize: '11px',
                      borderRadius: '2px'
                    }}
                  >
                    <option value={0}>Eixo 0 (Mov. Analógico L - X)</option>
                    <option value={1}>Eixo 1 (Mov. Analógico L - Y)</option>
                    <option value={2}>Eixo 2 (Câmera Analógico R - X)</option>
                    <option value={3}>Eixo 3 (Câmera Analógico R - Y)</option>
                  </select>
                ) : (
                  <input 
                    type="number"
                    value={v.value}
                    onChange={(e) => {
                      const copy = [...variablesList];
                      copy[idx] = { ...v, value: e.target.value };
                      onUpdateVars(copy);
                    }}
                    style={{
                      width: '100%',
                      background: 'var(--bg-panel)',
                      border: '1px solid var(--border)',
                      color: 'white',
                      padding: '2px 4px',
                      fontSize: '11px',
                      borderRadius: '2px'
                    }}
                  />
                )
              )}

              {v.type === 'string' && (
                v.name.toLowerCase().endsWith('button') ? (
                  <select
                    value={v.value}
                    onChange={(e) => {
                      const copy = [...variablesList];
                      copy[idx] = { ...v, value: e.target.value };
                      onUpdateVars(copy);
                    }}
                    style={{
                      width: '100%',
                      background: 'var(--bg-panel)',
                      border: '1px solid var(--border)',
                      color: 'white',
                      padding: '2px 4px',
                      fontSize: '11px',
                      borderRadius: '2px'
                    }}
                  >
                    <option value="A">Cruz / A</option>
                    <option value="B">Círculo / B</option>
                    <option value="C">Quadrado / C</option>
                    <option value="D">Triângulo / D</option>
                    <option value="L1">L1 (Ombro Esq.)</option>
                    <option value="R1">R1 (Ombro Dir.)</option>
                    <option value="L2">L2 (Gatilho Esq.)</option>
                    <option value="R2">R2 (Gatilho Dir.)</option>
                    <option value="L3">L3 (Analógico L Clique)</option>
                    <option value="R3">R3 (Analógico R Clique)</option>
                    <option value="Share">Share (Compartilhar)</option>
                    <option value="Options">Options (Opções)</option>
                  </select>
                ) : (
                  <input 
                    type="text"
                    value={v.value}
                    onChange={(e) => {
                      const copy = [...variablesList];
                      copy[idx] = { ...v, value: e.target.value };
                      onUpdateVars(copy);
                    }}
                    style={{
                      width: '100%',
                      background: 'var(--bg-panel)',
                      border: '1px solid var(--border)',
                      color: 'white',
                      padding: '2px 4px',
                      fontSize: '11px',
                      borderRadius: '2px'
                    }}
                  />
                )
              )}

              {v.type === 'boolean' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'white' }}>
                  <input 
                    type="checkbox"
                    checked={v.value === 'true'}
                    onChange={(e) => {
                      const copy = [...variablesList];
                      copy[idx] = { ...v, value: e.target.checked ? 'true' : 'false' };
                      onUpdateVars(copy);
                    }}
                  />
                  True
                </label>
              )}
            </div>
          );
        })}
      </div>
    );
  };
  */

  return (
    <>
      {/* CARD DO SCRIPT PRINCIPAL */}
      <div className="component-block">
        <div className="component-header">
          <span className="component-icon"><Code size={14} /></span>
          <span className="component-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
            {s.scriptName || 'Script Principal'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button className="component-remove-btn" onClick={() => {
              window.open(`/code-editor?entityId=${entityId}&scriptId=main`, 'Freedom3DCodeEditor', 'width=1100,height=750');
            }} title="Editar Código">
              <Edit size={12} />
            </button>
            <button className="component-remove-btn" onClick={() => useEditorStore.getState().removeComponent(entityId, 'Script')} title="Remover Componente">
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Variáveis Legadas Extraídas por Regex */}
        {renderCodeVariablesSection(s.code, (newCode) => updateComponent(entityId, 'Script', { code: newCode }))}


      </div>

      {/* SEÇÃO DE SCRIPTS ADICIONAIS (Cards individuais) */}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: '16px', paddingTop: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Múltiplos Scripts (Unity Mode)</span>
          <button
            type="button"
            onClick={() => {
              const rawName = prompt("Digite o nome do novo script adicional:", "ScriptAdicional");
              if (rawName === null) return; // Cancelado
              const cleanName = rawName.replace(/[^a-zA-Z0-9_\-]/g, '').trim();
              if (!cleanName) {
                alert("Nome de script inválido!");
                return;
              }

              const currentScripts = s.scripts || [];
              const exists = (s.scriptName === cleanName) || currentScripts.some(scr => scr.scriptName === cleanName);
              if (exists) {
                alert("Já existe um script com esse nome nesta entidade!");
                return;
              }

              const newScript = {
                id: Math.random().toString(36).substring(2, 9),
                scriptName: cleanName,
                code: `// Comportamento adicional\nexport function onAwake() {\n  // Chamado na inicialização\n}\n\nexport function onUpdate(delta) {\n  // Chamado a cada frame\n}`,
                variables: []
              };
              updateComponent(entityId, 'Script', { scripts: [...currentScripts, newScript] });
              setTimeout(() => {
                useEditorStore.getState().saveCurrentScene();
              }, 100);
            }}
            style={{
              fontSize: '10px',
              padding: '3px 8px',
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              border: 'none',
              color: 'white',
              borderRadius: '3px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            + Novo Script
          </button>
        </div>

        {(s.scripts || []).map((scr, sIdx) => (
          <div key={scr.id} className="component-block" style={{ marginTop: '10px' }}>
            <div className="component-header">
              <span className="component-icon"><Code size={14} style={{ color: '#10b981' }} /></span>
              <span className="component-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                {scr.scriptName}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button className="component-remove-btn" onClick={() => {
                  window.open(`/code-editor?entityId=${entityId}&scriptId=${scr.id}`, 'Freedom3DCodeEditor', 'width=1100,height=750');
                }} title="Editar Código">
                  <Edit size={12} />
                </button>
                <button className="component-remove-btn" onClick={() => {
                  const copy = [...(s.scripts || [])];
                  copy.splice(sIdx, 1);
                  updateComponent(entityId, 'Script', { scripts: copy });
                }} title="Remover Script">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {renderCodeVariablesSection(scr.code, (newCode) => {
              const copy = [...(s.scripts || [])];
              copy[sIdx] = { ...scr, code: newCode };
              updateComponent(entityId, 'Script', { scripts: copy });
            })}


          </div>
        ))}
      </div>
    </>
  );
}

function TextureInspector({ entityId }: { entityId: string }) {
  const { selectedEntity, updateComponent, currentProjectName } = useEditorStore();
  const entity = selectedEntity();
  const [imageFiles, setImageFiles] = useState<string[]>([]);
  const sceneName = currentProjectName || 'default';

  useEffect(() => {
    let active = true;
    const fetchImages = async () => {
      try {
        const res = await fetch(`/api/explorer-image/list?project=${encodeURIComponent(sceneName)}`);
        if (res.ok && active) {
          const files = await res.json();
          setImageFiles(files);
        }
      } catch (err) {
        console.error('Error fetching image files in TextureInspector:', err);
      }
    };
    fetchImages();
    return () => { active = false; };
  }, [sceneName]);

  if (!entity) return null;
  const t = entity.components.Texture as TextureComponent;
  if (!t) return null;

  return (
    <div className="component-block">
      <div className="component-header">
        <span className="component-icon"><Layers size={14} /></span>
        <span className="component-title">Texture (Textura)</span>
        <button className="component-remove-btn" onClick={() => useEditorStore.getState().removeComponent(entityId, 'Texture')} title="Remover Componente">
          <Trash2 size={12} />
        </button>
      </div>
      
      {/* ALBEDO TEXTURE */}
      <div className="field-row">
        <label className="field-label">Texture File</label>
        <select
          className="field-select"
          value={t.fileName || ''}
          onChange={(e) => {
            const file = e.target.value;
            if (file) {
              const url = `/api/project/get-asset?project=${encodeURIComponent(sceneName)}&file=${encodeURIComponent(file)}`;
              updateComponent(entityId, 'Texture', { textureUrl: url, fileName: file });
            } else {
              updateComponent(entityId, 'Texture', { textureUrl: '', fileName: '' });
            }
          }}
        >
          <option value="">Nenhuma textura</option>
          {imageFiles.map(img => (
            <option key={img} value={img}>{img}</option>
          ))}
        </select>
      </div>

      <div className="field-row">
        <label className="field-label">Custom URL</label>
        <input
          type="text"
          className="field-input"
          value={t.textureUrl || ''}
          onChange={(e) => updateComponent(entityId, 'Texture', { textureUrl: e.target.value })}
          placeholder="Ou insira uma URL externa..."
        />
      </div>

      {/* TILING */}
      <div className="field-row">
        <label className="field-label">Tiling</label>
        <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
            <span style={{ fontSize: '10px', color: '#888' }}>X</span>
            <input
              type="number"
              className="field-input"
              value={t.tilingX ?? 1}
              step={0.1}
              onChange={(e) => updateComponent(entityId, 'Texture', { tilingX: parseFloat(e.target.value) || 1 })}
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
            <span style={{ fontSize: '10px', color: '#888' }}>Y</span>
            <input
              type="number"
              className="field-input"
              value={t.tilingY ?? 1}
              step={0.1}
              onChange={(e) => updateComponent(entityId, 'Texture', { tilingY: parseFloat(e.target.value) || 1 })}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* OFFSET */}
      <div className="field-row">
        <label className="field-label">Offset</label>
        <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
            <span style={{ fontSize: '10px', color: '#888' }}>X</span>
            <input
              type="number"
              className="field-input"
              value={t.offsetX ?? 0}
              step={0.05}
              onChange={(e) => updateComponent(entityId, 'Texture', { offsetX: parseFloat(e.target.value) || 0 })}
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
            <span style={{ fontSize: '10px', color: '#888' }}>Y</span>
            <input
              type="number"
              className="field-input"
              value={t.offsetY ?? 0}
              step={0.05}
              onChange={(e) => updateComponent(entityId, 'Texture', { offsetY: parseFloat(e.target.value) || 0 })}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* NORMAL MAP */}
      <div className="field-row" style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
        <label className="field-label">Normal Map</label>
        <select
          className="field-select"
          value={t.normalFileName || ''}
          onChange={(e) => {
            const file = e.target.value;
            if (file) {
              const url = `/api/project/get-asset?project=${encodeURIComponent(sceneName)}&file=${encodeURIComponent(file)}`;
              updateComponent(entityId, 'Texture', { normalMapUrl: url, normalFileName: file });
            } else {
              updateComponent(entityId, 'Texture', { normalMapUrl: '', normalFileName: '' });
            }
          }}
        >
          <option value="">Nenhum Normal Map</option>
          {imageFiles.map(img => (
            <option key={img} value={img}>{img}</option>
          ))}
        </select>
      </div>

      <div className="field-row">
        <label className="field-label">Normal URL</label>
        <input
          type="text"
          className="field-input"
          value={t.normalMapUrl || ''}
          onChange={(e) => updateComponent(entityId, 'Texture', { normalMapUrl: e.target.value })}
          placeholder="Ou insira normal URL externa..."
        />
      </div>

      <div className="field-row">
        <label className="field-label">Normal Scale</label>
        <div className="field-slider-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <input
            type="range"
            min="0"
            max="5"
            step="0.1"
            className="field-slider"
            style={{ flex: 1 }}
            value={t.normalScale ?? 1.0}
            onChange={(e) => updateComponent(entityId, 'Texture', { normalScale: parseFloat(e.target.value) })}
          />
          <span className="field-slider-value" style={{ minWidth: '24px', fontSize: '10px' }}>{(t.normalScale ?? 1.0).toFixed(1)}</span>
        </div>
      </div>

      {/* PREVIEWS LADO A LADO */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'center' }}>
        {t.textureUrl && (
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: '#888', marginBottom: '2px' }}>Albedo</div>
            <img 
              src={t.textureUrl} 
              alt="Albedo Preview" 
              style={{ 
                width: '100%', 
                height: '60px', 
                borderRadius: '4px', 
                border: '1px solid var(--border)',
                objectFit: 'contain'
              }} 
            />
          </div>
        )}
        {t.normalMapUrl && (
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: '#888', marginBottom: '2px' }}>Normal</div>
            <img 
              src={t.normalMapUrl} 
              alt="Normal Preview" 
              style={{ 
                width: '100%', 
                height: '60px', 
                borderRadius: '4px', 
                border: '1px solid var(--border)',
                objectFit: 'contain'
              }} 
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Tags sugeridas para o projeto de futebol (e genéricas do engine)
const SUGGESTED_TAGS = [
  'player', 'ai-player', 'red-team', 'blue-team',
  'enemy', 'ally', 'ball', 'goalkeeper',
  'gltf', 'teleport', 'interactable', 'trigger',
];

// Cores por tag para facilitar identificação visual
function tagColor(tag: string): { bg: string; text: string; border: string } {
  if (tag === 'red-team')    return { bg: '#3a0a0a', text: '#ff6b6b', border: '#ff3333' };
  if (tag === 'blue-team')   return { bg: '#0a1a3a', text: '#6bb3ff', border: '#3366ff' };
  if (tag === 'enemy')       return { bg: '#2a0a0a', text: '#ff8888', border: '#cc3333' };
  if (tag === 'ally')        return { bg: '#0a2a0a', text: '#88ff88', border: '#33cc33' };
  if (tag === 'player')      return { bg: '#1a1a3a', text: '#aaaaff', border: '#5555cc' };
  if (tag === 'ai-player')   return { bg: '#1a1a2a', text: '#cc99ff', border: '#8855cc' };
  if (tag === 'ball')        return { bg: '#2a2a0a', text: '#ffee88', border: '#ccaa00' };
  if (tag === 'goalkeeper')  return { bg: '#0a2a2a', text: '#88eeff', border: '#00aacc' };
  return { bg: '#1a1a22', text: '#cccccc', border: '#444455' };
}

function TagsEditor({ entityId, tags }: { entityId: string; tags: string[] }) {
  const [inputVal, setInputVal] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const addTag = (tag: string) => {
    const clean = tag.trim().toLowerCase().replace(/\s+/g, '-');
    if (!clean || tags.includes(clean)) return;
    useEditorStore.getState().updateEntityTags(entityId, [...tags, clean]);
    setInputVal('');
    setShowSuggestions(false);
  };

  const removeTag = (tag: string) => {
    useEditorStore.getState().updateEntityTags(entityId, tags.filter(t => t !== tag));
  };

  const filteredSuggestions = SUGGESTED_TAGS.filter(
    s => !tags.includes(s) && (inputVal === '' || s.includes(inputVal.toLowerCase()))
  );

  return (
    <div style={{ padding: '8px 0 4px', borderTop: '1px solid #222', marginTop: '4px' }}>
      <label className="field-label" style={{ fontSize: '10px', color: '#888', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '6px' }}>
        Tags
      </label>

      {/* Chips das tags atuais */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: tags.length > 0 ? '6px' : '0' }}>
        {tags.map(tag => {
          const col = tagColor(tag);
          return (
            <span
              key={tag}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                background: col.bg, color: col.text,
                border: `1px solid ${col.border}`,
                borderRadius: '4px', padding: '2px 6px',
                fontSize: '11px', fontWeight: 500,
              }}
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                style={{
                  background: 'none', border: 'none', color: col.text,
                  cursor: 'pointer', padding: '0', lineHeight: 1,
                  fontSize: '13px', opacity: 0.7,
                }}
                title={`Remover tag "${tag}"`}
              >
                ×
              </button>
            </span>
          );
        })}
      </div>

      {/* Input para nova tag */}
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          <input
            type="text"
            className="field-input"
            value={inputVal}
            placeholder="+ nova tag..."
            style={{ flex: 1, fontSize: '11px', padding: '3px 6px' }}
            onChange={e => { setInputVal(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={e => {
              if (e.key === 'Enter') { addTag(inputVal); e.preventDefault(); }
              if (e.key === 'Escape') { setInputVal(''); setShowSuggestions(false); }
            }}
          />
          <button
            onClick={() => addTag(inputVal)}
            style={{
              background: '#1e2a1e', border: '1px solid #33aa33', color: '#66dd66',
              borderRadius: '4px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer',
            }}
            title="Adicionar tag"
          >
            +
          </button>
        </div>

        {/* Dropdown de sugestões */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
            background: '#111118', border: '1px solid #333',
            borderRadius: '4px', marginTop: '2px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
            overflow: 'hidden',
          }}>
            {filteredSuggestions.map(s => {
              const col = tagColor(s);
              return (
                <div
                  key={s}
                  onMouseDown={() => addTag(s)}
                  style={{
                    padding: '5px 10px', cursor: 'pointer', fontSize: '11px',
                    color: col.text, borderLeft: `3px solid ${col.border}`,
                    background: 'transparent',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#1a1a28')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {s}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function InspectorPanel({ style }: { style?: React.CSSProperties }) {
  const { selectedEntity, selectedEntityId, activeScene, updateSceneSettings, createPrefab } = useEditorStore();
  const entity = selectedEntity();
  const scene = activeScene();

  const [imageFiles, setImageFiles] = useState<string[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const sceneName = scene?.name || 'default';

  useEffect(() => {
    let active = true;
    const fetchImages = async () => {
      try {
        const res = await fetch(`/api/explorer-image/list?project=${encodeURIComponent(sceneName)}`);
        if (res.ok && active) {
          const files = await res.json();
          setImageFiles(files);
        }
      } catch (err) {
        console.error('Error fetching image files in InspectorPanel:', err);
      }
    };
    fetchImages();
    return () => { active = false; };
  }, [sceneName]);

  // Fecha o menu de componentes ao clicar fora
  useEffect(() => {
    const handleGlobalClick = () => {
      setShowAddMenu(false);
    };
    if (showAddMenu) {
      window.addEventListener('click', handleGlobalClick);
    }
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [showAddMenu]);

  if (!selectedEntityId || !entity) {
    return (
      <div className="panel inspector-panel" style={style}>
        <div className="panel-header">
          <span className="panel-title">Inspector</span>
        </div>
        <div className="inspector-scene-settings">
          <div className="scene-settings-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Settings size={14} /> Scene Settings
          </div>
          {/* ── Room Settings (Sistema de Salas) ── */}
          <div style={{ padding: '12px 14px', background: 'rgba(124,58,237,0.07)', borderRadius: '8px', border: '1px solid rgba(124,58,237,0.2)', marginBottom: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ◈ Room Settings
            </div>

            {/* Room ID */}
            <div className="field-row" style={{ alignItems: 'center' }}>
              <label className="field-label">Room ID</label>
              <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                <input
                  type="text"
                  className="field-input"
                  readOnly
                  value={scene.roomId || '(não gerado)'}
                  style={{ flex: 1, fontSize: '10px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', cursor: 'default' }}
                  title="ID único da sala (gerado automaticamente)"
                />
                <button
                  style={{ background: 'rgba(124,58,237,0.3)', border: '1px solid rgba(124,58,237,0.4)', color: '#a78bfa', borderRadius: '4px', padding: '0 8px', cursor: 'pointer', fontSize: '11px' }}
                  onClick={() => {
                    if (scene.roomId) navigator.clipboard?.writeText(scene.roomId);
                  }}
                  title="Copiar Room ID"
                >
                  ⎘
                </button>
                <button
                  style={{ background: 'rgba(124,58,237,0.3)', border: '1px solid rgba(124,58,237,0.4)', color: '#a78bfa', borderRadius: '4px', padding: '0 8px', cursor: 'pointer', fontSize: '11px' }}
                  onClick={() => {
                    if (scene.roomId) {
                      const url = `${window.location.origin}/room/${scene.roomId}`;
                      navigator.clipboard?.writeText(url);
                    }
                  }}
                  title="Copiar Link da Sala"
                >
                  🔗
                </button>
              </div>
            </div>

            {/* Cover Image */}
            <div style={{ marginTop: '8px' }}>
              <label className="field-label" style={{ marginBottom: '6px', display: 'block' }}>Capa da Sala (Cover Image)</label>
              {/* Preview */}
              {scene.coverImage && (
                <div style={{ marginBottom: '8px', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', aspectRatio: '16/9', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={scene.coverImage} alt="Capa" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
              {/* Seletor de imagem do projeto */}
              <select
                className="field-input select-dark"
                value={''}
                onChange={(e) => {
                  const relPath = e.target.value;
                  if (relPath) {
                    const coverUrl = `/api/project/get-asset?project=${encodeURIComponent(sceneName)}&file=${encodeURIComponent(relPath)}`;
                    updateSceneSettings({ coverImage: coverUrl });
                  }
                }}
                style={{ width: '100%', marginBottom: '4px', padding: '4px', fontSize: '11px', background: '#111122', border: '1px solid var(--border)', color: '#fff', borderRadius: '4px' }}
              >
                <option value="">Selecionar imagem do projeto…</option>
                {imageFiles.filter(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f)).map((file) => (
                  <option key={file} value={file}>{file}</option>
                ))}
              </select>
              {/* URL Manual */}
              <input
                type="text"
                className="field-input"
                value={scene.coverImage || ''}
                placeholder="ou cole uma URL de imagem…"
                onChange={(e) => updateSceneSettings({ coverImage: e.target.value })}
                style={{ width: '100%', fontSize: '11px' }}
              />
            </div>

            {/* Link da Sala */}
            <div style={{ marginTop: '10px', padding: '6px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {window.location.origin}/room/{scene.roomId || '…'}
            </div>
          </div>

          <div className="field-row">
            <label className="field-label">BG Color</label>
            <input type="color" className="field-color" value={scene.backgroundColor}
              onChange={(e) => updateSceneSettings({ backgroundColor: e.target.value })} />
          </div>

          <div className="field-row">
            <label className="field-label">Skybox (2:1)</label>
            <select
              className="field-input select-dark"
              value={scene.skyboxUrl || ''}
              onChange={(e) => updateSceneSettings({ skyboxUrl: e.target.value || undefined })}
              style={{ flex: 1, padding: '4px', fontSize: '11px', background: '#111122', border: '1px solid var(--border)', color: '#fff', borderRadius: '4px' }}
            >
              <option value="">(Nenhum - Usar cor de fundo)</option>
              {imageFiles.map((file) => (
                <option key={file} value={file}>
                  {file}
                </option>
              ))}
            </select>
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

          {/* Configurações do HUD da Cena */}
          <div className="scene-settings-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <Layers size={14} /> HUD Settings
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
              <input 
                type="checkbox" 
                checked={scene.hudEnabled ?? false}
                onChange={(e) => updateSceneSettings({ hudEnabled: e.target.checked })}
              />
              Habilitar HUD (Overlay 2D/3D)
            </label>
          </div>

          {!!(scene.hudEnabled) && (
            <div style={{ marginLeft: '12px', borderLeft: '2px solid rgba(255,255,255,0.05)', paddingLeft: '12px', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              
              <div className="field-row">
                <label className="field-label" style={{ fontSize: '11px', color: '#aaa' }}>Show Lobby</label>
                <input 
                  type="checkbox" 
                  checked={scene.hudConfig?.showLobby ?? false}
                  onChange={(e) => {
                    const currentConfig = scene.hudConfig || {};
                    updateSceneSettings({
                      hudConfig: { ...currentConfig, showLobby: e.target.checked }
                    });
                  }} 
                />
              </div>

              <div className="field-row">
                <label className="field-label" style={{ fontSize: '11px', color: '#aaa' }}>Show Scoreboard</label>
                <input 
                  type="checkbox" 
                  checked={scene.hudConfig?.showScoreboard ?? false}
                  onChange={(e) => {
                    const currentConfig = scene.hudConfig || {};
                    updateSceneSettings({
                      hudConfig: { ...currentConfig, showScoreboard: e.target.checked }
                    });
                  }} 
                />
              </div>

              <div className="field-row">
                <label className="field-label" style={{ fontSize: '11px', color: '#aaa' }}>Show Timer</label>
                <input 
                  type="checkbox" 
                  checked={scene.hudConfig?.showTimer ?? false}
                  onChange={(e) => {
                    const currentConfig = scene.hudConfig || {};
                    updateSceneSettings({
                      hudConfig: { ...currentConfig, showTimer: e.target.checked }
                    });
                  }} 
                />
              </div>

              <div className="field-row">
                <label className="field-label" style={{ fontSize: '11px', color: '#aaa' }}>Match Overlay</label>
                <input 
                  type="checkbox" 
                  checked={scene.hudConfig?.showMatchOverlay ?? false}
                  onChange={(e) => {
                    const currentConfig = scene.hudConfig || {};
                    updateSceneSettings({
                      hudConfig: { ...currentConfig, showMatchOverlay: e.target.checked }
                    });
                  }} 
                />
              </div>

              <div className="field-row">
                <label className="field-label" style={{ fontSize: '11px', color: '#aaa' }}>Label Home</label>
                <input 
                  type="text" 
                  className="field-input" 
                  value={scene.hudConfig?.labelHome || "P1"}
                  onChange={(e) => {
                    const currentConfig = scene.hudConfig || {};
                    updateSceneSettings({
                      hudConfig: { ...currentConfig, labelHome: e.target.value }
                    });
                  }} 
                  style={{ flex: 1, padding: '2px 6px', fontSize: '11px', background: '#111122', border: '1px solid var(--border)', color: '#fff', borderRadius: '4px' }}
                />
              </div>

              <div className="field-row">
                <label className="field-label" style={{ fontSize: '11px', color: '#aaa' }}>Label Away</label>
                <input 
                  type="text" 
                  className="field-input" 
                  value={scene.hudConfig?.labelAway || "P2"}
                  onChange={(e) => {
                    const currentConfig = scene.hudConfig || {};
                    updateSceneSettings({
                      hudConfig: { ...currentConfig, labelAway: e.target.value }
                    });
                  }} 
                  style={{ flex: 1, padding: '2px 6px', fontSize: '11px', background: '#111122', border: '1px solid var(--border)', color: '#fff', borderRadius: '4px' }}
                />
              </div>

              <div className="field-row">
                <label className="field-label" style={{ fontSize: '11px', color: '#aaa' }}>Theme Color</label>
                <input 
                  type="color" 
                  className="field-color" 
                  value={scene.hudConfig?.themeColor || "#00f3ff"}
                  onChange={(e) => {
                    const currentConfig = scene.hudConfig || {};
                    updateSceneSettings({
                      hudConfig: { ...currentConfig, themeColor: e.target.value }
                    });
                  }} 
                />
              </div>
            </div>
          )}

          <p className="inspector-hint">Selecione uma entidade para inspecioná-la.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel inspector-panel" style={style}>
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
        <div className="field-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', marginBottom: '8px', borderBottom: '1px solid #222', paddingBottom: '8px' }}>
          <label className="field-label" style={{ color: '#888', fontSize: '10px' }}>ID</label>
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#a0a0ff', flex: 1, userSelect: 'all', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedEntityId}
          </span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(selectedEntityId);
            }}
            style={{
              background: '#222233',
              border: '1px solid #444',
              color: '#ccc',
              padding: '2px 6px',
              fontSize: '10px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            title="Copiar ID para a área de transferência"
          >
            Copiar
          </button>
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

        {/* Tags */}
        <TagsEditor entityId={selectedEntityId} tags={entity.tags ?? []} />
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
        {entity.components.Collider && (
          <ColliderInspector entityId={selectedEntityId} />
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
        {entity.components.Texture && (
          <TextureInspector entityId={selectedEntityId} />
        )}
        {entity.components.HUDPlane && (
          <HUDPlaneInspector entityId={selectedEntityId} />
        )}
        {entity.components.VideoMesh && (
          <VideoMeshInspector entityId={selectedEntityId} />
        )}

        <div className="add-component-wrapper" style={{ marginTop: '16px', position: 'relative', display: 'flex', justifyContent: 'center' }}>
          <button 
            className="panel-btn" 
            onClick={(e) => { e.stopPropagation(); setShowAddMenu(!showAddMenu); }}
            title="Adicionar Componente"
            style={{ width: '100%', justifyContent: 'center', gap: '8px', padding: '8px' }}
          >
            <Plus size={14} /> Componente
          </button>

          {showAddMenu && (
            <div className="create-menu" style={{ bottom: '40px', top: 'auto', left: '0', right: '0' }}>
              <div className="create-menu-section">Física</div>
              {!entity.components.RigidBody && (
                <button className="create-menu-item" onClick={() => { useEditorStore.getState().addComponent(selectedEntityId, { type: 'RigidBody', mass: 1, isStatic: false, useGravity: true, collider: 'none' }); setShowAddMenu(false); }}>
                  RigidBody
                </button>
              )}
              {!entity.components.Collider && (
                <button className="create-menu-item" onClick={() => { useEditorStore.getState().addComponent(selectedEntityId, { type: 'Collider', shape: 'cuboid', scale: [1, 1, 1], offset: [0, 0, 0], isTrigger: false }); setShowAddMenu(false); }}>
                  Collider
                </button>
              )}
              
              <div className="create-menu-section">Mídia & Lógica</div>
              {!entity.components.Script && (
                <button className="create-menu-item" onClick={() => {
                  const rawName = prompt("Digite o nome do novo script:", "NovoScript");
                  if (rawName === null) return;
                  const cleanName = rawName.replace(/[^a-zA-Z0-9_\-]/g, '').trim();
                  if (!cleanName) { alert("Nome de script inválido!"); return; }
                  const defaultCode = `// O objeto 'entity' contem a referencia para esta entidade.\n// O objeto 'engine' contem referencias para cena e controle.\n\nexport function onAwake() {\n  // Chamado na inicialização\n}\n\nexport function onUpdate(delta) {\n  // Chamado a cada frame\n}\n`;
                  useEditorStore.getState().addComponent(selectedEntityId, { type: 'Script', scriptName: cleanName, code: defaultCode });
                  setShowAddMenu(false);
                  setTimeout(() => { useEditorStore.getState().saveCurrentScene(); }, 100);
                }}>
                  Script
                </button>
              )}
              {!entity.components.Audio && (
                <button className="create-menu-item" onClick={() => { useEditorStore.getState().addComponent(selectedEntityId, { type: 'Audio', src: '', loop: true, playOnStart: true, volume: 1, is3D: true, delay: 0, refDistance: 5, rolloffFactor: 1, maxDistance: 100, distanceModel: 'linear' }); setShowAddMenu(false); }}>
                  Audio Source
                </button>
              )}
              {!entity.components.VideoMesh && (
                <button className="create-menu-item" onClick={() => { useEditorStore.getState().addComponent(selectedEntityId, { type: 'VideoMesh', videoUrl: '', fileName: '', autoPlay: true, loop: true, volume: 1.0, muted: false, play: true, curveAmount: 0.0, curveDirection: 'horizontal', width: 2.0, height: 1.125, segmentsX: 32, segmentsY: 32, projection: 'plane', stereoMode: 'none' }); setShowAddMenu(false); }}>
                  Video Mesh
                </button>
              )}

              <div className="create-menu-section">Efeitos & Visual</div>
              {!entity.components.ParticleSystem && (
                <button className="create-menu-item" onClick={() => { useEditorStore.getState().addComponent(selectedEntityId, { type: 'ParticleSystem', count: 100, color: '#ffffff', size: 10, speed: 1 }); setShowAddMenu(false); }}>
                  Particle System
                </button>
              )}
              {!entity.components.Animator && (
                <button className="create-menu-item" onClick={() => { useEditorStore.getState().addComponent(selectedEntityId, { type: 'Animator', currentAnimation: '', loop: true, timeScale: 1 }); setShowAddMenu(false); }}>
                  Animator
                </button>
              )}
              {!entity.components.Texture && (
                <button className="create-menu-item" onClick={() => { useEditorStore.getState().addComponent(selectedEntityId, { type: 'Texture', textureUrl: '', fileName: '' }); setShowAddMenu(false); }}>
                  Texture Material
                </button>
              )}

              <div className="create-menu-section">Sistema</div>
              {!entity.components.Camera && (
                <button className="create-menu-item" onClick={() => { useEditorStore.getState().addComponent(selectedEntityId, { type: 'Camera', fov: 75, near: 0.1, far: 1000, isMain: true, offset: [0, 0.4, 0], rotation: [0, 0, 0] }); setShowAddMenu(false); }}>
                  Camera
                </button>
              )}
              {!entity.components.Network && (
                <button className="create-menu-item" onClick={() => { useEditorStore.getState().addComponent(selectedEntityId, { type: 'Network', isLocal: true, syncPosition: true, syncRotation: true, syncAnimation: false, sendRate: 20 }); setShowAddMenu(false); }}>
                  Network Identity
                </button>
              )}
              {!entity.components.HUDPlane && (
                <button className="create-menu-item" onClick={() => { useEditorStore.getState().addComponent(selectedEntityId, { type: 'HUDPlane', opacity: 0.8, color: '#00ffff', width: 2.0, height: 1.0, distance: 0.5 }); setShowAddMenu(false); }}>
                  HUD Visor
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
