import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { DepthLevel } from '../../../../types/ocean';
import { createRealisticSharkGeometry } from '../MarineGeometries';

// ── Hero-Scale Apex Predator Shark Component ────────────────────────────────

interface SharkInstanceConfig {
  id: number;
  center: THREE.Vector3;
  orbitRadiusX: number;
  orbitRadiusZ: number;
  speed: number;
  phase: number;
  depthBand: 'twilight' | 'deep'; // 100m or 500m
  scale: number; // 5.8m - 8.8m hero scale
  verticalAmp: number;
}

function createSharkConfigurations(): SharkInstanceConfig[] {
  return [
    // 100m Twilight Zone (Y around -8.5 to -13.0) — 3 Magnificent Apex Sharks
    {
      id: 1,
      center: new THREE.Vector3(0, -9.5, 0),
      orbitRadiusX: 14.5,
      orbitRadiusZ: 10.5,
      speed: 0.22,
      phase: 0.0,
      depthBand: 'twilight',
      scale: 6.2, // 6.2m Pelagic Shark
      verticalAmp: 0.6,
    },
    {
      id: 2,
      center: new THREE.Vector3(4.5, -11.5, -3.5),
      orbitRadiusX: 18.0,
      orbitRadiusZ: 14.5,
      speed: 0.18,
      phase: Math.PI * 0.75,
      depthBand: 'twilight',
      scale: 7.5, // 7.5m Hero Great White Shark
      verticalAmp: 0.8,
    },
    {
      id: 3,
      center: new THREE.Vector3(-4.5, -12.5, 3.5),
      orbitRadiusX: 16.0,
      orbitRadiusZ: 12.0,
      speed: 0.20,
      phase: Math.PI * 1.4,
      depthBand: 'twilight',
      scale: 5.8,
      verticalAmp: 0.5,
    },

    // 500m Deep Ocean Zone (Y around -46 to -54) — 2 Giant Deep Sleeper Sharks
    {
      id: 4,
      center: new THREE.Vector3(0, -48.0, 0),
      orbitRadiusX: 19.5,
      orbitRadiusZ: 16.5,
      speed: 0.14,
      phase: Math.PI * 0.2,
      depthBand: 'deep',
      scale: 8.0, // 8.0m deep sixgill shark
      verticalAmp: 1.2,
    },
    {
      id: 5,
      center: new THREE.Vector3(-6.5, -52.0, 4.5),
      orbitRadiusX: 23.5,
      orbitRadiusZ: 18.5,
      speed: 0.12,
      phase: Math.PI * 1.1,
      depthBand: 'deep',
      scale: 8.8, // 8.8m colossal deep sleeper shark
      verticalAmp: 1.4,
    },
  ];
}

function SingleSharkMesh({ config }: { config: SharkInstanceConfig }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const { camera } = useThree();

  const originalGeo = useMemo(() => createRealisticSharkGeometry(), []);
  const workingGeo = useMemo(() => originalGeo.clone(), [originalGeo]);

  // Physically based PBR shark material with counter-shaded vertex colors and specular response
  const sharkMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.32,
    metalness: 0.18,
    envMapIntensity: 0.95,
  }), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    const angle = t * config.speed + config.phase;

    // 1. Deliberate wide elliptical cruising trajectory
    const x = config.center.x + Math.cos(angle) * config.orbitRadiusX;
    const z = config.center.z + Math.sin(angle) * config.orbitRadiusZ;
    const y = config.center.y + Math.sin(t * 0.5 * config.speed + config.phase) * config.verticalAmp;

    meshRef.current.position.set(x, y, z);

    // 2. Heading alignment along trajectory tangent
    const nextAngle = angle + 0.03;
    const nextX = config.center.x + Math.cos(nextAngle) * config.orbitRadiusX;
    const nextZ = config.center.z + Math.sin(nextAngle) * config.orbitRadiusZ;
    const nextY = config.center.y + Math.sin((t + 0.03) * 0.5 * config.speed + config.phase) * config.verticalAmp;

    meshRef.current.lookAt(nextX, nextY, nextZ);

    // Gentle banking into turns
    const bankRoll = Math.sin(angle) * 0.20;
    meshRef.current.rotateZ(bankRoll);

    // 3. Tail-Driven Swimming Propulsion (Multi-Joint Progressive Undulation)
    // Snout and head maintain heading, while undulation amplitude increases toward caudal fin
    const basePos = originalGeo.attributes.position as THREE.BufferAttribute;
    const workPos = workingGeo.attributes.position as THREE.BufferAttribute;
    const swimFreq = t * 2.6 * (config.speed / 0.2);

    for (let i = 0; i < basePos.count; i++) {
      const origX = basePos.getX(i);
      const origY = basePos.getY(i);
      const origZ = basePos.getZ(i);

      // Z ranges from +1.45 (snout) down to -2.4 (caudal tip)
      if (origZ < 0.2) {
        const tailFactor = Math.pow(Math.min(1.0, (0.2 - origZ) / 2.4), 2.0);
        const lateralOffset = Math.sin(swimFreq + origZ * 1.5) * tailFactor * 0.24;
        workPos.setX(i, origX + lateralOffset);
      } else {
        workPos.setX(i, origX);
      }
      workPos.setY(i, origY);
      workPos.setZ(i, origZ);
    }
    workPos.needsUpdate = true;
    workingGeo.computeVertexNormals();

    // 4. Depth-aware visibility
    const camY = camera.position.y;
    let targetVisibility = 0;
    if (config.depthBand === 'twilight') {
      targetVisibility = Math.max(0, Math.min(1, 1 - Math.abs(camY - (-10.0)) / 12));
    } else {
      targetVisibility = Math.max(0, Math.min(1, 1 - Math.abs(camY - (-50.0)) / 30));
    }

    meshRef.current.visible = targetVisibility > 0.02;
    const currentScale = config.scale * targetVisibility;
    meshRef.current.scale.setScalar(currentScale);
  });

  return (
    <mesh
      ref={meshRef}
      geometry={workingGeo}
      material={sharkMaterial}
    />
  );
}

export function SharkModel({ depth }: { depth: DepthLevel }) {
  const configs = useMemo(() => createSharkConfigurations(), []);

  return (
    <group name="SharkSystem">
      {configs.map((c) => (
        <SingleSharkMesh key={c.id} config={c} />
      ))}
    </group>
  );
}
