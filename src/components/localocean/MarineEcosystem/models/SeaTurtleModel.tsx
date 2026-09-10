import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { DepthLevel } from '../../../../types/ocean';
import { createRealisticTurtleGeometry } from '../MarineGeometries';
import { MARINE_SPECIES_REGISTRY } from './MarineModelRegistry';

// ── Realistic Sea Turtle Component ─────────────────────────────────────────

interface TurtleInstanceConfig {
  id: number;
  center: THREE.Vector3;
  orbitRadiusX: number;
  orbitRadiusZ: number;
  speed: number;
  phase: number;
  scale: number;
}

function SingleTurtleMesh({ config }: { config: TurtleInstanceConfig }) {
  const groupRef = useRef<THREE.Group>(null!);
  const leftFlipperRef = useRef<THREE.Mesh>(null!);
  const rightFlipperRef = useRef<THREE.Mesh>(null!);

  const { camera } = useThree();
  const { shellGeo, flipperGeo } = useMemo(() => createRealisticTurtleGeometry(), []);

  const meta = MARINE_SPECIES_REGISTRY.sea_turtle;

  const shellMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: meta.colorPalette.dorsal,
    roughness: 0.52,
    metalness: 0.12,
  }), [meta]);

  const flipperMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: meta.colorPalette.accent,
    roughness: 0.60,
  }), [meta]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    const angle = t * config.speed + config.phase;

    const x = config.center.x + Math.cos(angle) * config.orbitRadiusX;
    const z = config.center.z + Math.sin(angle) * config.orbitRadiusZ;
    const y = config.center.y + Math.sin(t * 0.45 + config.phase) * 0.35;

    groupRef.current.position.set(x, y, z);

    const nextAngle = angle + 0.03;
    const nextX = config.center.x + Math.cos(nextAngle) * config.orbitRadiusX;
    const nextZ = config.center.z + Math.sin(nextAngle) * config.orbitRadiusZ;
    groupRef.current.lookAt(nextX, y, nextZ);

    // Front flipper rhythmic breaststroke paddling
    const stroke = Math.sin(t * 2.0 + config.phase);
    if (leftFlipperRef.current) {
      leftFlipperRef.current.rotation.x = stroke * 0.38;
      leftFlipperRef.current.rotation.z = -stroke * 0.22;
    }
    if (rightFlipperRef.current) {
      rightFlipperRef.current.rotation.x = stroke * 0.38;
      rightFlipperRef.current.rotation.z = stroke * 0.22;
    }

    // Depth visibility (active in 50m zone: Y between -2 and -14)
    const camY = camera.position.y;
    const visibility = Math.max(0, Math.min(1, 1 - Math.abs(camY - (-5.0)) / 9));
    groupRef.current.visible = visibility > 0.02;
    groupRef.current.scale.setScalar(config.scale * visibility);
  });

  return (
    <group ref={groupRef}>
      {/* 1. Carapace Shell */}
      <mesh geometry={shellGeo} material={shellMat} position={[0, 0.08, 0]} />

      {/* 2. Head & Neck */}
      <mesh position={[0, 0.04, 0.85]} rotation={[0.2, 0, 0]}>
        <sphereGeometry args={[0.22, 12, 10]} />
        <primitive object={flipperMat} attach="material" />
      </mesh>

      {/* 3. Left Front Flipper */}
      <mesh
        ref={leftFlipperRef}
        geometry={flipperGeo}
        material={flipperMat}
        position={[0.55, 0.02, 0.35]}
        rotation={[0.15, -0.3, -0.3]}
      />

      {/* 4. Right Front Flipper */}
      <mesh
        ref={rightFlipperRef}
        geometry={flipperGeo}
        material={flipperMat}
        position={[-0.55, 0.02, 0.35]}
        rotation={[0.15, 0.3, 0.3]}
        scale={[-1, 1, 1]}
      />

      {/* 5. Rear Steering Flippers */}
      <mesh
        geometry={flipperGeo}
        material={flipperMat}
        position={[0.35, 0.0, -0.75]}
        rotation={[0.1, -0.5, -0.2]}
        scale={[0.55, 0.55, 0.55]}
      />
      <mesh
        geometry={flipperGeo}
        material={flipperMat}
        position={[-0.35, 0.0, -0.75]}
        rotation={[0.1, 0.5, 0.2]}
        scale={[-0.55, 0.55, 0.55]}
      />
    </group>
  );
}

export function SeaTurtleModel({ depth }: { depth: DepthLevel }) {
  const turtles: TurtleInstanceConfig[] = useMemo(() => [
    {
      id: 1,
      center: new THREE.Vector3(-5.5, -5.2, 3.5),
      orbitRadiusX: 11.0,
      orbitRadiusZ: 8.5,
      speed: 0.16,
      phase: 0.5,
      scale: 1.9,
    },
    {
      id: 2,
      center: new THREE.Vector3(5.5, -6.5, -4.5),
      orbitRadiusX: 13.0,
      orbitRadiusZ: 9.5,
      speed: 0.14,
      phase: Math.PI,
      scale: 2.2,
    },
  ], []);

  return (
    <group name="SeaTurtleSystem">
      {turtles.map((t) => (
        <SingleTurtleMesh key={t.id} config={t} />
      ))}
    </group>
  );
}
