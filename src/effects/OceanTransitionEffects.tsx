import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CinematicTransitionState } from '../hooks/useCinematicTransition';

interface OceanTransitionEffectsProps {
  transitionState: CinematicTransitionState;
  targetLatitude: number;
  targetLongitude: number;
}

function latLonToXYZ(lat: number, lon: number, radius: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return [
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
}

export function OceanTransitionEffects({
  transitionState,
  targetLatitude,
  targetLongitude,
}: OceanTransitionEffectsProps) {
  const pulseRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);
  const lightRef = useRef<THREE.PointLight>(null!);

  const targetPos = latLonToXYZ(targetLatitude, targetLongitude, 2.03);
  const isActive = transitionState.effectState !== 'IDLE';

  useFrame((state) => {
    if (!isActive) return;
    const t = state.clock.elapsedTime;

    // Data pulse ring
    if (pulseRef.current) {
      const scale = 1 + transitionState.progress * 3;
      pulseRef.current.scale.setScalar(scale);
      const mat = pulseRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, transitionState.anomalyPulse * (1 - transitionState.progress * 0.5) * 0.5);
    }

    // Atmosphere enhancement glow
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = transitionState.atmosphereIntensity * 0.08;
    }

    // Ocean lighting
    if (lightRef.current) {
      lightRef.current.intensity = transitionState.oceanLighting * 1.5;
      lightRef.current.position.set(...targetPos);
    }
  });

  if (!isActive) return null;

  return (
    <group>
      {/* Radial data pulse from target region */}
      <mesh
        ref={pulseRef}
        position={targetPos}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.05, 0.08, 32]} />
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Enhanced atmosphere glow during transition */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[2.12, 48, 48]} />
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Subtle point light at target region */}
      <pointLight
        ref={lightRef}
        position={targetPos}
        color="#22d3ee"
        intensity={0}
        distance={4}
        decay={2}
      />
    </group>
  );
}
