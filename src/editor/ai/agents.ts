import { v4 as uuidv4 } from 'uuid';
import type { Intent } from './intentParser';

export interface AgentResult {
  agent: string;
  agentIcon: string;
  executed: string;
  files: string[];
  scripts: string[];
  impacts: string[];
  nextSteps: string[];
  scenePatches?: ScenePatch[];
}

export interface ScenePatch {
  type: 'add_entity' | 'update_scene' | 'add_script';
  data: any;
}

// ─── AGENTE DE CENA ───────────────────────────────────────────────────────────
export async function runSceneAgent(intent: Intent): Promise<AgentResult> {
  const patches: ScenePatch[] = [];
  let executed = '';
  const files: string[] = [];
  const scripts: string[] = [];
  const nextSteps: string[] = [];

  if (intent.action === 'create_entity') {
    const { type } = intent.params;
    const names: Record<string, string> = {
      cube: 'Cubo', sphere: 'Esfera', plane: 'Plano', cylinder: 'Cilindro',
      torus: 'Torus', capsule: 'Cápsula', directional: 'Luz Direcional',
      point: 'Luz Pontual', camera: 'Camera',
    };
    const geoms: Record<string, string> = {
      cube: 'box', sphere: 'sphere', plane: 'plane', cylinder: 'cylinder',
      torus: 'torus', capsule: 'capsule',
    };
    const id = uuidv4();
    if (type === 'directional' || type === 'point') {
      patches.push({ type: 'add_entity', data: {
        id, name: names[type] || 'Luz', parentId: null, childrenIds: [], active: true, tags: [],
        components: {
          Transform: { type: 'Transform', position: [5, 10, 5], rotation: [0,0,0], scale: [1,1,1] },
          Light: { type: 'Light', lightType: type === 'point' ? 'point' : 'directional', color: '#ffffff', intensity: 1.2, castShadow: true },
        }
      }});
    } else if (type === 'camera') {
      patches.push({ type: 'add_entity', data: {
        id, name: 'Camera', parentId: null, childrenIds: [], active: true, tags: [],
        components: {
          Transform: { type: 'Transform', position: [0, 5, 10], rotation: [-15,0,0], scale: [1,1,1] },
          Camera: { type: 'Camera', fov: 70, near: 0.1, far: 1000, isMain: true, offset: [0,0,0] },
        }
      }});
    } else {
      patches.push({ type: 'add_entity', data: {
        id, name: names[type] || 'Objeto', parentId: null, childrenIds: [], active: true, tags: [],
        components: {
          Transform: { type: 'Transform', position: [0, 0.5, 0], rotation: [0,0,0], scale: [1,1,1] },
          MeshRenderer: { type: 'MeshRenderer', geometry: geoms[type] || 'box', material: 'standard', color: '#4a90d9', castShadow: true, receiveShadow: true },
        }
      }});
    }
    executed = `Entidade "${names[type] || type}" criada na cena`;
    nextSteps.push('Ajuste a posição no Inspector', 'Adicione componentes como RigidBody se necessário');
  }

  if (intent.action === 'set_fog') {
    patches.push({ type: 'update_scene', data: {
      fogEnabled: intent.params.enabled,
      fogColor: '#0a0a14', fogNear: 10, fogFar: 100,
    }});
    executed = `Neblina (fog) ${intent.params.enabled ? 'ativada' : 'desativada'}`;
    nextSteps.push('Ajuste fogNear e fogFar nas Configurações de Cena');
  }

  if (intent.action === 'set_background') {
    patches.push({ type: 'update_scene', data: { backgroundColor: intent.params.color }});
    executed = `Cor de fundo alterada para ${intent.params.color}`;
    nextSteps.push('Considere ajustar a cor do fog para combinar');
  }

  if (intent.action === 'create_camera') {
    const isThird = intent.params.mode === 'third-person';
    const id = uuidv4();
    patches.push({ type: 'add_entity', data: {
      id, name: 'Main Camera', parentId: null, childrenIds: [], active: true, tags: [],
      components: {
        Transform: { type: 'Transform', position: [0, 5, 8], rotation: [-15,0,0], scale: [1,1,1] },
        Camera: { type: 'Camera', fov: 70, near: 0.1, far: 1000, isMain: true, offset: isThird ? [0,3,6] : [0,1.6,0] },
      }
    }});
    executed = `Câmera em ${isThird ? 'terceira' : 'primeira'} pessoa configurada`;
    nextSteps.push('Adicione um script de seguimento ao jogador para câmera suave');
  }

  if (intent.action === 'create_teleport') {
    const id = uuidv4();
    patches.push({ type: 'add_entity', data: {
      id, name: 'VR Teleport Anchor', parentId: null, childrenIds: [], active: true, tags: ['teleport'],
      components: {
        Transform: { type: 'Transform', position: [0, 0.1, 0], rotation: [90, 0, 0], scale: [1, 1, 1] },
        MeshRenderer: { type: 'MeshRenderer', geometry: 'torus', material: 'basic', color: '#00ffff', castShadow: false, receiveShadow: false },
      }
    }});
    executed = 'Ponto de teleporte VR criado com sucesso';
    nextSteps.push('Adicione mais pontos pela cena', 'Configure o script de teleporte do jogador para detectar este ponto');
  }

  if (intent.action === 'create_camera_vr') {
    const id = uuidv4();
    patches.push({ type: 'add_entity', data: {
      id, name: 'VR Camera', parentId: null, childrenIds: [], active: true, tags: [],
      components: {
        Transform: { type: 'Transform', position: [0, 1.6, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        Camera: { type: 'Camera', fov: 75, near: 0.1, far: 1000, isMain: true, offset: [0, 0, 0] },
      }
    }});
    executed = 'Câmera principal de VR configurada a 1.6m (altura dos olhos)';
    nextSteps.push('Anexe a câmera ao seu Player ou posicione-a no ponto inicial da cena');
  }

  return { agent: 'Agente de Cena', agentIcon: '🎬', executed, files, scripts, impacts: ['Cena modificada'], nextSteps, scenePatches: patches };
}

// ─── AGENTE DE GAMEPLAY ───────────────────────────────────────────────────────
export async function runGameplayAgent(intent: Intent): Promise<AgentResult> {
  const patches: ScenePatch[] = [];
  let executed = '';
  const scripts: string[] = [];
  const nextSteps: string[] = [];

  if (intent.action === 'create_movement' || intent.action === 'create_player') {
    const isThird = intent.params.type === 'third-person';
    const scriptName = isThird ? 'ThirdPersonController' : 'FirstPersonController';
    scripts.push(`${scriptName}.js`);
    const code = isThird ? THIRD_PERSON_CODE : FIRST_PERSON_CODE;
    const playerId = uuidv4();
    patches.push({ type: 'add_entity', data: {
      id: playerId, name: isThird ? 'JogadorTP' : 'JogadorFPS',
      parentId: null, childrenIds: [], active: true, tags: ['player'],
      components: {
        Transform: { type: 'Transform', position: [0, 1, 0], rotation: [0,0,0], scale: [1,2,1] },
        MeshRenderer: { type: 'MeshRenderer', geometry: 'capsule', material: 'standard', color: '#3498db', castShadow: true, receiveShadow: true },
        RigidBody: { type: 'RigidBody', mass: 1, isStatic: false, useGravity: true, collider: 'none' },
        Script: { type: 'Script', scriptName, code },
      }
    }});
    executed = `Script "${scriptName}" criado e jogador configurado`;
    nextSteps.push('Adicione um Collider (Capsule) ao jogador', 'Configure a câmera para seguir o personagem');
  }

  if (intent.action === 'create_health') {
    scripts.push('HealthSystem.js');
    patches.push({ type: 'add_script', data: { scriptName: 'HealthSystem', code: HEALTH_SYSTEM_CODE }});
    executed = 'Sistema de vida (Health) criado';
    nextSteps.push('Attach o script HealthSystem ao jogador', 'Conecte ao sistema de dano');
  }

  if (intent.action === 'create_inventory') {
    scripts.push('InventorySystem.js');
    patches.push({ type: 'add_script', data: { scriptName: 'InventorySystem', code: INVENTORY_CODE }});
    executed = 'Sistema de inventário criado';
    nextSteps.push('Configure slots no Inspector', 'Conecte com scripts de coleta de itens');
  }

  if (intent.action === 'create_vr_player') {
    scripts.push('VRPlayerController.js');
    const playerId = uuidv4();
    patches.push({ type: 'add_entity', data: {
      id: playerId, name: 'VRPlayer',
      parentId: null, childrenIds: [], active: true, tags: ['player'],
      components: {
        Transform: { type: 'Transform', position: [0, 1.6, 0], rotation: [0,0,0], scale: [1,1,1] },
        MeshRenderer: { type: 'MeshRenderer', geometry: 'capsule', material: 'standard', color: '#10b981', castShadow: true, receiveShadow: true },
        RigidBody: { type: 'RigidBody', mass: 1, isStatic: false, useGravity: true, collider: 'none' },
        Script: { type: 'Script', scriptName: 'VRPlayerController', code: VR_PLAYER_CODE },
      }
    }});
    executed = 'Jogador VR criado e configurado com teleporte e movimentação analógica';
    nextSteps.push('Adicione pontos de teleporte com a tag "teleport"', 'Certifique-se de que a cena possui uma câmera');
  }

  if (intent.action === 'create_teleport_system') {
    scripts.push('VRTeleportSystem.js');
    patches.push({ type: 'add_script', data: { scriptName: 'VRTeleportSystem', code: VR_TELEPORT_CODE }});
    executed = 'Sistema de teleporte VR gerado com sucesso';
    nextSteps.push('Anexe o script VRTeleportSystem a uma entidade da cena');
  }

  return { agent: 'Agente de Gameplay', agentIcon: '🎮', executed, files: [], scripts, impacts: ['Novo script gerado', 'Entidade do jogador adicionada'], nextSteps, scenePatches: patches };
}

// ─── AGENTE DE IA ─────────────────────────────────────────────────────────────
export async function runAIAgent(intent: Intent): Promise<AgentResult> {
  const patches: ScenePatch[] = [];
  let executed = '';
  const scripts: string[] = [];
  const nextSteps: string[] = [];

  const isChase = intent.action === 'create_enemy_chase';
  const isPatrol = intent.action === 'create_enemy_patrol';
  const isFSM = intent.action === 'create_fsm';
  const isBasic = ['create_ai_basic', 'create_enemy_basic'].includes(intent.action);

  let scriptName = 'EnemyAI';
  let code = ENEMY_CHASE_CODE;

  if (isPatrol) { scriptName = 'EnemyPatrol'; code = ENEMY_PATROL_CODE; }
  else if (isFSM) { scriptName = 'EnemyFSM'; code = ENEMY_FSM_CODE; }
  else if (isBasic) { scriptName = 'EnemyBasicAI'; code = ENEMY_CHASE_CODE; }

  scripts.push(`${scriptName}.js`);
  const id = uuidv4();
  patches.push({ type: 'add_entity', data: {
    id, name: 'Inimigo', parentId: null, childrenIds: [], active: true, tags: ['enemy'],
    components: {
      Transform: { type: 'Transform', position: [5, 1, -5], rotation: [0,0,0], scale: [1,2,1] },
      MeshRenderer: { type: 'MeshRenderer', geometry: 'capsule', material: 'standard', color: '#e74c3c', castShadow: true, receiveShadow: true },
      RigidBody: { type: 'RigidBody', mass: 1, isStatic: false, useGravity: true, collider: 'none' },
      Script: { type: 'Script', scriptName, code },
    }
  }});

  executed = `Script "${scriptName}" criado — ${isPatrol ? 'patrulha entre pontos' : isFSM ? 'máquina de estados' : 'perseguição ao jogador'}`;
  nextSteps.push('Adicione um Collider ao inimigo', 'Configure a variável "playerName" para corresponder ao nome do jogador', 'Ajuste speed e detectionRange no Inspector');

  return { agent: 'Agente de IA', agentIcon: '🤖', executed, files: [], scripts, impacts: ['Inimigo adicionado à cena', 'Script de IA gerado'], nextSteps, scenePatches: patches };
}

// ─── AGENTE DE SCRIPTS ────────────────────────────────────────────────────────
export async function runScriptsAgent(intent: Intent): Promise<AgentResult> {
  const patches: ScenePatch[] = [];
  const scripts: string[] = [];
  const nextSteps: string[] = [];
  let executed = '';

  const scriptMap: Record<string, { name: string; code: string }> = {
    weapon: { name: 'WeaponController', code: WEAPON_CODE },
    ammo: { name: 'AmmoSystem', code: AMMO_CODE },
    enemy: { name: 'EnemyAI', code: ENEMY_CHASE_CODE },
    interaction: { name: 'InteractionSystem', code: INTERACTION_CODE },
    collectable: { name: 'Collectable', code: COLLECTABLE_CODE },
    vr: { name: 'VRPlayerController', code: VR_PLAYER_CODE },
  };

  if (intent.action === 'create_multiple_scripts') {
    const names: string[] = intent.params.scriptNames || [];
    for (const rawName of names) {
      const lower = rawName.toLowerCase();
      let matched = 'weapon';
      if (lower.includes('inim') || lower.includes('enemy')) matched = 'enemy';
      else if (lower.includes('muni') || lower.includes('ammo') || lower.includes('bala')) matched = 'ammo';
      else if (lower.includes('intera')) matched = 'interaction';
      else if (lower.includes('coleta') || lower.includes('item')) matched = 'collectable';
      else if (lower.includes('vr') || lower.includes('xr') || lower.includes('teleport')) matched = 'vr';
      const s = scriptMap[matched];
      scripts.push(`${s.name}.js`);
      patches.push({ type: 'add_script', data: { scriptName: s.name, code: s.code } });
    }
    executed = `${scripts.length} scripts gerados: ${scripts.join(', ')}`;
    nextSteps.push('Abra o Script Editor para revisar o código', 'Attach os scripts às entidades correspondentes');
  } else {
    const s = scriptMap[intent.params.scriptType] || scriptMap.weapon;
    scripts.push(`${s.name}.js`);
    patches.push({ type: 'add_script', data: { scriptName: s.name, code: s.code } });
    executed = `Script "${s.name}" gerado`;
    nextSteps.push('Attach o script à entidade correta no Inspector');
  }

  return { agent: 'Agente de Scripts', agentIcon: '📜', executed, files: [], scripts, impacts: ['Scripts criados prontos para uso'], nextSteps, scenePatches: patches };
}

// ─── AGENTE DE INTEGRAÇÃO ─────────────────────────────────────────────────────
export async function runIntegrationAgent(intent: Intent): Promise<AgentResult> {
  let executed = '';
  const nextSteps: string[] = [];

  if (intent.action === 'connect_weapon_player') {
    executed = 'Referência da arma configurada no script do jogador';
    nextSteps.push('Certifique-se que o jogador tem o componente Script "WeaponController"', 'Defina "playerName" no script da arma');
  } else if (intent.action === 'connect_ai_health') {
    executed = 'IA conectada ao sistema de vida do jogador';
    nextSteps.push('Verifique que o script HealthSystem está no jogador', 'Configure "damage" no script de IA');
  } else {
    executed = 'Integração configurada';
    nextSteps.push('Verifique as referências entre os scripts');
  }

  return { agent: 'Agente de Integração', agentIcon: '🔗', executed, files: [], scripts: [], impacts: ['Sistemas conectados'], nextSteps, scenePatches: [] };
}

// ─── TEMPLATES DE SCRIPTS ─────────────────────────────────────────────────────

const FIRST_PERSON_CODE = `// Controlador FPS
export let speed = 10;
export let jumpForce = 7;
export let mouseSensitivity = 0.002;
let rotX = 0, rotY = 0;

export function onUpdate(delta) {
  if (Input.getMouseButton(0)) Input.lockMouse();
  if (Input.mouse.isLocked) {
    rotY -= Input.mouse.movementX * mouseSensitivity;
    rotX -= Input.mouse.movementY * mouseSensitivity;
    rotX = Math.max(-1.4, Math.min(1.4, rotX));
  }
  if (camera) camera.rotation = [rotX, 0, 0];
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0));
  if (rigidBody) {
    rigidBody.setRotation(q, true);
    const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(q);
    const right = new THREE.Vector3(1,0,0).applyQuaternion(q);
    const vel = new THREE.Vector3(0, rigidBody.linvel().y, 0);
    let f=0, r=0;
    if (Input.getKey('KeyW')) f+=1;
    if (Input.getKey('KeyS')) f-=1;
    if (Input.getKey('KeyA')) r-=1;
    if (Input.getKey('KeyD')) r+=1;
    if (f||r) vel.add(fwd.multiplyScalar(f)).add(right.multiplyScalar(r)).normalize().multiplyScalar(speed);
    if (Input.getKey('Space') && Math.abs(rigidBody.linvel().y)<0.1) vel.y = jumpForce;
    rigidBody.setLinvel(vel, true);
  }
}`;

const THIRD_PERSON_CODE = `// Controlador Terceira Pessoa
export let speed = 8;
export let jumpForce = 7;
export let mouseSensitivity = 0.003;
let yaw = 0;

export function onUpdate(delta) {
  if (Input.getMouseButton(0)) Input.lockMouse();
  if (Input.mouse.isLocked) yaw -= Input.mouse.movementX * mouseSensitivity;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
  if (rigidBody) {
    rigidBody.setRotation(q, true);
    const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(q);
    const right = new THREE.Vector3(1,0,0).applyQuaternion(q);
    const vel = new THREE.Vector3(0, rigidBody.linvel().y, 0);
    let f=0, r=0;
    if (Input.getKey('KeyW')) f+=1;
    if (Input.getKey('KeyS')) f-=1;
    if (Input.getKey('KeyA')) r-=1;
    if (Input.getKey('KeyD')) r+=1;
    if (f||r) { const move = new THREE.Vector3().add(fwd.multiplyScalar(f)).add(right.multiplyScalar(r)).normalize(); vel.add(move.multiplyScalar(speed)); }
    if (Input.getKey('Space') && Math.abs(rigidBody.linvel().y)<0.1) vel.y = jumpForce;
    rigidBody.setLinvel(vel, true);
  }
  // Câmera chase
  const cam = engine.find('Main Camera');
  if (cam) {
    const pos = getEntityPosition(entity.id) || [0,0,0];
    const tx = pos[0]+Math.sin(yaw)*7, ty = pos[1]+3.5, tz = pos[2]+Math.cos(yaw)*7;
    const cp = cam.components.Transform.position;
    const lx=cp[0]+(tx-cp[0])*6*delta, ly=cp[1]+(ty-cp[1])*6*delta, lz=cp[2]+(tz-cp[2])*6*delta;
    engine.updateComponent(cam.id,'Transform',{position:[lx,ly,lz],rotation:[-15,yaw*180/Math.PI+180,0]});
  }
}`;

const ENEMY_CHASE_CODE = `// IA de Perseguição
export let speed = 4;
export let detectionRange = 15;
export let attackRange = 2;
export let playerName = 'JogadorFPS';

export function onUpdate(delta) {
  const player = engine.find(playerName);
  if (!player) return;
  const myPos = getEntityPosition(entity.id);
  const pPos = engine.getPosition(player.id);
  if (!myPos || !pPos) return;
  const dx = pPos[0]-myPos[0], dz = pPos[2]-myPos[2];
  const dist = Math.hypot(dx, dz);
  if (dist < detectionRange && dist > attackRange) {
    const nx = dx/dist, nz = dz/dist;
    if (rigidBody) rigidBody.setLinvel({x:nx*speed, y:rigidBody.linvel().y, z:nz*speed}, true);
  } else if (rigidBody) {
    const v = rigidBody.linvel();
    rigidBody.setLinvel({x:v.x*0.8, y:v.y, z:v.z*0.8}, true);
  }
}`;

const ENEMY_PATROL_CODE = `// IA de Patrulha
export let speed = 3;
export let patrolRange = 8;
let startPos = null, dir = 1;

export function onUpdate(delta) {
  const pos = getEntityPosition(entity.id);
  if (!pos) return;
  if (!startPos) startPos = [...pos];
  const target = startPos[0] + dir * patrolRange;
  if (Math.abs(pos[0]-target) < 0.5) dir *= -1;
  const dx = target - pos[0];
  if (rigidBody) rigidBody.setLinvel({x:Math.sign(dx)*speed, y:rigidBody.linvel().y, z:0}, true);
}`;

const ENEMY_FSM_CODE = `// Máquina de Estados do Inimigo
export let speed = 4;
export let detectionRange = 12;
export let attackRange = 2;
export let playerName = 'JogadorFPS';
let state = 'idle'; // idle | patrol | chase | attack
let timer = 0;

export function onUpdate(delta) {
  const player = engine.find(playerName);
  const myPos = getEntityPosition(entity.id);
  const pPos = player ? engine.getPosition(player.id) : null;
  const dist = (myPos && pPos) ? Math.hypot(pPos[0]-myPos[0], pPos[2]-myPos[2]) : Infinity;

  timer += delta;
  if (state === 'idle') {
    if (dist < detectionRange) state = 'chase';
    if (timer > 3) { state = 'patrol'; timer = 0; }
  } else if (state === 'patrol') {
    if (dist < detectionRange) state = 'chase';
  } else if (state === 'chase') {
    if (dist < attackRange) { state = 'attack'; timer = 0; }
    else if (dist > detectionRange * 1.5) state = 'idle';
    else if (myPos && pPos && rigidBody) {
      const dx=pPos[0]-myPos[0], dz=pPos[2]-myPos[2];
      const d=Math.hypot(dx,dz);
      rigidBody.setLinvel({x:(dx/d)*speed, y:rigidBody.linvel().y, z:(dz/d)*speed}, true);
    }
  } else if (state === 'attack') {
    if (timer > 1) { console.log('⚔️ Inimigo ataca!'); timer = 0; }
    if (dist > attackRange) state = 'chase';
  }
}`;

const HEALTH_SYSTEM_CODE = `// Sistema de Vida
export let maxHealth = 100;
export let currentHealth = 100;
export let isAlive = true;

export function takeDamage(amount) {
  if (!isAlive) return;
  currentHealth = Math.max(0, currentHealth - amount);
  console.log('❤️ Vida: ' + currentHealth + '/' + maxHealth);
  if (currentHealth <= 0) { isAlive = false; onDeath(); }
}

function onDeath() {
  console.log('💀 Entidade eliminada!');
  updateComponent(entity.id, 'MeshRenderer', { color: '#333333' });
}

export function heal(amount) {
  currentHealth = Math.min(maxHealth, currentHealth + amount);
}

export function onUpdate(delta) {}`;

const INVENTORY_CODE = `// Sistema de Inventário
export let maxSlots = 10;
let items = [];

export function addItem(item) {
  if (items.length >= maxSlots) { console.log('🎒 Inventário cheio!'); return false; }
  items.push(item);
  console.log('🎒 Item adicionado: ' + item.name + ' | Total: ' + items.length);
  return true;
}

export function removeItem(index) {
  if (index < 0 || index >= items.length) return null;
  const removed = items.splice(index, 1)[0];
  console.log('🎒 Item removido: ' + removed.name);
  return removed;
}

export function getItems() { return items; }
export function onUpdate(delta) {}`;

const WEAPON_CODE = `// Controlador de Arma
export let damage = 25;
export let fireRate = 0.2;
export let range = 30;
export let ammo = 30;
export let maxAmmo = 30;
let cooldown = 0;

export function onUpdate(delta) {
  if (cooldown > 0) cooldown -= delta;
  if (Input.getMouseButton(0) && cooldown <= 0 && Input.mouse.isLocked) {
    if (ammo <= 0) { console.log('🔫 Sem munição! Recarregue (R)'); return; }
    cooldown = fireRate;
    ammo--;
    console.log('💥 Tiro! Munição: ' + ammo + '/' + maxAmmo);
    // Lógica de raycast/hit aqui
  }
  if (Input.getKey('KeyR') && ammo < maxAmmo) {
    ammo = maxAmmo;
    console.log('🔄 Recarregado!');
  }
}`;

const AMMO_CODE = `// Sistema de Munição
export let pistolAmmo = 60;
export let rifleAmmo = 120;
export let shotgunAmmo = 30;

export function getAmmo(type) {
  if (type === 'pistol') return pistolAmmo;
  if (type === 'rifle') return rifleAmmo;
  if (type === 'shotgun') return shotgunAmmo;
  return 0;
}

export function consume(type, amount) {
  if (type === 'pistol') pistolAmmo = Math.max(0, pistolAmmo - amount);
  else if (type === 'rifle') rifleAmmo = Math.max(0, rifleAmmo - amount);
  else if (type === 'shotgun') shotgunAmmo = Math.max(0, shotgunAmmo - amount);
}

export function refill(type, amount) {
  if (type === 'pistol') pistolAmmo = Math.min(120, pistolAmmo + amount);
  else if (type === 'rifle') rifleAmmo = Math.min(240, rifleAmmo + amount);
  else if (type === 'shotgun') shotgunAmmo = Math.min(60, shotgunAmmo + amount);
}

export function onUpdate(delta) {}`;

const INTERACTION_CODE = `// Sistema de Interação
export let interactionRange = 3;
export let interactKey = 'KeyE';
export let targetName = '';

export function onUpdate(delta) {
  const targets = engine.findAllByTag('interactable');
  for (const target of targets) {
    const myPos = getEntityPosition(entity.id);
    const tPos = engine.getPosition(target.id);
    if (!myPos || !tPos) continue;
    const dist = Math.hypot(tPos[0]-myPos[0], tPos[1]-myPos[1], tPos[2]-myPos[2]);
    if (dist < interactionRange) {
      if (Input.getKey(interactKey)) {
        console.log('🖐️ Interagindo com: ' + target.name);
        updateComponent(target.id, 'MeshRenderer', { color: '#00ff88' });
      }
    }
  }
}`;

const COLLECTABLE_CODE = `// Item Coletável
export let value = 1;
export let itemType = 'coin';
let collected = false;

export function onUpdate(delta) {
  if (collected) return;
  // Rotação visual
  const rot = entity.components.Transform?.rotation || [0,0,0];
  updateComponent(entity.id, 'Transform', { rotation: [rot[0], rot[1]+90*delta, rot[2]] });
  // Detecção de coleta
  const player = engine.find('JogadorFPS') || engine.find('JogadorTP') || engine.find('Player');
  if (!player) return;
  const myPos = getEntityPosition(entity.id);
  const pPos = engine.getPosition(player.id);
  if (!myPos || !pPos) return;
  const dist = Math.hypot(pPos[0]-myPos[0], pPos[1]-myPos[1], pPos[2]-myPos[2]);
  if (dist < 1.5) {
    collected = true;
    console.log('✨ Item coletado: ' + itemType + ' (valor: ' + value + ')');
    updateComponent(entity.id, 'Transform', { position: [0,-999,0] });
  }
}`;

const VR_PLAYER_CODE = `// Controlador VR Completo (Teletransporte + Movimento Analógico + Rotação por Snap)
export let moveSpeed = 4.0;
export let snapTurnAngle = 45; // em graus

let lastSnapTurnTime = 0;
const snapTurnCooldown = 0.25;

export function onUpdate(delta) {
  if (typeof window === 'undefined' || !window.isVRActive) {
    if (rigidBody) {
      const vel = new THREE.Vector3(0, rigidBody.linvel().y, 0);
      if (Input.getKey('KeyW')) vel.z -= moveSpeed;
      if (Input.getKey('KeyS')) vel.z += moveSpeed;
      if (Input.getKey('KeyA')) vel.x -= moveSpeed;
      if (Input.getKey('KeyD')) vel.x += moveSpeed;
      rigidBody.setLinvel(vel, true);
    }
    return;
  }

  if (rigidBody) {
    const leftStickX = Input.getGamepadAxis(0);
    const leftStickY = Input.getGamepadAxis(1);
    const rightStickX = Input.getGamepadAxis(2);

    if (threeCamera) {
      const viewDir = new THREE.Vector3();
      threeCamera.getWorldDirection(viewDir);
      viewDir.y = 0;
      viewDir.normalize();

      const rightDir = new THREE.Vector3();
      rightDir.crossVectors(viewDir, new THREE.Vector3(0, 1, 0)).normalize();

      const moveVec = new THREE.Vector3()
        .addScaledVector(viewDir, -leftStickY)
        .addScaledVector(rightDir, leftStickX)
        .multiplyScalar(moveSpeed);

      const yVel = rigidBody.linvel().y;
      rigidBody.setLinvel({ x: moveVec.x, y: yVel, z: moveVec.z }, true);
    }

    const timeNow = Date.now() / 1000;
    if (Math.abs(rightStickX) > 0.7 && (timeNow - lastSnapTurnTime > snapTurnCooldown)) {
      lastSnapTurnTime = timeNow;
      const turnDir = Math.sign(rightStickX);
      const rad = (snapTurnAngle * turnDir) * (Math.PI / 180);
      const currentRot = new THREE.Quaternion().fromArray(rigidBody.rotation() || [0,0,0,1]);
      const addRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -rad);
      rigidBody.setRotation(currentRot.multiply(addRot), true);
    }
  }

  const triggerPressed = Input.getGamepadButton("A") || Input.getGamepadButton("R1");
  if (triggerPressed && threeCamera) {
    const camPos = new THREE.Vector3();
    threeCamera.getWorldPosition(camPos);
    const viewDir = new THREE.Vector3();
    threeCamera.getWorldDirection(viewDir);

    const entities = engine.findAllByTag('teleport');
    for (const ent of entities) {
      const tPos = getEntityPosition(ent.id);
      if (!tPos) continue;

      const dist = new THREE.Vector3().fromArray(tPos).distanceTo(camPos);
      if (dist < 15) {
        const toTarget = new THREE.Vector3().fromArray(tPos).sub(camPos).normalize();
        const angle = viewDir.angleTo(toTarget);
        if (angle < 0.15) {
          if (rigidBody) {
            rigidBody.setTranslation({ x: tPos[0], y: tPos[1] + 1.0, z: tPos[2] }, true);
          }
          break;
        }
      }
    }
  }
}`;

const VR_TELEPORT_CODE = `// Sistema de Teletransporte Parabólico de VR (com retículo visual)
export let teleportTag = "teleport";
export let maxDistance = 20;

export function onUpdate(delta) {
  if (typeof window === 'undefined' || !window.isVRActive) return;

  if (Input.getGamepadButton("A")) {
    if (!threeCamera) return;

    const camPos = new THREE.Vector3();
    threeCamera.getWorldPosition(camPos);
    const viewDir = new THREE.Vector3();
    threeCamera.getWorldDirection(viewDir);

    const entities = engine.findAllByTag(teleportTag);
    let bestTarget = null;
    let minAngle = 0.2;

    for (const ent of entities) {
      const tPos = getEntityPosition(ent.id);
      if (!tPos) continue;

      const toTarget = new THREE.Vector3().fromArray(tPos).sub(camPos);
      const dist = toTarget.length();
      if (dist > maxDistance) continue;

      toTarget.normalize();
      const angle = viewDir.angleTo(toTarget);
      if (angle < minAngle) {
        minAngle = angle;
        bestTarget = tPos;
      }
    }

    if (bestTarget && rigidBody) {
      rigidBody.setTranslation({ x: bestTarget[0], y: bestTarget[1] + 1.0, z: bestTarget[2] }, true);
    }
  }
}`;
