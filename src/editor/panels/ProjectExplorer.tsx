import { useEffect, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { 
  Folder, File, FolderPlus, FilePlus, Trash2, ArrowLeft, Edit, Save, X, RotateCw
} from 'lucide-react';
import Editor from '@monaco-editor/react';

interface ExplorerItem {
  name: string;
  isDir: boolean;
  path: string;
  size: number;
}

export function ProjectExplorer() {
  const activeSceneId = useEditorStore(s => s.activeSceneId);
  const activeScene = useEditorStore(s => s.scenes[activeSceneId]);
  const sceneName = activeScene?.name || 'default';

  const [currentSubpath, setCurrentSubpath] = useState('');
  const [items, setItems] = useState<ExplorerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Estados do Modal do Editor
  const [editingFile, setEditingFile] = useState<ExplorerItem | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [savingFile, setSavingFile] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/explorer/list?project=${encodeURIComponent(sceneName)}&subpath=${encodeURIComponent(currentSubpath)}`);
      if (res.ok) {
        const data = await res.json();
        // Ordena pastas primeiro, depois arquivos
        data.sort((a: ExplorerItem, b: ExplorerItem) => {
          if (a.isDir && !b.isDir) return -1;
          if (!a.isDir && b.isDir) return 1;
          return a.name.localeCompare(b.name);
        });
        setItems(data);
      } else {
        setError('Falha ao listar diretório');
      }
    } catch (err) {
      console.error(err);
      setError('Erro de conexão com o servidor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [sceneName, currentSubpath]);

  // Criar Pasta
  const handleCreateFolder = async () => {
    const folderName = prompt('Nome da nova pasta:');
    if (!folderName) return;

    try {
      const res = await fetch('/api/explorer/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: sceneName,
          subpath: currentSubpath,
          folderName
        })
      });
      if (res.ok) {
        fetchItems();
      } else {
        alert('Falha ao criar pasta');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao criar pasta');
    }
  };

  // Criar Arquivo
  const handleCreateFile = async () => {
    const fileName = prompt('Nome do novo arquivo (ex: script.js):');
    if (!fileName) return;

    try {
      const res = await fetch('/api/explorer/create-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: sceneName,
          subpath: currentSubpath,
          fileName,
          content: ''
        })
      });
      if (res.ok) {
        fetchItems();
      } else {
        alert('Falha ao criar arquivo');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao criar arquivo');
    }
  };

  // Excluir Item
  const handleDeleteItem = async (item: ExplorerItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Deseja realmente excluir "${item.name}"?`)) return;

    try {
      const res = await fetch('/api/explorer/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: sceneName,
          subpath: item.path
        })
      });
      if (res.ok) {
        fetchItems();
      } else {
        alert('Falha ao excluir item');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir item');
    }
  };

  // Abrir arquivo para edição
  const handleEditFile = async (item: ExplorerItem) => {
    try {
      const res = await fetch(`/api/explorer/read-file?project=${encodeURIComponent(sceneName)}&subpath=${encodeURIComponent(item.path)}`);
      if (res.ok) {
        const data = await res.json();
        setEditingFile(item);
        setFileContent(data.content || '');
      } else {
        alert('Não foi possível ler o arquivo');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao carregar arquivo');
    }
  };

  // Salvar arquivo editado
  const handleSaveFile = async () => {
    if (!editingFile) return;
    setSavingFile(true);
    try {
      const res = await fetch('/api/explorer/write-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: sceneName,
          subpath: editingFile.path,
          content: fileContent
        })
      });
      if (res.ok) {
        setEditingFile(null);
        fetchItems();
      } else {
        alert('Falha ao salvar arquivo');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar arquivo');
    } finally {
      setSavingFile(false);
    }
  };

  // Navegação
  const handleGoBack = () => {
    const parts = currentSubpath.split('/');
    parts.pop();
    setCurrentSubpath(parts.join('/'));
  };

  const getFileLanguage = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'js' || ext === 'jsx') return 'javascript';
    if (ext === 'ts' || ext === 'tsx') return 'typescript';
    if (ext === 'css') return 'css';
    if (ext === 'json') return 'json';
    if (ext === 'md') return 'markdown';
    if (ext === 'html') return 'html';
    return 'plaintext';
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="project-explorer" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px', boxSizing: 'border-box' }}>
      {/* Barra de Ferramentas */}
      <div className="explorer-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {currentSubpath && (
            <button className="panel-btn icon-only" onClick={handleGoBack} title="Voltar Diretório">
              <ArrowLeft size={14} />
            </button>
          )}
          <span className="explorer-path" style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
            {sceneName} {currentSubpath ? ` / ${currentSubpath}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="panel-btn small" onClick={handleCreateFolder}>
            <FolderPlus size={13} /> Nova Pasta
          </button>
          <button className="panel-btn small" onClick={handleCreateFile}>
            <FilePlus size={13} /> Novo Arquivo
          </button>
          <button className="panel-btn icon-only" onClick={fetchItems} title="Atualizar">
            <RotateCw size={13} />
          </button>
        </div>
      </div>

      {/* Listagem de Arquivos */}
      <div className="explorer-content" style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>Carregando diretório...</div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '24px', color: '#ff4d4d' }}>{error}</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>Diretório vazio. Crie arquivos ou pastas para começar.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '6px 8px' }}>Nome</th>
                <th style={{ padding: '6px 8px' }}>Tamanho</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr 
                  key={item.path} 
                  className="explorer-row"
                  onClick={() => item.isDir && setCurrentSubpath(item.path)}
                  style={{ 
                    borderBottom: '1px solid var(--border-light)', 
                    cursor: item.isDir ? 'pointer' : 'default',
                    transition: 'background 0.2s'
                  }}
                >
                  <td style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text)' }}>
                    {item.isDir ? (
                      <Folder size={15} style={{ color: '#ffb900' }} />
                    ) : (
                      <File size={15} style={{ color: '#999' }} />
                    )}
                    <span style={{ fontWeight: item.isDir ? 'bold' : 'normal' }}>{item.name}</span>
                  </td>
                  <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>
                    {item.isDir ? 'Pasta' : formatSize(item.size)}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                    {!item.isDir && (
                      <button 
                        className="panel-btn icon-only small" 
                        onClick={() => handleEditFile(item)} 
                        title="Editar Arquivo"
                        style={{ marginRight: '6px' }}
                      >
                        <Edit size={12} />
                      </button>
                    )}
                    <button 
                      className="panel-btn icon-only small danger" 
                      onClick={(e) => handleDeleteItem(item, e)} 
                      title="Excluir"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Premium do Editor de Código para Arquivos */}
      {editingFile && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '24px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            width: '90%',
            maxWidth: '1000px',
            height: '85%',
            backgroundColor: '#1a1a2e',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
          }}>
            {/* Cabeçalho do Modal */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: '#161626',
              borderBottom: '1px solid var(--border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <File size={16} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff', fontFamily: 'monospace' }}>
                  Editando: {editingFile.name}
                </span>
              </div>
              <button 
                className="panel-btn icon-only" 
                onClick={() => setEditingFile(null)}
                style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Editor Monaco */}
            <div style={{ flex: 1, backgroundColor: '#1e1e1e' }}>
              <Editor
                height="100%"
                language={getFileLanguage(editingFile.name)}
                theme="vs-dark"
                value={fileContent}
                onChange={(val) => setFileContent(val || '')}
                options={{
                  fontSize: 13,
                  fontFamily: 'Consolas, Courier New, monospace',
                  minimap: { enabled: false },
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  automaticLayout: true
                }}
              />
            </div>

            {/* Rodapé do Modal */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              padding: '12px 16px',
              backgroundColor: '#161626',
              borderTop: '1px solid var(--border)'
            }}>
              <button 
                className="panel-btn" 
                onClick={() => setEditingFile(null)}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                Cancelar
              </button>
              <button 
                className="panel-btn primary" 
                onClick={handleSaveFile}
                disabled={savingFile}
                style={{ padding: '6px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Save size={14} />
                {savingFile ? 'Salvando...' : 'Salvar Arquivo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
