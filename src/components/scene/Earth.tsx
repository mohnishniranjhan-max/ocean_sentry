import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useEarthTexture } from '../../utils/earthTexture';

export function Earth() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const texture = useEarthTexture();

  useFrame((_, delta) => {
    // Very slow constant rotation
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.02;
    }
  });

  return (
    <group>
      {/* Main Earth sphere */}
      <mesh ref={meshRef} receiveShadow castShadow>
        <sphereGeometry args={[2, 96, 96]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.88}
          metalness={0.04}
        />
      </mesh>
    </group>
  );
}
