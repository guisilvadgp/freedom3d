import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export function VirtualARScreen() {
  const { gl, scene } = useThree();
  const [isPresenting, setIsPresenting] = useState(gl.xr.isPresenting);
  const [isAR, setIsAR] = useState(false);
  const [hasSetInitialPosition, setHasSetInitialPosition] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);

  // Monitora o momento exato de ativacao do AR para guiar a calibracao
  useEffect(() => {
    if (isAR) {
      setSessionStartTime(Date.now());
    } else {
      setSessionStartTime(0);
    }
  }, [isAR]);

  const screenRef = useRef<THREE.Mesh>(null);
  const borderRef = useRef<THREE.Mesh>(null);
  const bgMeshRef = useRef<THREE.Mesh>(null);
  const backgroundGroupRef = useRef<THREE.Group>(null);

  const [renderTarget, setRenderTarget] = useState<THREE.WebGLRenderTarget | null>(null);
  const [videoTexture, setVideoTexture] = useState<THREE.VideoTexture | null>(null);
  const hiddenObjectsRef = useRef<THREE.Object3D[]>([]);

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

    // Estado inicial
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

  // Escuta cliques no trigger do Cardboard (evento select do WebXR)
  useEffect(() => {
    if (!isAR) return;
    const session = gl.xr.getSession();
    const handleXRSelect = () => {
      setHasSetInitialPosition(false);
      setSessionStartTime(Date.now());
    };
    session?.addEventListener('select', handleXRSelect);
    return () => {
      session?.removeEventListener('select', handleXRSelect);
    };
  }, [isAR, isPresenting, gl]);

  // Escuta teclas de atalho de recalibracao (C ou R)
  useEffect(() => {
    if (!isAR) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'r') {
        setHasSetInitialPosition(false);
        setSessionStartTime(Date.now());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAR]);

  // Reseta estado de posicionamento quando sai do AR
  useEffect(() => {
    if (!isAR) {
      setHasSetInitialPosition(false);
    }
  }, [isAR]);

  // Configuração de Render Target, Câmera de Passthrough e restauração de estados
  useEffect(() => {
    if (!isAR) return;

    // Criamos o RenderTarget para o monitor virtual (proporção 16:9)
    const rt = new THREE.WebGLRenderTarget(1280, 720, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });
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
  }, [isAR, scene, gl]);

  useFrame((state) => {
    // Restaura a visibilidade dos objetos ocultados no frame anterior para que eles possam rodar e ser filmados
    hiddenObjectsRef.current.forEach(obj => {
      obj.visible = true;
    });
    hiddenObjectsRef.current = [];

    if (!isAR || !renderTarget || !screenRef.current) return;

    const screenMesh = screenRef.current;

    // Polling de Gamepad para recalibrar a TV (botões Select/Share ou Start/Options)
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (gp) {
        if (gp.buttons[8]?.pressed || gp.buttons[9]?.pressed) {
          setHasSetInitialPosition(false);
          setSessionStartTime(Date.now());
          break;
        }
      }
    }

    // Encontra a câmera ativa do jogo (ex: câmera do drone, jogador)
    let gameCam: THREE.PerspectiveCamera | null = null;
    state.scene.traverse((obj) => {
      if (obj instanceof THREE.PerspectiveCamera && obj !== state.camera && obj.name !== 'xr-camera') {
        gameCam = obj;
      }
    });

    if (!gameCam) return;

    // 1. Posicionamento e calibracao de headtracking inicial da TV virtual
    if (!hasSetInitialPosition) {
      const elapsed = Date.now() - sessionStartTime;
      const xrCamera = state.camera;

      // Direção do olhar do usuário
      const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(xrCamera.quaternion);

      // Coloca a TV a exatamente 3.5 metros de distância à frente dos olhos
      const targetPos = xrCamera.position.clone().add(direction.multiplyScalar(3.5));

      // Altura confortável padrão
      targetPos.y = Math.max(1.1, xrCamera.position.y);

      // Durante os primeiros 1.2 segundos, a TV acompanha o olhar para aguardar a estabilização do giroscópio do celular
      if (elapsed < 1200) {
        // Suaviza a transição física nos primeiros frames usando um lerp leve
        screenMesh.position.lerp(targetPos, 0.15);

        const tempLookTarget = new THREE.Vector3(xrCamera.position.x, targetPos.y, xrCamera.position.z);
        // Cria uma rotação lookAt suave
        const currentRot = screenMesh.quaternion.clone();
        screenMesh.lookAt(tempLookTarget);
        screenMesh.quaternion.slerp(currentRot, 0.85); // Suaviza a rotação
      } else {
        // Trava permanentemente a TV no espaço (world-locked sólido no ambiente físico)
        screenMesh.position.copy(targetPos);
        screenMesh.lookAt(xrCamera.position.x, targetPos.y, xrCamera.position.z);
        setHasSetInitialPosition(true);
      }
    }

    // 2. Alinha rigidamente o plano de vídeo de fundo à câmera dos olhos do usuário
    if (backgroundGroupRef.current) {
      backgroundGroupRef.current.position.copy(state.camera.position);
      backgroundGroupRef.current.quaternion.copy(state.camera.quaternion);
    }

    // 3. Renderiza a cena do jogo na textura da TV
    // Como os meshes do jogo ainda estão visíveis, a gameCam filma tudo normalmente.
    const currentRenderTarget = gl.getRenderTarget();
    // Desativa temporariamente o XR para que o render para a textura (RTT) seja monoscópico normal
    gl.xr.enabled = false;
    gl.setRenderTarget(renderTarget);
    gl.clear();
    gl.render(state.scene, gameCam);
    gl.setRenderTarget(currentRenderTarget);
    // Reativa o XR para a renderização principal da tela do headset
    gl.xr.enabled = true;

    // 4. Oculta todos os meshes do jogo da câmera principal (headset) para este frame.
    // Desta forma, o usuário (câmera do headset) enxerga unicamente a TV plana e a imagem da câmera física ao fundo.
    state.scene.traverse((obj) => {
      if (
        obj.isMesh &&
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
    <group>
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
    </group>
  );
}
