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
  
  // Cache de funções compiladas: entityId -> Function
  const compiledScripts = useRef<Record<string, Function>>({});

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
          compiledScripts.current[entity.id] = new Function('entity', 'delta', 'updateComponent', 'Input', 'rigidBody', 'camera', 'rapierContext', 'Math', 'THREE', `
            ${cleanCode}
            if (typeof onUpdate === "function") {
              onUpdate(delta);
            }
          `);
        } catch(err) {
          addLog('error', `Erro ao compilar script "${entity.name}": ${String(err)}`);
        }
      }
    }

    frame.current++;
    accumulated.current += delta;

    // ── Update (todo frame) ──────────────────────────────────
    const rigidBodyRefs = useEditorStore.getState().rigidBodyRefs || {};
    for (const entity of Object.values(scene.entities)) {
      if (!entity?.active) continue;
      
      const fn = compiledScripts.current[entity.id];
      if (fn) {
        try {
          const rb = rigidBodyRefs[entity.id];
          fn(entity, delta, useEditorStore.getState().updateComponent, Input, rb, entity.components.Camera, rapierContext, Math, THREE);
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



