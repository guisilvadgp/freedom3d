import { useEffect, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { RotateCw, Blocks, Layers, Plus } from 'lucide-react';

interface ProjectAsset {
  fileName: string;
  size: number;
}

export function AssetBrowser() {
  const { instantiateAsset, prefabs, instantiatePrefab } = useEditorStore();
  const currentProjectName = useEditorStore(s => s.currentProjectName);
  const sceneName = currentProjectName || 'default';

  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssets = async () => {
    try {
      const res = await fetch(`/api/project/assets?project=${encodeURIComponent(sceneName)}`);
      if (res.ok) {
        const list = await res.json();
        setAssets(list);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
    const interval = setInterval(fetchAssets, 3000);
    return () => clearInterval(interval);
  }, [sceneName]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="asset-browser">
      <div className="asset-toolbar">
        <span className="asset-title">Meus Assets (GLTF)</span>
        <button className="panel-btn small" onClick={fetchAssets}>
          <RotateCw size={12} /> Refresh
        </button>
      </div>
      
      {loading ? (
        <div className="asset-empty">Carregando assets...</div>
      ) : (
        <>
          {/* Prefabs Section */}
          <div className="asset-toolbar" style={{ borderTop: '1px solid var(--border)', marginTop: '8px' }}>
            <span className="asset-title">Meus Prefabs</span>
          </div>
          {prefabs.length === 0 ? (
            <div className="asset-empty">Nenhum prefab salvo. Use o botão no Inspector.</div>
          ) : (
            <div className="asset-grid">
              {prefabs.map((prefab, i) => (
                <div 
                  key={i} 
                  className="asset-card"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'prefab', index: i }));
                  }}
                >
                  <div className="asset-icon">
                    <Blocks size={24} />
                  </div>
                  <div className="asset-info">
                    <span className="asset-name" title={prefab.name}>{prefab.name}</span>
                    <span className="asset-size">Prefab</span>
                  </div>
                  <div className="asset-actions">
                    <button 
                      className="asset-btn" 
                      onClick={() => instantiatePrefab(i)}
                      title="Adicionar à Cena"
                    >
                      <Plus size={13} /> Instanciar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* GLTF Section */}
          <div className="asset-toolbar" style={{ borderTop: '1px solid var(--border)' }}>
            <span className="asset-title">Meus Assets (GLTF)</span>
          </div>
          {assets.length === 0 ? (
            <div className="asset-empty">Nenhum asset importado. Use a Toolbar.</div>
          ) : (
            <div className="asset-grid">
              {assets.map((asset) => (
                <div 
                  key={asset.fileName} 
                  className="asset-card"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'gltf', fileName: asset.fileName }));
                  }}
                >
                  <div className="asset-icon">
                    <Layers size={24} />
                  </div>
                  <div className="asset-info">
                    <span className="asset-name" title={asset.fileName}>{asset.fileName}</span>
                    <span className="asset-size">{formatSize(asset.size)}</span>
                  </div>
                  <div className="asset-actions">
                    <button 
                      className="asset-btn" 
                      onClick={() => instantiateAsset(asset.fileName)}
                      title="Adicionar à Cena"
                    >
                      <Plus size={13} /> Instanciar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
