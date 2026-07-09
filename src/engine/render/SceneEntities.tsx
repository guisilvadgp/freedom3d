import { XROrigin } from '@react-three/xr';
import { useRef, useState, useEffect, Suspense } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { TransformControls, Edges, Sparkles, PerspectiveCamera } from '@react-three/drei';
import { RigidBody, MeshCollider, CuboidCollider, BallCollider, CapsuleCollider, CylinderCollider, ConeCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useRuntimeStore } from '../runtime/runtimeStore';
import { useShallow } from 'zustand/react/shallow';
import type { Entity } from '../../engine/ecs/types';
import { getOrCreateHUDCanvas, setHUDUpdateCallback } from '../../engine/ecs/types';
import { attemptTeleport } from '../runtime/xrStore';
import { Input } from '../systems/InputManager';
import { GLTFMesh } from './GLTFViewer';
import { HUD3D } from '../systems/HUD';


const HUDPlaneRenderer = ({ entity, isGameView }: { entity: Entity; isGameView: boolean }) => {
  const hudComp = entity.components.HUDPlane;
  if (!hudComp) return null;

  const isPlaying = useRuntimeStore(s => s.isPlaying);
  const { size } = useThree();
  const aspect = size.width / size.height;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  if (!canvasRef.current) {
    canvasRef.current = getOrCreateHUDCanvas(entity);
  }

  // Ajusta o buffer do Canvas para sincronizar com a proporção da tela (aspect ratio)
  const canvas = canvasRef.current;
  if (canvas) {
    const targetHeight = Math.round(1024 / aspect);
    if (canvas.height !== targetHeight) {
      canvas.height = targetHeight;
      if (textureRef.current) {
        textureRef.current.needsUpdate = true;
      }
    }
  }

  // Registra o callback para quando o script chamar updateHUDTexture
  setHUDUpdateCallback(entity.id, () => {
    if (textureRef.current) {
      textureRef.current.needsUpdate = true;
    }
  });

  const targetMatrix = useRef(new THREE.Matrix4());
  const parentInverse = useRef(new THREE.Matrix4());
  const transMatrix = useRef(new THREE.Matrix4());

  // Compila e executa o script do HUD em tempo real (sincronamente no render)
  const lastScriptCode = useRef<string | null>(null);
  const editorScriptInstance = useRef<any>(null);

  const scriptComp = entity.components.Script as any;
  const hudScript = scriptComp?.scripts?.[0] || scriptComp;
  const currentCode = hudScript?.code || null;

  // Reinicia o previewer se o modo Play mudar
  const wasPlaying = useRef(isPlaying);
  if (isPlaying !== wasPlaying.current) {
    wasPlaying.current = isPlaying;
    editorScriptInstance.current = null;
    lastScriptCode.current = null;
  }

  if (!isPlaying && currentCode && currentCode !== lastScriptCode.current) {
    lastScriptCode.current = currentCode;
    try {
      const cleanCode = currentCode
        .replace(/export\s+function\s+/g, 'function ')
        .replace(/export\s+const\s+/g, 'const ')
        .replace(/export\s+let\s+/g, 'let ')
        .replace(/export\s+var\s+/g, 'var ')
        .replace(/export\s+class\s+/g, 'class ');

      const scriptCreator = new Function('THREE', `
        let entity;
        let delta;
        let updateComponent;
        let Input;
        let rigidBody;
        let camera;
        let getEntityPosition;
        let threeCamera;
        let engine;

        function updateFrameData(_entity, _delta, _updateComponent, _Input, _rigidBody, _camera, _getEntityPosition, _threeCamera, _engine) {
          entity = _entity;
          delta = _delta;
          updateComponent = _updateComponent;
          Input = _Input;
          rigidBody = _rigidBody;
          camera = _camera;
          getEntityPosition = _getEntityPosition;
          threeCamera = _threeCamera;
          engine = _engine;
        }

        ${cleanCode}

        return {
          updateFrameData,
          onUpdate: typeof onUpdate === 'function' ? onUpdate : null
        };
      `);
      editorScriptInstance.current = scriptCreator(THREE);
      
      // Executa o script uma vez de forma síncrona para desenhar no canvas antes do primeiro render
      if (editorScriptInstance.current.onUpdate && canvasRef.current) {
        const mockEntity = {
          ...entity,
          HUDCanvas: canvasRef.current,
          updateHUDTexture: () => {
            if (textureRef.current) {
              textureRef.current.needsUpdate = true;
            }
          }
        };
        editorScriptInstance.current.updateFrameData(
          mockEntity,
          0,
          () => {},
          { getKey: () => false, getGamepadButton: () => false },
          null,
          entity.components.Camera,
          () => null,
          new THREE.Camera(),
          {}
        );
        editorScriptInstance.current.onUpdate(0);
      }
    } catch (err) {
      console.warn('Erro ao compilar HUD script em modo de Edição:', err);
      editorScriptInstance.current = null;
    }
  }

  // Anula a escala herdada do pai no modo de edição (quando não está "grudado")
  useFrame((state, delta) => {
    const shouldStick = isPlaying || isGameView;
    const mesh = meshRef.current;
    if (mesh && !shouldStick) {
      if (mesh.parent) {
        const parentScale = new THREE.Vector3();
        mesh.parent.getWorldScale(parentScale);
        if (parentScale.x !== 0 && parentScale.y !== 0 && parentScale.z !== 0) {
          mesh.scale.set(1 / parentScale.x, 1 / parentScale.y, 1 / parentScale.z);
        }
      } else {
        mesh.scale.set(1, 1, 1);
      }
    }

    // Executa a atualização do script do HUD em modo de edição (Realtime Editor Preview)
    if (!isPlaying && editorScriptInstance.current?.onUpdate && canvasRef.current) {
      try {
        const mockEntity = {
          ...entity,
          HUDCanvas: canvasRef.current,
          updateHUDTexture: () => {
            if (textureRef.current) {
              textureRef.current.needsUpdate = true;
            }
          }
        };
        editorScriptInstance.current.updateFrameData(
          mockEntity,
          delta,
          () => {}, // updateComponent
          { getKey: () => false, getGamepadButton: () => false }, // Input
          null, // rigidBody
          entity.components.Camera,
          () => null, // getEntityPosition
          state.camera,
          {} // engine API
        );
        editorScriptInstance.current.onUpdate(delta);
      } catch (err) {
        console.error('Erro ao executar HUD script em modo de Edição:', err);
      }
    }
  });

  const handleBeforeRender = (renderer: any, scene: any, currentCamera: THREE.Camera) => {
    const shouldStick = isPlaying || isGameView;
    const mesh = meshRef.current;
    if (mesh) {
      if (shouldStick) {
        mesh.matrixAutoUpdate = false;
        
        // 1. Obtém a matriz global da câmera e decompõe para neutralizar qualquer escala
        targetMatrix.current.copy(currentCamera.matrixWorld);
        const camPos = new THREE.Vector3();
        const camQuat = new THREE.Quaternion();
        const camScale = new THREE.Vector3();
        targetMatrix.current.decompose(camPos, camQuat, camScale);
        
        // Reconstrói a matriz da câmera com escala [1, 1, 1] absoluta
        targetMatrix.current.compose(camPos, camQuat, new THREE.Vector3(1, 1, 1));

        const dist = hudComp.distance ?? 0.5;
        transMatrix.current.makeTranslation(0, 0, -dist);
        targetMatrix.current.multiply(transMatrix.current);
        
        // 2. Anula a transformação do pai no grafo 3D
        if (mesh.parent) {
          parentInverse.current.copy(mesh.parent.matrixWorld).invert();
          mesh.matrix.copy(parentInverse.current).multiply(targetMatrix.current);
          mesh.matrixWorld.multiplyMatrices(mesh.parent.matrixWorld, mesh.matrix);
        } else {
          mesh.matrix.copy(targetMatrix.current);
          mesh.matrixWorld.copy(mesh.matrix);
        }
      } else {
        mesh.matrixAutoUpdate = true;
      }
    }
  };

  const h = hudComp.height ?? 0.9;
  const w = h * aspect;

  return (
    <mesh ref={meshRef} onBeforeRender={handleBeforeRender} frustumCulled={false}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial
        transparent
        opacity={hudComp.opacity ?? 0.8}
        depthTest={!isGameView} // Se isGameView for true, depthTest fica false (sempre sobrepondo)
        depthWrite={!isGameView}
        toneMapped={false}
      >
        <canvasTexture
          key={`${canvas.width}-${canvas.height}`}
          ref={textureRef}
          attach="map"
          image={canvasRef.current}
          colorSpace={THREE.SRGBColorSpace}
        />
      </meshBasicMaterial>
      {!isGameView && (
        <Edges color={hudComp.color || "#00ffff"} />
      )}
    </mesh>
  );
};

function StereoGeometry({
  projection,
  stereoMode,
  eye,
  width,
  height,
  segmentsX,
  segmentsY,
  curveAmount,
  curveDirection,
}: {
  projection: 'plane' | 'sphere360' | 'sphere180';
  stereoMode: 'none' | 'sbs' | 'tb';
  eye: 'left' | 'right' | 'none';
  width: number;
  height: number;
  segmentsX: number;
  segmentsY: number;
  curveAmount: number;
  curveDirection: 'horizontal' | 'vertical';
}) {
  const geomRef = useRef<THREE.BufferGeometry>(null);

  useEffect(() => {
    const geometry = geomRef.current;
    if (!geometry) return;

    // Se for projeção de plano, aplica curvatura
    if (projection === 'plane') {
      const posAttr = geometry.attributes.position;
      if (posAttr) {
        const count = posAttr.count;
        const halfW = width / 2;
        const halfH = height / 2;

        for (let i = 0; i < count; i++) {
          // Reconstrói coordenadas originais do plano para evitar acúmulo de deformações
          const col = i % (segmentsX + 1);
          const row = Math.floor(i / (segmentsX + 1));
          
          const x = col * (width / segmentsX) - halfW;
          const y = halfH - row * (height / segmentsY);
          
          let z = 0;
          if (curveAmount !== 0) {
            if (curveDirection === 'horizontal') {
              z = curveAmount * (1.0 - Math.pow(x / (halfW || 1), 2));
            } else {
              z = curveAmount * (1.0 - Math.pow(y / (halfH || 1), 2));
            }
          }
          posAttr.setXYZ(i, x, y, z);
        }
        posAttr.needsUpdate = true;
        geometry.computeVertexNormals();
      }
    }

    // Modifica as coordenadas UV baseando-se no mapeamento de estereoscopia
    const uvAttr = geometry.attributes.uv;
    if (uvAttr) {
      const count = uvAttr.count;
      for (let i = 0; i < count; i++) {
        // Reconstrói as coordenadas UV padrão baseadas no índice
        const col = i % (segmentsX + 1);
        const row = Math.floor(i / (segmentsX + 1));
        
        let u = col / segmentsX;
        let v = 1.0 - (row / segmentsY);

        // Se for projeção esférica, inverte o U horizontalmente para renderizar correto por dentro
        if (projection !== 'plane') {
          u = 1.0 - u;
        }

        if (stereoMode === 'sbs') {
          if (eye === 'left') {
            u = u * 0.5; // Metade esquerda
          } else if (eye === 'right') {
            u = u * 0.5 + 0.5; // Metade direita
          }
        } else if (stereoMode === 'tb') {
          if (eye === 'left') {
            v = v * 0.5 + 0.5; // Metade superior
          } else if (eye === 'right') {
            v = v * 0.5; // Metade inferior
          }
        }

        uvAttr.setXY(i, u, v);
      }
      uvAttr.needsUpdate = true;
    }
  }, [projection, stereoMode, eye, width, height, segmentsX, segmentsY, curveAmount, curveDirection]);

  if (projection === 'sphere360') {
    return (
      <sphereGeometry
        ref={geomRef as any}
        args={[width || 5, segmentsX || 60, segmentsY || 40]}
      />
    );
  }

  if (projection === 'sphere180') {
    // Meia esfera para domo imersivo 180°
    return (
      <sphereGeometry
        ref={geomRef as any}
        args={[width || 5, segmentsX || 60, segmentsY || 40, -Math.PI / 2, Math.PI, 0, Math.PI]}
      />
    );
  }

  return (
    <planeGeometry
      ref={geomRef as any}
      args={[width, height, segmentsX, segmentsY]}
    />
  );
}

const VideoMeshRenderer = ({ entity, isGameView }: { entity: Entity; isGameView: boolean }) => {
  const videoComp = entity.components.VideoMesh;
  if (!videoComp) return null;

  const isPlaying = useRuntimeStore(s => s.isPlaying);
  const isSelected = useRuntimeStore(s => s.selectedEntityId === entity.id);

  const { gl } = useThree();
  const [isPresenting, setIsPresenting] = useState(gl.xr.isPresenting);

  useEffect(() => {
    const handleSessionStart = () => setIsPresenting(true);
    const handleSessionEnd = () => setIsPresenting(false);

    gl.xr.addEventListener('sessionstart', handleSessionStart);
    gl.xr.addEventListener('sessionend', handleSessionEnd);

    // Initial check
    setIsPresenting(gl.xr.isPresenting);

    return () => {
      gl.xr.removeEventListener('sessionstart', handleSessionStart);
      gl.xr.removeEventListener('sessionend', handleSessionEnd);
    };
  }, [gl]);

  const leftMeshRef = useRef<THREE.Mesh>(null);
  const rightMeshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    const leftMesh = leftMeshRef.current;
    if (leftMesh) {
      if (isPresenting) {
        leftMesh.layers.set(1); // Left eye in VR
      } else {
        leftMesh.layers.set(0); // Screen in desktop
      }
    }
  }, [isPresenting]);

  useEffect(() => {
    const rightMesh = rightMeshRef.current;
    if (rightMesh) {
      rightMesh.layers.set(2); // Right eye in VR
    }
  }, []);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoTexture, setVideoTexture] = useState<THREE.VideoTexture | null>(null);

  const mat1Ref = useRef<THREE.MeshBasicMaterial>(null);
  const mat2Ref = useRef<THREE.MeshBasicMaterial>(null);
  const mat3Ref = useRef<THREE.MeshBasicMaterial>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const pointLightRef = useRef<THREE.PointLight>(null);

  const lastKeysPressed = useRef<Record<string, boolean>>({});
  const lastGamepadPressed = useRef<Record<string, boolean>>({});

  // Força o Three.js a recompilar o shader do material ativando texturização assim que a textura do vídeo estiver pronta
  useEffect(() => {
    if (videoTexture) {
      if (mat1Ref.current) mat1Ref.current.needsUpdate = true;
      if (mat2Ref.current) mat2Ref.current.needsUpdate = true;
      if (mat3Ref.current) mat3Ref.current.needsUpdate = true;
    }
  }, [videoTexture]);

  const width = videoComp.width ?? 2.0;
  const height = videoComp.height ?? 1.125;
  const curveAmount = videoComp.curveAmount ?? 0.0;
  const curveDirection = videoComp.curveDirection ?? 'horizontal';
  const segmentsX = videoComp.segmentsX ?? 32;
  const segmentsY = videoComp.segmentsY ?? 32;
  const projection = videoComp.projection ?? 'plane';
  const stereoMode = videoComp.stereoMode ?? 'none';

  // Setup element video e textura
  useEffect(() => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    video.loop = videoComp.loop ?? true;
    video.muted = videoComp.muted ?? false;
    video.volume = videoComp.volume ?? 1.0;

    // Garante que o elemento de vídeo esteja no DOM de forma oculta
    // Alguns navegadores/Chromium suspendem a decodificação de frames de vídeo
    // se o elemento não estiver anexado ao DOM do documento.
    video.style.position = 'absolute';
    video.style.width = '0px';
    video.style.height = '0px';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    document.body.appendChild(video);

    if (videoComp.videoUrl) {
      video.src = videoComp.videoUrl;
    }

    videoRef.current = video;

    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    setVideoTexture(texture);

    const handleFrameUpdate = () => {
      texture.needsUpdate = true;
    };
    video.addEventListener('loadeddata', handleFrameUpdate);
    video.addEventListener('seeked', handleFrameUpdate);

    if (isPlaying && videoComp.autoPlay && videoComp.play) {
      video.play().catch(() => {});
    }

    return () => {
      video.removeEventListener('loadeddata', handleFrameUpdate);
      video.removeEventListener('seeked', handleFrameUpdate);
      video.pause();
      if (document.body.contains(video)) {
        document.body.removeChild(video);
      }
      video.removeAttribute('src');
      video.load();
      texture.dispose();
      setVideoTexture(null);
    };
  }, [videoComp.videoUrl, isPlaying]);

  // Controle de reprodução em tempo real
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.loop = videoComp.loop ?? true;
    video.muted = videoComp.muted ?? false;
    video.volume = videoComp.volume ?? 1.0;

    if (isPlaying) {
      if (videoComp.play) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    } else {
      video.pause();
    }
  }, [videoComp.play, videoComp.loop, videoComp.muted, videoComp.volume, isPlaying]);

  // Força atualização da textura a cada frame de renderização e atualiza a luz emissiva se ativo
  useFrame(() => {
    const video = videoRef.current;
    if (!video) return;

    if (videoTexture && !video.paused) {
      videoTexture.needsUpdate = true;

      // Se a influência de luz estiver ativada, lê a cor média do frame do vídeo
      if (videoComp.lightInfluence) {
        if (!canvasRef.current) {
          canvasRef.current = document.createElement('canvas');
          canvasRef.current.width = 1;
          canvasRef.current.height = 1;
          ctxRef.current = canvasRef.current.getContext('2d');
        }

        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (ctx) {
          try {
            // Desenha o frame atual reduzido no canvas de 1x1 pixel
            ctx.drawImage(video, 0, 0, 1, 1);
            const pixel = ctx.getImageData(0, 0, 1, 1).data;
            
            // Atualiza a cor da pointLight física com o RGB extraído do frame
            if (pointLightRef.current) {
              pointLightRef.current.color.setRGB(pixel[0] / 255, pixel[1] / 255, pixel[2] / 255);
            }
          } catch (e) {
            // Evita erros de segurança do canvas por restrições de CORS
          }
        }
      }
    }

    // Gerenciamento de input (teclado e controle) se o simulador estiver rodando
    if (isPlaying) {
      const wasKeyPressedThisFrame = (code: string) => {
        const isPressed = Input.getKey(code);
        const wasPressed = !!lastKeysPressed.current[code];
        lastKeysPressed.current[code] = isPressed;
        return isPressed && !wasPressed;
      };

      const wasGamepadButtonPressedThisFrame = (btn: string) => {
        const isPressed = Input.getGamepadButton(btn);
        const wasPressed = !!lastGamepadPressed.current[btn];
        lastGamepadPressed.current[btn] = isPressed;
        return isPressed && !wasPressed;
      };

      // 1. Alternar Play/Pause com Triângulo (D) no Gamepad
      if (wasGamepadButtonPressedThisFrame('D')) {
        if (video.paused) {
          video.play().catch(() => {});
          useRuntimeStore.getState().updateComponent(entity.id, 'VideoMesh', { play: true });
        } else {
          video.pause();
          useRuntimeStore.getState().updateComponent(entity.id, 'VideoMesh', { play: false });
        }
      }

      // 2. Avançar / Retroceder com Teclado (ArrowLeft/ArrowRight) ou Gamepad (L2/R2)
      const stepSeconds = 5; // Salto de 5 segundos
      if (wasKeyPressedThisFrame('ArrowLeft') || wasGamepadButtonPressedThisFrame('L2')) {
        video.currentTime = Math.max(0, video.currentTime - stepSeconds);
      }
      if (wasKeyPressedThisFrame('ArrowRight') || wasGamepadButtonPressedThisFrame('R2')) {
        video.currentTime = Math.min(video.duration || 0, video.currentTime + stepSeconds);
      }
    }
  });

  // Define qual o side do material (renderizar por dentro na esfera)
  const side = (projection === 'sphere360' || projection === 'sphere180') ? THREE.BackSide : THREE.DoubleSide;

  const lightElement = videoComp.lightInfluence && (
    <pointLight
      ref={pointLightRef}
      position={[0, 0, 0.8]} // Ligeiramente à frente da tela
      intensity={videoComp.lightIntensity ?? 2.0}
      distance={videoComp.lightDistance ?? 15.0}
      decay={1.2}
      castShadow={false}
    />
  );

  if (stereoMode === 'none') {
    return (
      <group>
        <mesh>
          <StereoGeometry
            projection={projection}
            stereoMode={stereoMode}
            eye="none"
            width={width}
            height={height}
            segmentsX={segmentsX}
            segmentsY={segmentsY}
            curveAmount={curveAmount}
            curveDirection={curveDirection}
          />
          <meshBasicMaterial
            ref={mat1Ref}
            side={side}
            toneMapped={false}
            map={videoTexture || undefined}
          />
          {isSelected && !isGameView && (
            <Edges scale={1.01} color="#44aaff" />
          )}
        </mesh>
        {lightElement}
      </group>
    );
  }

  // Se for estereoscópico (SBS ou TB), renderiza dois meshes (olho esquerdo e olho direito) + a luz física
  return (
    <group>
      {/* Olho Esquerdo (Visível no olho esquerdo no VR e na tela desktop) */}
      <mesh ref={leftMeshRef}>
        <StereoGeometry
          projection={projection}
          stereoMode={stereoMode}
          eye="left"
          width={width}
          height={height}
          segmentsX={segmentsX}
          segmentsY={segmentsY}
          curveAmount={curveAmount}
          curveDirection={curveDirection}
        />
        <meshBasicMaterial
          ref={mat2Ref}
          side={side}
          toneMapped={false}
          map={videoTexture || undefined}
        />
        {isSelected && !isGameView && (
          <Edges scale={1.01} color="#44aaff" />
        )}
      </mesh>

      {/* Olho Direito (Apenas visível no olho direito no VR) */}
      <mesh ref={rightMeshRef}>
        <StereoGeometry
          projection={projection}
          stereoMode={stereoMode}
          eye="right"
          width={width}
          height={height}
          segmentsX={segmentsX}
          segmentsY={segmentsY}
          curveAmount={curveAmount}
          curveDirection={curveDirection}
        />
        <meshBasicMaterial
          ref={mat3Ref}
          side={side}
          toneMapped={false}
          map={videoTexture || undefined}
        />
      </mesh>
      {lightElement}
    </group>
  );
};

// ── Audio Listener Global Singleton ──────────────────────────
let globalAudioListener: THREE.AudioListener | null = null;

function getGlobalAudioListener(): THREE.AudioListener {
  if (!globalAudioListener) {
    globalAudioListener = new THREE.AudioListener();
    globalAudioListener.name = 'global-audio-listener';
  }
  return globalAudioListener;
}

function GlobalAudioListenerHandler() {
  const camera = useThree(s => s.camera);
  const isPlaying = useRuntimeStore(s => s.isPlaying);
  
  useEffect(() => {
    const listener = getGlobalAudioListener();

    const resumeContext = () => {
      if (listener.context && listener.context.state === 'suspended') {
        listener.context.resume().then(() => {
          console.log("AudioContext retomado via evento de captura.");
          cleanup();
        }).catch(err => {
          console.warn("Falha ao retomar AudioContext:", err);
        });
      } else if (listener.context && listener.context.state === 'running') {
        cleanup();
      }
    };

    const cleanup = () => {
      window.removeEventListener('click', resumeContext, { capture: true });
      window.removeEventListener('touchstart', resumeContext, { capture: true });
      window.removeEventListener('mousedown', resumeContext, { capture: true });
      window.removeEventListener('keydown', resumeContext, { capture: true });
    };

    // Registra na fase de captura para contornar e.stopPropagation() dos elementos da UI
    window.addEventListener('click', resumeContext, { capture: true });
    window.addEventListener('touchstart', resumeContext, { capture: true });
    window.addEventListener('mousedown', resumeContext, { capture: true });
    window.addEventListener('keydown', resumeContext, { capture: true });

    // Remove do pai antigo se houver
    if (listener.parent) {
      listener.parent.remove(listener);
    }

    // Reseta posição e rotação local para alinhar perfeitamente com a câmera ativa
    listener.position.set(0, 0, 0);
    listener.quaternion.set(0, 0, 0, 1);

    // Adiciona o listener diretamente como filho da câmera ativa
    camera.add(listener);

    return () => {
      camera.remove(listener);
      cleanup();
    };
  }, [camera]);

  // Força retomar o AudioContext ao iniciar a simulação (Play) ou suspende tudo no (Stop)
  useEffect(() => {
    const listener = getGlobalAudioListener();
    if (isPlaying) {
      if (listener && listener.context && listener.context.state === 'suspended') {
        listener.context.resume().then(() => {
          console.log('AudioContext retomado ao iniciar simulacao (Play).');
        }).catch(err => {
          console.warn("Falha ao retomar AudioContext no Play:", err);
        });
      }
    } else {
      // Se parou de reproduzir (Stop)
      // Suspende o AudioContext principal do Three.js para garantir silêncio absoluto
      if (listener && listener.context && listener.context.state === 'running') {
        listener.context.suspend().then(() => {
          console.log('AudioContext suspenso ao parar simulacao (Stop).');
        }).catch(err => {
          console.warn("Falha ao suspender AudioContext no Stop:", err);
        });
      }

      // Pausa e desliga todos os áudios HTML5 no DOM
      if (typeof window !== 'undefined') {
        document.querySelectorAll('audio').forEach(el => {
          try {
            el.pause();
            el.currentTime = 0;
          } catch (e) {}
        });

        // Pausa e reseta todos os objetos de áudio rastreados criados por scripts (new Audio)
        if ((window as any).__orion_active_audios__) {
          (window as any).__orion_active_audios__.forEach((aud: any) => {
            try {
              aud.pause();
              aud.currentTime = 0;
            } catch (e) {}
          });
        }
      }
    }
  }, [isPlaying]);

  return null;
}

// ── Perspective Camera Wrapper ──────────────────────────────
// Updates position and rotation on every frame (60fps) directly in Three.js
// avoiding React re-renders while keeping script mutations synchronized.
// Cache global de anéis de teleporte — evita scene.traverse() a cada frame
const _teleportRingCache = new Map<string, THREE.Object3D[]>();
let _teleportRingCacheKey = '';

function getTeleportRings(scene: THREE.Scene, sceneKey: string): THREE.Object3D[] {
  if (_teleportRingCacheKey === sceneKey && _teleportRingCache.has(sceneKey)) {
    return _teleportRingCache.get(sceneKey)!;
  }
  const rings: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (o.userData?.isTeleportRing) rings.push(o);
  });
  _teleportRingCache.set(sceneKey, rings);
  _teleportRingCacheKey = sceneKey;
  return rings;
}

// Invalida o cache quando a cena mudar (chamado externamente)
export function invalidateTeleportRingCache() {
  _teleportRingCacheKey = '';
}

function PerspectiveCameraWrapper({ entity, camera, isGameView, isStandalone }: { entity: Entity; camera: any; isGameView: boolean; isStandalone: boolean }) {
  const ref = useRef<THREE.PerspectiveCamera>(null);
  const [initialHeadsetHeight, setInitialHeadsetHeight] = useState<number | null>(null);

  const { gl, scene, camera: defaultCamera } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const hoveredRing = useRef<any>(null);
  const crosshairRef = useRef<THREE.Mesh>(null);
  const sceneActiveId = useRuntimeStore(s => s.activeSceneId);

  // Seletores reativos via ref para evitar getState() por frame
  const rigidBodyRefs = useRuntimeStore(s => s.rigidBodyRefs);
  const rigidBodyRefsRef = useRef(rigidBodyRefs);
  rigidBodyRefsRef.current = rigidBodyRefs;

  const updateComponent = useRuntimeStore(s => s.updateComponent);
  const updateComponentRef = useRef(updateComponent);
  updateComponentRef.current = updateComponent;

  // Cache de vetores para evitar garbage collection a 60fps
  const forwardVec = useRef(new THREE.Vector3());
  const rightVec = useRef(new THREE.Vector3());
  const moveVec = useRef(new THREE.Vector3());

  // Rastreamento local da rotação Y
  const currentRotationY = useRef(entity.components.Transform?.rotation?.[1] || 0);
  useEffect(() => {
    currentRotationY.current = entity.components.Transform?.rotation?.[1] || 0;
  }, [entity.id]);

  // Timestamps para throttling
  const lastRotationUpdate = useRef(0);
  const lastPositionUpdate = useRef(0);
  const handleSelectRef = useRef<() => void>(null!);
  const lastTriggerPressed = useRef(false);
  const gazeDirectionRef = useRef(new THREE.Vector3(0, 0, -1));
  const gazeOriginRef = useRef(new THREE.Vector3(0, 0, 0));
  const isCrouching = useRef(false);
  const cachedPlayerId = useRef<string | null>(null);
  useEffect(() => {
    cachedPlayerId.current = null;
  }, [sceneActiveId]);

  // Setup WebXR "Tap" Event
  useEffect(() => {
    if (!isStandalone) return;
    const xr = gl.xr;
    let session: any = null;

    const handleSelect = () => {
      // Usa a direção e origem sincronizadas no loop principal (useFrame)
      raycaster.current.ray.origin.copy(gazeOriginRef.current);
      raycaster.current.ray.direction.copy(gazeDirectionRef.current);

      // Usa cache de anéis para evitar intersectObjects em toda a cena
      const rings = getTeleportRings(scene as any, sceneActiveId);
      const intersects = raycaster.current.intersectObjects(rings, false);
      const hit = intersects.find(i => i.object.userData?.isTeleportRing);
      if (hit && hit.object.userData.onClick) {
        hit.object.userData.onClick({ stopPropagation: () => { } });
        return;
      }
    };

    handleSelectRef.current = handleSelect;

    const onSessionStart = () => {
      session = xr.getSession();
      if (session) session.addEventListener('select', handleSelect);
    };

    const onSessionEnd = () => {
      if (session) session.removeEventListener('select', handleSelect);
      session = null;
    };

    xr.addEventListener('sessionstart', onSessionStart);
    xr.addEventListener('sessionend', onSessionEnd);

    return () => {
      xr.removeEventListener('sessionstart', onSessionStart);
      xr.removeEventListener('sessionend', onSessionEnd);
      if (session) session.removeEventListener('select', handleSelect);
    };
  }, [gl, scene, defaultCamera, isStandalone, sceneActiveId]);

  useFrame((state, delta) => {
    if (ref.current && camera) {
      if (camera.offset) {
        ref.current.position.set(camera.offset[0], camera.offset[1], camera.offset[2]);
      }
      if (camera.rotation) {
        ref.current.rotation.set(camera.rotation[0], camera.rotation[1], camera.rotation[2]);
      }
      
      // Neutraliza a escala herdada do pai (ex: Drone) na câmera de renderização para evitar distorcer o mundo
      if (ref.current.parent) {
        const parentScale = new THREE.Vector3();
        ref.current.parent.getWorldScale(parentScale);
        if (parentScale.x !== 0 && parentScale.y !== 0 && parentScale.z !== 0) {
          ref.current.scale.set(1 / parentScale.x, 1 / parentScale.y, 1 / parentScale.z);
        }
      }
    }

    // No modo AR/MR simulado (TV) o jogo roda como "Screen mode": não
    // aplicamos locomoção VR, gaze nem tomada da câmera XR no drone.
    const simulatedAR = typeof window !== 'undefined' && (window as any).__freedom3d_simulated_ar__;

    if (state.gl.xr.isPresenting && !simulatedAR) {
      if (typeof window !== 'undefined') {
        (window as any).isVRActive = true;
      }

      const xrCamera = (state.gl.xr as any).getCamera(state.camera);
      const subCam = xrCamera.cameras?.[0] || xrCamera;
      
      const subCamPos = new THREE.Vector3();
      const subCamQuat = new THREE.Quaternion();
      const subCamScale = new THREE.Vector3();
      if (subCam) {
        subCam.matrixWorld.decompose(subCamPos, subCamQuat, subCamScale);
      }

      if (subCam && initialHeadsetHeight === null) {
        const y = subCamPos.y;
        if (y > 0.1) {
          setInitialHeadsetHeight(y);
        }
      }

      // Sincroniza a posição e direção do olhar a cada frame
      if (subCam) {
        gazeOriginRef.current.copy(subCamPos);
        const e = subCam.matrixWorld.elements;
        gazeDirectionRef.current.set(-e[8], -e[9], -e[10]).normalize();
      }

      // VR Gaze (Hovering) — throttle a 10 frames/s e usa cache de rings
      if (isStandalone) {
        const now = performance.now();
        const lastRaycast = (raycaster.current as any).lastTime || 0;

        if (now - lastRaycast > 100) { // Throttle: 10fps é suficiente para hover de anéis
          (raycaster.current as any).lastTime = now;
          raycaster.current.ray.origin.copy(gazeOriginRef.current);
          raycaster.current.ray.direction.copy(gazeDirectionRef.current);

          // Cache de anéis — sem traverse toda frame!
          const rings = getTeleportRings(state.scene as any, sceneActiveId);
          const intersects = raycaster.current.intersectObjects(rings, false);
          const hit = intersects[0];
          if (hit) {
            if (hoveredRing.current !== hit.object) {
              if (hoveredRing.current?.userData.setHovered) hoveredRing.current.userData.setHovered(false);
              hoveredRing.current = hit.object;
              if (hoveredRing.current?.userData.setHovered) hoveredRing.current.userData.setHovered(true);
            }
          } else {
            if (hoveredRing.current) {
              if (hoveredRing.current.userData.setHovered) hoveredRing.current.userData.setHovered(false);
              hoveredRing.current = null;
            }
          }
        }

        // Atualizar a posicao do crosshair para grudar no rosto do jogador usando a pose sincronizada
        if (crosshairRef.current && subCam) {
          const localPos = subCamPos.clone();
          const localQuat = subCamQuat.clone();

          if (crosshairRef.current.parent) {
            crosshairRef.current.parent.worldToLocal(localPos);
            const parentWorldQuat = new THREE.Quaternion();
            crosshairRef.current.parent.getWorldQuaternion(parentWorldQuat);
            localQuat.premultiply(parentWorldQuat.invert());
          }

          crosshairRef.current.position.copy(localPos);
          crosshairRef.current.quaternion.copy(localQuat);
          crosshairRef.current.translateZ(-1.5);
        }
      }

      // VR Locomotion (Smooth movement + turning, Jump + Crouch)
      const session = state.gl.xr.getSession();
      if (session) {
        let moveX = 0;
        let moveZ = 0;
        let turnX = 0;
        let jumpPressed = false;
        let crouchPressed = false;

        for (const source of session.inputSources) {
          if (source.gamepad) {
            const axes = source.gamepad.axes;
            const buttons = source.gamepad.buttons;
            
            if (source.handedness === 'left') {
              if (axes.length >= 4) {
                moveX = axes[2];
                moveZ = axes[3];
              }
              // Grip no controle esquerdo para agachar
              if (buttons.length > 1 && buttons[1].pressed) {
                crouchPressed = true;
              }
            } else if (source.handedness === 'right') {
              if (axes.length >= 4) {
                turnX = axes[2];
              }
              // Botão A do controle direito (buttons[4]) para pular
              if (buttons.length > 4 && buttons[4].pressed) {
                jumpPressed = true;
              }
              // Botão B do controle direito (buttons[5]) para agachar
              if (buttons.length > 5 && buttons[5].pressed) {
                crouchPressed = true;
              }
            }
          }
        }

        // Lê a configuração salva do gamepad Bluetooth (VRBox)
        const configStr = typeof window !== 'undefined' ? localStorage.getItem('freedom3d_gamepad_config') : null;
        const config = configStr ? JSON.parse(configStr) : {
          triggerButton: 0,
          moveAxisX: 0,
          moveAxisY: 1,
          invertX: false,
          invertY: false,
          buttonA: 0,
          buttonB: 1,
          buttonC: 2,
          buttonD: 3
        };

        const gamepads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
        let extTriggerPressed = false;

        for (const gp of gamepads) {
          if (gp && gp.connected) {
            // Skip Android motion sensors / gyros often reported as gamepads in Chrome
            const idLower = gp.id ? gp.id.toLowerCase() : '';
            if (idLower.includes('sensor') || idLower.includes('motion') || idLower.includes('accelerometer') || idLower.includes('gyro')) {
              continue;
            }
            // Skip devices with no buttons
            if (!gp.buttons || gp.buttons.length === 0) {
              continue;
            }

            if (gp.axes.length > Math.max(config.moveAxisX, config.moveAxisY)) {
              const gpX = gp.axes[config.moveAxisX];
              const gpY = gp.axes[config.moveAxisY];
              const finalX = config.invertX ? -gpX : gpX;
              const finalY = config.invertY ? -gpY : gpY;
              if (Math.abs(finalX) > 0.05) moveX = finalX;
              if (Math.abs(finalY) > 0.05) moveZ = finalY;
            }

            if (gp.buttons.length > config.triggerButton) {
              const btn = gp.buttons[config.triggerButton];
              if (btn.pressed || btn.value > 0.5) {
                extTriggerPressed = true;
              }
            }

            // Mapeamentos de Pular (A) e Agachar (C) do Gamepad Bluetooth
            if (gp.buttons.length > config.buttonA && (gp.buttons[config.buttonA].pressed || gp.buttons[config.buttonA].value > 0.5)) {
              jumpPressed = true;
            }
            if (gp.buttons.length > config.buttonC && (gp.buttons[config.buttonC].pressed || gp.buttons[config.buttonC].value > 0.5)) {
              crouchPressed = true;
            }
            break;
          }
        }

        // Fallbacks de Teclado no VR
        if (Input.getKey('Space')) {
          jumpPressed = true;
        }
        if (Input.getKey('ControlLeft') || Input.getKey('KeyC')) {
          crouchPressed = true;
        }

        // Dispara o clique do gatilho configurado
        if (extTriggerPressed) {
          if (!lastTriggerPressed.current) {
            lastTriggerPressed.current = true;
            if (handleSelectRef.current) {
              handleSelectRef.current();
            }
          }
        } else {
          lastTriggerPressed.current = false;
        }

        // Resolve a entidade alvo (player físico) para aplicar a locomoção, rotação, pulo e agachamento
        const storeState = useRuntimeStore.getState();
        const currentScene = storeState.activeScene();
        if (currentScene) {
          if (!cachedPlayerId.current || !currentScene.entities[cachedPlayerId.current]) {
            // Apenas entidades explícitas com a tag 'player' são controladas pela
            // locomoção VR. Câmeras isMain (ex.: drone FPV) NÃO devem ser
            // sequestradas — assim o drone voa só pelo próprio script, igual ao Screen.
            const found = Object.values(currentScene.entities).find(e => e.tags?.includes('player'));
            cachedPlayerId.current = found?.id ?? null;
          }
        }
        const targetEntity = cachedPlayerId.current ? currentScene.entities[cachedPlayerId.current] : entity;
        const targetRb = rigidBodyRefsRef.current[targetEntity.id];

        // 1. Rotação Suave do Player
        const turnSpeed = 1.5;
        if (Math.abs(turnX) > 0.05) {
          currentRotationY.current -= turnX * turnSpeed * delta * (180 / Math.PI);
          const newEulerY = currentRotationY.current;

          if (targetRb) {
            const qRot = new THREE.Quaternion().setFromEuler(
              new THREE.Euler(0, (newEulerY * Math.PI) / 180, 0)
            );
            targetRb.setRotation(qRot, true);
          } else {
            // Se não houver RB, atualiza a store de forma throttlada (10Hz) para evitar lags no render
            const now = performance.now();
            if (now - lastRotationUpdate.current > 100) {
              lastRotationUpdate.current = now;
              const currentRot = targetEntity.components.Transform?.rotation || [0, 0, 0];
              updateComponentRef.current(targetEntity.id, 'Transform', {
                rotation: [currentRot[0], newEulerY, currentRot[2]]
              });
            }
          }
        }

        // 2. Movimentação Suave do Player com suporte a Corrida (Sprint) lido do Script
        const forward = forwardVec.current.copy(gazeDirectionRef.current);
        forward.y = 0;
        forward.normalize();

        const right = rightVec.current;
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0));
        right.normalize();

        // Extrai variáveis públicas de velocidade e botões do Script do Player
        let sprintSpeedVal = 8.0;
        let speedVal = 5.0;
        let gamepadSprintBtn = 'L2';
        let keySprintCode = 'ShiftLeft';

        const playerScript = targetEntity?.components?.Script as any;
        if (playerScript && playerScript.code) {
          const codeStr = playerScript.code;
          const speedMatch = codeStr.match(/^export\s+let\s+speed\s*=\s*(.+?);?$/m);
          if (speedMatch) speedVal = parseFloat(speedMatch[1]) || 5.0;

          const sprintMatch = codeStr.match(/^export\s+let\s+sprintSpeed\s*=\s*(.+?);?$/m);
          if (sprintMatch) sprintSpeedVal = parseFloat(sprintMatch[1]) || 8.0;

          const gamepadSprintMatch = codeStr.match(/^export\s+let\s+gamepadSprint\s*=\s*["'](.+?)["'];?$/m);
          if (gamepadSprintMatch) gamepadSprintBtn = gamepadSprintMatch[1];

          const keySprintMatch = codeStr.match(/^export\s+let\s+keySprint\s*=\s*["'](.+?)["'];?$/m);
          if (keySprintMatch) keySprintCode = keySprintMatch[1];
        }

        // Verifica se o sprint está pressionado nos controles nativos VR ou no Input global
        let sprintPressed = false;
        for (const source of session.inputSources) {
          if (source.gamepad) {
            const buttons = source.gamepad.buttons;
            if (source.handedness === 'left') {
              if (gamepadSprintBtn === 'L2' && buttons.length > 0 && buttons[0].pressed) {
                sprintPressed = true;
              }
              if (gamepadSprintBtn === 'L1' && buttons.length > 1 && buttons[1].pressed) {
                sprintPressed = true;
              }
            } else if (source.handedness === 'right') {
              if (gamepadSprintBtn === 'R2' && buttons.length > 0 && buttons[0].pressed) {
                sprintPressed = true;
              }
              if (gamepadSprintBtn === 'R1' && buttons.length > 1 && buttons[1].pressed) {
                sprintPressed = true;
              }
            }
          }
        }
        if (Input.getGamepadButton(gamepadSprintBtn) || Input.getKey(keySprintCode)) {
          sprintPressed = true;
        }

        const currentSpeed = sprintPressed ? sprintSpeedVal : speedVal;
        const speedMultiplier = isCrouching.current ? 0.5 : 1.0;
        const moveSpeed = currentSpeed * speedMultiplier;

        const move = moveVec.current
          .set(0, 0, 0)
          .addScaledVector(forward, -moveZ)
          .addScaledVector(right, moveX)
          .multiplyScalar(moveSpeed);

        if (targetRb) {
          const currentVel = targetRb.linvel();
          
          // Pulo (Jump)
          let newVelY = currentVel.y;
          if (jumpPressed && Math.abs(currentVel.y) < 0.05) {
            newVelY = 5.5; // força do pulo
          }
          
          targetRb.setLinvel({ x: move.x, y: newVelY, z: move.z }, true);
        } else {
          const currentPos = targetEntity.components.Transform?.position || [0, 0, 0];
          const newPos: [number, number, number] = [
            currentPos[0] + move.x * delta,
            currentPos[1],
            currentPos[2] + move.z * delta
          ];
          
          // Atualiza a store de forma throttlada (10Hz) se não tiver física ativa
          const now = performance.now();
          if (now - lastPositionUpdate.current > 100) {
            lastPositionUpdate.current = now;
            updateComponentRef.current(targetEntity.id, 'Transform', { position: newPos });
          }
        }

        // 3. Agachamento (Crouch)
        if (crouchPressed && !isCrouching.current) {
          isCrouching.current = true;
          if (typeof window !== 'undefined') {
            (window as any).isFreedom3DCrouching = true;
          }
        } else if (!crouchPressed && isCrouching.current) {
          isCrouching.current = false;
          if (typeof window !== 'undefined') {
            (window as any).isFreedom3DCrouching = false;
          }
        }
      }
    } else {
      if (typeof window !== 'undefined' && (window as any).isVRActive) {
        (window as any).isVRActive = false;
      }
      if (initialHeadsetHeight !== null) {
        setInitialHeadsetHeight(null);
      }
    }
  });

  return (
    <>
      <PerspectiveCamera
        ref={ref}
        makeDefault={isGameView && camera.isMain}
        position={camera.offset || [0, 0, 0]}
        rotation={camera.rotation || [0, 0, 0]}
        fov={camera.fov}
        near={camera.near}
        far={camera.far}
      />
    {gl.xr.isPresenting && !(window as any).__freedom3d_simulated_ar__ && (
      <>
          {camera.showCrosshair && (
            <mesh ref={crosshairRef} renderOrder={9999}>
              <ringGeometry args={[0.015, 0.02, 32]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.8} depthTest={false} depthWrite={false} />
            </mesh>
          )}
          <HUD3D />
        </>
      )}
    </>
  );
}


// ── VR Teleport Ring ──────────────────────────────────────────
// Only rendered in /preview (StandalonePlayer), inside <XR>.
function VRTeleportRing({ entity }: { entity: Entity }) {
  const transform = entity.components.Transform;
  const [hovered, setHovered] = useState(false);
  if (!transform) return null;

  const pos = transform.position as [number, number, number];
  const rot = (transform.rotation as [number, number, number]).map((d) => (d * Math.PI) / 180) as [number, number, number];
  const scale = transform.scale as [number, number, number];

  const handleClick = (e: any) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!attemptTeleport()) return;

    // Move a câmera via atualização da entidade que tem Camera principal
    const storeState = useRuntimeStore.getState();
    const scene = storeState.activeScene();
    Object.values(scene.entities).forEach(e => {
      if (e.tags?.includes('player') || e.components.Camera?.isMain) {
        const targetPos = [pos[0], pos[1] + 1.05, pos[2]] as [number, number, number];
        storeState.updateComponent(e.id, 'Transform', {
          position: targetPos,
        });

        // Se houver um RigidBody físico ativo, teleporta e zera a velocidade dele
        const rb = storeState.rigidBodyRefs[e.id];
        if (rb) {
          rb.setTranslation({ x: targetPos[0], y: targetPos[1], z: targetPos[2] }, true);
          rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
          rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
        }
      }
    });
  };

  return (
    <group
      position={pos}
      rotation={rot}
      scale={scale}
    >
      {/* Torus */}
      <mesh
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        userData={{ isTeleportRing: true, onClick: handleClick, setHovered }}
      >
        <torusGeometry args={[0.6, 0.06, 16, 64]} />
        <meshStandardMaterial
          color={hovered ? '#ffffff' : '#00ffff'}
          emissive={hovered ? '#00ffff' : '#007777'}
          emissiveIntensity={hovered ? 2 : 1}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
      {/* Disco de chão translúcido para capturar cliques de raycast de forma perfeita */}
      <mesh
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        userData={{ isTeleportRing: true, onClick: handleClick, setHovered }}
      >
        <circleGeometry args={[0.58, 64]} />
        <meshBasicMaterial
          color={hovered ? '#ffffff' : '#00ffff'}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ── Audio Helper Components (Spatial and 2D with volume and delay) ──
function Audio2D({ url, loop, volume, playbackRate }: { url: string; loop: boolean; volume: number; playbackRate?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const audioRef = useRef<THREE.Audio | null>(null);

  useEffect(() => {
    let isActive = true;
    const listener = getGlobalAudioListener();
    const sound = new THREE.Audio(listener);
    sound.setVolume(volume);
    sound.setLoop(loop);
    const rate = typeof playbackRate === 'number' ? playbackRate : 1.0;
    sound.setPlaybackRate(rate);

    audioRef.current = sound;

    if (groupRef.current) {
      groupRef.current.add(sound);
    }

    // Carrega o áudio via AudioLoader decodificando em memória RAM
    const audioLoader = new THREE.AudioLoader();
    let cleanupAudioContextListener: (() => void) | null = null;

    audioLoader.load(
      url,
      (buffer) => {
        if (!isActive) return;
        sound.setBuffer(buffer);
        if (!sound.isPlaying) {
          const playOrWait = () => {
            if (!isActive) return;
            if (listener.context && listener.context.state === 'running') {
              if (!sound.isPlaying && sound.buffer) {
                sound.play();
              }
              if (cleanupAudioContextListener) {
                cleanupAudioContextListener();
                cleanupAudioContextListener = null;
              }
            }
          };

          if (listener.context && listener.context.state === 'running') {
            sound.play();
          } else {
            cleanupAudioContextListener = () => {
              window.removeEventListener('click', playOrWait, { capture: true });
              window.removeEventListener('touchstart', playOrWait, { capture: true });
              window.removeEventListener('mousedown', playOrWait, { capture: true });
              window.removeEventListener('keydown', playOrWait, { capture: true });
              if (listener.context) {
                listener.context.removeEventListener('statechange', playOrWait);
              }
            };

            window.addEventListener('click', playOrWait, { capture: true });
            window.addEventListener('touchstart', playOrWait, { capture: true });
            window.addEventListener('mousedown', playOrWait, { capture: true });
            window.addEventListener('keydown', playOrWait, { capture: true });
            if (listener.context) {
              listener.context.addEventListener('statechange', playOrWait);
            }
          }
        }
      },
      undefined,
      (err) => {
        console.warn("Falha ao carregar buffer do áudio 2D:", err);
      }
    );

    return () => {
      isActive = false;
      if (cleanupAudioContextListener) {
        cleanupAudioContextListener();
      }
      if (sound.isPlaying) {
        sound.stop();
      }
      if (groupRef.current) {
        groupRef.current.remove(sound);
      }
      sound.disconnect();
    };
  }, [url, loop]);

  // Atualiza volume e playbackRate em tempo real pelo GainNode do Three.js
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.setVolume(volume);
      const rate = typeof playbackRate === 'number' ? playbackRate : 1.0;
      audioRef.current.setPlaybackRate(rate);
    }
  }, [volume, playbackRate]);

  return <group ref={groupRef} />;
}

function SpatialAudio({ 
  url, 
  loop, 
  volume,
  refDistance,
  rolloffFactor,
  maxDistance,
  distanceModel,
  playbackRate
}: { 
  url: string; 
  loop: boolean; 
  volume: number;
  refDistance?: number;
  rolloffFactor?: number;
  maxDistance?: number;
  distanceModel?: 'linear' | 'inverse' | 'exponential';
  playbackRate?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const audioRef = useRef<THREE.PositionalAudio | null>(null);

  useEffect(() => {
    let isActive = true;
    const listener = getGlobalAudioListener();
    const sound = new THREE.PositionalAudio(listener);

    // Configurações iniciais de espacialização
    const rDist = typeof refDistance === 'number' ? refDistance : 5;
    const rFactor = typeof rolloffFactor === 'number' ? rolloffFactor : 1;
    const mDist = typeof maxDistance === 'number' ? maxDistance : 100;
    const model = distanceModel || 'linear';
    const rate = typeof playbackRate === 'number' ? playbackRate : 1.0;
    
    sound.setRefDistance(rDist);
    sound.setRolloffFactor(rFactor);
    sound.setMaxDistance(mDist);
    sound.setDistanceModel(model);
    sound.setVolume(volume ?? 1.0);
    sound.setLoop(loop);
    sound.setPlaybackRate(rate);

    audioRef.current = sound;
    
    if (groupRef.current) {
      groupRef.current.add(sound);
    }

    // Carrega o áudio via AudioLoader decodificando em memória RAM (melhor para áudio espacial 3D)
    const audioLoader = new THREE.AudioLoader();
    let cleanupAudioContextListener: (() => void) | null = null;

    audioLoader.load(
      url,
      (buffer) => {
        if (!isActive) return;
        sound.setBuffer(buffer);
        if (!sound.isPlaying) {
          const playOrWait = () => {
            if (!isActive) return;
            if (listener.context && listener.context.state === 'running') {
              if (!sound.isPlaying && sound.buffer) {
                sound.play();
              }
              if (cleanupAudioContextListener) {
                cleanupAudioContextListener();
                cleanupAudioContextListener = null;
              }
            }
          };

          if (listener.context && listener.context.state === 'running') {
            sound.play();
          } else {
            cleanupAudioContextListener = () => {
              window.removeEventListener('click', playOrWait, { capture: true });
              window.removeEventListener('touchstart', playOrWait, { capture: true });
              window.removeEventListener('mousedown', playOrWait, { capture: true });
              window.removeEventListener('keydown', playOrWait, { capture: true });
              if (listener.context) {
                listener.context.removeEventListener('statechange', playOrWait);
              }
            };

            window.addEventListener('click', playOrWait, { capture: true });
            window.addEventListener('touchstart', playOrWait, { capture: true });
            window.addEventListener('mousedown', playOrWait, { capture: true });
            window.addEventListener('keydown', playOrWait, { capture: true });
            if (listener.context) {
              listener.context.addEventListener('statechange', playOrWait);
            }
          }
        }
      },
      undefined,
      (err) => {
        console.warn("Falha ao carregar buffer do som espacial:", err);
      }
    );

    return () => {
      isActive = false;
      if (cleanupAudioContextListener) {
        cleanupAudioContextListener();
      }
      if (sound.isPlaying) {
        sound.stop();
      }
      if (groupRef.current) {
        groupRef.current.remove(sound);
      }
      sound.disconnect();
    };
  }, [url, loop]);

  // Efeito para atualizar volume e parâmetros em tempo real sem recarregar o áudio
  useEffect(() => {
    const sound = audioRef.current;
    if (sound) {
      sound.setVolume(volume ?? 1.0);
      const rDist = typeof refDistance === 'number' ? refDistance : 5;
      const rFactor = typeof rolloffFactor === 'number' ? rolloffFactor : 1;
      const mDist = typeof maxDistance === 'number' ? maxDistance : 100;
      const model = distanceModel || 'linear';
      const rate = typeof playbackRate === 'number' ? playbackRate : 1.0;
      
      sound.setRefDistance(rDist);
      sound.setRolloffFactor(rFactor);
      sound.setMaxDistance(mDist);
      sound.setDistanceModel(model);
      sound.setPlaybackRate(rate);
    }
  }, [volume, refDistance, rolloffFactor, maxDistance, distanceModel, playbackRate]);

  return <group ref={groupRef} />;
}

interface OrionAudioProps {
  src: string;
  loop: boolean;
  volume: number;
  playOnStart: boolean;
  is3D: boolean;
  delay: number;
  isPlaying: boolean;
  refDistance?: number;
  rolloffFactor?: number;
  maxDistance?: number;
  distanceModel?: 'linear' | 'inverse' | 'exponential';
  playbackRate?: number;
}

function OrionAudioComponent({ 
  src, 
  loop, 
  volume, 
  playOnStart, 
  is3D, 
  delay, 
  isPlaying,
  refDistance,
  rolloffFactor,
  maxDistance,
  distanceModel,
  playbackRate
}: OrionAudioProps) {
  const [shouldPlay, setShouldPlay] = useState(false);

  useEffect(() => {
    if (!isPlaying || !playOnStart) {
      setShouldPlay(false);
      return;
    }

    const timer = setTimeout(() => {
      setShouldPlay(true);
    }, (delay || 0) * 1000);

    return () => clearTimeout(timer);
  }, [isPlaying, playOnStart, delay, src]);

  if (!isPlaying || !shouldPlay) return null;

  if (is3D) {
    return (
      <SpatialAudio 
        url={src} 
        loop={loop} 
        volume={volume ?? 1.0} 
        refDistance={refDistance}
        rolloffFactor={rolloffFactor}
        maxDistance={maxDistance}
        distanceModel={distanceModel}
        playbackRate={playbackRate}
      />
    );
  } else {
    return <Audio2D url={src} loop={loop} volume={volume ?? 1.0} playbackRate={playbackRate} />;
  }
}

const mapColliderType = (type: any): 'cuboid' | 'ball' | 'hull' | 'trimesh' | false => {
  if (!type || typeof type !== 'string' || type === 'none') return false;
  const t = type.toLowerCase();
  if (t === 'cuboid' || t === 'box') return 'cuboid';
  if (t === 'ball' || t === 'sphere') return 'ball';
  if (t === 'trimesh') return false;
  if (t === 'hull' || t === 'cylinder' || t === 'capsule') return 'hull';
  return 'cuboid';
};

function CustomDirectionalLight({ light, shadowMapSize }: { light: any; shadowMapSize: number }) {
  const dirLightRef = useRef<THREE.DirectionalLight>(null);

  useEffect(() => {
    if (dirLightRef.current) {
      const directionalLight = dirLightRef.current;
      if (!directionalLight.target.parent) {
        const target = new THREE.Object3D();
        target.position.set(0, 0, -1);
        directionalLight.add(target);
        directionalLight.target = target;
      }
    }
  }, [light]);

  return (
    <directionalLight
      ref={dirLightRef}
      position={[0, 0, 0]}
      color={light.color}
      intensity={light.intensity}
      castShadow={light.castShadow}
      shadow-bias={-0.0005}
      shadow-normalBias={0.02}
      shadow-mapSize={[shadowMapSize, shadowMapSize]}
      shadow-camera-left={-30}
      shadow-camera-right={30}
      shadow-camera-top={30}
      shadow-camera-bottom={-30}
      shadow-camera-near={0.1}
      shadow-camera-far={150}
    />
  );
}

function CustomSpotLight({ light, shadowMapSize }: { light: any; shadowMapSize: number }) {
  const spotLightRef = useRef<THREE.SpotLight>(null);

  useEffect(() => {
    if (spotLightRef.current) {
      const spotLight = spotLightRef.current;
      if (!spotLight.target.parent) {
        const target = new THREE.Object3D();
        target.position.set(0, 0, -1);
        spotLight.add(target);
        spotLight.target = target;
      }
    }
  }, [light]);

  return (
    <spotLight
      ref={spotLightRef}
      position={[0, 0, 0]}
      color={light.color}
      intensity={light.intensity}
      castShadow={light.castShadow}
      decay={1}
      shadow-bias={-0.0005}
      shadow-normalBias={0.02}
      shadow-mapSize={[shadowMapSize, shadowMapSize]}
      shadow-camera-near={0.1}
      shadow-camera-far={150}
    />
  );
}

export function EntityMesh({ entity, entities }: { entity: Entity; entities: Record<string, Entity> }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);

  const {
    selectedEntityId,
    selectEntity,
    editorMode,
    isPlaying,
    updateComponent,
    snapEnabled,
    snapValue,
    setRigidBodyRef,
    activeViewport,
    showLighting
  } = useRuntimeStore(useShallow(s => ({
    selectedEntityId: s.selectedEntityId,
    selectEntity: s.selectEntity,
    editorMode: s.editorMode,
    isPlaying: s.isPlaying,
    updateComponent: s.updateComponent,
    snapEnabled: s.snapEnabled,
    snapValue: s.snapValue,
    setRigidBodyRef: s.setRigidBodyRef,
    activeViewport: s.activeViewport,
    showLighting: s.showLighting
  })));

  const isGameView = activeViewport === 'game';
  const isStandalone = typeof window !== 'undefined' && window.location.pathname === '/preview';
  const transform = entity.components.Transform;
  const mesh = entity.components.MeshRenderer;
  const light = entity.components.Light;
  const rigidBody = entity.components.RigidBody;
  const audio = entity.components.Audio;
  const particles = entity.components.ParticleSystem;
  const camera = entity.components.Camera;
  const customCollider = entity.components.Collider as any;
  const colliderScale = customCollider?.scale || [1, 1, 1];
  const colliderOffset = customCollider?.offset || [0, 0, 0];
  const textureComp = entity.components.Texture as any;

  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [normalTexture, setNormalTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    let normalObjectUrl: string | null = null;

    const tilingX = textureComp?.tilingX ?? 1;
    const tilingY = textureComp?.tilingY ?? 1;
    const offsetX = textureComp?.offsetX ?? 0;
    const offsetY = textureComp?.offsetY ?? 0;

    // 1. Carrega Albedo Texture
    if (textureComp?.textureUrl) {
      fetch(textureComp.textureUrl)
        .then((res) => {
          if (!res.ok) throw new Error('Falha ao baixar imagem da textura');
          return res.blob();
        })
        .then((blob) => {
          if (!active) return;
          objectUrl = URL.createObjectURL(blob);
          const loader = new THREE.TextureLoader();
          loader.load(
            objectUrl,
            (tex) => {
              if (!active) return;
              tex.colorSpace = THREE.SRGBColorSpace;
              tex.wrapS = THREE.RepeatWrapping;
              tex.wrapT = THREE.RepeatWrapping;
              tex.repeat.set(tilingX, tilingY);
              tex.offset.set(offsetX, offsetY);
              tex.needsUpdate = true;
              setTexture(tex);
            },
            undefined,
            (err) => {
              console.error("Erro no TextureLoader da textura Albedo:", err);
            }
          );
        })
        .catch((err) => {
          console.error("Erro no fetch da textura Albedo em SceneEntities:", err);
          if (active) setTexture(null);
        });
    } else {
      setTexture(null);
    }

    // 2. Carrega Normal Map Texture
    if (textureComp?.normalMapUrl) {
      fetch(textureComp.normalMapUrl)
        .then((res) => {
          if (!res.ok) throw new Error('Falha ao baixar normal map');
          return res.blob();
        })
        .then((blob) => {
          if (!active) return;
          normalObjectUrl = URL.createObjectURL(blob);
          const loader = new THREE.TextureLoader();
          loader.load(
            normalObjectUrl,
            (tex) => {
              if (!active) return;
              tex.colorSpace = THREE.NoColorSpace;
              tex.wrapS = THREE.RepeatWrapping;
              tex.wrapT = THREE.RepeatWrapping;
              tex.repeat.set(tilingX, tilingY);
              tex.offset.set(offsetX, offsetY);
              tex.needsUpdate = true;
              setNormalTexture(tex);
            },
            undefined,
            (err) => {
              console.error("Erro no TextureLoader do Normal Map:", err);
            }
          );
        })
        .catch((err) => {
          console.error("Erro no fetch do Normal Map em SceneEntities:", err);
          if (active) setNormalTexture(null);
        });
    } else {
      setNormalTexture(null);
    }

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      if (normalObjectUrl) {
        URL.revokeObjectURL(normalObjectUrl);
      }
    };
  }, [
    textureComp?.textureUrl,
    textureComp?.normalMapUrl,
    textureComp?.tilingX,
    textureComp?.tilingY,
    textureComp?.offsetX,
    textureComp?.offsetY
  ]);

  // Se tem Animator
  const animatorComp = entity.components.Animator as any;

  // -- Material Mapping --
  const matProps: any = { color: mesh?.color || '#ffffff' };

  const renderCustomColliderPhysics = (entityScale: [number, number, number]) => {
    if (!customCollider) return null;

    const args: any = [];
    if (customCollider.shape === 'cuboid') {
      args.push(
        colliderScale[0] * entityScale[0],
        colliderScale[1] * entityScale[1],
        colliderScale[2] * entityScale[2]
      );
    }
    if (customCollider.shape === 'ball') {
      const maxScale = Math.max(entityScale[0], entityScale[1], entityScale[2]);
      args.push(colliderScale[0] * maxScale);
    }
    if (customCollider.shape === 'capsule') {
      const radiusScale = Math.max(entityScale[0], entityScale[2]);
      args.push(
        colliderScale[1] * entityScale[1], // halfHeight
        colliderScale[0] * radiusScale // radius
      );
    }
    if (customCollider.shape === 'cylinder') {
      const radiusScale = Math.max(entityScale[0], entityScale[2]);
      args.push(
        colliderScale[1] * entityScale[1], // halfHeight
        colliderScale[0] * radiusScale // radius
      );
    }
    if (customCollider.shape === 'cone') {
      const radiusScale = Math.max(entityScale[0], entityScale[2]);
      args.push(
        colliderScale[1] * entityScale[1], // halfHeight
        colliderScale[0] * radiusScale // radius
      );
    }

    const scaledOffset: [number, number, number] = [
      colliderOffset[0] * entityScale[0],
      colliderOffset[1] * entityScale[1],
      colliderOffset[2] * entityScale[2]
    ];

    const props = {
      args,
      position: scaledOffset,
      sensor: customCollider.isTrigger,
      restitution: customCollider.restitution ?? 0.0
    };

    if (customCollider.shape === 'cuboid') return <CuboidCollider {...props} />;
    if (customCollider.shape === 'ball') return <BallCollider {...props} />;
    if (customCollider.shape === 'capsule') return <CapsuleCollider {...props} />;
    if (customCollider.shape === 'cylinder') return <CylinderCollider {...props} />;
    if (customCollider.shape === 'cone') return <ConeCollider {...props} />;
    return null;
  };

  if (!transform) return null;
  if (!entity.active) return null;

  if (entity.components.GLTFModel) {
    const audio = entity.components.Audio;
    const particles = entity.components.ParticleSystem;
    const light = entity.components.Light;
    const camera = entity.components.Camera;

    return (
      <Suspense fallback={null}>
        <GLTFMesh entity={entity}>
          {audio && audio.src && (
            <OrionAudioComponent
              src={audio.src}
              loop={audio.loop}
              volume={audio.volume ?? 1.0}
              playOnStart={audio.playOnStart}
              is3D={audio.is3D ?? true}
              delay={audio.delay ?? 0}
              isPlaying={isPlaying}
              refDistance={audio.refDistance}
              rolloffFactor={audio.rolloffFactor}
              maxDistance={audio.maxDistance}
              distanceModel={audio.distanceModel}
              playbackRate={audio.playbackRate}
            />
          )}
          {particles && (
            <Sparkles
              count={particles.count}
              scale={5}
              size={particles.size}
              speed={particles.speed}
              color={particles.color}
            />
          )}
          {light && renderLight()}
          {camera && (
            <PerspectiveCameraWrapper
              entity={entity}
              camera={camera}
              isGameView={isGameView}
              isStandalone={isStandalone}
            />
          )}

          {entity.childrenIds && entity.childrenIds.map(id => {
            const childEntity = entities[id];
            if (!childEntity) return null;
            return <EntityMesh key={id} entity={childEntity} entities={entities} />;
          })}
        </GLTFMesh>
      </Suspense>
    );
  }

  const isSelected = selectedEntityId === entity.id;
  const pos = transform.position as [number, number, number];
  const rot = (transform.rotation as [number, number, number]).map((d) => (d * Math.PI) / 180) as [number, number, number];
  const scale = transform.scale as [number, number, number];

  // ── Drag detection: evita seleção acidental ao arrastar a câmera ──
  const isPlayer = entity.tags?.includes('player') || !!entity.components.Camera?.isMain;

  const handlePointerDown = (e: any) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: any) => {
    if (isStandalone) return;

    if (!mouseDownPos.current) return;
    const dx = Math.abs(e.clientX - mouseDownPos.current.x);
    const dy = Math.abs(e.clientY - mouseDownPos.current.y);
    mouseDownPos.current = null;
    if (dx < 5 && dy < 5) { // só seleciona se não houve arrasto
      e.stopPropagation();
      selectEntity(entity.id);
    }
  };


  const handleChange = () => {
    if (isPlaying) return;
    const obj = meshRef.current;
    if (!obj) return;
    updateComponent(entity.id, 'Transform', {
      position: [
        parseFloat(obj.position.x.toFixed(3)),
        parseFloat(obj.position.y.toFixed(3)),
        parseFloat(obj.position.z.toFixed(3)),
      ],
      rotation: [
        parseFloat(((obj.rotation.x * 180) / Math.PI).toFixed(2)),
        parseFloat(((obj.rotation.y * 180) / Math.PI).toFixed(2)),
        parseFloat(((obj.rotation.z * 180) / Math.PI).toFixed(2)),
      ],
      scale: [
        parseFloat(obj.scale.x.toFixed(3)),
        parseFloat(obj.scale.y.toFixed(3)),
        parseFloat(obj.scale.z.toFixed(3)),
      ],
    });
  };

  function renderGeometry() {
    if (!mesh) return null;
    switch (mesh.geometry) {
      case 'box': return <boxGeometry args={[1, 1, 1]} />;
      case 'sphere': return <sphereGeometry args={[0.5, 32, 32]} />;
      case 'plane': return <planeGeometry args={[1, 1]} />;
      case 'cylinder': return <cylinderGeometry args={[0.5, 0.5, 1, 32]} />;
      case 'torus': return <torusGeometry args={[0.5, 0.2, 16, 64]} />;
      case 'cone': return <coneGeometry args={[0.5, 1, 32]} />;
      case 'capsule': return <capsuleGeometry args={[0.3, 1, 8, 16]} />;
      default: return <boxGeometry args={[1, 1, 1]} />;
    }
  };

  // ── Teleport ring: renderizado de forma especial no modo VR ──
  if (entity.tags?.includes('teleport')) {
    if (isStandalone) {
      return <VRTeleportRing entity={entity} />;
    }
    // No editor: anel com TransformControls para poder mover
    return (
      <>
        <group
          ref={meshRef}
          position={pos}
          rotation={rot}
          scale={scale}
        >
          {/* Torus */}
          <mesh
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
          >
            <torusGeometry args={[0.6, 0.06, 16, 64]} />
            <meshStandardMaterial color="#00ffff" emissive={isSelected ? '#00ffff' : '#007777'} emissiveIntensity={isSelected ? 1.5 : 0.8} />
            {isSelected && <Edges scale={1.05} color="#44aaff" />}
          </mesh>
          {/* Disco de chão translúcido para facilitar seleção no editor */}
          <mesh
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
          >
            <circleGeometry args={[0.58, 64]} />
            <meshBasicMaterial color="#00ffff" transparent opacity={0.15} side={THREE.DoubleSide} />
          </mesh>
        </group>
        {isSelected && !isGameView && (
          <TransformControls
            object={meshRef}
            mode={editorMode as any}
            translationSnap={snapEnabled ? snapValue : null}
            rotationSnap={snapEnabled ? (Math.PI / 12) : null}
            scaleSnap={snapEnabled ? snapValue : null}
            onChange={handleChange}
            onMouseDown={() => useRuntimeStore.getState().takeHistorySnapshot()}
          />
        )}
      </>
    );
  }

  function renderMaterial() {
    if (!mesh) return null;
    const color = mesh.color;
    const ns = textureComp?.normalScale ?? 1;

    // A chave UUID inclui a normalTexture para remontar o shader caso o normal map seja anexado/removido
    const materialKey = `${texture ? texture.uuid : 'no-tex'}-${normalTexture ? normalTexture.uuid : 'no-norm'}`;

    switch (mesh.material) {
      case 'basic': 
        return <meshBasicMaterial key={materialKey} color={color} map={texture || undefined} />;
      case 'phong': 
        return (
          <meshPhongMaterial 
            key={materialKey} 
            color={color} 
            map={texture || undefined} 
            normalMap={normalTexture || undefined}
            normalScale={new THREE.Vector2(ns, ns)}
          />
        );
      case 'wireframe': return <meshBasicMaterial color={color} wireframe />;
      case 'invisible': return <meshBasicMaterial color={color} transparent opacity={0.3} wireframe visible={!isGameView && !isStandalone} />;
      case 'emissive':
        return (
          <meshStandardMaterial
            key={materialKey}
            color={color}
            emissive={color}
            emissiveIntensity={mesh.emissiveIntensity ?? 2.0}
            roughness={mesh.roughness ?? 0.2}
            metalness={mesh.metalness ?? 0.1}
            map={texture || undefined}
            normalMap={normalTexture || undefined}
            normalScale={[ns, ns]}
          />
        );
      default:
        return (
          <meshStandardMaterial
            key={materialKey}
            color={color}
            roughness={mesh.roughness ?? 0.6}
            metalness={mesh.metalness ?? 0.1}
            map={texture || undefined}
            normalMap={normalTexture || undefined}
            normalScale={[ns, ns]}
          />
        );
    }
  };

  function renderLight() {
    if (!light || (!showLighting && !isGameView)) return null;
    const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const shadowMapSize = isMobile ? 512 : 1024;

    // Como esta função é renderizada dentro do container <mesh> que já possui a posição global definida em `pos`,
    // as luzes locais (point, directional e spot) devem ter posição local [0, 0, 0] para coincidir com a posição visual da entidade no editor.
    // Também adicionamos decay={1} para melhorar a visibilidade em intensidades mais baixas.
    // Adicionamos shadow-bias e shadow-normalBias para evitar o efeito "shadow acne" (listras indesejadas no modelo 3D).
    switch (light.lightType) {
      case 'directional':
        return <CustomDirectionalLight light={light} shadowMapSize={shadowMapSize} />;
      case 'point':
        return (
          <pointLight
            position={[0, 0, 0]}
            color={light.color}
            intensity={light.intensity}
            castShadow={light.castShadow}
            decay={1}
            shadow-bias={-0.0005}
            shadow-normalBias={0.02}
            shadow-mapSize={[shadowMapSize, shadowMapSize]}
          />
        );
      case 'spot':
        return <CustomSpotLight light={light} shadowMapSize={shadowMapSize} />;
      default:
        return null;
    }
  };

  if (!mesh) {
    // Entities without mesh (Light, Audio, Particles, Empty objects)
    const emptyMesh = (
      <mesh
        ref={meshRef}
        position={(!rigidBody || !isPlaying) ? pos : undefined}
        rotation={(!rigidBody || !isPlaying) ? rot : undefined}
        scale={scale}
        onPointerDown={isStandalone ? undefined : handlePointerDown}
        onPointerUp={isStandalone ? undefined : handlePointerUp}
        userData={{ entityId: entity.id }}
      >
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshBasicMaterial color={light ? light.color : "#ffffff"} wireframe opacity={0.3} transparent visible={!isGameView && !entity.components.VideoMesh && !entity.components.HUDPlane} />

        {renderLight()}
        {audio && audio.src && (
          <OrionAudioComponent
            src={audio.src}
            loop={audio.loop}
            volume={audio.volume ?? 1.0}
            playOnStart={audio.playOnStart}
            is3D={audio.is3D ?? true}
            delay={audio.delay ?? 0}
            isPlaying={isPlaying}
            refDistance={audio.refDistance}
            rolloffFactor={audio.rolloffFactor}
            maxDistance={audio.maxDistance}
            distanceModel={audio.distanceModel}
            playbackRate={audio.playbackRate}
          />
        )}
        {particles && (
          <Sparkles
            count={particles.count}
            scale={5}
            size={particles.size}
            speed={particles.speed}
            color={particles.color}
          />
        )}
        {/* Camera */}
        {camera && (
          <PerspectiveCameraWrapper
            entity={entity}
            camera={camera}
            isGameView={isGameView}
            isStandalone={isStandalone}
          />
        )}
        {entity.components.HUDPlane && (
          <HUDPlaneRenderer
            entity={entity}
            isGameView={isGameView}
          />
        )}
        {entity.components.VideoMesh && (
          <VideoMeshRenderer
            entity={entity}
            isGameView={isGameView}
          />
        )}
        {entity.childrenIds && entity.childrenIds.map(id => {
          const childEntity = entities[id];
          if (!childEntity) return null;
          return <EntityMesh key={id} entity={childEntity} entities={entities} />;
        })}
        {customCollider && !isGameView && (
          <mesh position={customCollider.offset}>
            {customCollider.shape === 'cuboid' && <boxGeometry args={[customCollider.scale[0]*2, customCollider.scale[1]*2, customCollider.scale[2]*2]} />}
            {customCollider.shape === 'ball' && <sphereGeometry args={[customCollider.scale[0]]} />}
            {customCollider.shape === 'capsule' && <capsuleGeometry args={[customCollider.scale[0], customCollider.scale[1]*2, 4, 8]} />}
            {customCollider.shape === 'cylinder' && <cylinderGeometry args={[customCollider.scale[0], customCollider.scale[0], customCollider.scale[1]*2, 8]} />}
            {customCollider.shape === 'cone' && <coneGeometry args={[customCollider.scale[0], customCollider.scale[1]*2, 8]} />}
            <meshBasicMaterial wireframe color="#00ff00" transparent opacity={0.3} depthTest={false} />
          </mesh>
        )}
      </mesh>
    );

    return (
      <>
        {(rigidBody && isPlaying) ? (
          <RigidBody
            ref={(rb) => { if (rb) setRigidBodyRef(entity.id, rb); }}
            position={pos}
            rotation={rot}
            type={rigidBody.isStatic ? 'fixed' : (rigidBody.isKinematic ? 'kinematicPosition' : 'dynamic')}
            mass={rigidBody.mass}
            gravityScale={rigidBody.useGravity ? 1 : 0}
            linearDamping={rigidBody.drag ?? 0}
            angularDamping={rigidBody.angularDrag ?? 0.05}
            restitution={rigidBody.restitution ?? 0.0}
            ccd={rigidBody.collisionDetection === 'continuous'}
            enabledTranslations={[
              !(rigidBody.freezePositionX ?? false),
              !(rigidBody.freezePositionY ?? false),
              !(rigidBody.freezePositionZ ?? false)
            ]}
            enabledRotations={[
              !(rigidBody.freezeRotationX ?? false),
              !(rigidBody.freezeRotationY ?? false),
              !(rigidBody.freezeRotationZ ?? false)
            ]}
            colliders={customCollider ? false : mapColliderType(rigidBody.collider)}
          >
            {emptyMesh}
            {customCollider && renderCustomColliderPhysics(scale)}
            {(!customCollider && rigidBody.collider === 'trimesh') && (
              <MeshCollider type="trimesh">
                <mesh geometry={(meshRef.current as any)?.geometry}>
                  <meshBasicMaterial />
                </mesh>
              </MeshCollider>
            )}
          </RigidBody>
        ) : (customCollider && isPlaying && !rigidBody) ? (
          <RigidBody type="fixed" colliders={false} position={pos} rotation={rot}>
            {emptyMesh}
            {renderCustomColliderPhysics(scale)}
          </RigidBody>
        ) : emptyMesh}

        {isSelected && !isGameView && (
          <TransformControls
            object={meshRef}
            mode={editorMode as any}
            translationSnap={snapEnabled ? snapValue : null}
            rotationSnap={snapEnabled ? (Math.PI / 12) : null}
            scaleSnap={snapEnabled ? snapValue : null}
            onChange={handleChange}
          />
        )}
      </>
    );
  }

  const innerMesh = (
    <mesh
      ref={meshRef}
      position={(!rigidBody || !isPlaying) ? pos : undefined}
      rotation={(!rigidBody || !isPlaying) ? rot : undefined}
      scale={scale}
      castShadow={mesh.castShadow}
      receiveShadow={mesh.receiveShadow}
      onPointerDown={isStandalone ? undefined : handlePointerDown}
      onPointerUp={isStandalone ? undefined : handlePointerUp}
      userData={{ isPlayer, entityId: entity.id }}
    >
      {renderGeometry()}
      {renderMaterial()}
      {audio && audio.src && (
        <OrionAudioComponent
          src={audio.src}
          loop={audio.loop}
          volume={audio.volume ?? 1.0}
          playOnStart={audio.playOnStart}
          is3D={audio.is3D ?? true}
          delay={audio.delay ?? 0}
          isPlaying={isPlaying}
          refDistance={audio.refDistance}
          rolloffFactor={audio.rolloffFactor}
          maxDistance={audio.maxDistance}
          distanceModel={audio.distanceModel}
          playbackRate={audio.playbackRate}
        />
      )}
      {/* Particles */}
      {particles && (
        <Sparkles
          count={particles.count}
          scale={5}
          size={particles.size}
          speed={particles.speed}
          color={particles.color}
        />
      )}
      {/* Camera */}
      {camera && (
        <PerspectiveCameraWrapper
          entity={entity}
          camera={camera}
          isGameView={isGameView}
          isStandalone={isStandalone}
        />
      )}
      {entity.components.HUDPlane && (
        <HUDPlaneRenderer
          entity={entity}
          isGameView={isGameView}
        />
      )}
      {entity.components.VideoMesh && (
        <VideoMeshRenderer
          entity={entity}
          isGameView={isGameView}
        />
      )}
      {/* Selection outline */}
      {isSelected && !isGameView && (
        <Edges scale={1.01} color="#44aaff" />
      )}
      {customCollider && !isGameView && (
        <mesh position={colliderOffset}>
          {customCollider.shape === 'cuboid' && <boxGeometry args={[colliderScale[0]*2, colliderScale[1]*2, colliderScale[2]*2]} />}
          {customCollider.shape === 'ball' && <sphereGeometry args={[colliderScale[0]]} />}
          {customCollider.shape === 'capsule' && <capsuleGeometry args={[colliderScale[0], colliderScale[1]*2, 4, 8]} />}
          {customCollider.shape === 'cylinder' && <cylinderGeometry args={[colliderScale[0], colliderScale[0], colliderScale[1]*2, 8]} />}
          {customCollider.shape === 'cone' && <coneGeometry args={[colliderScale[0], colliderScale[1]*2, 8]} />}
          <meshBasicMaterial wireframe color="#00ff00" transparent opacity={0.3} depthTest={false} />
        </mesh>
      )}
      {entity.childrenIds && entity.childrenIds.map(id => {
        const childEntity = entities[id];
        if (!childEntity) return null;
        return <EntityMesh key={id} entity={childEntity} entities={entities} />;
      })}
    </mesh>
  );

  return (
    <>
      {(rigidBody && isPlaying) ? (
        <RigidBody
          ref={(rb) => { if (rb) setRigidBodyRef(entity.id, rb); }}
          position={pos}
          rotation={rot}
          type={rigidBody.isStatic ? 'fixed' : (rigidBody.isKinematic ? 'kinematicPosition' : 'dynamic')}
          mass={rigidBody.mass}
          gravityScale={rigidBody.useGravity ? 1 : 0}
          linearDamping={rigidBody.drag ?? 0}
          angularDamping={rigidBody.angularDrag ?? 0.05}
          restitution={rigidBody.restitution ?? 0.0}
          ccd={rigidBody.collisionDetection === 'continuous'}
          enabledTranslations={[
            !(rigidBody.freezePositionX ?? false),
            !(rigidBody.freezePositionY ?? false),
            !(rigidBody.freezePositionZ ?? false)
          ]}
          enabledRotations={[
            !(rigidBody.freezeRotationX ?? false),
            !(rigidBody.freezeRotationY ?? false),
            !(rigidBody.freezeRotationZ ?? false)
          ]}
          colliders={customCollider ? false : mapColliderType(rigidBody.collider)}
        >
          {(!customCollider && rigidBody.collider === 'trimesh') ? (
            <MeshCollider type="trimesh">
              {innerMesh}
            </MeshCollider>
          ) : innerMesh}
          {customCollider && renderCustomColliderPhysics(scale)}
        </RigidBody>
      ) : (customCollider && isPlaying && !rigidBody) ? (
        <RigidBody type="fixed" colliders={false} position={pos} rotation={rot}>
          {innerMesh}
          {renderCustomColliderPhysics(scale)}
        </RigidBody>
      ) : innerMesh}

      {isSelected && !isGameView && (
        <TransformControls
          object={meshRef}
          mode={editorMode as any}
          translationSnap={snapEnabled ? snapValue : null}
          rotationSnap={snapEnabled ? (Math.PI / 12) : null}
          scaleSnap={snapEnabled ? snapValue : null}
          onChange={handleChange}
          onMouseDown={() => useRuntimeStore.getState().takeHistorySnapshot()}
        />
      )}
    </>
  );
}

function XRSync() {
  const groupRef = useRef<THREE.Group>(null);
  // Cache do player para evitar Object.values().find() a cada frame
  const cachedPlayerId = useRef<string | null>(null);
  const sceneActiveId = useRuntimeStore(s => s.activeSceneId);

  // Seletores reativos do editorStore via ref para evitar getState() por frame
  const scene = useRuntimeStore(s => s.scenes[s.activeSceneId]);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  const rigidBodyRefs = useRuntimeStore(s => s.rigidBodyRefs);
  const rigidBodyRefsRef = useRef(rigidBodyRefs);
  rigidBodyRefsRef.current = rigidBodyRefs;

  // Recalcula o ID do player quando a cena mudar
  useEffect(() => {
    cachedPlayerId.current = null; // Reset para forçar re-lookup no próximo frame
  }, [sceneActiveId]);

  const eulerTemp = useRef(new THREE.Euler());
  const quatTemp = useRef(new THREE.Quaternion());
  const initialHeadsetHeight = useRef<number | null>(null);
  const currentHeightRef = useRef(1.6);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    // No modo AR/MR simulado (TV), o jogo roda como "Screen mode":
    // sem sincronização de origem XR nem locomoção de player.
    if (typeof window !== 'undefined' && (window as any).__freedom3d_simulated_ar__) return;
    const currentScene = sceneRef.current;
    if (!currentScene) return;

    // Busca o player uma única vez por cena e armazena em cache
    if (!cachedPlayerId.current || !currentScene.entities[cachedPlayerId.current]) {
      const found = Object.values(currentScene.entities).find(e => e.tags?.includes('player'));
      cachedPlayerId.current = found?.id ?? null;
    }
    if (!cachedPlayerId.current) return;
    const player = currentScene.entities[cachedPlayerId.current];
    if (!player) return;

    const rbRefs = rigidBodyRefsRef.current || {};
    const rb = rbRefs[player.id];
    let ePos = player.components.Transform?.position || [0, 0, 0];
    let eRot = player.components.Transform?.rotation || [0, 0, 0];

    if (rb) {
      const trans = rb.translation();
      ePos = [trans.x, trans.y, trans.z];

      const rot = rb.rotation();
      quatTemp.current.set(rot.x, rot.y, rot.z, rot.w);
      eulerTemp.current.setFromQuaternion(quatTemp.current);
      eRot = [eulerTemp.current.x * 180 / Math.PI, eulerTemp.current.y * 180 / Math.PI, eulerTemp.current.z * 180 / Math.PI];
    }

    const offset = player.components.Camera?.offset || [0, 0, 0];

    // Obtém a altura física do headset do WebXR
    let xrCamHeight = 0;
    if (state.gl.xr.isPresenting) {
      const xrCam = (state.gl.xr as any).getCamera(state.camera);
      if (xrCam) {
        xrCamHeight = xrCam.position.y;
        // Calibra a altura do headset uma única vez no início da sessão (quando o tracking estiver ativo)
        if (initialHeadsetHeight.current === null && xrCamHeight >= 0.5) {
          initialHeadsetHeight.current = xrCamHeight;
        }
      }
    } else {
      // Reseta se a sessão for encerrada
      if (initialHeadsetHeight.current !== null) {
        initialHeadsetHeight.current = null;
      }
    }

    // Se estiver agachado, divide a altura padrão (1.6m) por 2 (0.8m)
    const targetHeight = (window as any).isFreedom3DCrouching ? 0.8 : 1.6;
    
    // Suaviza a transição de altura usando lerp com delta
    currentHeightRef.current = THREE.MathUtils.lerp(
      currentHeightRef.current,
      targetHeight,
      Math.min(12 * delta, 1.0)
    );

    const targetY = initialHeadsetHeight.current !== null
      ? ePos[1] + currentHeightRef.current - initialHeadsetHeight.current
      : ePos[1] + currentHeightRef.current;

    groupRef.current.position.set(
      ePos[0] + offset[0],
      targetY,
      ePos[2] + offset[2]
    );
    groupRef.current.rotation.set(0, eRot[1] * Math.PI / 180, 0);
  });

  return (
    <group ref={groupRef}>
      <XROrigin />
    </group>
  );
}

export function SceneEntities() {
  const scene = useRuntimeStore(s => s.scenes[s.activeSceneId]);
  const isStandalone = typeof window !== 'undefined' && window.location.pathname === '/preview';

  if (!scene) return null;

  return (
    <>
      <GlobalAudioListenerHandler />
      {isStandalone && <XRSync />}
      {scene.rootEntityIds.map(id => {
        const entity = scene.entities[id];
        if (!entity) return null;
        return <EntityMesh key={id} entity={entity} entities={scene.entities} />;
      })}
    </>
  );
}



