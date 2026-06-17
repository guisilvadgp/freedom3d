import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { useEditorStore } from '../../editor/store/editorStore';

// ============================================================
// Orion Engine – Game Loop System
// Executa Update/FixedUpdate por frame quando em modo Play
// ============================================================

const FIXED_STEP = 1 / 60; // 60Hz para FixedUpdate

export function GameLoop() {
  const { isPlaying, activeScene, addLog } = useEditorStore();

  const accumulated = useRef(0);
  const frame = useRef(0);
  const started = useRef(false);
  const stopped = useRef(false);

  useFrame((_state, delta) => {
    if (!isPlaying) {
      if (started.current && !stopped.current) {
        stopped.current = true;
        started.current = false;
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
      addLog('info', '▶ Game loop iniciado (Update @ requestAnimationFrame, FixedUpdate @ 60Hz)');
    }

    frame.current++;
    accumulated.current += delta;

    const scene = activeScene();

    // ── Update (todo frame) ──────────────────────────────────
    for (const id of scene.rootEntityIds) {
      const entity = scene.entities[id];
      if (!entity?.active) continue;
      if (entity.components.Script) {
        // TODO: executar ScriptComponent.code via Function() sandboxed
        // engine.emit('update', entity.id, delta);
      }
    }

    // ── FixedUpdate (60Hz fixo) ──────────────────────────────
    while (accumulated.current >= FIXED_STEP) {
      accumulated.current -= FIXED_STEP;
      // TODO: PhysicsSystem.step(FIXED_STEP)
    }
  });

  return null;
}
