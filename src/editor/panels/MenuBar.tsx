import { useState, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '../store/editorStore';
import { 
  FolderOpen, Save, Play, Square, Wifi, Download,
  RotateCcw, RotateCw, Copy, Trash2, Eye, EyeOff, Monitor,
  Compass, Keyboard, Info, CheckCircle, Film, Plus, Files, Code
} from 'lucide-react';

const DEFAULT_SCRIPTS: Record<string, string> = {
  FPSController: `// Controle em 1a Pessoa com Gamepad
export let speed = 5;
export let jumpForce = 5.5;
export let crouchSpeed = 2.5;
export let jumpButton = "A";
export let crouchButton = "C";
export let sprintButton = "L3";

let eulerY = 0;
let eulerX = 0;
let isCrouching = false;

export function onUpdate(delta) {
  if (typeof window !== 'undefined' && window.isVRActive) return;

  if (Input.getMouseButton(0)) Input.lockMouse();
  if (Input.mouse.isLocked) {
    eulerY -= Input.mouse.movementX * 0.002;
    eulerX -= Input.mouse.movementY * 0.002;
  }

  // Eixos do Gamepad (Look Axis: X=2, Y=3)
  const lookX = Input.getGamepadAxis(2);
  const lookY = Input.getGamepadAxis(3);
  if (Math.abs(lookX) > 0.1) eulerY -= lookX * 0.03;
  if (Math.abs(lookY) > 0.1) eulerX -= lookY * 0.03;

  eulerX = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, eulerX));
  
  if (camera) {
    camera.rotation = [eulerX, 0, 0];
  }
  
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, eulerY, 0));
  if (rigidBody) {
    rigidBody.setRotation(q, true);
    
    const runPressed = Input.getKey('ShiftLeft') || Input.getGamepadButton(sprintButton);
    const currentSpeed = runPressed ? speed * 1.6 : (isCrouching ? crouchSpeed : speed);

    const crouchPressed = Input.getKey('ControlLeft') || Input.getKey('KeyC') || Input.getGamepadButton(crouchButton);
    
    if (crouchPressed && !isCrouching) {
      isCrouching = true;
      if (transform) {
        transform.scale = [1, 0.5, 1];
        transform.position[1] -= 0.5;
      }
    } else if (!crouchPressed && isCrouching) {
      isCrouching = false;
      if (transform) {
        transform.scale = [1, 1, 1];
        transform.position[1] += 0.5;
      }
    }

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const vel = new THREE.Vector3(0, rigidBody.linvel().y, 0);
    
    let moveForward = 0;
    let moveRight = 0;
    if (Input.getKey('KeyW')) moveForward += 1;
    if (Input.getKey('KeyS')) moveForward -= 1;
    if (Input.getKey('KeyA')) moveRight -= 1;
    if (Input.getKey('KeyD')) moveRight += 1;

    const stickX = Input.getGamepadAxis(0);
    const stickY = Input.getGamepadAxis(1);
    if (Math.abs(stickX) > 0.1) moveRight += stickX;
    if (Math.abs(stickY) > 0.1) moveForward -= stickY;

    const moveDir = new THREE.Vector3();
    if (moveForward !== 0 || moveRight !== 0) {
      moveDir.add(forward.clone().multiplyScalar(moveForward));
      moveDir.add(right.clone().multiplyScalar(moveRight));
      if (moveDir.lengthSq() > 1) moveDir.normalize();
      vel.add(moveDir.multiplyScalar(currentSpeed));
    }

    const jumpPressed = Input.getKey('Space') || Input.getGamepadButton(jumpButton);
    if (jumpPressed && Math.abs(rigidBody.linvel().y) < 0.05) {
      vel.y = jumpForce;
    }
    
    rigidBody.setLinvel(vel, true);
  }
}`,

  TPSController: `// Controle em 3a Pessoa (Orbital) com Gamepad
export let speed = 5;
export let jumpForce = 5.5;
export let crouchSpeed = 2.5;
export let jumpButton = "A";
export let crouchButton = "C";
export let sprintButton = "L3";

let angleX = 0;
let angleY = Math.PI / 6;
let radius = 5;
let isCrouching = false;

export function onUpdate(delta) {
  if (Input.getMouseButton(0)) Input.lockMouse();
  if (Input.mouse.isLocked) {
    angleX -= Input.mouse.movementX * 0.005;
    angleY -= Input.mouse.movementY * 0.005;
  }
  
  // Eixos do Gamepad (Look Axis: X=2, Y=3)
  const lookX = Input.getGamepadAxis(2);
  const lookY = Input.getGamepadAxis(3);
  if (Math.abs(lookX) > 0.1) angleX -= lookX * 0.03;
  if (Math.abs(lookY) > 0.1) angleY -= lookY * 0.03;

  angleY = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, angleY));
  
  if (camera) {
    camera.offset = [
      Math.sin(angleX) * Math.cos(angleY) * radius,
      Math.sin(angleY) * radius + 1,
      Math.cos(angleX) * Math.cos(angleY) * radius
    ];
    const lookAtPos = new THREE.Vector3(0, 1, 0);
    const camPos = new THREE.Vector3(camera.offset[0], camera.offset[1], camera.offset[2]);
    const m = new THREE.Matrix4().lookAt(camPos, lookAtPos, new THREE.Vector3(0,1,0));
    const e = new THREE.Euler().setFromRotationMatrix(m);
    camera.rotation = [e.x, e.y, e.z];
  }
  
  if (rigidBody) {
    const runPressed = Input.getKey('ShiftLeft') || Input.getGamepadButton(sprintButton);
    const currentSpeed = runPressed ? speed * 1.6 : (isCrouching ? crouchSpeed : speed);

    const crouchPressed = Input.getKey('ControlLeft') || Input.getKey('KeyC') || Input.getGamepadButton(crouchButton);
    
    if (crouchPressed && !isCrouching) {
      isCrouching = true;
      if (transform) {
        transform.scale = [1, 0.5, 1];
        transform.position[1] -= 0.5;
      }
    } else if (!crouchPressed && isCrouching) {
      isCrouching = false;
      if (transform) {
        transform.scale = [1, 1, 1];
        transform.position[1] += 0.5;
      }
    }

    const qCam = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angleX, 0));
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(qCam);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(qCam);
    const vel = new THREE.Vector3(0, rigidBody.linvel().y, 0);
    
    let isMoving = false;
    let moveForward = 0;
    let moveRight = 0;

    if (Input.getKey('KeyW')) moveForward += 1;
    if (Input.getKey('KeyS')) moveForward -= 1;
    if (Input.getKey('KeyA')) moveRight -= 1;
    if (Input.getKey('KeyD')) moveRight += 1;

    const stickX = Input.getGamepadAxis(0);
    const stickY = Input.getGamepadAxis(1);
    if (Math.abs(stickX) > 0.1) moveRight += stickX;
    if (Math.abs(stickY) > 0.1) moveForward -= stickY;

    const moveDir = new THREE.Vector3();
    if (moveForward !== 0 || moveRight !== 0) {
      isMoving = true;
      moveDir.add(forward.clone().multiplyScalar(moveForward));
      moveDir.add(right.clone().multiplyScalar(moveRight));
      if (moveDir.lengthSq() > 1) moveDir.normalize();
      vel.add(moveDir.multiplyScalar(currentSpeed));
    }

    const jumpPressed = Input.getKey('Space') || Input.getGamepadButton(jumpButton);
    if (jumpPressed && Math.abs(rigidBody.linvel().y) < 0.05) {
      vel.y = jumpForce;
    }
    
    rigidBody.setLinvel(vel, true);

    if (isMoving && transform) {
      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      transform.rotation = [0, targetAngle, 0];
    }
  }
}`,

  OrbitCamera: `// Câmera que orbita ao redor do alvo
export let targetEntityId = "";
export let radius = 8;
export let rotationSpeed = 0.5;

let angle = 0;

export function onUpdate(delta) {
  angle += rotationSpeed * delta;
  
  let targetPos = [0, 0, 0];
  if (targetEntityId) {
    const target = scene.entities[targetEntityId];
    if (target && target.components.Transform) {
      targetPos = target.components.Transform.position;
    }
  }

  if (transform) {
    transform.position = [
      targetPos[0] + Math.sin(angle) * radius,
      targetPos[1] + 3,
      targetPos[2] + Math.cos(angle) * radius
    ];
    
    if (camera) {
      const lookAtPos = new THREE.Vector3(targetPos[0], targetPos[1], targetPos[2]);
      const camPos = new THREE.Vector3(transform.position[0], transform.position[1], transform.position[2]);
      const m = new THREE.Matrix4().lookAt(camPos, lookAtPos, new THREE.Vector3(0, 1, 0));
      const e = new THREE.Euler().setFromRotationMatrix(m);
      camera.rotation = [e.x, e.y, e.z];
    }
  }
}`,

  RotateObject: `// Rotaciona o objeto nos eixos X, Y, Z continuamente
export let speedX = 0;
export let speedY = 1.0;
export let speedZ = 0;

export function onUpdate(delta) {
  if (transform) {
    transform.rotation[0] += speedX * delta;
    transform.rotation[1] += speedY * delta;
    transform.rotation[2] += speedZ * delta;
  }
}`,

  LightFlicker: `// Efeito de oscilação em luzes (fogo/vela)
export let minIntensity = 0.5;
export let maxIntensity = 2.0;
export let speed = 10.0;

let time = 0;

export function onUpdate(delta) {
  time += delta * speed;
  if (light) {
    const noise = Math.sin(time) * Math.cos(time * 0.7);
    const normalized = (noise + 1) / 2; // 0 to 1
    light.intensity = minIntensity + normalized * (maxIntensity - minIntensity);
  }
}`
};

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
    togglePlay,
    currentProjectName,
    activeSceneName,
    projectScenes,
    createNewScene,
    loadProjectScene,
    deleteProjectScene,
    duplicateProjectScene
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
    togglePlay: state.togglePlay,
    currentProjectName: state.currentProjectName,
    activeSceneName: state.activeSceneName,
    projectScenes: state.projectScenes,
    createNewScene: state.createNewScene,
    loadProjectScene: state.loadProjectScene,
    deleteProjectScene: state.deleteProjectScene,
    duplicateProjectScene: state.duplicateProjectScene
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

  const applyDefaultScript = (name: string, code: string) => {
    if (!selectedEntityId) {
      alert("Por favor, selecione uma entidade na Hierarquia para aplicar este script.");
      return;
    }
    const store = useEditorStore.getState();
    const entity = store.scenes[store.activeSceneId]?.entities[selectedEntityId];
    if (!entity) return;

    if (entity.components.Script) {
      if (confirm(`A entidade já possui um script "${entity.components.Script.scriptName}". Deseja substituí-lo pelo "${name}"?`)) {
        store.updateComponent(selectedEntityId, 'Script', { scriptName: name, code });
      }
    } else {
      store.addComponent(selectedEntityId, { type: 'Script', scriptName: name, code });
    }
    setBottomTab('script');
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

        {/* SCENE MENU */}
        {currentProjectName && (
          <div className={`menubar-item-wrapper ${activeMenu === 'scenes' ? 'open' : ''}`}>
            <button 
              className="menubar-btn" 
              onClick={(e) => toggleMenu('scenes', e)}
              onMouseEnter={() => handleMenuHover('scenes')}
            >
              Cenas ({activeSceneName})
            </button>
            {activeMenu === 'scenes' && (
              <div className="menubar-dropdown" style={{ minWidth: '200px' }}>
                <div className="dropdown-section-header" style={{ padding: '4px 12px', fontSize: '10px', opacity: 0.5, fontWeight: 'bold' }}>CARREGAR CENA</div>
                {projectScenes.map(sceneName => (
                  <button 
                    key={sceneName}
                    onClick={() => loadProjectScene(sceneName)} 
                    className={activeSceneName === sceneName ? 'checked' : ''}
                  >
                    <Film size={13} style={{ marginRight: '6px', color: activeSceneName === sceneName ? '#10b981' : 'inherit' }} />
                    <span style={{ fontWeight: activeSceneName === sceneName ? 'bold' : 'normal' }}>{sceneName}</span>
                    {activeSceneName === sceneName && <CheckCircle size={12} style={{ marginLeft: 'auto', color: '#10b981' }} />}
                  </button>
                ))}
                
                <div className="menu-divider" />
                <button onClick={() => {
                  const name = prompt('Digite o nome da nova cena:');
                  if (name) createNewScene(name);
                }}>
                  <Plus size={13} />
                  <span>Criar Nova Cena</span>
                </button>
                <button onClick={() => {
                  const name = prompt('Digite o nome para a cena duplicada:', `${activeSceneName} Copy`);
                  if (name) duplicateProjectScene(name);
                }}>
                  <Copy size={13} />
                  <span>Duplicar Cena Atual</span>
                </button>

                {projectScenes.filter(s => s !== 'Main Scene' && s !== activeSceneName).length > 0 && (
                  <>
                    <div className="menu-divider" />
                    <div className="dropdown-section-header" style={{ padding: '4px 12px', fontSize: '10px', opacity: 0.5, fontWeight: 'bold', color: '#ef4444' }}>EXCLUIR CENA</div>
                    {projectScenes.filter(s => s !== 'Main Scene' && s !== activeSceneName).map(sceneName => (
                      <button 
                        key={`delete-${sceneName}`}
                        onClick={() => {
                          if (confirm(`Tem certeza que deseja excluir a cena "${sceneName}" permanentemente do disco?`)) {
                            deleteProjectScene(sceneName);
                          }
                        }}
                        className="danger"
                      >
                        <Trash2 size={13} />
                        <span>{sceneName}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* SCRIPTS MENU */}
        <div className={`menubar-item-wrapper ${activeMenu === 'scripts' ? 'open' : ''}`}>
          <button 
            className="menubar-btn" 
            onClick={(e) => toggleMenu('scripts', e)}
            onMouseEnter={() => handleMenuHover('scripts')}
          >
            Scripts
          </button>
          {activeMenu === 'scripts' && (
            <div className="menubar-dropdown" style={{ minWidth: '220px' }}>
              <div className="dropdown-section-header" style={{ padding: '4px 12px', fontSize: '10px', opacity: 0.5, fontWeight: 'bold' }}>APLICAR SCRIPT PADRÃO</div>
              <button onClick={() => applyDefaultScript('FPSController', DEFAULT_SCRIPTS.FPSController)}>
                <Code size={13} style={{ marginRight: '6px', color: '#60a5fa' }} />
                <span>FPSController (1ª Pessoa)</span>
              </button>
              <button onClick={() => applyDefaultScript('TPSController', DEFAULT_SCRIPTS.TPSController)}>
                <Code size={13} style={{ marginRight: '6px', color: '#60a5fa' }} />
                <span>TPSController (3ª Pessoa)</span>
              </button>
              <button onClick={() => applyDefaultScript('OrbitCamera', DEFAULT_SCRIPTS.OrbitCamera)}>
                <Code size={13} style={{ marginRight: '6px', color: '#f59e0b' }} />
                <span>OrbitCamera (Câmera Orbital)</span>
              </button>
              <button onClick={() => applyDefaultScript('RotateObject', DEFAULT_SCRIPTS.RotateObject)}>
                <Code size={13} style={{ marginRight: '6px', color: '#10b981' }} />
                <span>RotateObject (Rotacionar)</span>
              </button>
              <button onClick={() => applyDefaultScript('LightFlicker', DEFAULT_SCRIPTS.LightFlicker)}>
                <Code size={13} style={{ marginRight: '6px', color: '#f43f5e' }} />
                <span>LightFlicker (Oscilar Luz)</span>
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
              <button onClick={() => setBottomTab('explorer')} className={bottomTab === 'explorer' ? 'checked' : ''}>
                <Files size={13} />
                <span>Painel: File Explorer</span>
                <span className="menu-shortcut">Alt + 4</span>
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
                    <td>Alternar Translação/Rotação/Redimensionamento</td>
                    <td><kbd>Tab</kbd></td>
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
