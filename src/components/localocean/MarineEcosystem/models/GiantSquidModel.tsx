import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { DepthLevel } from '../../../../types/ocean';
import { MARINE_SPECIES_REGISTRY } from './MarineModelRegistry';

// ── Giant Squid (Architeuthis) Component ───────────────────────────────────

interface SquidInstanceConfig {
  id: number;
  center: THREE.Vector3;
  orbitRadiusX: number;
  orbitRadiusZ: number;
  speed: number;
  phase: number;
  scale: number; // 8.5m - 11m
  depthBand: 'deep' | 'abyss';
}

function SingleSquidMesh({ config }: { config: SquidInstanceConfig }) {
  const groupRef = useRef<THREE.Group>(null!);
  const mantleRef = useRef<THREE.Mesh>(null!);
  const armsGroupRef = useRef<THREE.Group>(null!);
  const armRefs = useRef<(THREE.Group | null)[]>([]);

  const { camera } = useThree();
  const meta = MARINE_SPECIES_REGISTRY.giant_squid;

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    const angle = t * config.speed + config.phase;

    // Slow, mysterious deep drift
    const x = config.center.x + Math.cos(angle) * config.orbitRadiusX;
    const z = config.center.z + Math.sin(angle) * config.orbitRadiusZ;
    const y = config.center.y + Math.sin(t * 0.35 + config.phase) * 1.4;

    groupRef.current.position.set(x, y, z);

    const nextAngle = angle + 0.02;
    const nextX = config.center.x + Math.cos(nextAngle) * config.orbitRadiusX;
    const nextZ = config.center.z + Math.sin(nextAngle) * config.orbitRadiusZ;
    groupRef.current.lookAt(nextX, y, nextZ);

    // Jet propulsion mantle contraction pulse
    const jetPulse = Math.sin(t * 1.6 + config.phase);
    if (mantleRef.current) {
      mantleRef.current.scale.set(1 + jetPulse * 0.07, 1 - jetPulse * 0.03, 1 + jetPulse * 0.07);
    }

    // Undulate the 8 arms
    armRefs.current.forEach((arm, i) => {
      if (!arm) return;
      const armPhase = config.phase + (i * Math.PI) / 4;
      arm.rotation.x = Math.sin(t * 2.0 + armPhase) * 0.20;
      arm.rotation.y = Math.cos(t * 1.6 + armPhase) * 0.16;
    });

    // Depth-aware visibility
    const camY = camera.position.y;
    let visibility = 0;
    if (config.depthBand === 'deep') {
      visibility = Math.max(0, Math.min(1, 1 - Math.abs(camY - (-50.0)) / 28));
    } else {
      visibility = Math.max(0, Math.min(1, 1 - Math.abs(camY - (-95.0)) / 30));
    }

    groupRef.current.visible = visibility > 0.02;
    groupRef.current.scale.setScalar(config.scale * visibility);
  });

  const squidSkinMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: meta.colorPalette.dorsal,
    roughness: 0.35,
    metalness: 0.38,
    envMapIntensity: 0.75,
  }), [meta]);

  const eyeGlowMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: meta.colorPalette.accent || '#fef08a',
  }), [meta]);

  return (
    <group ref={groupRef}>
      {/* 1. Torpedo Mantle */}
      <mesh ref={mantleRef} position={[0, 0, -1.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.55, 3.2, 14]} />
        <primitive object={squidSkinMat} attach="material" />
      </mesh>

      {/* 2. Stabilizing Tail Fins (Diamond shape) */}
      <mesh position={[0, 0, -3.2]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[1.4, 0.04, 1.4]} />
        <primitive object={squidSkinMat} attach="material" />
      </mesh>

      {/* 3. Head Section */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.48, 12, 12]} />
        <primitive object={squidSkinMat} attach="material" />
      </mesh>

      {/* Huge Glowing Eyes with pupils */}
      <mesh position={[0.42, 0.05, 0.1]}>
        <sphereGeometry args={[0.16, 10, 10]} />
        <primitive object={eyeGlowMat} attach="material" />
      </mesh>
      <mesh position={[0.48, 0.05, 0.1]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color="#020617" />
      </mesh>

      <mesh position={[-0.42, 0.05, 0.1]}>
        <sphereGeometry args={[0.16, 10, 10]} />
        <primitive object={eyeGlowMat} attach="material" />
      </mesh>
      <mesh position={[-0.48, 0.05, 0.1]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color="#020617" />
      </mesh>

      {/* 4. 8 Undulating Arms & 2 Long Feeding Clubs */}
      <group ref={armsGroupRef} position={[0, 0, 0.4]}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const rad = (i * Math.PI * 2) / 8;
          const armX = Math.cos(rad) * 0.28;
          const armY = Math.sin(rad) * 0.28;
          return (
            <group
              key={i}
              ref={(el) => { armRefs.current[i] = el; }}
              position={[armX, armY, 0]}
            >
              <mesh position={[0, 0, 1.5]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.04, 0.12, 3.0, 6]} />
                <primitive object={squidSkinMat} attach="material" />
              </mesh>
            </group>
          );
        })}

        {/* 2 Long Feeding Tentacles */}
        <mesh position={[0.1, -0.05, 3.8]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.06, 7.5, 6]} />
          <primitive object={squidSkinMat} attach="material" />
        </mesh>
        <mesh position={[-0.1, -0.05, 3.8]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.06, 7.5, 6]} />
          <primitive object={squidSkinMat} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

export function GiantSquidModel({ depth }: { depth: DepthLevel }) {
  const squids: SquidInstanceConfig[] = useMemo(() => [
    {
      id: 1,
      center: new THREE.Vector3(4.5, -49.0, -4.5),
      orbitRadiusX: 19.5,
      orbitRadiusZ: 15.5,
      speed: 0.13,
      phase: 0.4,
      scale: 8.5, // 8.5m Giant Squid at 500m
      depthBand: 'deep',
    },
    {
      id: 2,
      center: new THREE.Vector3(-6.5, -96.0, 5.5),
      orbitRadiusX: 24.5,
      orbitRadiusZ: 19.5,
      speed: 0.10,
      phase: Math.PI * 0.8,
      scale: 11.0, // 11.0m Colossal Squid at 1000m
      depthBand: 'abyss',
    },
  ], []);

  return (
    <group name="GiantSquidSystem">
      {squids.map((s) => (
        <SingleSquidMesh key={s.id} config={s} />
      ))}
    </group>
  );
}
