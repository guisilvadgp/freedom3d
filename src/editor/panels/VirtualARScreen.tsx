import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState, useCallback, useMemo, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { useEditorStore } from '../store/editorStore';

type TVMode = 'world' | 'follow' | 'pin';
type TVQuality = 'low' | 'med' | 'high';
type PinnedPose = {
  position: [number, number, number];
  quaternion: [number, number, number, number];
};

// ── RenderTarget dinâmico (resolução escalável por qualidade) ──
function createTVRenderTarget(quality: TVQuality): THREE.WebGLRenderTarget {
  const sizes: Record<TVQuality, [number, number]> = {
    low: [640, 360],
    med: [854, 480],
    high: [1280, 720],
  };
  const [w, h] = sizes[quality] || sizes.low;
  return new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
  });
}

// ── Check de frustum: a TV está na frente da cabeça / dentro do FOV? ──
// Retorna true se visível. Fallback seguro: true (renderiza) em caso de erro.
const _projScreenMatrix = new THREE.Matrix4();
const _invMatrix = new THREE.Matrix4();
const _frustum = new THREE.Frustum();
const _tvWorldPos = new THREE.Vector3();
const _tvSphere = new THREE.Sphere();

function isTVInView(camera: THREE.Camera, obj: THREE.Object3D): boolean {
  try {
    camera.updateMatrixWorld();
    _invMatrix.copy(camera.matrixWorld).invert();
    _projScreenMatrix.multiplyMatrices(camera.projectionMatrix, _invMatrix);
    _frustum.setFromProjectionMatrix(_projScreenMatrix);
    obj.getWorldPosition(_tvWorldPos);
    // Raio aproximado da tela 85" (4.43 x 2.49 m) + margem de segurança
    _tvSphere.set(_tvWorldPos, 2.8);
    return _frustum.intersectsSphere(_tvSphere);
  } catch {
    return true;
  }
}

// ── Máquina de posicionamento da TV ──
const _dir = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _tempLook = new THREE.Vector3();
const _curQuat = new THREE.Quaternion();

function updateTVPlacement(opts: {
  mode: TVMode;
  camera: THREE.Camera;
  tvObject: THREE.Object3D;
  elapsed: number;
  hasSetInitialPosition: boolean;
  setHasSetInitialPosition: (v: boolean) => void;
  pinnedPoseRef: MutableRefObject<PinnedPose | null>;
  followDirtyRef: MutableRefObject<boolean>;
}) {
  const {
    mode, camera, tvObject, elapsed,
    hasSetInitialPosition, setHasSetInitialPosition,
    pinnedPoseRef, followDirtyRef,
  } = opts;

  if (mode === 'world') {
    // World-locked: trava a 3.5m à frente, com estabilização de giroscópio de 1.2s
    if (!hasSetInitialPosition) {
      _dir.set(0, 0, -1).applyQuaternion(camera.quaternion);
      _targetPos.copy(camera.position).add(_dir.multiplyScalar(3.5));
      _targetPos.y = Math.max(1.1, camera.position.y);

      if (elapsed < 1200) {
        // Aguarda estabilização do giroscópio (suavização física)
        tvObject.position.lerp(_targetPos, 0.15);
        _tempLook.set(camera.position.x, _targetPos.y, camera.position.z);
        _curQuat.copy(tvObject.quaternion);
        tvObject.lookAt(_tempLook);
        tvObject.quaternion.slerp(_curQuat, 0.85);
      } else {
        // Trava permanentemente no espaço (world-locked)
        tvObject.position.copy(_targetPos);
        tvObject.lookAt(camera.position.x, _targetPos.y, camera.position.z);
        setHasSetInitialPosition(true);
      }
    }
  } else if (mode === 'follow') {
    // Follow User: HUD preso à cabeça, ~1.2m à frente (conforto)
    _dir.set(0, 0, -1).applyQuaternion(camera.quaternion);
    _targetPos.copy(camera.position).add(_dir.multiplyScalar(1.2));
    tvObject.position.lerp(_targetPos, followDirtyRef.current ? 0.5 : 0.2);
    _curQuat.copy(tvObject.quaternion);
    tvObject.lookAt(camera.position.x, camera.position.y, camera.position.z);
    tvObject.quaternion.slerp(_curQuat, 0.6);
    followDirtyRef.current = false;
  } else if (mode === 'pin') {
    // Pin/Anchor: aplica a pose salva (posição + quaternion)
    const pose = pinnedPoseRef.current;
    if (pose) {
      tvObject.position.set(pose.position[0], pose.position[1], pose.position[2]);
      tvObject.quaternion.set(
        pose.quaternion[0], pose.quaternion[1], pose.quaternion[2], pose.quaternion[3]
      );
    }
  }
}

export function VirtualARScreen({ roomId }: { roomId?: string } = {}) {
  const { gl, scene } = useThree();
  const isPlaying = useEditorStore(s => s.isPlaying);

  const [isPresenting, setIsPresenting] = useState(gl.xr.isPresenting);
  const [isAR, setIsAR] = useState(false);
  const [hasSetInitialPosition, setHasSetInitialPosition] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);

  // Modo de posicionamento e qualidade (lidos do global do overlay ao entrar no AR)
  const [tvQuality, setTvQuality] = useState<TVQuality>('low');
  const tvModeRef = useRef<TVMode>('world');
  const tvQualityRef = useRef<TVQuality>('low');

  const groupRef = useRef<THREE.Group>(null);
  const screenRef = useRef<THREE.Mesh>(null);
  const borderRef = useRef<THREE.Mesh>(null);
  const bgMeshRef = useRef<THREE.Mesh>(null);
  const backgroundGroupRef = useRef<THREE.Group>(null);
  const labelRef = useRef<THREE.Sprite>(null);

  const [renderTarget, setRenderTarget] = useState<THREE.WebGLRenderTarget | null>(null);
  const [videoTexture, setVideoTexture] = useState<THREE.VideoTexture | null>(null);
  const hiddenObjectsRef = useRef<THREE.Object3D[]>([]);

  // Otimização do 2º render (RTT)
  const frameCounterRef = useRef(0);     // contador de frame para decimação temporal
  const rtDirtyRef = useRef(true);       // true quando isPlaying ligou ou TV re-posicionada
  const pinnedPoseRef = useRef<PinnedPose | null>(null);
  const followDirtyRef = useRef(false);
  const headPoseRef = useRef({ position: new THREE.Vector3(), quaternion: new THREE.Quaternion() });

  const pinKey = `freedom3d_tv_pin_${roomId || 'default'}`;

  // ── Indicador de modo (CanvasTexture sprite, baixo custo) ──
  const labelTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, []);

  const drawLabel = (mode: TVMode) => {
    const canvas = labelTexture.image as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(10,12,20,0.72)';
    const r = 12, x = 4, y = 12, w = 248, h = 40;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#a78bfa';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = mode === 'world' ? 'WORLD' : mode === 'follow' ? 'FOLLOW' : 'PIN';
    ctx.fillText(label, 128, 33);
    labelTexture.needsUpdate = true;
  };

  useEffect(() => () => { labelTexture.dispose(); }, [labelTexture]);

  // Monitora o momento exato de ativação do AR para guiar a calibração
  useEffect(() => {
    if (isAR) {
      setSessionStartTime(Date.now());
    } else {
      setSessionStartTime(0);
    }
  }, [isAR]);

  // Escuta os eventos de sessão XR do gl.xr para atualizar o estado de apresentação
  useEffect(() => {
    const handleSessionStart = () => {
      setIsPresenting(true);
      (window as any).__freedom3d_xr_presenting__ = true;
    };
    const handleSessionEnd = () => {
      setIsPresenting(false);
      (window as any).__freedom3d_xr_presenting__ = false;
    };

    gl.xr.addEventListener('sessionstart', handleSessionStart);
    gl.xr.addEventListener('sessionend', handleSessionEnd);

    setIsPresenting(gl.xr.isPresenting);
    (window as any).__freedom3d_xr_presenting__ = gl.xr.isPresenting;

    return () => {
      gl.xr.removeEventListener('sessionstart', handleSessionStart);
      gl.xr.removeEventListener('sessionend', handleSessionEnd);
    };
  }, [gl]);

  // Detecta se estamos no modo AR ativo (que roda simulado dentro de immersive-vr)
  useEffect(() => {
    if (isPresenting) {
      const active = (window as any).__freedom3d_ar_mode__;
      setIsAR(!!active);
    } else {
      setIsAR(false);
    }
  }, [isPresenting]);

  // Lê modo/qualidade do overlay e carrega pose do Pin ao entrar no AR
  useEffect(() => {
    if (!isAR) return;

    const mode = ((window as any).__freedom3d_ar_tv_mode__ || 'world') as TVMode;
    const quality = ((window as any).__freedom3d_ar_tv_quality__ || 'low') as TVQuality;
    tvModeRef.current = mode;
    tvQualityRef.current = quality;
    setTvQuality(quality);

    if (mode === 'pin') {
      try {
        const saved = localStorage.getItem(pinKey);
        if (saved) pinnedPoseRef.current = JSON.parse(saved);
      } catch { /* ignora parse inválido */ }
    } else {
      pinnedPoseRef.current = null;
    }

    frameCounterRef.current = 0;
    rtDirtyRef.current = true;
    followDirtyRef.current = false;

    drawLabel(mode);
  }, [isAR, pinKey]);

  // Re-calibra a TV conforme o modo via gesto (trigger / gamepad / tecla)
  const repositionTV = useCallback(() => {
    const mode = tvModeRef.current;
    if (mode === 'world') {
      setHasSetInitialPosition(false);
      setSessionStartTime(Date.now());
    } else if (mode === 'follow') {
      followDirtyRef.current = true;
      rtDirtyRef.current = true;
    } else if (mode === 'pin') {
      const p = headPoseRef.current;
      const pose: PinnedPose = {
        position: [p.position.x, p.position.y, p.position.z],
        quaternion: [p.quaternion.x, p.quaternion.y, p.quaternion.z, p.quaternion.w],
      };
      pinnedPoseRef.current = pose;
      try {
        localStorage.setItem(pinKey, JSON.stringify(pose));
      } catch { /* ignora falha de quota */ }
      rtDirtyRef.current = true;
    }
  }, [pinKey]);

  // Escuta cliques no trigger do Cardboard (evento select do WebXR)
  useEffect(() => {
    if (!isAR) return;
    const session = gl.xr.getSession();
    const handleXRSelect = () => { repositionTV(); };
    session?.addEventListener('select', handleXRSelect);
    return () => {
      session?.removeEventListener('select', handleXRSelect);
    };
  }, [isAR, isPresenting, gl, repositionTV]);

  // Escuta teclas de atalho de recalibração (C ou R)
  useEffect(() => {
    if (!isAR) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'r') {
        repositionTV();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAR, repositionTV]);

  // Reseta estado de posicionamento quando sai do AR (mantém o Pin em localStorage)
  useEffect(() => {
    if (!isAR) {
      setHasSetInitialPosition(false);
      pinnedPoseRef.current = null;
      frameCounterRef.current = 0;
      rtDirtyRef.current = true;
    }
  }, [isAR]);

  // Força um render do RT quando o estado de jogo (isPlaying) muda
  useEffect(() => {
    rtDirtyRef.current = true;
  }, [isPlaying]);

  // Configuração de Render Target, Câmera de Passthrough e restauração de estados
  useEffect(() => {
    if (!isAR) return;

    // RT com resolução conforme a qualidade (recriado quando qualidade/modo mudam)
    const rt = createTVRenderTarget(tvQuality);
    setRenderTarget(rt);

    // Obtém o elemento de vídeo criado pelo StandalonePlayer
    const video = (window as any).__freedom3d_ar_video__;
    let tex: THREE.VideoTexture | null = null;
    if (video) {
      tex = new THREE.VideoTexture(video);
      tex.colorSpace = THREE.SRGBColorSpace;
      setVideoTexture(tex);
    }

    // Ativa transparência no canvas
    const origBackground = scene.background;
    scene.background = null;
    const origClearColor = gl.getClearColor(new THREE.Color());
    const origClearAlpha = gl.getClearAlpha();
    gl.setClearColor(0x000000, 0);

    return () => {
      scene.background = origBackground;
      gl.setClearColor(origClearColor, origClearAlpha);
      if (tex) {
        tex.dispose();
      }
      setVideoTexture(null);

      rt.dispose();
      setRenderTarget(null);

      // Garante a restauração da visibilidade de quaisquer objetos ocultados
      hiddenObjectsRef.current.forEach(obj => {
        obj.visible = true;
      });
      hiddenObjectsRef.current = [];
    };
  }, [isAR, tvQuality, scene, gl]);

  useFrame((state) => {
    // Restaura a visibilidade dos objetos ocultados no frame anterior para que eles possam rodar e ser filmados
    hiddenObjectsRef.current.forEach(obj => {
      obj.visible = true;
    });
    hiddenObjectsRef.current = [];

    if (!isAR || !renderTarget || !screenRef.current || !groupRef.current) return;

    const screenMesh = screenRef.current;
    const tvObject = groupRef.current;

    // Rastreia a pose da cabeça (para Follow / Pin / re-pin)
    headPoseRef.current.position.copy(state.camera.position);
    headPoseRef.current.quaternion.copy(state.camera.quaternion);

    // Polling de Gamepad para recalibrar a TV (botões 8/9)
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (gp) {
        if (gp.buttons[8]?.pressed || gp.buttons[9]?.pressed) {
          repositionTV();
          break;
        }
      }
    }

    // Encontra a câmera ativa do jogo (ex: câmera do drone, jogador)
    let gameCam: THREE.PerspectiveCamera | null = null;
    state.scene.traverse((obj) => {
      if (
        obj instanceof THREE.PerspectiveCamera &&
        obj !== state.camera &&
        obj.name !== 'xr-camera' &&
        !(obj as any).isXRCamera
      ) {
        gameCam = obj;
      }
    });

    if (!gameCam) return;

    // 1. Posicionamento / calibração da TV virtual conforme o modo
    updateTVPlacement({
      mode: tvModeRef.current,
      camera: state.camera,
      tvObject,
      elapsed: Date.now() - sessionStartTime,
      hasSetInitialPosition,
      setHasSetInitialPosition,
      pinnedPoseRef,
      followDirtyRef,
    });

    // 2. Alinha rigidamente o plano de vídeo de fundo à câmera dos olhos do usuário
    if (backgroundGroupRef.current) {
      backgroundGroupRef.current.position.copy(state.camera.position);
      backgroundGroupRef.current.quaternion.copy(state.camera.quaternion);
    }

    // 3. Renderiza a cena do jogo na textura da TV (RTT), com otimizações
    frameCounterRef.current++;
    const K = 2; // decimação temporal (~30-45Hz em vez de 90Hz)
    const mode = tvModeRef.current;

    // Decide se renderiza: decimação (jogando) ou dirty único (pausado)
    let shouldRender = isPlaying
      ? (rtDirtyRef.current || frameCounterRef.current % K === 0)
      : rtDirtyRef.current;

    // Skip por frustum: só vale para World/Pin (Follow está sempre à frente)
    if (shouldRender && (mode === 'world' || mode === 'pin')) {
      if (!isTVInView(state.camera, tvObject)) {
        shouldRender = false;
      }
    }

    if (shouldRender) {
      // Oculta o aparato da TV para não aparecer dentro da própria textura (e poupar draws)
      screenMesh.visible = false;
      const border = borderRef.current; if (border) border.visible = false;
      const bg = bgMeshRef.current; if (bg) bg.visible = false;
      if (backgroundGroupRef.current) backgroundGroupRef.current.visible = false;
      if (labelRef.current) labelRef.current.visible = false;

      const currentRenderTarget = gl.getRenderTarget();
      // Desativa temporariamente o XR para que o render para a textura (RTT) seja monoscópico normal
      gl.xr.enabled = false;
      gl.setRenderTarget(renderTarget);
      gl.clear();
      gl.render(state.scene, gameCam);
      gl.setRenderTarget(currentRenderTarget);
      // Reativa o XR para a renderização principal da tela do headset
      gl.xr.enabled = true;

      // Restaura o aparato da TV para a visão do headset
      screenMesh.visible = true;
      if (border) border.visible = true;
      if (bg) bg.visible = true;
      if (backgroundGroupRef.current) backgroundGroupRef.current.visible = true;
      if (labelRef.current) labelRef.current.visible = (tvQualityRef.current !== 'low');

      rtDirtyRef.current = false;
    }

    // 4. Oculta todos os meshes do jogo da câmera principal (headset) para este frame.
    // Desta forma, o usuário (câmera do headset) enxerga unicamente a TV plana e a imagem da câmera física ao fundo.
    state.scene.traverse((obj) => {
      if (
        obj instanceof THREE.Mesh &&
        obj !== screenMesh &&
        obj !== borderRef.current &&
        obj !== bgMeshRef.current &&
        obj.visible
      ) {
        obj.visible = false;
        hiddenObjectsRef.current.push(obj);
      }
    });
  });

  if (!isAR || !renderTarget) return null;

  return (
    <group ref={groupRef}>
      {/* Background de Vídeo Passthrough simulado em VR (Mesh Fixo a 20 metros) */}
      {videoTexture && (
        <group ref={backgroundGroupRef}>
          <mesh ref={bgMeshRef} position={[0, 0, 0]} scale={[-1, 1, 1]} renderOrder={-1}>
            <cylinderGeometry args={[20, 20, 25, 32, 1, true, Math.PI * 0.55, Math.PI * 0.9]} />
            <meshBasicMaterial
              map={videoTexture}
              depthTest={false}
              depthWrite={false}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}

      {/* Tela do Monitor Virtual Plana na camada 0 (85 polegadas: 1.881m x 1.058m) */}
      <mesh ref={screenRef} scale={[4.43, 2.49, 1]}>
        <planeGeometry />
        <meshBasicMaterial
          map={renderTarget.texture}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
        {/* Moldura / Painel traseiro preto da TV virtual */}
        <mesh ref={borderRef} position={[0, 0, -0.015]} scale={[1.03, 1.03, 1]}>
          <planeGeometry />
          <meshBasicMaterial color="#0e0e12" side={THREE.DoubleSide} />
        </mesh>
      </mesh>

      {/* Indicador de modo (opcional) — desligado em qualidade 'low' (Cardboard) */}
      {tvQuality !== 'low' && (
        <sprite ref={labelRef} position={[0, 1.5, 0.06]} scale={[0.9, 0.225, 1]}>
          <spriteMaterial
            map={labelTexture}
            depthTest={false}
            depthWrite={false}
            transparent
            toneMapped={false}
          />
        </sprite>
      )}
    </group>
  );
}
