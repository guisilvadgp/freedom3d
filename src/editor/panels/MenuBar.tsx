import { useState, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '../store/editorStore';
import { 
  FolderOpen, Save, Play, Square, Wifi, Download,
  RotateCcw, RotateCw, Copy, Trash2, Eye, EyeOff, Monitor,
  Compass, Keyboard, Info, CheckCircle
} from 'lucide-react';

export function MenuBar() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);

  const {
    activeScene,
    saveCurrentScene,
    publishToPreview,
    undo,
    redo,
    historyPast,
    historyFuture,
    selectedEntityId,
    duplicateEntity,
    deleteEntity,
    selectEntity,
    showGrid,
    toggleGrid,
    showGizmos,
    toggleGizmos,
    bottomTab,
    setBottomTab,
    isPlaying,
    togglePlay
  } = useEditorStore(useShallow(state => ({
    activeScene: state.activeSceneId ? state.scenes[state.activeSceneId] : null,
    saveCurrentScene: state.saveCurrentScene,
    publishToPreview: state.publishToPreview,
    undo: state.undo,
    redo: state.redo,
    historyPast: state.historyPast,
    historyFuture: state.historyFuture,
    selectedEntityId: state.selectedEntityId,
    duplicateEntity: state.duplicateEntity,
    deleteEntity: state.deleteEntity,
    selectEntity: state.selectEntity,
    showGrid: state.showGrid,
    toggleGrid: state.toggleGrid,
    showGizmos: state.showGizmos,
    toggleGizmos: state.toggleGizmos,
    bottomTab: state.bottomTab,
    setBottomTab: state.setBottomTab,
    isPlaying: state.isPlaying,
    togglePlay: state.togglePlay
  })));

  // Fecha o menu se clicar fora
  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveMenu(null);
    };
    if (activeMenu) {
      window.addEventListener('click', handleGlobalClick);
    }
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [activeMenu]);

  const toggleMenu = (menuName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };

  const handleMenuHover = (menuName: string) => {
    if (activeMenu !== null) {
      setActiveMenu(menuName);
    }
  };

  const selectMainCameraOrPlayer = (type: 'camera' | 'player') => {
    if (!activeScene) return;
    const found = Object.values(activeScene.entities).find(e => {
      if (type === 'camera') return e.components.Camera !== undefined;
      return e.tags?.includes('player') || e.components.Camera?.isMain;
    });
    if (found) {
      selectEntity(found.id);
    }
  };

  const handleExportProject = () => {
    if (!activeScene) return;
    const url = `/api/project/export?project=${encodeURIComponent(activeScene.name)}`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activeScene.name}_export.zip`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="native-menubar">
      <div className="menubar-items">
        {/* FILE MENU */}
        <div className={`menubar-item-wrapper ${activeMenu === 'file' ? 'open' : ''}`}>
          <button 
            className="menubar-btn" 
            onClick={(e) => toggleMenu('file', e)}
            onMouseEnter={() => handleMenuHover('file')}
          >
            Arquivo
          </button>
          {activeMenu === 'file' && (
            <div className="menubar-dropdown">
              <button onClick={() => useEditorStore.setState({ activeSceneId: '' })}>
                <FolderOpen size={13} />
                <span>Abrir Hub de Projetos</span>
                <span className="menu-shortcut">Alt + H</span>
              </button>
              <div className="menu-divider" />
              <button onClick={saveCurrentScene}>
                <Save size={13} />
                <span>Salvar Projeto</span>
                <span className="menu-shortcut">Ctrl + S</span>
              </button>
              <button onClick={publishToPreview}>
                <Wifi size={13} />
                <span>Publicar para Mobile Preview</span>
                <span className="menu-shortcut">Ctrl + P</span>
              </button>
              <button onClick={handleExportProject}>
                <Download size={13} />
                <span>Exportar Projeto (.ZIP)</span>
              </button>
              <div className="menu-divider" />
              <button onClick={() => window.close()}>
                <span>Sair</span>
              </button>
            </div>
          )}
        </div>

        {/* EDIT MENU */}
        <div className={`menubar-item-wrapper ${activeMenu === 'edit' ? 'open' : ''}`}>
          <button 
            className="menubar-btn" 
            onClick={(e) => toggleMenu('edit', e)}
            onMouseEnter={() => handleMenuHover('edit')}
          >
            Editar
          </button>
          {activeMenu === 'edit' && (
            <div className="menubar-dropdown">
              <button onClick={undo} disabled={historyPast.length === 0}>
                <RotateCcw size={13} />
                <span>Desfazer</span>
                <span className="menu-shortcut">Ctrl + Z</span>
              </button>
              <button onClick={redo} disabled={historyFuture.length === 0}>
                <RotateCw size={13} />
                <span>Refazer</span>
                <span className="menu-shortcut">Ctrl + Y</span>
              </button>
              <div className="menu-divider" />
              <button 
                onClick={() => selectedEntityId && duplicateEntity(selectedEntityId)} 
                disabled={!selectedEntityId}
              >
                <Copy size={13} />
                <span>Duplicar Selecionado</span>
                <span className="menu-shortcut">Ctrl + D</span>
              </button>
              <button 
                onClick={() => selectedEntityId && deleteEntity(selectedEntityId)} 
                disabled={!selectedEntityId}
                className="danger"
              >
                <Trash2 size={13} />
                <span>Excluir Selecionado</span>
                <span className="menu-shortcut">Delete</span>
              </button>
            </div>
          )}
        </div>

        {/* SELECTION MENU */}
        <div className={`menubar-item-wrapper ${activeMenu === 'selection' ? 'open' : ''}`}>
          <button 
            className="menubar-btn" 
            onClick={(e) => toggleMenu('selection', e)}
            onMouseEnter={() => handleMenuHover('selection')}
          >
            Seleção
          </button>
          {activeMenu === 'selection' && (
            <div className="menubar-dropdown">
              <button onClick={() => selectMainCameraOrPlayer('player')}>
                <Compass size={13} />
                <span>Selecionar Jogador (Player)</span>
              </button>
              <button onClick={() => selectMainCameraOrPlayer('camera')}>
                <Eye size={13} />
                <span>Selecionar Câmera Principal</span>
              </button>
              <div className="menu-divider" />
              <button onClick={() => selectEntity(null)} disabled={!selectedEntityId}>
                <span>Limpar Seleção</span>
              </button>
            </div>
          )}
        </div>

        {/* VIEW MENU */}
        <div className={`menubar-item-wrapper ${activeMenu === 'view' ? 'open' : ''}`}>
          <button 
            className="menubar-btn" 
            onClick={(e) => toggleMenu('view', e)}
            onMouseEnter={() => handleMenuHover('view')}
          >
            Visualização
          </button>
          {activeMenu === 'view' && (
            <div className="menubar-dropdown">
              <button onClick={() => setBottomTab('console')} className={bottomTab === 'console' ? 'checked' : ''}>
                <Monitor size={13} />
                <span>Painel: Console</span>
                <span className="menu-shortcut">Alt + 1</span>
              </button>
              <button onClick={() => setBottomTab('assets')} className={bottomTab === 'assets' ? 'checked' : ''}>
                <FolderOpen size={13} />
                <span>Painel: Assets Browser</span>
                <span className="menu-shortcut">Alt + 2</span>
              </button>
              <button onClick={() => setBottomTab('script')} className={bottomTab === 'script' ? 'checked' : ''}>
                <CheckCircle size={13} />
                <span>Painel: Editor de Script</span>
                <span className="menu-shortcut">Alt + 3</span>
              </button>
              <div className="menu-divider" />
              <button onClick={toggleGrid}>
                {showGrid ? <Eye size={13} /> : <EyeOff size={13} />}
                <span>{showGrid ? 'Ocultar Grid' : 'Mostrar Grid'}</span>
                <span className="menu-shortcut">G</span>
              </button>
              <button onClick={toggleGizmos}>
                {showGizmos ? <Eye size={13} /> : <EyeOff size={13} />}
                <span>{showGizmos ? 'Ocultar Gizmos / Física' : 'Mostrar Gizmos / Física'}</span>
                <span className="menu-shortcut">H</span>
              </button>
            </div>
          )}
        </div>

        {/* RUN MENU */}
        <div className={`menubar-item-wrapper ${activeMenu === 'run' ? 'open' : ''}`}>
          <button 
            className="menubar-btn" 
            onClick={(e) => toggleMenu('run', e)}
            onMouseEnter={() => handleMenuHover('run')}
          >
            Executar
          </button>
          {activeMenu === 'run' && (
            <div className="menubar-dropdown">
              <button onClick={togglePlay}>
                {isPlaying ? <Square size={13} /> : <Play size={13} />}
                <span>{isPlaying ? 'Parar Simulação (Stop)' : 'Iniciar Simulação (Play)'}</span>
                <span className="menu-shortcut">Espaço</span>
              </button>
              <button onClick={() => window.open('/preview', '_blank')}>
                <Monitor size={13} />
                <span>Abrir Preview em Nova Aba</span>
              </button>
            </div>
          )}
        </div>

        {/* HELP MENU */}
        <div className={`menubar-item-wrapper ${activeMenu === 'help' ? 'open' : ''}`}>
          <button 
            className="menubar-btn" 
            onClick={(e) => toggleMenu('help', e)}
            onMouseEnter={() => handleMenuHover('help')}
          >
            Ajuda
          </button>
          {activeMenu === 'help' && (
            <div className="menubar-dropdown">
              <button onClick={() => setShowShortcutsModal(true)}>
                <Keyboard size={13} />
                <span>Atalhos de Teclado</span>
              </button>
              <button onClick={() => setShowAboutModal(true)}>
                <Info size={13} />
                <span>Sobre o Orion Engine</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SHORTCUTS MODAL */}
      {showShortcutsModal && (
        <div className="menu-modal-overlay" onClick={() => setShowShortcutsModal(false)}>
          <div className="menu-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="menu-modal-header">
              <h2><Keyboard size={18} /> Atalhos de Teclado</h2>
              <button className="close-btn" onClick={() => setShowShortcutsModal(false)}>&times;</button>
            </div>
            <div className="menu-modal-body">
              <table className="shortcuts-table">
                <thead>
                  <tr>
                    <th>Ação</th>
                    <th>Atalho</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Salvar Projeto</td>
                    <td><kbd>Ctrl</kbd> + <kbd>S</kbd></td>
                  </tr>
                  <tr>
                    <td>Publicar para Mobile Preview</td>
                    <td><kbd>Ctrl</kbd> + <kbd>P</kbd></td>
                  </tr>
                  <tr>
                    <td>Desfazer (Undo)</td>
                    <td><kbd>Ctrl</kbd> + <kbd>Z</kbd></td>
                  </tr>
                  <tr>
                    <td>Refazer (Redo)</td>
                    <td><kbd>Ctrl</kbd> + <kbd>Y</kbd></td>
                  </tr>
                  <tr>
                    <td>Duplicar Entidade Selecionada</td>
                    <td><kbd>Ctrl</kbd> + <kbd>D</kbd></td>
                  </tr>
                  <tr>
                    <td>Deletar Entidade Selecionada</td>
                    <td><kbd>Delete</kbd> ou <kbd>Backspace</kbd></td>
                  </tr>
                  <tr>
                    <td>Alternar Grid</td>
                    <td><kbd>G</kbd></td>
                  </tr>
                  <tr>
                    <td>Alternar Gizmos / Física</td>
                    <td><kbd>H</kbd></td>
                  </tr>
                  <tr>
                    <td>Ferramenta de Seleção</td>
                    <td><kbd>Q</kbd></td>
                  </tr>
                  <tr>
                    <td>Ferramenta de Translação (Translate)</td>
                    <td><kbd>W</kbd></td>
                  </tr>
                  <tr>
                    <td>Ferramenta de Rotação (Rotate)</td>
                    <td><kbd>E</kbd></td>
                  </tr>
                  <tr>
                    <td>Ferramenta de Redimensionamento (Scale)</td>
                    <td><kbd>R</kbd></td>
                  </tr>
                  <tr>
                    <td>Focar Console</td>
                    <td><kbd>Alt</kbd> + <kbd>1</kbd></td>
                  </tr>
                  <tr>
                    <td>Focar Assets Browser</td>
                    <td><kbd>Alt</kbd> + <kbd>2</kbd></td>
                  </tr>
                  <tr>
                    <td>Focar Editor de Scripts</td>
                    <td><kbd>Alt</kbd> + <kbd>3</kbd></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABOUT MODAL */}
      {showAboutModal && (
        <div className="menu-modal-overlay" onClick={() => setShowAboutModal(false)}>
          <div className="menu-modal-content about" onClick={(e) => e.stopPropagation()}>
            <div className="menu-modal-header">
              <h2><Info size={18} /> Sobre o Orion Engine</h2>
              <button className="close-btn" onClick={() => setShowAboutModal(false)}>&times;</button>
            </div>
            <div className="menu-modal-body" style={{ textAlign: 'center', padding: '20px 10px' }}>
              <h1 style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: '36px', fontWeight: 800, margin: '0 0 10px 0', fontFamily: 'Outfit, sans-serif' }}>Orion Engine</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 20px 0' }}>Versão 0.1.0 (Fase 3 - Produção)</p>
              
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '15px', textAlign: 'left', fontSize: '13px', lineHeight: '1.6', marginBottom: '20px' }}>
                Orion Engine é um motor de jogo web 3D de alta performance, construído com React Three Fiber, Rapier Physics, WebXR imersivo e replicação em tempo real por WebSockets.
              </div>
              
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>© 2026 Orion Engine Contributors. Distribuído sob a Licença MIT.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
