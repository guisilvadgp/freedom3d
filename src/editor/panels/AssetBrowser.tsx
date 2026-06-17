import { useEffect, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { listAssets } from '../../engine/core/persistence';
import type { StoredAsset } from '../../engine/core/persistence';

export function AssetBrowser() {
  const { instantiateAsset } = useEditorStore();
  const [assets, setAssets] = useState<Omit<StoredAsset, 'buffer'>[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssets = async () => {
    try {
      const list = await listAssets();
      setAssets(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
    // Poll for updates (simple way to keep it fresh when importing)
    const interval = setInterval(fetchAssets, 3000);
    return () => clearInterval(interval);
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="asset-browser">
      <div className="asset-toolbar">
        <span className="asset-title">Meus Assets (GLTF)</span>
        <button className="panel-btn small" onClick={fetchAssets}>🔄 Refresh</button>
      </div>
      
      {loading ? (
        <div className="asset-empty">Carregando assets...</div>
      ) : assets.length === 0 ? (
        <div className="asset-empty">Nenhum asset importado. Use o botão na Toolbar para importar modelos GLTF.</div>
      ) : (
        <div className="asset-grid">
          {assets.map((asset) => (
            <div key={asset.fileName} className="asset-card">
              <div className="asset-icon">📦</div>
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
                  ➕ Instanciar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
