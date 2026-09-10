import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { DepthLevel } from '../../../types/ocean';

export function SeafloorReef({ depth }: { depth: DepthLevel }) {
  const groupRef = useRef<THREE.Group>(null!);
  const { camera } = useThree();

  // Rocky outcrops and coral formations situated around Y = -28m (visible in distance when looking down from shallow water)
  const reefElements = useMemo(() => [
    { pos: [0, -28, -4], scale: [14, 4, 12], color: '#0f172a' },
    { pos: [-8, -27, 4], scale: [10, 3.5, 9], color: '#1e293b' },
    { pos: [9, -29, 3], scale: [11, 4.0, 10], color: '#09101d' },
    // Coral clusters
    { pos: [2, -25.5, -3], scale: [1.8, 1.8, 1.8], color: '#f43f5e' }, // Staghorn rose
    { pos: [-3, -25.0, -2], scale: [2.0, 1.2, 2.0], color: '#06b6d4' }, // Brain cyan
    { pos: [4, -25.2, 2], scale: [1.6, 2.0, 1.6], color: '#eab308' },  // Gold coral
    { pos: [-5, -24.8, 3], scale: [1.8, 1.4, 1.8], color: '#a855f7' }, // Purple sea fan
  ], []);

  useFrame(() => {
    if (!groupRef.current) return;
    const camY = camera.position.y;
    // Visible between surface and 50m (Y: 0 to -15)
    const visibility = Math.max(0, Math.min(1, (camY + 20) / 15)) * (camY < 0.5 ? 1 : 0);
    groupRef.current.visible = visibility > 0.01;
  });

  return (
    <group ref={groupRef}>
      {reefElements.map((el, i) => (
        <mesh key={i} position={el.pos as [number, number, number]} scale={el.scale as [number, number, number]}>
          <dodecahedronGeometry args={[1, 1]} />
          <meshStandardMaterial
            color={el.color}
            roughness={0.8}
            metalness={0.1}
          />
        </mesh>
      ))}
    </group>
  );
}
