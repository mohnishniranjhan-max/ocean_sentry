import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { DepthLevel } from '../../../../types/ocean';
import { MARINE_SPECIES_REGISTRY } from './MarineModelRegistry';

// ── Colossal Abyssal Leviathan (25m+) ────────────────────────────────────────

function ColossalLeviathan() {
  const groupRef = useRef<THREE.Group>(null!);
  const tailRef = useRef<THREE.Group>(null!);
  const { camera } = useThree();

  const meta = MARINE_SPECIES_REGISTRY.colossal_whale;

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    const speed = 0.042;
    const orbitX = 36.0;
    const orbitZ = 30.0;
    const x = Math.cos(t * speed) * orbitX;
    const z = Math.sin(t * speed) * orbitZ;
    const y = -98.0 + Math.sin(t * 0.15) * 3.5;

    groupRef.current.position.set(x, y, z);

    const nextX = Math.cos(t * speed + 0.01) * orbitX;
    const nextZ = Math.sin(t * speed + 0.01) * orbitZ;
    groupRef.current.lookAt(nextX, y, nextZ);

    // Majestic slow tail fluke undulation
    if (tailRef.current) {
      tailRef.current.rotation.y = Math.sin(t * 0.75) * 0.16;
    }

    const camY = camera.position.y;
    const visibility = Math.max(0, Math.min(1, (-(camY + 60)) / 25));
    groupRef.current.visible = visibility > 0.02;
    groupRef.current.scale.setScalar(meta.defaultScale * visibility);
  });

  const leviathanMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: meta.colorPalette.dorsal,
    roughness: 0.8,
    metalness: 0.1,
    transparent: true,
    opacity: 0.88,
  }), [meta]);

  const bioStripeMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: meta.colorPalette.accent || '#06b6d4',
    transparent: true,
    opacity: 0.65,
  }), [meta]);

  return (
    <group ref={groupRef}>
      {/* Massive Fusiform Body */}
      <mesh position={[0, 0, 0]} scale={[1, 0.75, 1]}>
        <cylinderGeometry args={[0.35, 0.45, 2.8, 14]} />
        <primitive object={leviathanMat} attach="material" />
      </mesh>

      {/* Head / Blunt Snout */}
      <mesh position={[0, 0, 1.8]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.42, 1.2, 12]} />
        <primitive object={leviathanMat} attach="material" />
      </mesh>

      {/* Bioluminescent Flank Stripes (Left & Right) */}
      <mesh position={[0.46, 0.05, 0]}>
        <boxGeometry args={[0.02, 0.06, 2.2]} />
        <primitive object={bioStripeMat} attach="material" />
      </mesh>
      <mesh position={[-0.46, 0.05, 0]}>
        <boxGeometry args={[0.02, 0.06, 2.2]} />
        <primitive object={bioStripeMat} attach="material" />
      </mesh>

      {/* Pectoral Fins (Left & Right) */}
      <mesh position={[0.7, -0.15, 0.6]} rotation={[0.1, 0.2, -0.5]}>
        <boxGeometry args={[0.8, 0.05, 0.35]} />
        <primitive object={leviathanMat} attach="material" />
      </mesh>
      <mesh position={[-0.7, -0.15, 0.6]} rotation={[0.1, -0.2, 0.5]}>
        <boxGeometry args={[0.8, 0.05, 0.35]} />
        <primitive object={leviathanMat} attach="material" />
      </mesh>

      {/* Massive Caudal Tail Section */}
      <group ref={tailRef} position={[0, 0, -1.4]}>
        <mesh position={[0, 0, -0.8]}>
          <cylinderGeometry args={[0.15, 0.35, 1.6, 10]} />
          <primitive object={leviathanMat} attach="material" />
        </mesh>
        {/* Horizontal Whale Tail Flukes */}
        <mesh position={[0, 0, -1.8]} scale={[2.2, 0.15, 0.7]}>
          <coneGeometry args={[0.6, 1.0, 4]} />
          <primitive object={leviathanMat} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

// ── Deep-Sea Anglerfish with Glowing Lure ───────────────────────────────────

function Anglerfish({ center, phase }: { center: THREE.Vector3; phase: number }) {
  const groupRef = useRef<THREE.Group>(null!);
  const { camera } = useThree();

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    const x = center.x + Math.sin(t * 0.25 + phase) * 4.0;
    const z = center.z + Math.cos(t * 0.25 + phase) * 3.5;
    const y = center.y + Math.sin(t * 0.5 + phase) * 0.6;

    groupRef.current.position.set(x, y, z);
    groupRef.current.lookAt(center.x + Math.sin(t * 0.25 + phase + 0.05) * 4.0, y, center.z + Math.cos(t * 0.25 + phase + 0.05) * 3.5);

    const camY = camera.position.y;
    const visibility = Math.max(0, Math.min(1, (-(camY + 45)) / 30));
    groupRef.current.visible = visibility > 0.02;
    groupRef.current.scale.setScalar(2.2 * visibility);
  });

  const anglerBodyMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.9,
  }), []);

  const lureGlowMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#38bdf8', // Luminous cyan lure
  }), []);

  return (
    <group ref={groupRef}>
      {/* Globular Body */}
      <mesh position={[0, 0, 0]} scale={[1, 1.2, 1.4]}>
        <sphereGeometry args={[0.4, 12, 12]} />
        <primitive object={anglerBodyMat} attach="material" />
      </mesh>

      {/* Menacing Gaping Lower Jaw with Needles */}
      <mesh position={[0, -0.2, 0.4]} rotation={[0.4, 0, 0]}>
        <coneGeometry args={[0.35, 0.5, 8]} />
        <primitive object={anglerBodyMat} attach="material" />
      </mesh>

      {/* Illitium (Curved Antenna Rod) */}
      <mesh position={[0, 0.45, 0.35]} rotation={[-0.6, 0, 0]}>
        <cylinderGeometry args={[0.015, 0.02, 0.7, 4]} />
        <primitive object={anglerBodyMat} attach="material" />
      </mesh>

      {/* Esca (Glowing Bioluminescent Lure) */}
      <mesh position={[0, 0.72, 0.7]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <primitive object={lureGlowMat} attach="material" />
      </mesh>

      {/* Dynamic Local Light cast by the lure */}
      <pointLight
        position={[0, 0.72, 0.7]}
        color="#38bdf8"
        intensity={1.2}
        distance={8}
        decay={2}
      />
    </group>
  );
}

// ── Bioluminescent Jellyfish Swarm ─────────────────────────────────────────

function BioluminescentJellyfish({ center, phase, scale = 1.0 }: { center: THREE.Vector3; phase: number; scale?: number }) {
  const groupRef = useRef<THREE.Group>(null!);
  const bellRef = useRef<THREE.Mesh>(null!);
  const { camera } = useThree();

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    const pulse = Math.sin(t * 1.6 + phase);
    const y = center.y + Math.sin(t * 0.4 + phase) * 1.5;
    const x = center.x + Math.sin(t * 0.2 + phase) * 2.0;
    const z = center.z + Math.cos(t * 0.2 + phase) * 2.0;

    groupRef.current.position.set(x, y, z);

    if (bellRef.current) {
      bellRef.current.scale.set(1 + pulse * 0.15, 1 - pulse * 0.1, 1 + pulse * 0.15);
    }

    const camY = camera.position.y;
    const visibility = Math.max(0, Math.min(1, (-(camY + 20)) / 35));
    groupRef.current.visible = visibility > 0.02;
    groupRef.current.scale.setScalar(scale * visibility);
  });

  const jellyMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#06b6d4',
    emissive: '#0891b2',
    emissiveIntensity: 0.85,
    transparent: true,
    opacity: 0.55,
    roughness: 0.2,
  }), []);

  return (
    <group ref={groupRef}>
      {/* Translucent Glowing Bell */}
      <mesh ref={bellRef} position={[0, 0, 0]} rotation={[Math.PI, 0, 0]}>
        <sphereGeometry args={[0.35, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <primitive object={jellyMat} attach="material" />
      </mesh>

      {/* Trailing Tentacles */}
      {[0, 1, 2, 3].map((i) => {
        const rad = (i * Math.PI * 2) / 4;
        return (
          <mesh
            key={i}
            position={[Math.cos(rad) * 0.18, -0.6, Math.sin(rad) * 0.18]}
            rotation={[0, 0, 0]}
          >
            <cylinderGeometry args={[0.01, 0.02, 1.2, 4]} />
            <primitive object={jellyMat} attach="material" />
          </mesh>
        );
      })}
    </group>
  );
}

// ── Master Component ────────────────────────────────────────────────────────

export function AbyssalLeviathanModel({ depth }: { depth: DepthLevel }) {
  return (
    <group name="AbyssalLeviathanSystem">
      {/* 26m Colossal Whale Leviathan */}
      <ColossalLeviathan />

      {/* Deep-Sea Anglerfish with Glowing Lures */}
      <Anglerfish center={new THREE.Vector3(-4.5, -92, -3.5)} phase={0.2} />
      <Anglerfish center={new THREE.Vector3(5.5, -97, 2.5)} phase={Math.PI * 0.7} />

      {/* Bioluminescent Jellyfish Floating Columns */}
      <BioluminescentJellyfish center={new THREE.Vector3(-3.5, -46, -4.5)} phase={0.5} scale={1.8} />
      <BioluminescentJellyfish center={new THREE.Vector3(4.5, -54, -2.5)} phase={1.8} scale={2.2} />
      <BioluminescentJellyfish center={new THREE.Vector3(1.5, -88, 5.5)} phase={2.4} scale={2.5} />
      <BioluminescentJellyfish center={new THREE.Vector3(-5.5, -95, 3.5)} phase={3.1} scale={3.0} />
    </group>
  );
}
