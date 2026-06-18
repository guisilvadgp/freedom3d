import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { useEditorStore } from '../../editor/store/editorStore';
import { Input } from './InputManager';
import { useRapier } from '@react-three/rapier';
import * as THREE from 'three';

// ============================================================
// Orion Engine – Game Loop System
// Executa Update/FixedUpdate por frame quando em modo Play
// ============================================================

const FIXED_STEP = 1 / 60; // 60Hz para FixedUpdate

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

  useFrame((_state, delta) => {
    if (!isPlaying) {
      if (started.current && !stopped.current) {
        stopped.current = true;
        started.current = false;
        Input._cleanup();
        Input.unlockMouse();
        addLog('info', `⏹ Game loop encerrado. Frames renderizados: ${frame.current}`);
        frame.current = 0;
        accumulated.current = 0;
      }
      return;
    }

    // Inicialização
    if (!started.current) {
      started.current = true;
      stopped.current = false;
      Input._init();
      addLog('info', '▶ Game loop iniciado (Update @ requestAnimationFrame, FixedUpdate @ 60Hz)');
      
      // Compila todos os scripts ativos na cena
      compiledScripts.current = {};
      for (const entity of Object.values(scene.entities)) {
        if (!entity?.active || !entity.components.Script) continue;
        
        const code = entity.components.Script.code;
        try {
          const cleanCode = code.replace(/export function/g, 'function');
          const scriptCreator = new Function('rapierContext', 'Math', 'THREE', `
            let entity;
            let delta;
            let updateComponent;
            let Input;
            let rigidBody;
            let camera;

            function updateFrameData(_entity, _delta, _updateComponent, _Input, _rigidBody, _camera) {
              entity = _entity;
              delta = _delta;
              updateComponent = _updateComponent;
              Input = _Input;
              rigidBody = _rigidBody;
              camera = _camera;
            }

            ${cleanCode}

            return {
              updateFrameData,
              onUpdate: typeof onUpdate === 'function' ? onUpdate : null
            };
          `);
          compiledScripts.current[entity.id] = scriptCreator(rapierContext, Math, THREE);
        } catch(err) {
          addLog('error', `Erro ao compilar script "${entity.name}": ${String(err)}`);
        }
      }
    }

    frame.current++;
    accumulated.current += delta;

    // Atualiza estados do Gamepad Bluetooth (VRBox)
    if ((Input as any)._updateGamepadState) {
      (Input as any)._updateGamepadState();
    }

    // ── Update (todo frame) ──────────────────────────────────
    const rbRefs = rigidBodyRefsRef.current || {};
    const updComp = updateComponentRef.current;
    for (const entity of Object.values(scene.entities)) {
      if (!entity?.active) continue;
      
      const instance = compiledScripts.current[entity.id];
      if (instance && instance.onUpdate) {
        try {
          const rb = rbRefs[entity.id];
          instance.updateFrameData(entity, delta, updComp, Input, rb, entity.components.Camera);
          instance.onUpdate(delta);
        } catch(err) {
          console.error(`Runtime script error on ${entity.name}:`, err);
        }
      }
    }
    Input._resetFrame();

    // ── FixedUpdate (60Hz fixo) ──────────────────────────────
    while (accumulated.current >= FIXED_STEP) {
      accumulated.current -= FIXED_STEP;
      // TODO: PhysicsSystem.step(FIXED_STEP)
    }
  });

  return null;
}



