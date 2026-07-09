import { XR, createXRStore, XRSpace, useXRInputSourceStateContext } from '@react-three/xr';

const XR_JOINTS = [
  'wrist',
  'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
  'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
  'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
  'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
  'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip'
];

export function CustomXRHand() {
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
              <sphereGeometry args={[0.015, 12, 12]} />
              <meshStandardMaterial
                color="#00ffd8"
                emissive="#00ffd8"
                emissiveIntensity={1.2}
                roughness={0.1}
                metalness={0.9}
              />
            </mesh>
          </XRSpace>
        );
      })}
    </group>
  );
}

export const xrStore = createXRStore({
  hand: CustomXRHand
});

let lastTeleportTime = 0;
export function attemptTeleport(): boolean {
  const now = Date.now();
  if (now - lastTeleportTime < 600) return false;
  lastTeleportTime = now;
  return true;
}
