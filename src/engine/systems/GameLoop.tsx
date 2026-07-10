import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { useEditorStore } from '../../editor/store/editorStore';
import { getOrCreateHUDCanvas } from '../ecs/types';
import { Input } from './InputManager';
import { useRapier } from '@react-three/rapier';
import * as THREE from 'three';
import { Network } from './NetworkManager';

// ============================================================
// Orion Engine – Game Loop System
// Executa Update/FixedUpdate por frame quando em modo Play
//
// FIXED TIMESTEP ARCHITECTURE:
// Os scripts SEMPRE recebem delta = 1/60 (FIXED_STEP), independente
// da taxa real do renderer (60Hz monitor, 72/90Hz headset VR/AR).
// Isso garante mecânica IDÊNTICA em Screen, VR e AR.
// ============================================================

const FIXED_STEP = 1 / 60; // 60Hz para todos os scripts
const MAX_ACCUMULATED = FIXED_STEP * 5; // Evita espiral da morte (max 5 steps por frame)

export function GameLoop() {
  const isPlaying = useEditorStore(s => s.isPlaying);
  const scene = useEditorStore(s => s.scenes[s.activeSceneId]);
  const addLog = useEditorStore(s => s.addLog);
  const rapierContext = useRapier();

  const accumulated = useRef(0);
  const frame = useRef(0);
  const started = useRef(false);
  const stopped = useRef(false);

  // Cache de scripts compilados e instanciados: entityId -> any
  const compiledScripts = useRef<Record<string, any>>({});

  // Cache das fatias da store para evitar chamadas de getState por frame
  const rigidBodyRefs = useEditorStore(s => s.rigidBodyRefs);
  const rigidBodyRefsRef = useRef(rigidBodyRefs);
  rigidBodyRefsRef.current = rigidBodyRefs;

  const updateComponent = useEditorStore(s => s.updateComponent);
  const updateComponentRef = useRef(updateComponent);
  updateComponentRef.current = updateComponent;

  useFrame((state, delta) => {
    if (!isPlaying) {
      if (started.current && !stopped.current) {
        stopped.current = true;
        started.current = false;
        Input._cleanup();
        Input.unlockMouse();
        addLog('info', `⏹ Game loop encerrado. Frames renderizados: ${frame.current}`);

        // Desconecta do multiplayer
        Network.disconnect();

        // Limpa listeners acumulados de scripts específicos para evitar vazamento de memória e pânico de WASM
        if (typeof window !== 'undefined') {
          if ((window as any)._soccerResetListeners) {
            for (const key of Object.keys((window as any)._soccerResetListeners)) {
              window.removeEventListener('soccer-reset-positions', (window as any)._soccerResetListeners[key]);
            }
            (window as any)._soccerResetListeners = {};
          }
          if ((window as any)._soccerBallListeners) {
            for (const key of Object.keys((window as any)._soccerBallListeners)) {
              if (key === 'kick') {
                window.removeEventListener('ai-kick-ball', (window as any)._soccerBallListeners[key]);
              }
            }
            (window as any)._soccerBallListeners = {};
          }
        }

        frame.current = 0;
        accumulated.current = 0;
      }
      return;
    }

    // Câmera real do jogo: em modo VR state.camera é substituída pela câmera XR do headset.
    // Encontramos a câmera original do jogo para que scripts recebam a referência correta.
    let scriptCamera: THREE.Camera = state.camera;
    if (state.gl.xr.isPresenting) {
      state.scene.traverse((obj) => {
        if (
          obj instanceof THREE.PerspectiveCamera &&
          obj !== state.camera &&
          obj.name !== 'xr-camera' &&
          !(obj as any).isXRCamera
        ) {
          scriptCamera = obj;
        }
      });
    }

    // Inicialização
    if (!started.current) {
      started.current = true;
      stopped.current = false;
      Input._init();
      addLog('info', '▶ Game loop iniciado (Scripts @ 60Hz fixo, independente da taxa do renderer)');

      // Conecta ao multiplayer se houver componente Network na cena
      const hasNetwork = Object.values(scene.entities).some(e => e?.components.Network !== undefined);
      if (hasNetwork) {
        Network.connect({ roomName: scene.name });
      }

      // Compila todos os scripts ativos na cena
      compiledScripts.current = {};
      for (const entity of Object.values(scene.entities)) {
        if (!entity?.active || !entity.components.Script) continue;

        const scriptComp = entity.components.Script as any;
        const instances: any[] = [];

        const compileSingleScript = (name: string, code: string, variables: any[] = []) => {
          try {
            const cleanCode = code
              .replace(/export\s+function\s+/g, 'function ')
              .replace(/export\s+const\s+/g, 'const ')
              .replace(/export\s+let\s+/g, 'let ')
              .replace(/export\s+var\s+/g, 'var ')
              .replace(/export\s+class\s+/g, 'class ');
            const varDeclarations = variables.map((v: any) => `let ${v.name};`).join('\n');
            const varParams = variables.map((v: any) => `_${v.name}`).join(', ');
            const varAssignments = variables.map((v: any) => `${v.name} = _${v.name};`).join('\n');

            const scriptCreator = new Function('rapierContext', 'Math', 'THREE', `
              let entity;
              let delta;
              let updateComponent;
              let Input;
              let rigidBody;
              let camera;
              let getEntityPosition;
              let threeCamera;
              let engine;
              ${varDeclarations}

              function updateFrameData(_entity, _delta, _updateComponent, _Input, _rigidBody, _camera, _getEntityPosition, _threeCamera, _engine${varParams ? ', ' + varParams : ''}) {
                entity = _entity;
                delta = _delta;
                updateComponent = _updateComponent;
                Input = _Input;
                rigidBody = _rigidBody;
                camera = _camera;
                getEntityPosition = _getEntityPosition;
                threeCamera = _threeCamera;
                engine = _engine;
                ${varAssignments}
              }

              ${cleanCode}

              return {
                updateFrameData,
                onUpdate: typeof onUpdate === 'function' ? onUpdate : null,
                onAwake: typeof onAwake === 'function' ? onAwake : null
              };
            `);
            const compiled = scriptCreator(rapierContext, Math, THREE);
            return { compiled, variables };
          } catch (err) {
            addLog('error', `Erro ao compilar script "${name}" em "${entity.name}": ${String(err)}`);
            return null;
          }
        };

        // Compila o script principal
        const mainInst = compileSingleScript(scriptComp.scriptName || 'Main', scriptComp.code || '', scriptComp.variables || []);
        if (mainInst) {
          instances.push(mainInst);
        }

        // Compila os scripts adicionais
        if (scriptComp.scripts && Array.isArray(scriptComp.scripts)) {
          for (const s of scriptComp.scripts) {
            const inst = compileSingleScript(s.scriptName, s.code, s.variables || []);
            if (inst) {
              instances.push(inst);
            }
          }
        }

        if (instances.length > 0) {
          compiledScripts.current[entity.id] = instances;
        }
      }

      // Executa o onAwake em todos os scripts recém-compilados
      const rbRefs = rigidBodyRefsRef.current || {};
      const updComp = updateComponentRef.current;

      const getEntityPosition = (id: string): [number, number, number] | null => {
        const targetEntity = scene.entities[id];
        if (!targetEntity) return null;
        const rb = rbRefs[id];
        if (rb) {
          try {
            const trans = rb.translation();
            return [trans.x, trans.y, trans.z];
          } catch (e) { }
        }
        if (targetEntity.components.Transform?.position) {
          return targetEntity.components.Transform.position;
        }
        return [0, 0, 0];
      };

      for (const entity of Object.values(scene.entities)) {
        if (!entity?.active) continue;
        if (entity.components.HUDPlane) {
          getOrCreateHUDCanvas(entity);
        }
        const instances = compiledScripts.current[entity.id];
        if (instances && Array.isArray(instances)) {
          for (const inst of instances) {
            if (inst.compiled && inst.compiled.onAwake) {
              try {
                const rb = rbRefs[entity.id] || null;
                const varValues = (inst.variables || []).map((v: any) => {
                  if (v.type === 'entity') return scene.entities[v.value] || null;
                  if (v.type === 'component') {
                    const targetEntity = scene.entities[v.entityId];
                    return (targetEntity?.components as any)[v.componentType] || null;
                  }
                  if (v.type === 'number') return Number(v.value);
                  if (v.type === 'boolean') return v.value === 'true';
                  return v.value;
                });

                const engineAPI = {
                  find: (name: string) => {
                    return Object.values(scene.entities).find(e => e && e.name === name) || null;
                  },
                  findByTag: (tag: string) => {
                    return Object.values(scene.entities).find(e => e && e.tags && e.tags.includes(tag)) || null;
                  },
                  findAllByTag: (tag: string) => {
                    return Object.values(scene.entities).filter(e => e && e.tags && e.tags.includes(tag));
                  },
                  getPosition: (id: string): [number, number, number] | null => {
                    return getEntityPosition(id);
                  },
                  updateComponent: (id: string, type: string, patch: any) => {
                    if (updComp) {
                      updComp(id, type as any, patch);
                    }
                  },
                  network: Network
                };

                inst.compiled.updateFrameData(
                  entity,
                  0,
                  updComp,
                  Input,
                  rb,
                  entity.components.Camera,
                  getEntityPosition,
                  scriptCamera, // Câmera real do jogo (não XR)
                  engineAPI,
                  ...varValues
                );
                inst.compiled.onAwake();
              } catch (err) {
                console.error(`Awake script error on ${entity.name}:`, err);
              }
            }
          }
        }
      }
    }

    frame.current++;

    // -- Atualiza estados do Gamepad Bluetooth (VRBox)
    if ((Input as any)._updateGamepadState) {
      (Input as any)._updateGamepadState();
    }

    // ── Acumulador de Tempo Fixo (Fixed Timestep) ────────────────────────────
    // Clampamos o delta real para no máximo MAX_ACCUMULATED para evitar a
    // "espiral da morte" quando o jogo travar por um momento.
    accumulated.current += Math.min(delta, MAX_ACCUMULATED);

    const rbRefs = rigidBodyRefsRef.current || {};
    const updComp = updateComponentRef.current;

    const getEntityPosition = (id: string): [number, number, number] | null => {
      const targetEntity = scene.entities[id];
      if (!targetEntity) return null;
      const rb = rbRefs[id];
      if (rb) {
        try {
          const trans = rb.translation();
          return [trans.x, trans.y, trans.z];
        } catch (e) { }
      }
      if (targetEntity.components.Transform?.position) {
        return targetEntity.components.Transform.position;
      }
      return [0, 0, 0];
    };

    // Consome o acumulador em passos fixos de FIXED_STEP (1/60s)
    // • Monitor 60Hz  → 1 iteração por frame  (1/60 ÷ 1/60 = 1)
    // • Headset 90Hz  → ~2 iterações a cada 3 frames (padrão temporal idêntico a 60Hz)
    // • Headset 72Hz  → ~5 iterações a cada 6 frames (padrão temporal idêntico a 60Hz)
    // RESULTADO: drag, aceleração, inércia → 100% iguais em todos os modos
    while (accumulated.current >= FIXED_STEP) {
      accumulated.current -= FIXED_STEP;

      for (const entity of Object.values(scene.entities)) {
        if (!entity?.active) continue;
        if (entity.components.HUDPlane) {
          getOrCreateHUDCanvas(entity);
        }

        const instances = compiledScripts.current[entity.id];
        if (instances && Array.isArray(instances)) {
          for (const inst of instances) {
            if (inst.compiled && inst.compiled.onUpdate) {
              try {
                const rb = rbRefs[entity.id];

                const varValues = (inst.variables || []).map((v: any) => {
                  if (v.type === 'entity') {
                    return scene.entities[v.value] || null;
                  } else if (v.type === 'component') {
                    const targetEntity = scene.entities[v.entityId];
                    return (targetEntity?.components as any)[v.componentType] || null;
                  } else if (v.type === 'number') {
                    return Number(v.value);
                  } else if (v.type === 'boolean') {
                    return v.value === 'true';
                  } else {
                    return v.value;
                  }
                });

                const engineAPI = {
                  find: (name: string) => {
                    return Object.values(scene.entities).find(e => e && e.name === name) || null;
                  },
                  findByTag: (tag: string) => {
                    return Object.values(scene.entities).find(e => e && e.tags && e.tags.includes(tag)) || null;
                  },
                  findAllByTag: (tag: string) => {
                    return Object.values(scene.entities).filter(e => e && e.tags && e.tags.includes(tag));
                  },
                  getPosition: (id: string): [number, number, number] | null => {
                    return getEntityPosition(id);
                  },
                  updateComponent: (id: string, type: string, patch: any) => {
                    if (updComp) {
                      updComp(id, type as any, patch);
                    }
                  },
                  network: Network
                };

                // Delta SEMPRE = FIXED_STEP (1/60s) — mecânica idêntica em Screen/VR/AR
                inst.compiled.updateFrameData(
                  entity,
                  FIXED_STEP,
                  updComp,
                  Input,
                  rb,
                  entity.components.Camera,
                  getEntityPosition,
                  scriptCamera,
                  engineAPI,
                  ...varValues
                );
                inst.compiled.onUpdate(FIXED_STEP);
              } catch (err) {
                console.error(`Runtime script error on ${entity.name}:`, err);
              }
            }
          }
        }
      }
    }

    // Replicação Multiplayer: Envia posição/rotação do jogador local
    for (const entity of Object.values(scene.entities)) {
      if (entity?.active && entity.components.Network?.isLocal) {
        const rb = rbRefs[entity.id];
        let pos = entity.components.Transform?.position || [0, 0, 0];
        let rot = entity.components.Transform?.rotation || [0, 0, 0];

        if (rb) {
          try {
            const trans = rb.translation();
            pos = [trans.x, trans.y, trans.z];
            const rotQ = rb.rotation();
            const euler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(rotQ.x, rotQ.y, rotQ.z, rotQ.w));
            rot = [euler.x, euler.y, euler.z];
          } catch (e) { }
        }

        Network.sendState(entity.id, { position: pos, rotation: rot });
      }
    }

    Input._resetFrame();
  });

  return null;
}
