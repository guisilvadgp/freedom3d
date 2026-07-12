import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { XR, createXRStore, XRSpace, useXRInputSourceStateContext } from '@react-three/xr';
import * as THREE from 'three';
import { Camera as CameraIcon, Video, VideoOff, RefreshCw, ArrowLeft, Cpu } from 'lucide-react';

// ─── 1. ARQUITETURA DE ESTADO DE ALTA PERFORMANCE (SEM ZUSTAND) ───
// Ao invés de usar useState no componente principal (que força re-render do Canvas),
// criamos um mini-store isolado para o HUD.
const hudState = {
  status: 'Inicializando...',
  fps: 0,
  handsCount: 0,
};

const hudListeners = new Set<() => void>();

function updateHudState(newState: Partial<typeof hudState>) {
  let changed = false;
  for (const key in newState) {
    if (hudState[key as keyof typeof hudState] !== newState[key as keyof typeof hudState]) {
      // @ts-ignore
      hudState[key] = newState[key];
      changed = true;
    }
  }
  if (changed) {
    hudListeners.forEach((listener) => listener());
  }
}

function useHudState() {
  const [state, setState] = useState(hudState);
  useEffect(() => {
    const listener = () => setState({ ...hudState });
    hudListeners.add(listener);
    return () => {
      hudListeners.delete(listener);
    };
  }, []);
  return state;
}

// ─── 2. REFERÊNCIAS GLOBAIS DE RASTREAMENTO (SEM RE-RENDERS) ───
const cameraLandmarksRef = { current: null as any[] | null };
const indexFingerWorldPosRef = { current: new THREE.Vector3() };
const thumbTipWorldPosRef = { current: new THREE.Vector3() };
const isPinchingRef = { current: false };

// ─── 3. SCRIPTS EXTERNOS (MEDIAPIPE) ───
const SCRIPTS = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js'
];

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Falha ao carregar: ${src}`));
    document.head.appendChild(script);
  });
}

// ─── 4. COMPONENTES 3D (WEBXR & R3F) ───

/**
 * Cubo Interativo: Representa um objeto 3D ancorado no mundo.
 * Suporta a funcionalidade de ser "agarrado" via gesto de pinça (Pinch).
 */
function InteractiveCube() {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  
  const hoveredRef = useRef(false);
  const grabbedRef = useRef(false);
  
  const initializedRef = useRef(false);
  const offsetRef = useRef(new THREE.Vector3());

  useFrame(({ camera, clock }) => {
    if (!meshRef.current) return;

    // Reposicionamento mais inteligente: aguarda a câmera ter uma posição real (pós-load do VR)
    if (!initializedRef.current && (camera.position.z !== 8 || clock.elapsedTime > 1.0)) {
      const forward = new THREE.Vector3(0, 0, -0.6).applyQuaternion(camera.quaternion);
      meshRef.current.position.copy(camera.position).add(forward);
      initializedRef.current = true;
    }

    const dist = meshRef.current.position.distanceTo(indexFingerWorldPosRef.current);
    const hitThreshold = 0.15; // 15cm hitbox
    
    // Detecta Pinch (Pinça) - Distância entre Polegar e Indicador
    const pinchDist = indexFingerWorldPosRef.current.distanceTo(thumbTipWorldPosRef.current);
    const isPinching = pinchDist < 0.04 && pinchDist > 0.001; // Menos de 4cm é pinça
    isPinchingRef.current = isPinching;

    // Lógica de Hover (Sem Re-render React)
    const isHovered = dist < hitThreshold;
    if (isHovered !== hoveredRef.current && !grabbedRef.current) {
      hoveredRef.current = isHovered;
    }

    // Lógica de Grab (Agarrar e Mover)
    if (hoveredRef.current && isPinching && !grabbedRef.current) {
      grabbedRef.current = true;
      // Calcula offset para não "pular" pro centro do dedo
      offsetRef.current.copy(meshRef.current.position).sub(indexFingerWorldPosRef.current);
    } else if (grabbedRef.current && !isPinching) {
      grabbedRef.current = false; // Solta no espaço (Mundo Fixo)
    }

    // Comportamento
    if (grabbedRef.current) {
      // Segue a mão mantendo o offset original
      const targetPos = indexFingerWorldPosRef.current.clone().add(offsetRef.current);
      meshRef.current.position.lerp(targetPos, 0.3); // Suavização forte para seguir a mão
      
      // Rotação acelerada ao segurar
      meshRef.current.rotation.x += 0.05;
      meshRef.current.rotation.y += 0.05;
    } else {
      // Rotação padrão flutuante (idle)
      meshRef.current.rotation.x = clock.getElapsedTime() * 0.5;
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.5;
    }
    
    // Feedback visual (Escala e Cor Diretos)
    const targetScale = grabbedRef.current ? 1.4 : (hoveredRef.current ? 1.2 : 1.0);
    meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.2);

    if (materialRef.current) {
      const colorHex = grabbedRef.current ? '#ff3366' : (hoveredRef.current ? '#ff00ff' : '#00ffd8');
      const emissiveIntensity = grabbedRef.current ? 1.0 : 0.5;
      
      materialRef.current.color.set(colorHex);
      materialRef.current.emissive.set(colorHex);
      materialRef.current.emissiveIntensity = emissiveIntensity;
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[0.15, 0.15, 0.15]} />
      <meshStandardMaterial 
        ref={materialRef}
        color="#00ffd8"
        roughness={0.2} 
        metalness={0.8}
        emissive="#000000"
        emissiveIntensity={0.5}
      />
    </mesh>
  );
}

/**
 * Ambiente VR (Background + Visualização de Mão 3D via MediaPipe)
 * Renderiza de forma dissociada do React State.
 */
function VRCameraEnvironment({ 
  videoRef, 
  facingMode 
}: { 
  videoRef: React.RefObject<HTMLVideoElement | null>;
  facingMode: 'user' | 'environment';
}) {
  const groupRef = useRef<THREE.Group>(null);
  const handGroupRef = useRef<THREE.Group>(null);
  const [texture, setTexture] = useState<THREE.VideoTexture | null>(null);
  const [videoAspect, setVideoAspect] = useState(16 / 9);

  // Inicializa a textura do vídeo
  useEffect(() => {
    if (videoRef && videoRef.current) {
      const video = videoRef.current;
      const tex = new THREE.VideoTexture(video);
      tex.colorSpace = THREE.SRGBColorSpace;
      
      if (facingMode === 'user') {
        tex.wrapS = THREE.RepeatWrapping;
        tex.repeat.x = -1; // Efeito espelho
      }
      setTexture(tex);

      const updateAspect = () => {
        if (video.videoWidth && video.videoHeight) {
          setVideoAspect(video.videoWidth / video.videoHeight);
        }
      };
      
      video.addEventListener('loadedmetadata', updateAspect);
      video.addEventListener('resize', updateAspect);
      updateAspect();

      return () => {
        tex.dispose();
        video.removeEventListener('loadedmetadata', updateAspect);
        video.removeEventListener('resize', updateAspect);
      };
    }
  }, [videoRef, facingMode]);

  useFrame(({ camera }) => {
    // Alinha o ambiente inteiro à câmera de forma rígida
    if (groupRef.current) {
      groupRef.current.position.copy(camera.position);
      groupRef.current.quaternion.copy(camera.quaternion);
    }
    
    const landmarks = cameraLandmarksRef.current;
    if (!handGroupRef.current) return;

    if (!landmarks) {
      handGroupRef.current.visible = false;
      return;
    }

    handGroupRef.current.visible = true;

    // Configuração de projeção geométrica para as mãos virtuais
    const bgDistance = 20;
    const bgHeight = 40;
    const bgWidth = bgHeight * videoAspect;

    const handDistance = 0.6; // Mão a 60cm de distância real
    const scale = handDistance / bgDistance;
    const handHeight = bgHeight * scale;
    const handWidth = bgWidth * scale;
    
    const zBase = -handDistance;
    const mirrorFactor = facingMode === 'user' ? -1 : 1;

    const spheres = handGroupRef.current.children;
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      const sphere = spheres[i];
      if (sphere) {
        const x = (lm.x - 0.5) * handWidth * mirrorFactor;
        const y = -(lm.y - 0.5) * handHeight;
        const z = zBase - (lm.z * handWidth); 
        
        sphere.position.set(x, y, z);

        const localPos = new THREE.Vector3(x, y, z);
        
        // Atualiza Ponta do Indicador (Index = 8)
        if (i === 8) {
          indexFingerWorldPosRef.current.copy(localPos).applyMatrix4(camera.matrixWorld);
        }
        
        // Atualiza Ponta do Polegar (Index = 4) para detectar gesto de Pinça (Pinch/Grab)
        if (i === 4) {
          thumbTipWorldPosRef.current.copy(localPos).applyMatrix4(camera.matrixWorld);
        }
      }
    }
  });

  if (!texture) return null;

  const bgHeight = 40;
  const bgWidth = bgHeight * videoAspect;

  return (
    <group ref={groupRef}>
      {/* Background de Vídeo (Mesh Fixo) */}
      <mesh position={[0, 0, -20]} renderOrder={-1}>
        <planeGeometry args={[bgWidth, bgHeight]} />
        <meshBasicMaterial 
          map={texture} 
          depthTest={false} 
          depthWrite={false} 
          toneMapped={false} 
          side={THREE.DoubleSide} 
        />
      </mesh>

      {/* Rastreamento 3D da Mão (MediaPipe Projetado) */}
      <group ref={handGroupRef} visible={false}>
        {Array.from({ length: 21 }).map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.015, 8, 8]} />
            <meshBasicMaterial color="#00ffd8" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/**
 * Hand Nativa do WebXR (Quest, Pico, Vision Pro)
 */
const XR_JOINTS = [
  'wrist',
  'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
  'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
  'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
  'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
  'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip'
];

function CustomXRHand() {
  const state = useXRInputSourceStateContext('hand');
  if (!state?.inputSource?.hand) return null;

  return (
    <group>
      {XR_JOINTS.map((jointName) => {
        // @ts-ignore
        const jointSpace = state.inputSource.hand.get(jointName);
        if (!jointSpace) return null;

        return (
          <XRSpace key={jointName} space={jointSpace}>
            <mesh>
              <sphereGeometry args={[0.012, 12, 12]} />
              <meshBasicMaterial
                color="#00ffd8"
              />
            </mesh>
          </XRSpace>
        );
      })}
    </group>
  );
}

const handTrackingXRStore = createXRStore({
  hand: CustomXRHand
});

// ─── 5. INTERFACE DE USUÁRIO (ISOLADA) ───
function StatusBar() {
  const { status, fps, handsCount } = useHudState();
  const isError = status.toLowerCase().includes('erro');
  const isTracking = status.toLowerCase().includes('rastreando') || status.toLowerCase().includes('mão');

  return (
    <div style={{
      background: '#0b0f19',
      borderTop: '1px solid #1e293b',
      padding: '10px 20px',
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: '12px',
      zIndex: 10
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: isError ? '#ef4444' : (isTracking ? '#00ffd8' : '#e2e8f0'),
          boxShadow: isTracking ? '0 0 8px #00ffd8' : 'none',
          transition: 'all 0.3s ease'
        }} />
        <span style={{ color: '#cbd5e1' }}>{status}</span>
      </div>

      <div style={{ display: 'flex', gap: '20px', color: '#94a3b8' }}>
        <div>
          FPS: <strong style={{ color: '#f1f5f9' }}>{fps}</strong>
        </div>
        <div>
          Mãos: <strong style={{ color: '#f1f5f9' }}>{handsCount}</strong>
        </div>
      </div>
    </div>
  );
}


// ─── 6. COMPONENTE PRINCIPAL (CONTROLADOR) ───
export function HandTrackingTest() {
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [isXRSupported, setIsXRSupported] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvas2dRef = useRef<HTMLCanvasElement | null>(null);

  const handsRef = useRef<any>(null);
  const cameraHelperRef = useRef<any>(null);
  const loopActiveRef = useRef<boolean>(false);
  
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(performance.now());

  // Verificação de Suporte VR (WebXR)
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr').then(supported => {
        setIsXRSupported(supported);
      });
    }
  }, []);

  // Inicialização Assíncrona do MediaPipe
  useEffect(() => {
    let active = true;
    
    const init = async () => {
      try {
        updateHudState({ status: 'Carregando dependências de ML...' });
        for (const src of SCRIPTS) {
          await loadScript(src);
        }
        if (active) {
          updateHudState({ status: 'Modelos carregados. Preparando rastreamento...' });
          setupMediaPipe();
        }
      } catch (err: any) {
        console.error(err);
        updateHudState({ status: `Erro: ${err.message}` });
      }
    };
    init();

    return () => {
      active = false;
      stopCamera();
      if (handsRef.current) {
        try { handsRef.current.close(); } catch (e) { }
      }
    };
  }, []);

  const setupMediaPipe = useCallback(() => {
    // @ts-ignore
    const mpHands = window.Hands;
    if (!mpHands) {
      updateHudState({ status: 'Erro crítico: MediaPipe indisponível.' });
      return;
    }

    const hands = new mpHands({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1, // Melhor balanço de performance/precisão
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6
    });

    hands.onResults(onResults);
    handsRef.current = hands;

    updateHudState({ status: 'Pronto para uso.' });
    startCamera();
  }, [facingMode]);

  const startCamera = async () => {
    stopCamera();

    const video = videoRef.current;
    if (!video) return;

    updateHudState({ status: 'Inicializando Hardware...' });
    
    try {
      // @ts-ignore
      const mpCamera = window.Camera;
      
      if (!mpCamera) {
        // Fallback Nativo (MediaDevices)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        });
        video.srcObject = stream;
        video.play();
        setCameraActive(true);
        updateHudState({ status: 'Câmera nativa ativa.' });

        loopActiveRef.current = true;
        const process = async () => {
          if (!loopActiveRef.current) return;
          if (video.readyState === 4 && handsRef.current) {
            await handsRef.current.send({ image: video });
          }
          requestAnimationFrame(process);
        };
        requestAnimationFrame(process);
        return;
      }

      // MediaPipe Helper
      const cameraHelper = new mpCamera(video, {
        onFrame: async () => {
          if (handsRef.current) {
            await handsRef.current.send({ image: video });
          }
        },
        width: 640,
        height: 480,
        facingMode
      });

      cameraHelperRef.current = cameraHelper;
      await cameraHelper.start();
      setCameraActive(true);
      updateHudState({ status: 'Aguardando rastreamento da mão...' });
    } catch (err: any) {
      console.error(err);
      updateHudState({ status: `Erro Câmera: ${err.message || err}` });
    }
  };

  const stopCamera = () => {
    loopActiveRef.current = false;
    
    if (cameraHelperRef.current) {
      try { cameraHelperRef.current.stop(); } catch (e) { }
      cameraHelperRef.current = null;
    }

    const video = videoRef.current;
    if (video && video.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
    
    setCameraActive(false);
    cameraLandmarksRef.current = null;
    updateHudState({ handsCount: 0 });
  };

  const toggleCameraFacing = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  useEffect(() => {
    if (cameraActive) {
      startCamera();
    }
  }, [facingMode]);

  // Callback de alta frequência: Mantido leve, sem React SetState direto
  const onResults = (results: any) => {
    const now = performance.now();
    frameCountRef.current++;

    // Cálculo de FPS desacoplado do ciclo de render
    if (now - lastFpsUpdateRef.current >= 500) {
      const fps = Math.round((frameCountRef.current * 1000) / (now - lastFpsUpdateRef.current));
      updateHudState({ fps });
      frameCountRef.current = 0;
      lastFpsUpdateRef.current = now;
    }

    const canvas = canvas2dRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== results.image.width || canvas.height !== results.image.height) {
      canvas.width = results.image.width;
      canvas.height = results.image.height;
    }

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      updateHudState({ status: 'Mão rastreada', handsCount: results.multiHandLandmarks.length });

      for (const landmarks of results.multiHandLandmarks) {
        if (window.drawConnectors && window.HAND_CONNECTIONS) {
          window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, {
            color: '#00ffd8', lineWidth: 4
          });
        }
        if (window.drawLandmarks) {
          window.drawLandmarks(ctx, landmarks, {
            color: '#ff00ff', lineWidth: 2, radius: 4
          });
        }
      }

      // Atualiza a ref para o loop de renderização 3D
      cameraLandmarksRef.current = results.multiHandLandmarks[0];
    } else {
      updateHudState({ status: 'Nenhuma mão detectada.', handsCount: 0 });
      cameraLandmarksRef.current = null;
    }
    
    ctx.restore();
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#04060a',
      color: '#fff',
      fontFamily: 'Inter, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Header UI */}
      <div style={{
        padding: '12px 20px',
        background: '#0b0f19',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => window.location.pathname = '/'}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '6px'
            }}
            title="Voltar"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#f8fafc' }}>Hand Tracking AR/VR</h1>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>WebXR & MediaPipe Spatial Engine</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {isXRSupported && (
            <button
              onClick={() => handTrackingXRStore.enterVR()}
              style={{
                background: '#8b5cf6',
                border: 'none',
                color: '#fff',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                boxShadow: '0 0 10px rgba(139, 92, 246, 0.4)'
              }}
            >
              <Cpu size={14} />
              <span>Immersive VR</span>
            </button>
          )}

          <button
            onClick={toggleCameraFacing}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#f1f5f9',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} />
            <span>{facingMode === 'user' ? 'Frontal' : 'Traseira'}</span>
          </button>

          <button
            onClick={cameraActive ? stopCamera : startCamera}
            style={{
              background: cameraActive ? '#ef4444' : '#10b981',
              border: 'none',
              color: '#fff',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            {cameraActive ? <VideoOff size={14} /> : <Video size={14} />}
            <span>{cameraActive ? 'Desligar' : 'Ligar'}</span>
          </button>
        </div>
      </div>

      {/* Workspace Grid */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr',
        position: 'relative',
        minHeight: 0
      }} className="tracking-grid">
        
        {/* Painel Esquerdo: Computer Vision */}
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#070a13',
          borderRight: '1px solid #1e293b',
          overflow: 'hidden'
        }}>
          <video ref={videoRef} playsInline muted style={{ display: 'none' }} />
          <canvas
            ref={canvas2dRef}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none'
            }}
          />

          {!cameraActive && (
            <div style={{
              position: 'absolute',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              color: '#94a3b8'
            }}>
              <CameraIcon size={48} style={{ opacity: 0.5 }} />
              <span style={{ fontSize: '13px' }}>Câmera Desligada</span>
            </div>
          )}
        </div>

        {/* Painel Direito: Spatial Engine (R3F) */}
        <div style={{
          position: 'relative',
          background: '#0b0f19',
          overflow: 'hidden',
          width: '100%',
          height: '100%'
        }}>
          <div style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#a5f3fc',
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            pointerEvents: 'none'
          }}>
            <Cpu size={12} />
            <span>WebGL Spatial Renderer</span>
          </div>

          <Canvas camera={{ position: [0, 0, 8], fov: 50 }}>
            <XR store={handTrackingXRStore}>
              <ambientLight intensity={0.6} />
              <directionalLight position={[5, 5, 5]} intensity={1} color="#00ffd8" />
              <directionalLight position={[-5, -5, 5]} intensity={0.8} color="#ff00ff" />
              
              <InteractiveCube />
              <VRCameraEnvironment videoRef={videoRef} facingMode={facingMode} />
            </XR>
          </Canvas>
        </div>
      </div>

      <StatusBar />

      <style dangerouslySetInnerHTML={{
        __html: `
        @media (max-width: 768px) {
          .tracking-grid {
            grid-template-columns: 1fr !important;
            grid-template-rows: 1fr 1fr !important;
          }
        }
      `}} />
    </div>
  );
}
