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
    code: `// Controle em 1a Pessoa com Gamepad
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
    code: `// Controle em 3a Pessoa (Orbital) com Gamepad
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
      moveDir.add(forward.clone().multiplyScalar(moveForward));
      moveDir.add(right.clone().multiplyScalar(moveRight));
      if (moveDir.lengthSq() > 1) moveDir.normalize();
      vel.add(moveDir.multiplyScalar(currentSpeed));
      isMoving = true;
    }
    
    const jumpPressed = Input.getKey('Space') || Input.getGamepadButton(jumpButton);
    if (jumpPressed && Math.abs(rigidBody.linvel().y) < 0.05) {
      vel.y = jumpForce;
    }
    
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







