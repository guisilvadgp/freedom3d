import { v4 as uuidv4 } from 'uuid';
import type { Entity, EntityId } from './types';

export function createEntity(name: string, parentId: EntityId | null = null): Entity {
  return {
    id: uuidv4(),
    name,
    parentId,
    childrenIds: [],
    active: true,
    tags: [],
    components: {
      Transform: {
        type: 'Transform',
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
    },
  };
}

export function createCube(name = 'Cube'): Entity {
  const e = createEntity(name);
  e.components.MeshRenderer = {
    type: 'MeshRenderer',
    geometry: 'box',
    material: 'standard',
    color: '#4f86c6',
    castShadow: true,
    receiveShadow: true,
  };
  return e;
}

export function createSphere(name = 'Sphere'): Entity {
  const e = createEntity(name);
  e.components.MeshRenderer = {
    type: 'MeshRenderer',
    geometry: 'sphere',
    material: 'standard',
    color: '#c66b4f',
    castShadow: true,
    receiveShadow: true,
  };
  return e;
}

export function createPlane(name = 'Plane'): Entity {
  const e = createEntity(name);
  e.components.Transform!.position = [0, 0, 0];
  e.components.Transform!.rotation = [-90, 0, 0];
  e.components.Transform!.scale = [30, 30, 1];
  e.components.MeshRenderer = {
    type: 'MeshRenderer',
    geometry: 'plane',
    material: 'standard',
    color: '#4caf50',
    castShadow: false,
    receiveShadow: true,
  };
  return e;
}

export function createVRPosition(name = 'VR Position'): Entity {
  const e = createEntity(name);
  e.tags.push('teleport');
  e.components.Transform!.rotation = [90, 0, 0]; // Deitado no chão
  e.components.Transform!.scale = [1, 1, 1];
  e.components.Transform!.position = [0, 0.1, 0]; // Levemente acima do chão
  e.components.MeshRenderer = {
    type: 'MeshRenderer',
    geometry: 'torus',
    material: 'basic',
    color: '#00ffff',
    castShadow: false,
    receiveShadow: false,
  };
  return e;
}

export function createDirectionalLight(name = 'Directional Light'): Entity {
  const e = createEntity(name);
  e.components.Transform!.position = [5, 10, 5];
  e.components.Light = {
    type: 'Light',
    lightType: 'directional',
    color: '#ffffff',
    intensity: 1,
    castShadow: true,
  };
  return e;
}

export function createPointLight(name = 'Point Light'): Entity {
  const e = createEntity(name);
  e.components.Transform!.position = [0, 3, 0];
  e.components.Light = {
    type: 'Light',
    lightType: 'point',
    color: '#ffaa44',
    intensity: 1,
    castShadow: false,
  };
  return e;
}

export function createCamera(name = 'Main Camera'): Entity {
  const e = createEntity(name);
  e.components.Transform!.position = [0, 3, 8];
  e.components.Camera = {
    type: 'Camera',
    fov: 60,
    near: 0.1,
    far: 1000,
    isMain: true,
    offset: [0, 0.4, 0],
  };
  return e;
}

export function createCylinder(name = 'Cylinder'): Entity {
  const e = createEntity(name);
  e.components.MeshRenderer = {
    type: 'MeshRenderer',
    geometry: 'cylinder',
    material: 'standard',
    color: '#6bc44f',
    castShadow: true,
    receiveShadow: true,
  };
  return e;
}

export function createTorus(name = 'Torus'): Entity {
  const e = createEntity(name);
  e.components.MeshRenderer = {
    type: 'MeshRenderer',
    geometry: 'torus',
    material: 'standard',
    color: '#c44fa8',
    castShadow: true,
    receiveShadow: true,
  };
  return e;
}

export function createFirstPersonPlayer(name = 'First Person Player'): Entity {
  const e = createEntity(name);
  e.components.Transform!.position = [0, 2, 0];
  e.components.MeshRenderer = {
    type: 'MeshRenderer',
    geometry: 'cylinder',
    material: 'standard',
    color: '#3498db',
    castShadow: true,
    receiveShadow: true,
  };
  e.components.RigidBody = {
    type: 'RigidBody',
    mass: 1,
    isStatic: false,
    useGravity: true,
    collider: 'cuboid',
  };
  e.components.Camera = {
    type: 'Camera',
    fov: 75,
    near: 0.1,
    far: 1000,
    isMain: true,
    offset: [0, 0.4, 0],
  };
  e.components.Script = {
    type: 'Script',
    scriptName: 'FPSController',
    code: `// Controle em 1a Pessoa
let eulerY = 0;
let eulerX = 0;
const speed = 5;

export function onUpdate(delta) {
  if (typeof window !== 'undefined' && window.isVRActive) return;

  if (Input.getMouseButton(0)) Input.lockMouse();
  if (Input.mouse.isLocked) {
    eulerY -= Input.mouse.movementX * 0.002;
    eulerX -= Input.mouse.movementY * 0.002;
    // Limite o angulo vertical da camera (Pitch) para nao virar de cabeca para baixo
    eulerX = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, eulerX));
  }
  
  if (camera) {
    camera.rotation = [eulerX, 0, 0];
  }
  
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, eulerY, 0));
  if (rigidBody) {
    rigidBody.setRotation(q, true);
    
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const vel = new THREE.Vector3(0, rigidBody.linvel().y, 0);
    
    if (Input.getKey('KeyW')) vel.add(forward.clone().multiplyScalar(speed));
    if (Input.getKey('KeyS')) vel.add(forward.clone().multiplyScalar(-speed));
    if (Input.getKey('KeyA')) vel.add(right.clone().multiplyScalar(-speed));
    if (Input.getKey('KeyD')) vel.add(right.clone().multiplyScalar(speed));
    if (Input.getKey('Space') && Math.abs(vel.y) < 0.1) vel.y = 5;
    
    rigidBody.setLinvel(vel, true);
  }
}`
  };
  return e;
}

export function createThirdPersonPlayer(name = 'Third Person Player'): Entity {
  const e = createEntity(name);
  e.components.Transform!.position = [0, 2, 0];
  e.components.MeshRenderer = {
    type: 'MeshRenderer',
    geometry: 'cylinder',
    material: 'standard',
    color: '#e74c3c',
    castShadow: true,
    receiveShadow: true,
  };
  e.components.RigidBody = {
    type: 'RigidBody',
    mass: 1,
    isStatic: false,
    useGravity: true,
    collider: 'cuboid',
  };
  e.components.Camera = {
    type: 'Camera',
    fov: 75,
    near: 0.1,
    far: 1000,
    isMain: true,
    offset: [0, 2, 4], // Terceira pessoa (Atrás e acima)
  };
  e.components.Script = {
    type: 'Script',
    scriptName: 'TPSController',
    code: `// Controle em 3a Pessoa (Orbital)
let angleX = 0;
let angleY = Math.PI / 6; // angulo inicial da camera
let radius = 5;
const speed = 5;

export function onUpdate(delta) {
  if (Input.getMouseButton(0)) Input.lockMouse();
  if (Input.mouse.isLocked) {
    angleX -= Input.mouse.movementX * 0.005;
    angleY -= Input.mouse.movementY * 0.005;
    angleY = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, angleY));
  }
  
  // Posiciona a camera orbital ao redor do player
  if (camera) {
    camera.offset = [
      Math.sin(angleX) * Math.cos(angleY) * radius,
      Math.sin(angleY) * radius + 1, // +1 para focar acima do chao
      Math.cos(angleX) * Math.cos(angleY) * radius
    ];
    // Faz a camera olhar para o centro do player (0, 0, 0 relativo)
    const lookAtPos = new THREE.Vector3(0, 1, 0);
    const camPos = new THREE.Vector3(camera.offset[0], camera.offset[1], camera.offset[2]);
    const m = new THREE.Matrix4().lookAt(camPos, lookAtPos, new THREE.Vector3(0,1,0));
    const e = new THREE.Euler().setFromRotationMatrix(m);
    camera.rotation = [e.x, e.y, e.z];
  }
  
  if (rigidBody) {
    // Movimentacao relativa a direcao da camera
    const qCam = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angleX, 0));
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(qCam);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(qCam);
    const vel = new THREE.Vector3(0, rigidBody.linvel().y, 0);
    
    let isMoving = false;
    if (Input.getKey('KeyW')) { vel.add(forward.clone().multiplyScalar(speed)); isMoving = true; }
    if (Input.getKey('KeyS')) { vel.add(forward.clone().multiplyScalar(-speed)); isMoving = true; }
    if (Input.getKey('KeyA')) { vel.add(right.clone().multiplyScalar(-speed)); isMoving = true; }
    if (Input.getKey('KeyD')) { vel.add(right.clone().multiplyScalar(speed)); isMoving = true; }
    if (Input.getKey('Space') && Math.abs(vel.y) < 0.1) vel.y = 5;
    
    // Rotaciona o personagem para onde ele esta andando
    if (isMoving) {
      const targetAngle = Math.atan2(vel.x, vel.z);
      const qRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, targetAngle, 0));
      rigidBody.setRotation(qRot, true);
    }
    
    rigidBody.setLinvel(vel, true);
  }
}`
  };
  return e;
}







