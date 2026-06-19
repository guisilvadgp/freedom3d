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

  // Estados do Modal do Editor de Arquivos
  const [editingFile, setEditingFile] = useState<ExplorerItem | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [savingFile, setSavingFile] = useState(false);

  // Estados dos Modais de Criação e Confirmação de Exclusão (Substitutos de prompt/confirm)
  const [createModal, setCreateModal] = useState<{ type: 'folder' | 'file'; value: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<ExplorerItem | null>(null);

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

  // Abre modal para criar pasta
  const handleCreateFolderClick = () => {
    setCreateModal({ type: 'folder', value: '' });
  };

  // Abre modal para criar arquivo
  const handleCreateFileClick = () => {
    setCreateModal({ type: 'file', value: '' });
  };

  // Confirma a criação de pasta ou arquivo
  const submitCreate = async () => {
    if (!createModal || !createModal.value.trim()) return;
    const { type, value } = createModal;

    try {
      const endpoint = type === 'folder' ? '/api/explorer/create-folder' : '/api/explorer/create-file';
      const body: any = {
        project: sceneName,
        subpath: currentSubpath
      };

      if (type === 'folder') {
        body.folderName = value.trim();
      } else {
        body.fileName = value.trim();
        body.content = '';
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        setCreateModal(null);
        fetchItems();
      } else {
        alert(type === 'folder' ? 'Falha ao criar pasta' : 'Falha ao criar arquivo');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao realizar operação');
    }
  };

  // Abre modal para confirmar exclusão
  const handleDeleteClick = (item: ExplorerItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteModal(item);
  };

  // Confirma exclusão
  const submitDelete = async () => {
    if (!deleteModal) return;

    try {
      const res = await fetch('/api/explorer/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: sceneName,
          subpath: deleteModal.path
        })
      });
      if (res.ok) {
        setDeleteModal(null);
        fetchItems();
      } else {
        alert('Falha ao excluir item');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir item');
    }
  };

  // Drag and Drop de arquivos locais para o Explorer
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    setLoading(true);
    try {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        const buffer = await file.arrayBuffer();
        const uploadUrl = `/api/explorer/upload-file?project=${encodeURIComponent(sceneName)}&subpath=${encodeURIComponent(currentSubpath)}&file=${encodeURIComponent(file.name)}`;
        const res = await fetch(uploadUrl, {
          method: 'POST',
          body: buffer,
          headers: { 'Content-Type': 'application/octet-stream' }
        });
        if (!res.ok) {
          alert(`Falha ao carregar o arquivo: ${file.name}`);
        }
      }
      fetchItems();
    } catch (err) {
      console.error(err);
      alert('Erro no upload do arquivo');
    } finally {
      setLoading(false);
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
    <div 
      className="project-explorer" 
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px', boxSizing: 'border-box' }}
    >
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
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic', marginLeft: '8px' }}>(Arraste arquivos aqui para importar)</span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="panel-btn small" onClick={handleCreateFolderClick}>
            <FolderPlus size={13} /> Nova Pasta
          </button>
          <button className="panel-btn small" onClick={handleCreateFileClick}>
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
                      onClick={(e) => handleDeleteClick(item, e)} 
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

      {/* MODAL REACT: Criar Pasta ou Arquivo */}
      {createModal && (
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
          zIndex: 10000,
          padding: '16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '400px',
            backgroundColor: '#1a1a2e',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: '#161626',
              borderBottom: '1px solid var(--border)'
            }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>
                {createModal.type === 'folder' ? 'Criar Nova Pasta' : 'Criar Novo Arquivo'}
              </span>
              <button 
                onClick={() => setCreateModal(null)}
                style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input 
                type="text" 
                placeholder={createModal.type === 'folder' ? 'Nome da pasta' : 'ex: script.js'}
                value={createModal.value}
                onChange={(e) => setCreateModal({ ...createModal, value: e.target.value })}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitCreate();
                  if (e.key === 'Escape') setCreateModal(null);
                }}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#111122',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '12px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              padding: '12px 16px',
              backgroundColor: '#161626',
              borderTop: '1px solid var(--border)'
            }}>
              <button className="panel-btn" onClick={() => setCreateModal(null)} style={{ fontSize: '11px', padding: '5px 10px' }}>
                Cancelar
              </button>
              <button className="panel-btn primary" onClick={submitCreate} style={{ fontSize: '11px', padding: '5px 12px' }}>
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REACT: Confirmar Exclusão */}
      {deleteModal && (
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
          zIndex: 10000,
          padding: '16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '400px',
            backgroundColor: '#1a1a2e',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: '#161626',
              borderBottom: '1px solid var(--border)'
            }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>
                Confirmar Exclusão
              </span>
              <button 
                onClick={() => setDeleteModal(null)}
                style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: '16px', color: '#fff', fontSize: '12px' }}>
              Tem certeza que deseja excluir permanentemente o item <strong style={{ color: 'var(--accent)' }}>"{deleteModal.name}"</strong>?
              {deleteModal.isDir && <div style={{ color: '#ff4d4d', marginTop: '6px', fontSize: '11px' }}>Aviso: Isso excluirá recursivamente todo o conteúdo desta pasta!</div>}
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              padding: '12px 16px',
              backgroundColor: '#161626',
              borderTop: '1px solid var(--border)'
            }}>
              <button className="panel-btn" onClick={() => setDeleteModal(null)} style={{ fontSize: '11px', padding: '5px 10px' }}>
                Cancelar
              </button>
              <button className="panel-btn primary danger" onClick={submitDelete} style={{ fontSize: '11px', padding: '5px 12px', backgroundColor: '#d9534f', borderColor: '#d43f3a' }}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

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
