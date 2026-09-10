import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Atmosphere() {
  const outerRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (glowRef.current) {
      // Subtle breathing effect
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.08 + Math.sin(t * 0.5) * 0.01;
    }
  });

  return (
    <group>
      {/* Inner atmospheric glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[2.08, 48, 48]} />
        <meshBasicMaterial
          color="#1a78d4"
          transparent
          opacity={0.09}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Outer atmospheric rim */}
      <mesh ref={outerRef}>
        <sphereGeometry args={[2.22, 48, 48]} />
        <meshBasicMaterial
          color="#0a4a9a"
          transparent
          opacity={0.05}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Thin rim light shell */}
      <mesh>
        <sphereGeometry args={[2.03, 48, 48]} />
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0.03}
          side={THREE.FrontSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
