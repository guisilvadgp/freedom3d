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
  e.components.Transform!.position = [0, -0.5, 0];
  e.components.Transform!.scale = [10, 1, 10];
  e.components.MeshRenderer = {
    type: 'MeshRenderer',
    geometry: 'plane',
    material: 'standard',
    color: '#3a3a3a',
    castShadow: false,
    receiveShadow: true,
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
  };
  e.components.Camera = {
    type: 'Camera',
    fov: 75,
    near: 0.1,
    far: 1000,
    isMain: true,
  };
  e.components.Script = {
    type: 'Script',
    scriptName: 'FPSController',
    code: `// Controle em 1a Pessoa
export function onUpdate(delta) {
  // A Camera é anexada a esta entidade e herda o transform.
  // Logica simples de giro. No futuro, adicione listeners de mouse/teclado.
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
  };
  e.components.Script = {
    type: 'Script',
    scriptName: 'TPSController',
    code: `// Controle em 3a Pessoa
export function onUpdate(delta) {
  // Lógica de WASD e controle de RigidBody.
}`
  };
  return e;
}


