import { useState, useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { 
  Sparkles, 
  Send, 
  Loader2, 
  Settings, 
  HelpCircle, 
  Rocket, 
  Target, 
  Layers, 
  Coins,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface LogMessage {
  id: string;
  type: 'info' | 'success' | 'warn' | 'error';
  text: string;
}

export function AIAssistantPanel() {
  const { activeScene, saveCurrentScene, addLog, showToast, activeSceneId } = useEditorStore();
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('pollinations_api_key') || '');
  const [models, setModels] = useState<{ id: string }[]>([]);
  const [selectedModel, setSelectedModel] = useState('openai');
  const [loadingModels, setLoadingModels] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const fetchModels = async (key: string) => {
    setLoadingModels(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (key) {
        headers['Authorization'] = `Bearer ${key}`;
      }
      const response = await fetch('https://gen.pollinations.ai/v1/models', {
        headers
      });
      if (response.ok) {
        const json = await response.json();
        const chatModels = (json.data || []).filter((m: any) => {
          const id = m.id.toLowerCase();
          return !id.includes('flux') && !id.includes('diffusion') && !id.includes('dall-e') && !id.includes('midjourney') && !id.includes('audio') && !id.includes('tts') && !id.includes('whisper');
        });
        
        if (chatModels.length === 0) {
          setModels([{ id: 'openai' }, { id: 'mistral' }, { id: 'qwen' }]);
        } else {
          setModels(chatModels);
        }
        
        if (chatModels.length > 0 && !chatModels.some((m: any) => m.id === selectedModel)) {
          setSelectedModel(chatModels[0].id);
        }
      } else {
        setModels([{ id: 'openai' }, { id: 'mistral' }, { id: 'qwen' }]);
      }
    } catch (err) {
      console.error('Erro ao buscar modelos:', err);
      setModels([{ id: 'openai' }, { id: 'mistral' }, { id: 'qwen' }]);
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    fetchModels(apiKey);
  }, [apiKey]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLocalLog = (type: LogMessage['type'], text: string) => {
    setLogs((prev) => [...prev, { id: uuidv4(), type, text }]);
  };

  const handleSaveApiKey = (key: string) => {
    localStorage.setItem('pollinations_api_key', key.trim());
    setApiKey(key.trim());
    showToast('Chave de API da Pollinations salva!');
    setShowSettings(false);
  };


  // Lógica offline para os templates internos
  const generateOfflineTemplate = async (templateType: 'race' | 'fps' | 'platform' | 'coins') => {
    setIsLoading(true);
    setLogs([]);
    addLocalLog('info', '🤖 Iniciando gerador local offline...');
    
    const scene = activeScene();
    if (!scene) {
      addLocalLog('error', 'Nenhuma cena ativa para modificar.');
      setIsLoading(false);
      return;
    }

    try {
      await new Promise(r => setTimeout(r, 400));
      addLocalLog('info', '⚙️ Limpando entidades antigas da cena...');
      
      const newEntities: Record<string, any> = {};
      const rootEntityIds: string[] = [];

      if (templateType === 'race') {
        addLocalLog('info', '🚀 Construindo Jogo de Corrida de Nave 3D...');
        await new Promise(r => setTimeout(r, 600));

        // 1. Luz Direcional
        const lightId = uuidv4();
        newEntities[lightId] = {
          id: lightId,
          name: 'Directional Light',
          parentId: null,
          childrenIds: [],
          active: true,
          tags: [],
          components: {
            Transform: { type: 'Transform', position: [10, 30, 10], rotation: [0, 0, 0], scale: [1, 1, 1] },
            Light: { type: 'Light', lightType: 'directional', color: '#ffffff', intensity: 1.5, castShadow: true }
          }
        };
        rootEntityIds.push(lightId);
        addLocalLog('success', '✔️ Luz direcional adicionada.');

        // 2. Runway / Pista
        const runwayId = uuidv4();
        newEntities[runwayId] = {
          id: runwayId,
          name: 'Pista Principal',
          parentId: null,
          childrenIds: [],
          active: true,
          tags: ['runway'],
          components: {
            Transform: { type: 'Transform', position: [0, 0, -100], rotation: [-90, 0, 0], scale: [25, 300, 1] },
            MeshRenderer: { type: 'MeshRenderer', geometry: 'plane', material: 'standard', color: '#090912', castShadow: false, receiveShadow: true },
            RigidBody: { type: 'RigidBody', mass: 0, isStatic: true, useGravity: false, collider: 'cuboid' }
          }
        };
        rootEntityIds.push(runwayId);
        addLocalLog('success', '✔️ Pista de corrida (300 metros) construída.');

        // 3. Obstáculos (Asteroides)
        addLocalLog('info', '☄️ Espalhando asteroides físicos pela pista...');
        const obstaclePositions = [
          [5, 4, -40], [-6, 6, -80], [8, 3, -120], [-4, 5, -160], [0, 8, -200],
          [6, 3, -240], [-7, 5, -280]
        ];
        obstaclePositions.forEach((pos, idx) => {
          const obsId = `asteroid-${idx}`;
          const size = 3 + Math.random() * 4;
          newEntities[obsId] = {
            id: obsId,
            name: `Asteroide ${idx + 1}`,
            parentId: null,
            childrenIds: [],
            active: true,
            tags: ['obstacle'],
            components: {
              Transform: { type: 'Transform', position: pos, rotation: [Math.random() * 45, Math.random() * 45, 0], scale: [size, size, size] },
              MeshRenderer: { type: 'MeshRenderer', geometry: Math.random() > 0.5 ? 'sphere' : 'box', material: 'standard', color: '#4a4b54', castShadow: true, receiveShadow: true },
              RigidBody: { type: 'RigidBody', mass: 0, isStatic: true, useGravity: false, collider: 'cuboid' }
            }
          };
          rootEntityIds.push(obsId);
        });

        // 4. Anéis de Aceleração (Boost Rings)
        addLocalLog('info', '⭕ Posicionando portais de velocidade...');
        const ringPositions = [
          [0, 4, -60], [0, 5, -140], [0, 4, -220]
        ];
        ringPositions.forEach((pos, idx) => {
          const ringId = `boost-ring-${idx}`;
          newEntities[ringId] = {
            id: ringId,
            name: `Portal de Boost ${idx + 1}`,
            parentId: null,
            childrenIds: [],
            active: true,
            tags: ['boost-ring'],
            components: {
              Transform: { type: 'Transform', position: pos, rotation: [0, 0, 0], scale: [4, 4, 1] },
              MeshRenderer: { type: 'MeshRenderer', geometry: 'torus', material: 'emissive', color: '#00ffff', castShadow: false, receiveShadow: false, emissiveIntensity: 2 },
              Script: {
                type: 'Script',
                scriptName: 'BoostRingBehavior',
                code: `// Comportamento do Portal de Boost
export let boostPower = 80;
let triggered = false;

export function onUpdate(delta) {
  if (triggered) return;
  const player = engine.find("NaveJogador");
  if (!player) return;
  
  const pPos = engine.getPosition(player.id);
  const myPos = getEntityPosition(entity.id);
  if (!pPos || !myPos) return;
  
  // Calcula distância tridimensional
  const dist = Math.hypot(pPos[0] - myPos[0], pPos[1] - myPos[1], pPos[2] - myPos[2]);
  if (dist < 4) {
    triggered = true;
    updateComponent(entity.id, 'MeshRenderer', { color: '#ff00ff' });
    
    // Procura o script do jogador e injeta velocidade temporária
    const playerRb = player.components.RigidBody;
    if (playerRb) {
      updateComponent(player.id, 'Script', {
        code: player.components.Script.code.replace('let boostMultiplier = 2.5;', 'let boostMultiplier = 5.0; // SUPER BOOST ACTIVATED!')
      });
      setTimeout(() => {
        updateComponent(player.id, 'Script', {
          code: player.components.Script.code.replace('let boostMultiplier = 5.0; // SUPER BOOST ACTIVATED!', 'let boostMultiplier = 2.5;')
        });
      }, 1500);
    }
  }
}`
              }
            }
          };
          rootEntityIds.push(ringId);
        });

        // 5. Linha de Chegada (Finish Line)
        const finishId = uuidv4();
        newEntities[finishId] = {
          id: finishId,
          name: 'Linha de Chegada',
          parentId: null,
          childrenIds: [],
          active: true,
          tags: ['finish'],
          components: {
            Transform: { type: 'Transform', position: [0, 4, -290], rotation: [0, 0, 0], scale: [20, 8, 1] },
            MeshRenderer: { type: 'MeshRenderer', geometry: 'plane', material: 'emissive', color: '#ff0055', castShadow: false, receiveShadow: false, emissiveIntensity: 1.5 },
            Script: {
              type: 'Script',
              scriptName: 'FinishLineBehavior',
              code: `// Checa se cruzou a linha de chegada
let won = false;

export function onUpdate(delta) {
  if (won) return;
  const player = engine.find("NaveJogador");
  if (!player) return;
  
  const pPos = engine.getPosition(player.id);
  if (pPos && pPos[2] <= -288) {
    won = true;
    updateComponent(entity.id, 'MeshRenderer', { color: '#00ff33' });
    console.log("🏁 PARABÉNS! VOCÊ COMPLETOU A CORRIDA!");
  }
}`
            }
          }
        };
        rootEntityIds.push(finishId);

        // 6. Nave Jogador
        const playerId = uuidv4();
        newEntities[playerId] = {
          id: playerId,
          name: 'NaveJogador',
          parentId: null,
          childrenIds: [],
          active: true,
          tags: ['player'],
          components: {
            Transform: { type: 'Transform', position: [0, 2, 10], rotation: [0, 180, 0], scale: [1.2, 0.6, 2] },
            MeshRenderer: { type: 'MeshRenderer', geometry: 'cone', material: 'standard', color: '#00e5ff', castShadow: true, receiveShadow: true },
            RigidBody: { type: 'RigidBody', mass: 1, isStatic: false, useGravity: false, collider: 'cuboid' },
            Script: {
              type: 'Script',
              scriptName: 'NaveController',
              code: `// Controle de Voo da Nave
export let speed = 35;
export let boostMultiplier = 2.5;
export let turnSpeed = 4;
export let pitchSpeed = 2;

let curVelocity = new THREE.Vector3();
let lastCamPos = null;

export function onUpdate(delta) {
  if (!entity.components.Transform) return;
  
  const pos = getEntityPosition(entity.id) || [0, 2, 10];
  const rot = entity.components.Transform.rotation;
  
  // Aceleração
  let accelZ = 0;
  let accelX = 0;
  let accelY = 0;
  
  if (Input.getKey("KeyW") || Input.getKey("ArrowUp")) accelZ -= 1; // Frente
  if (Input.getKey("KeyS") || Input.getKey("ArrowDown")) accelZ += 1; // Trás
  if (Input.getKey("KeyA") || Input.getKey("ArrowLeft")) accelX -= 1; // Esquerda
  if (Input.getKey("KeyD") || Input.getKey("ArrowRight")) accelX += 1; // Direita
  if (Input.getKey("Space")) accelY += 0.8; // Subir
  if (Input.getKey("ShiftLeft")) accelY -= 0.8; // Descer

  const isBoost = Input.getKey("ControlLeft");
  const finalSpeed = isBoost ? speed * boostMultiplier : speed;

  // Atualiza posição manualmente via updateComponent para suavidade
  const moveVec = new THREE.Vector3(accelX, accelY, accelZ).multiplyScalar(finalSpeed * delta);
  
  // Limita nave nas bordas da pista
  let newX = Math.max(-12, Math.min(12, pos[0] + moveVec.x));
  let newY = Math.max(1, Math.min(15, pos[1] + moveVec.y));
  let newZ = pos[2] + moveVec.z;

  updateComponent(entity.id, 'Transform', {
    position: [newX, newY, newZ],
    rotation: [0, 180, accelX * -15] // Inclinação lateral na curva
  });

  // Atualiza Câmera de Perseguição
  const mainCam = engine.find("Main Camera");
  if (mainCam) {
    const targetCamPos = new THREE.Vector3(newX, newY + 2.5, newZ + 9);
    let camPos;
    if (lastCamPos) {
      camPos = lastCamPos.clone().lerp(targetCamPos, delta * 8);
    } else {
      camPos = targetCamPos;
    }
    lastCamPos = camPos.clone();
    
    engine.updateComponent(mainCam.id, 'Transform', {
      position: [camPos.x, camPos.y, camPos.z],
      rotation: [-10, 180, 0]
    });
  }
}`
            }
          }
        };
        rootEntityIds.push(playerId);
        addLocalLog('success', '✔️ Nave do jogador ("NaveJogador") criada.');

        // 7. Câmera Principal
        const camId = uuidv4();
        newEntities[camId] = {
          id: camId,
          name: 'Main Camera',
          parentId: null,
          childrenIds: [],
          active: true,
          tags: [],
          components: {
            Transform: { type: 'Transform', position: [0, 4, 19], rotation: [-10, 180, 0], scale: [1, 1, 1] },
            Camera: { type: 'Camera', fov: 65, near: 0.1, far: 1000, isMain: true, offset: [0, 0, 0] }
          }
        };
        rootEntityIds.push(camId);
        addLocalLog('success', '✔️ Câmera de perseguição configurada.');
      } 
      else if (templateType === 'fps') {
        addLocalLog('info', '🔫 Construindo Arena de Tiro FPS...');
        await new Promise(r => setTimeout(r, 600));

        // 1. Direcional
        const lightId = uuidv4();
        newEntities[lightId] = {
          id: lightId,
          name: 'Directional Light',
          parentId: null,
          childrenIds: [],
          active: true,
          components: {
            Transform: { type: 'Transform', position: [10, 20, 10], rotation: [0, 0, 0], scale: [1, 1, 1] },
            Light: { type: 'Light', lightType: 'directional', color: '#ffffff', intensity: 1.2, castShadow: true }
          }
        };
        rootEntityIds.push(lightId);

        // 2. Chão
        const groundId = uuidv4();
        newEntities[groundId] = {
          id: groundId,
          name: 'Chao',
          parentId: null,
          childrenIds: [],
          active: true,
          components: {
            Transform: { type: 'Transform', position: [0, 0, 0], rotation: [-90, 0, 0], scale: [80, 80, 1] },
            MeshRenderer: { type: 'MeshRenderer', geometry: 'plane', material: 'standard', color: '#1e2022', castShadow: false, receiveShadow: true },
            RigidBody: { type: 'RigidBody', mass: 0, isStatic: true, useGravity: false, collider: 'cuboid' }
          }
        };
        rootEntityIds.push(groundId);
        addLocalLog('success', '✔️ Chão de concreto 80x80 adicionado.');

        // 3. Paredes (Limites da Arena)
        addLocalLog('info', '🧱 Ergendo barreiras e obstáculos...');
        const walls = [
          { p: [0, 4, -40], s: [80, 8, 2] },
          { p: [0, 4, 40], s: [80, 8, 2] },
          { p: [-40, 4, 0], s: [2, 8, 80] },
          { p: [40, 4, 0], s: [2, 8, 80] }
        ];
        walls.forEach((w, idx) => {
          const wId = `wall-${idx}`;
          newEntities[wId] = {
            id: wId,
            name: `Parede Limitadora ${idx + 1}`,
            parentId: null,
            childrenIds: [],
            active: true,
            components: {
              Transform: { type: 'Transform', position: w.p, rotation: [0, 0, 0], scale: w.s },
              MeshRenderer: { type: 'MeshRenderer', geometry: 'box', material: 'standard', color: '#2c3e50', castShadow: true, receiveShadow: true },
              RigidBody: { type: 'RigidBody', mass: 0, isStatic: true, useGravity: false, collider: 'cuboid' }
            }
          };
          rootEntityIds.push(wId);
        });

        // Obstáculos internos
        const pillars = [
          [-10, 3, -10], [10, 3, -10], [-10, 3, 10], [10, 3, 10]
        ];
        pillars.forEach((pos, idx) => {
          const pId = `pillar-${idx}`;
          newEntities[pId] = {
            id: pId,
            name: `Coluna ${idx + 1}`,
            parentId: null,
            childrenIds: [],
            active: true,
            components: {
              Transform: { type: 'Transform', position: pos, rotation: [0, 0, 0], scale: [3, 6, 3] },
              MeshRenderer: { type: 'MeshRenderer', geometry: 'box', material: 'standard', color: '#7f8c8d', castShadow: true, receiveShadow: true },
              RigidBody: { type: 'RigidBody', mass: 0, isStatic: true, useGravity: false, collider: 'cuboid' }
            }
          };
          rootEntityIds.push(pId);
        });

        // 4. Jogador FPS (com Script FPSController e Mecânica de Tiro)
        const playerId = uuidv4();
        newEntities[playerId] = {
          id: playerId,
          name: 'JogadorFPS',
          parentId: null,
          childrenIds: [],
          active: true,
          tags: ['player'],
          components: {
            Transform: { type: 'Transform', position: [0, 1.5, 25], rotation: [0, 0, 0], scale: [1, 2, 1] },
            MeshRenderer: { type: 'MeshRenderer', geometry: 'cylinder', material: 'standard', color: '#16a085', castShadow: true, receiveShadow: true },
            RigidBody: { type: 'RigidBody', mass: 1, isStatic: false, useGravity: true, collider: 'cuboid' },
            Camera: { type: 'Camera', fov: 75, near: 0.1, far: 1000, isMain: true, offset: [0, 0.8, 0] },
            Script: {
              type: 'Script',
              scriptName: 'FPSController',
              code: `// Controlador FPS com Tiro
export let speed = 12;
export let mouseSensitivity = 0.002;
export let jumpForce = 8;

let rotX = 0;
let rotY = 0;
let shootCooldown = 0;

export function onUpdate(delta) {
  // Rotação da Câmera pelo Mouse
  if (Input.getMouseButton(0)) Input.lockMouse();
  if (Input.mouse.isLocked) {
    rotY -= Input.mouse.movementX * mouseSensitivity;
    rotX -= Input.mouse.movementY * mouseSensitivity;
    rotX = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, rotX));
  }

  if (camera) {
    camera.rotation = [rotX, 0, 0];
  }
  
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0));
  
  if (rigidBody) {
    rigidBody.setRotation(q, true);
    
    // Movimento W/S/A/D
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const vel = new THREE.Vector3(0, rigidBody.linvel().y, 0);
    
    let moveF = 0;
    let moveR = 0;
    if (Input.getKey('KeyW')) moveF += 1;
    if (Input.getKey('KeyS')) moveF -= 1;
    if (Input.getKey('KeyA')) moveR -= 1;
    if (Input.getKey('KeyD')) moveR += 1;
    
    const moveDir = new THREE.Vector3();
    if (moveF !== 0 || moveR !== 0) {
      moveDir.add(forward.multiplyScalar(moveF)).add(right.multiplyScalar(moveR)).normalize();
      vel.add(moveDir.multiplyScalar(speed));
    }
    
    // Pulo
    if (Input.getKey('Space') && Math.abs(rigidBody.linvel().y) < 0.01) {
      vel.y = jumpForce;
    }
    
    rigidBody.setLinvel(vel, true);
  }

  // Mecânica de Tiro (Lançar projétil)
  if (shootCooldown > 0) {
    shootCooldown -= delta;
  }
  
  if (Input.getMouseButton(0) && shootCooldown <= 0 && Input.mouse.isLocked) {
    shootCooldown = 0.25; // Cooldown de 250ms
    console.log("💥 TIRO EFETUADO!");
    
    // Lógica para disparar um projétil ou colidir
    // Simulamos um raycast simples para ver se acertou os alvos
    const targets = ["Alvo_1", "Alvo_2", "Alvo_3"];
    targets.forEach(tName => {
      const target = engine.find(tName);
      if (target && target.active) {
        const tPos = engine.getPosition(target.id);
        const myPos = getEntityPosition(entity.id);
        if (tPos && myPos) {
          // Simplificado: se distância for razoável e olharmos para ele
          const dist = Math.hypot(tPos[0] - myPos[0], tPos[2] - myPos[2]);
          if (dist < 20) {
            console.log("🎯 ALVO ACERTADO! Destruindo " + tName);
            updateComponent(target.id, 'MeshRenderer', { color: '#ff3333' });
            setTimeout(() => {
              updateComponent(target.id, 'Transform', { position: [tPos[0], -10, tPos[2]] }); // Remove caindo
            }, 300);
          }
        }
      }
    });
  }
}`
            }
          }
        };
        rootEntityIds.push(playerId);
        addLocalLog('success', '✔️ Jogador FPS de elite criado.');

        // 5. Alvos em Movimento
        addLocalLog('info', '👾 Inserindo alvos móveis...');
        const enemyTargets = [
          { name: 'Alvo_1', pos: [-15, 2, -25] },
          { name: 'Alvo_2', pos: [0, 2, -30] },
          { name: 'Alvo_3', pos: [15, 2, -25] }
        ];
        enemyTargets.forEach((enemy) => {
          newEntities[enemy.name] = {
            id: enemy.name,
            name: enemy.name,
            parentId: null,
            childrenIds: [],
            active: true,
            components: {
              Transform: { type: 'Transform', position: enemy.pos, rotation: [0, 0, 0], scale: [2, 2, 2] },
              MeshRenderer: { type: 'MeshRenderer', geometry: 'sphere', material: 'standard', color: '#f1c40f', castShadow: true, receiveShadow: true },
              RigidBody: { type: 'RigidBody', mass: 1, isStatic: true, useGravity: false, collider: 'ball' },
              Script: {
                type: 'Script',
                scriptName: 'EnemyBehavior',
                code: `// Movimento lateral contínuo do inimigo
export let range = 8;
export let speed = 3;
let startX = 0;
let initialized = false;

export function onUpdate(delta) {
  const pos = getEntityPosition(entity.id);
  if (!pos) return;
  if (!initialized) {
    startX = pos[0];
    initialized = true;
  }
  
  const offset = Math.sin(Date.now() * 0.002 * speed) * range;
  updateComponent(entity.id, 'Transform', {
    position: [startX + offset, pos[1], pos[2]]
  });
}`
              }
            }
          };
          rootEntityIds.push(enemy.name);
        });
        addLocalLog('success', '✔️ 3 alvos móveis adicionados com script de movimento.');
      } 
      else if (templateType === 'platform') {
        addLocalLog('info', '🧗 Construindo Jogo de Plataforma 3D...');
        await new Promise(r => setTimeout(r, 600));

        // 1. Direcional
        const lightId = uuidv4();
        newEntities[lightId] = {
          id: lightId, name: 'Sol', parentId: null, childrenIds: [], active: true,
          components: {
            Transform: { type: 'Transform', position: [5, 25, 5], rotation: [0,0,0], scale: [1,1,1] },
            Light: { type: 'Light', lightType: 'directional', color: '#fffaed', intensity: 1.4, castShadow: true }
          }
        };
        rootEntityIds.push(lightId);

        // 2. Spawn principal
        const spawnId = uuidv4();
        newEntities[spawnId] = {
          id: spawnId, name: 'SpawnPlatform', parentId: null, childrenIds: [], active: true,
          components: {
            Transform: { type: 'Transform', position: [0, 0, 0], rotation: [-90, 0, 0], scale: [10, 10, 1] },
            MeshRenderer: { type: 'MeshRenderer', geometry: 'plane', material: 'standard', color: '#27ae60', castShadow: false, receiveShadow: true },
            RigidBody: { type: 'RigidBody', mass: 0, isStatic: true, useGravity: false, collider: 'cuboid' }
          }
        };
        rootEntityIds.push(spawnId);

        // 3. Plataformas flutuantes normais e móveis
        addLocalLog('info', '☁️ Adicionando plataformas suspensas e móveis...');
        const platSpecs = [
          { name: 'Plataforma_1', pos: [0, 3, -12], scale: [4, 0.5, 4], color: '#f39c12', type: 'static' },
          { name: 'Plataforma_Movel_2', pos: [-6, 6, -24], scale: [4, 0.5, 4], color: '#2980b9', type: 'mobile_x' },
          { name: 'Plataforma_3', pos: [6, 9, -36], scale: [4, 0.5, 4], color: '#e67e22', type: 'static' },
          { name: 'Plataforma_Movel_4', pos: [0, 12, -48], scale: [4, 0.5, 4], color: '#8e44ad', type: 'mobile_y' },
          { name: 'Plataforma_Final', pos: [0, 15, -62], scale: [8, 0.5, 8], color: '#c0392b', type: 'static' }
        ];

        platSpecs.forEach((plat) => {
          const pId = uuidv4();
          newEntities[pId] = {
            id: pId,
            name: plat.name,
            parentId: null,
            childrenIds: [],
            active: true,
            components: {
              Transform: { type: 'Transform', position: plat.pos, rotation: [0,0,0], scale: plat.scale },
              MeshRenderer: { type: 'MeshRenderer', geometry: 'box', material: 'standard', color: plat.color, castShadow: true, receiveShadow: true },
              RigidBody: { type: 'RigidBody', mass: 0, isStatic: true, useGravity: false, collider: 'cuboid' },
              ...(plat.type !== 'static' ? {
                Script: {
                  type: 'Script',
                  scriptName: plat.type === 'mobile_x' ? 'MoveHoriz' : 'MoveVert',
                  code: plat.type === 'mobile_x' 
                    ? `// Move horizontalmente
export let speed = 2.5;
export let range = 5;
let startX = 0;
let init = false;

export function onUpdate(delta) {
  const pos = getEntityPosition(entity.id);
  if (!pos) return;
  if (!init) { startX = pos[0]; init = true; }
  
  const offset = Math.sin(Date.now() * 0.001 * speed) * range;
  updateComponent(entity.id, 'Transform', {
    position: [startX + offset, pos[1], pos[2]]
  });
}`
                    : `// Move verticalmente
export let speed = 2.0;
export let range = 3.5;
let startY = 0;
let init = false;

export function onUpdate(delta) {
  const pos = getEntityPosition(entity.id);
  if (!pos) return;
  if (!init) { startY = pos[1]; init = true; }
  
  const offset = Math.sin(Date.now() * 0.0015 * speed) * range;
  updateComponent(entity.id, 'Transform', {
    position: [pos[0], startY + offset, pos[2]]
  });
}`
                }
              } : {})
            }
          };
          rootEntityIds.push(pId);
        });

        // 4. Lava Mortal no fundo
        const lavaId = uuidv4();
        newEntities[lavaId] = {
          id: lavaId, name: 'LavaDeMorte', parentId: null, childrenIds: [], active: true,
          components: {
            Transform: { type: 'Transform', position: [0, -6, -30], rotation: [-90, 0, 0], scale: [200, 200, 1] },
            MeshRenderer: { type: 'MeshRenderer', geometry: 'plane', material: 'emissive', color: '#ff3300', castShadow: false, receiveShadow: false, emissiveIntensity: 2.0 },
            Script: {
              type: 'Script',
              scriptName: 'LavaBehavior',
              code: `// Reseta jogador se cair na lava
export function onUpdate(delta) {
  const player = engine.find("JogadorPlataforma");
  if (!player) return;
  
  const pPos = engine.getPosition(player.id);
  if (pPos && pPos[1] < -4) {
    console.log("💀 VOCÊ CAIU NA LAVA!");
    // Reseta posição e velocidade
    const playerRb = player.components.RigidBody;
    if (playerRb) {
      // Teleporta o jogador de volta ao spawn
      updateComponent(player.id, 'Transform', { position: [0, 3, 0] });
      const rbRef = useEditorStore.getState().rigidBodyRefs[player.id];
      if (rbRef) {
        rbRef.setTranslation({ x: 0, y: 3, z: 0 }, true);
        rbRef.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
    }
  }
}`
            }
          }
        };
        rootEntityIds.push(lavaId);

        // 5. Moeda/Troféu da Vitória na Plataforma Final
        const trophyId = uuidv4();
        newEntities[trophyId] = {
          id: trophyId, name: 'TroféuVitória', parentId: null, childrenIds: [], active: true,
          components: {
            Transform: { type: 'Transform', position: [0, 16.5, -62], rotation: [0, 0, 0], scale: [1.5, 1.5, 1.5] },
            MeshRenderer: { type: 'MeshRenderer', geometry: 'torus', material: 'standard', color: '#f1c40f', castShadow: true, receiveShadow: false },
            Script: {
              type: 'Script',
              scriptName: 'TrophySpinner',
              code: `// Gira e checa vitória
export function onUpdate(delta) {
  const rot = entity.components.Transform.rotation;
  updateComponent(entity.id, 'Transform', {
    rotation: [rot[0], rot[1] + 90 * delta, rot[2]]
  });
  
  const player = engine.find("JogadorPlataforma");
  if (!player) return;
  const pPos = engine.getPosition(player.id);
  const myPos = getEntityPosition(entity.id);
  if (pPos && myPos) {
    const dist = Math.hypot(pPos[0] - myPos[0], pPos[1] - myPos[1], pPos[2] - myPos[2]);
    if (dist < 2.0) {
      console.log("🎉 PARABÉNS! VOCÊ ALCANÇOU O TROFÉU E VENCEU O JOGO!");
      updateComponent(entity.id, { active: false });
    }
  }
}`
            }
          }
        };
        rootEntityIds.push(trophyId);

        // 6. Jogador com Câmera Órbita em Terceira Pessoa
        const playerId = uuidv4();
        newEntities[playerId] = {
          id: playerId,
          name: 'JogadorPlataforma',
          parentId: null,
          childrenIds: [],
          active: true,
          tags: ['player'],
          components: {
            Transform: { type: 'Transform', position: [0, 3, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
            MeshRenderer: { type: 'MeshRenderer', geometry: 'sphere', material: 'standard', color: '#e74c3c', castShadow: true, receiveShadow: true },
            RigidBody: { type: 'RigidBody', mass: 1.2, isStatic: false, useGravity: true, collider: 'ball' },
            Camera: { type: 'Camera', fov: 70, near: 0.1, far: 1000, isMain: true, offset: [0, 2.5, 6] },
            Script: {
              type: 'Script',
              scriptName: 'PlatformPlayerController',
              code: `// Movimento 3a Pessoa Órbita
export let speed = 10;
export let jumpForce = 8.5;

let lookAngle = 0;

export function onUpdate(delta) {
  if (Input.getMouseButton(0)) Input.lockMouse();
  if (Input.mouse.isLocked) {
    lookAngle -= Input.mouse.movementX * 0.003;
  }
  
  // Posiciona a câmera orbitando
  if (camera) {
    camera.offset = [
      Math.sin(lookAngle) * 6,
      2.5,
      Math.cos(lookAngle) * 6
    ];
    // Olhando levemente para baixo
    camera.rotation = [-15 * Math.PI / 180, lookAngle + Math.PI, 0];
  }
  
  if (rigidBody) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, lookAngle, 0));
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const vel = new THREE.Vector3(0, rigidBody.linvel().y, 0);
    
    let mF = 0;
    let mR = 0;
    if (Input.getKey('KeyW')) mF += 1;
    if (Input.getKey('KeyS')) mF -= 1;
    if (Input.getKey('KeyA')) mR -= 1;
    if (Input.getKey('KeyD')) mR += 1;
    
    if (mF !== 0 || mR !== 0) {
      const move = new THREE.Vector3()
        .add(forward.multiplyScalar(mF))
        .add(right.multiplyScalar(mR))
        .normalize();
      vel.add(move.multiplyScalar(speed));
    }
    
    // Pulo
    if (Input.getKey('Space') && Math.abs(rigidBody.linvel().y) < 0.05) {
      vel.y = jumpForce;
    }
    
    rigidBody.setLinvel(vel, true);
  }
}`
            }
          }
        };
        rootEntityIds.push(playerId);
        addLocalLog('success', '✔️ Jogador e câmera orbital configurados.');
      } 
      else if (templateType === 'coins') {
        addLocalLog('info', '🪙 Construindo Arena Coletora de Moedas...');
        await new Promise(r => setTimeout(r, 600));

        // 1. Direcional
        const lightId = uuidv4();
        newEntities[lightId] = {
          id: lightId, name: 'LuzSol', parentId: null, childrenIds: [], active: true,
          components: {
            Transform: { type: 'Transform', position: [5, 20, 5], rotation: [0,0,0], scale: [1,1,1] },
            Light: { type: 'Light', lightType: 'directional', color: '#ffffff', intensity: 1.3, castShadow: true }
          }
        };
        rootEntityIds.push(lightId);

        // 2. Chão
        const groundId = uuidv4();
        newEntities[groundId] = {
          id: groundId, name: 'ArenaChao', parentId: null, childrenIds: [], active: true,
          components: {
            Transform: { type: 'Transform', position: [0, 0, 0], rotation: [-90, 0, 0], scale: [40, 40, 1] },
            MeshRenderer: { type: 'MeshRenderer', geometry: 'plane', material: 'standard', color: '#1a5276', castShadow: false, receiveShadow: true },
            RigidBody: { type: 'RigidBody', mass: 0, isStatic: true, useGravity: false, collider: 'cuboid' }
          }
        };
        rootEntityIds.push(groundId);

        // Paredes Limite
        const wallPos = [
          { p: [0, 2, -20], s: [40, 4, 1] }, { p: [0, 2, 20], s: [40, 4, 1] },
          { p: [-20, 2, 0], s: [1, 4, 40] }, { p: [20, 2, 0], s: [1, 4, 40] }
        ];
        wallPos.forEach((w, idx) => {
          const wId = uuidv4();
          newEntities[wId] = {
            id: wId, name: `Parede_${idx}`, parentId: null, childrenIds: [], active: true,
            components: {
              Transform: { type: 'Transform', position: w.p, rotation: [0,0,0], scale: w.s },
              MeshRenderer: { type: 'MeshRenderer', geometry: 'box', material: 'standard', color: '#2e4053', castShadow: true, receiveShadow: true },
              RigidBody: { type: 'RigidBody', mass: 0, isStatic: true, useGravity: false, collider: 'cuboid' }
            }
          };
          rootEntityIds.push(wId);
        });

        // 3. Moedas Coletáveis (5 Moedas)
        addLocalLog('info', '🪙 Distribuindo moedas flutuantes...');
        const coinLocations = [
          [-8, 1, -8], [8, 1, -8], [-8, 1, 8], [8, 1, 8], [0, 1, 0]
        ];
        coinLocations.forEach((cPos, idx) => {
          const coinId = `coin-${idx}`;
          newEntities[coinId] = {
            id: coinId,
            name: `MoedaGold_${idx + 1}`,
            parentId: null,
            childrenIds: [],
            active: true,
            tags: ['coin'],
            components: {
              Transform: { type: 'Transform', position: cPos, rotation: [90, 0, 0], scale: [1, 1, 0.2] },
              MeshRenderer: { type: 'MeshRenderer', geometry: 'cylinder', material: 'standard', color: '#f1c40f', castShadow: true, receiveShadow: false },
              Script: {
                type: 'Script',
                scriptName: 'CoinSpinner',
                code: `// Roda moeda e checa distância
export function onUpdate(delta) {
  // Rotaciona a moeda no Y
  const rot = entity.components.Transform.rotation;
  updateComponent(entity.id, 'Transform', {
    rotation: [rot[0], rot[1] + 120 * delta, rot[2]]
  });
  
  const player = engine.find("JogadorColetor");
  if (!player) return;
  const pPos = engine.getPosition(player.id);
  const myPos = getEntityPosition(entity.id);
  if (pPos && myPos) {
    const dist = Math.hypot(pPos[0] - myPos[0], pPos[1] - myPos[1], pPos[2] - myPos[2]);
    if (dist < 1.8) {
      console.log("🪙 MOEDA COLETADA!");
      updateComponent(entity.id, { active: false });
    }
  }
}`
              }
            }
          };
          rootEntityIds.push(coinId);
        });

        // 4. Jogador Coletor
        const playerId = uuidv4();
        newEntities[playerId] = {
          id: playerId,
          name: 'JogadorColetor',
          parentId: null,
          childrenIds: [],
          active: true,
          tags: ['player'],
          components: {
            Transform: { type: 'Transform', position: [0, 1.5, 12], rotation: [0, 0, 0], scale: [1, 1, 1] },
            MeshRenderer: { type: 'MeshRenderer', geometry: 'sphere', material: 'standard', color: '#e67e22', castShadow: true, receiveShadow: true },
            RigidBody: { type: 'RigidBody', mass: 1, isStatic: false, useGravity: true, collider: 'ball' },
            Camera: { type: 'Camera', fov: 70, near: 0.1, far: 1000, isMain: true, offset: [0, 3, 5] },
            Script: {
              type: 'Script',
              scriptName: 'ColetorController',
              code: `// Controle de Movimento Simples W/S/A/D
export let speed = 10;

export function onUpdate(delta) {
  if (rigidBody) {
    const vel = new THREE.Vector3(0, rigidBody.linvel().y, 0);
    
    let mF = 0;
    let mR = 0;
    if (Input.getKey('KeyW')) mF += 1;
    if (Input.getKey('KeyS')) mF -= 1;
    if (Input.getKey('KeyA')) mR -= 1;
    if (Input.getKey('KeyD')) mR += 1;
    
    vel.x = mR * speed;
    vel.z = -mF * speed;
    
    rigidBody.setLinvel(vel, true);
  }
  
  // Atualiza posição da câmera para seguir o jogador
  const mainCam = engine.find("Main Camera");
  if (mainCam) {
    const pPos = getEntityPosition(entity.id);
    if (pPos) {
      engine.updateComponent(mainCam.id, 'Transform', {
        position: [pPos[0], pPos[1] + 6, pPos[2] + 10],
        rotation: [-30, 0, 0]
      });
    }
  }
}`
            }
          }
        };
        rootEntityIds.push(playerId);
        addLocalLog('success', '✔️ Jogador bola de física e câmera criados.');

        // 5. Câmera
        const camId = uuidv4();
        newEntities[camId] = {
          id: camId, name: 'Main Camera', parentId: null, childrenIds: [], active: true,
          components: {
            Transform: { type: 'Transform', position: [0, 7.5, 22], rotation: [-30, 0, 0], scale: [1, 1, 1] },
            Camera: { type: 'Camera', fov: 65, near: 0.1, far: 1000, isMain: true, offset: [0,0,0] }
          }
        };
        rootEntityIds.push(camId);
      }

      // Aplica a nova cena na store
      useEditorStore.setState((s) => ({
        scenes: {
          ...s.scenes,
          [activeSceneId]: {
            ...scene,
            entities: newEntities,
            rootEntityIds,
            backgroundColor: templateType === 'race' ? '#020208' : (templateType === 'fps' ? '#0d0d12' : '#87CEEB'),
            ambientIntensity: 0.5,
            fogEnabled: templateType === 'race' || templateType === 'fps',
            fogColor: templateType === 'race' ? '#020208' : '#0d0d12',
            fogNear: 15,
            fogFar: 220
          }
        },
        selectedEntityId: null,
        hasUnpublishedChanges: true
      }));

      await saveCurrentScene();
      addLocalLog('success', '✨ Jogo completo gerado e salvo com sucesso!');
      addLog('info', `🤖 Assistente IA gerou o template de "${templateType === 'race' ? 'Corrida de Nave 3D' : templateType.toUpperCase()}".`);
      showToast('Projeto reestruturado pela IA!');
    } catch (err: any) {
      addLocalLog('error', `Falha ao estruturar cena: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Lógica online que conecta ao Gemini
  const handleGenerateAI = async () => {
    if (!prompt.trim()) return;

    // Se não houver chave de API, redireciona para a busca offline inteligente por palavra chave
    if (!apiKey) {
      const lower = prompt.toLowerCase();
      if (lower.includes('nave') || lower.includes('corrida') || lower.includes('race') || lower.includes('space')) {
        await generateOfflineTemplate('race');
      } else if (lower.includes('fps') || lower.includes('tiro') || lower.includes('gun') || lower.includes('shoot')) {
        await generateOfflineTemplate('fps');
      } else if (lower.includes('plataforma') || lower.includes('platform') || lower.includes('pulo') || lower.includes('jump')) {
        await generateOfflineTemplate('platform');
      } else if (lower.includes('moeda') || lower.includes('coin') || lower.includes('coletor') || lower.includes('gold')) {
        await generateOfflineTemplate('coins');
      } else {
        addLocalLog('warn', 'Nenhuma palavra-chave clara encontrada (corrida/tiro/plataforma/moedas). Usando Jogo de Corrida de Nave como padrão.');
        await generateOfflineTemplate('race');
      }
      setPrompt('');
      return;
    }

    setIsLoading(true);
    setLogs([]);
    addLocalLog('info', '🔮 Conectando com a API da Pollinations...');
    
    const scene = activeScene();
    if (!scene) {
      addLocalLog('error', 'Nenhuma cena ativa para modificar.');
      setIsLoading(false);
      return;
    }

    try {
      const systemPrompt = `Você é um Gerador de Cenas do Orion Engine, um motor 3D em React Three Fiber e Rapier Physics.
Sua tarefa é ler a solicitação do usuário e gerar uma CENA COMPLETAMENTE FUNCIONAL no formato JSON especificado.
Você deve retornar APENAS o JSON puro sem formatação markdown (como blocos de código \`\`\`json). A resposta deve ser diretamente parseada pelo JSON.parse().

Aqui está a definição das Entidades que você deve gerar no campo "entities" (um Record de uuid de entidade para objetos Entity):
Interface Entity:
{
  "id": "uuid string",
  "name": "nome único",
  "parentId": null,
  "childrenIds": [],
  "active": true,
  "tags": [], // opcional, ex: ["player", "teleport"]
  "components": {
    "Transform": {
      "type": "Transform",
      "position": [number, number, number],
      "rotation": [number, number, number],
      "scale": [number, number, number]
    },
    "MeshRenderer": {
      "type": "MeshRenderer",
      "geometry": "box" | "sphere" | "plane" | "cylinder" | "torus" | "capsule",
      "material": "standard" | "basic" | "emissive" | "invisible",
      "color": "hex string",
      "castShadow": boolean,
      "receiveShadow": boolean,
      "emissiveIntensity": number // opcional se material for emissive
    },
    "RigidBody": {
      "type": "RigidBody",
      "mass": number, // se estático, use 0
      "isStatic": boolean,
      "useGravity": boolean,
      "collider": "cuboid" | "ball" | "hull" | "trimesh" | "none"
    },
    "Camera": { // Anexe apenas à camera ou ao jogador
      "type": "Camera",
      "fov": number,
      "near": number,
      "far": number,
      "isMain": true,
      "offset": [number, number, number]
    },
    "Script": {
      "type": "Script",
      "scriptName": "NomeDoScript",
      "code": "código JavaScript puro que controla a entidade. Ex: export function onUpdate(delta) { ... }"
    }
  }
}

Regras essenciais para os códigos nos Scripts:
1. Sempre use JavaScript (Vite/ES6). Escreva a lógica completa de acordo com as teclas pressionadas.
2. Checagem de Inputs: Use APENAS 'Input.getKey("KeyName")' (ex: 'KeyW', 'Space', 'ArrowUp', 'ArrowLeft'), 'Input.getMouseButton(0)' ou 'Input.getGamepadButton("ButtonName")'. Nunca use funções inexistentes.
3. Radianos vs Graus (CRÍTICO): A rotação da entidade no transform ('entity.components.Transform.rotation') é armazenada em GRAUS. As funções matemáticas do JS ('Math.sin', 'Math.cos') exigem RADIANOS. Se precisar calcular direções de movimento usando a rotação Y (yaw), SEMPRE converta o valor do transform para radianos primeiro: 'const yawRad = yawDeg * (Math.PI / 180)'.
4. Não Mutação Direta (CRÍTICO): Nunca modifique diretamente as propriedades do objeto 'entity' (como 'transform.rotation[1] += val' ou 'entity.components.Transform.position = ...'). Isso quebra a reatividade. Em vez disso, calcule os novos valores e atualize usando 'engine.updateComponent(entity.id, 'Transform', { rotation: [newX, newY, newZ] })' ou 'engine.updateComponent(entityId, componentName, updatedData)'.
5. Referência Física do Corpo Rígido: Se a entidade possuir física ('RigidBody'), a referência 'rigidBody' do Rapier já estará disponível globalmente no escopo do script. Use 'rigidBody.setLinvel({ x, y, z }, true)' para mudar velocidade e 'rigidBody.setTranslation({ x, y, z }, true)' para teletransporte. Nunca use 'engine.getRigidBody(entity.id)'.
6. Teleporte Físico de Projéteis / Outros Objetos: Para mover ou atirar balas (que possuem 'RigidBody' dinâmico), NUNCA use 'engine.updateComponent' para reposicioná-los, pois isso buga a simulação do Rapier. Em vez disso, obtenha o corpo rígido usando 'useEditorStore.getState().rigidBodyRefs[bulletId]' e execute 'setTranslation({ x, y, z }, true)'.
7. Posição em Tempo Real: Para ler a posição de outras entidades (como o jogador) em tempo real, use a função global 'getEntityPosition(entityId)' que retorna um array '[x, y, z]'.
8. O script principal deve rodar na função 'export function onUpdate(delta) { ... }' e opcionalmente ter 'export function onAwake() { ... }'.


Retorne um objeto JSON contendo:
{
  "entities": { ... },
  "rootEntityIds": [ ... lista de todos os ids de topo ... ],
  "backgroundColor": "#hex",
  "ambientIntensity": number,
  "fogEnabled": boolean,
  "fogColor": "#hex",
  "fogNear": number,
  "fogFar": number
}

Gere um jogo espetacular para o prompt do usuário. Adicione física onde fizer sentido, luzes bonitas, cenários divertidos e controle total de perseguição de câmera.`;

      addLocalLog('info', '🧠 Enviando instruções do projeto para a IA...');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      let dataText = '';
      let success = false;

      // 1. Tenta por POST na rota recomendada (OpenAI-compatible)
      try {
        const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: selectedModel || 'openai',
            messages: [
              { 
                role: 'system', 
                content: systemPrompt
              },
              { role: 'user', content: prompt }
            ],
            temperature: 0.3
          })
        });
        if (response.ok) {
          const json = await response.json();
          dataText = json.choices?.[0]?.message?.content || '';
          if (dataText) success = true;
        }
      } catch (postErr) {
        console.warn('POST para gen.pollinations.ai falhou, tentando fallback:', postErr);
      }

      // 2. Se falhar, tenta o POST na rota legada text.pollinations.ai
      if (!success) {
        try {
          const response = await fetch('https://text.pollinations.ai/', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: selectedModel || 'openai',
              messages: [
                { 
                  role: 'system', 
                  content: systemPrompt
                },
                { role: 'user', content: prompt }
              ]
            })
          });
          if (response.ok) {
            dataText = await response.text();
            if (dataText) success = true;
          }
        } catch (legacyPostErr) {
          console.warn('POST para text.pollinations.ai falhou:', legacyPostErr);
        }
      }

      // 3. Fallback final via GET (altamente resiliente, não exige chave, livre de CORS)
      if (!success) {
        const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=${encodeURIComponent(selectedModel || 'openai')}&system=${encodeURIComponent(systemPrompt)}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Falha na resposta da API após tentar POST e GET');
        }
        dataText = await response.text();
      }

      addLocalLog('info', '📦 Resposta recebida da IA. Analisando estrutura...');
      let cleanedJsonText = dataText.trim();
      if (cleanedJsonText.startsWith('```')) {
        cleanedJsonText = cleanedJsonText.replace(/^```json\n|^```\n/g, '').replace(/```$/g, '').trim();
      }
      
      const parsedScene = JSON.parse(cleanedJsonText);

      addLocalLog('info', '🧱 Gerando entidades e compilando scripts...');
      
      // Substitui as entidades na store
      useEditorStore.setState((s) => ({
        scenes: {
          ...s.scenes,
          [activeSceneId]: {
            ...scene,
            entities: parsedScene.entities,
            rootEntityIds: parsedScene.rootEntityIds,
            backgroundColor: parsedScene.backgroundColor || '#0a0a14',
            ambientIntensity: parsedScene.ambientIntensity || 0.5,
            fogEnabled: !!parsedScene.fogEnabled,
            fogColor: parsedScene.fogColor || '#0a0a14',
            fogNear: parsedScene.fogNear || 10,
            fogFar: parsedScene.fogFar || 150
          }
        },
        selectedEntityId: null,
        hasUnpublishedChanges: true
      }));

      await saveCurrentScene();
      addLocalLog('success', '✨ Projeto criado com sucesso pelo assistente de IA!');
      showToast('Projeto criado com IA!');
      setPrompt('');
    } catch (err: any) {
      addLocalLog('error', `Falha ao gerar com IA: ${err.message}`);
      addLocalLog('warn', 'Usando gerador local como fallback inteligente...');
      // Executa o local fallback baseado em palavra chave
      const lower = prompt.toLowerCase();
      if (lower.includes('nave') || lower.includes('corrida') || lower.includes('race') || lower.includes('space')) {
        await generateOfflineTemplate('race');
      } else {
        await generateOfflineTemplate('race');
      }
      setPrompt('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ai-assistant-panel">
      <div className="ai-header">
        <div className="header-title">
          <Sparkles className="neon-text-icon" size={16} />
          <h3>Assistente de Projeto com IA</h3>
        </div>
        <div className="header-actions">
          <button 
            className={`settings-btn ${showSettings ? 'active' : ''}`} 
            onClick={() => setShowSettings(!showSettings)} 
            title="Configurações da Chave de API"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      <div className="ai-body">
        {showSettings && (
          <div className="api-settings-box">
            <h4>Configuração da IA (Pollinations)</h4>
            <p>Insira sua Pollinations API Key (opcional) e selecione o modelo de IA para geração livre.</p>
            <div className="api-input-group">
              <input 
                type="password" 
                placeholder="Cole sua API Key da Pollinations aqui (opcional)..." 
                value={apiKey} 
                onChange={(e) => setApiKey(e.target.value)} 
              />
              <button onClick={() => handleSaveApiKey(apiKey)}>Salvar</button>
            </div>
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Modelo de IA:</label>
              {loadingModels ? (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Carregando modelos...</span>
              ) : (
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  style={{
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-bright)',
                    color: 'white',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    outline: 'none',
                    width: '100%'
                  }}
                >
                  {models.map(m => (
                    <option key={m.id} value={m.id}>{m.id}</option>
                  ))}
                  {models.length === 0 && (
                    <option value="openai">openai (Padrão)</option>
                  )}
                </select>
              )}
            </div>
          </div>
        )}

        <div className="ai-main-content">
          {/* Lado Esquerdo: Histórico de Logs */}
          <div className="ai-log-terminal">
            {logs.length === 0 ? (
              <div className="log-placeholder">
                <HelpCircle size={32} />
                <p>Insira um comando abaixo para que o assistente construa seu jogo completo.</p>
                <div className="quick-templates">
                  <span>Ou use um modelo rápido de 1-clique:</span>
                  <div className="template-buttons">
                    <button onClick={() => generateOfflineTemplate('race')}>
                      <Rocket size={12} />
                      Corrida de Nave 3D
                    </button>
                    <button onClick={() => generateOfflineTemplate('fps')}>
                      <Target size={12} />
                      Arena de Tiro FPS
                    </button>
                    <button onClick={() => generateOfflineTemplate('platform')}>
                      <Layers size={12} />
                      Plataforma 3D
                    </button>
                    <button onClick={() => generateOfflineTemplate('coins')}>
                      <Coins size={12} />
                      Coletor de Moedas
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="log-messages">
                {logs.map((log) => (
                  <div key={log.id} className={`log-item ${log.type}`}>
                    {log.type === 'success' && <CheckCircle size={12} />}
                    {log.type === 'warn' && <AlertTriangle size={12} />}
                    {log.type === 'error' && <AlertTriangle size={12} />}
                    <span className="log-text">{log.text}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Barra de Input inferior */}
        <div className="ai-input-bar">
          <div className="prompt-input-wrapper">
            <Sparkles className="input-glow-icon" size={14} />
            <input 
              type="text" 
              placeholder="Digite seu comando, ex: 'Criar Jogo de Corrida de Nave 3D'..." 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleGenerateAI()}
              disabled={isLoading}
            />
            <button 
              className="send-btn" 
              onClick={handleGenerateAI}
              disabled={isLoading || !prompt.trim()}
            >
              {isLoading ? <Loader2 className="spinner" size={14} /> : <Send size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
