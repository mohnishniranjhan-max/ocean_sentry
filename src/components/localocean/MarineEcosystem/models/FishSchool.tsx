import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { DepthLevel } from '../../../../types/ocean';
import { createHighFidelityFishGeometry, createTunaGeometry } from '../MarineGeometries';

// ── Multi-Species Boid Fish Data Structure ──────────────────────────────────

interface SchoolingBoid {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  target: THREE.Vector3;
  speed: number;
  maxSpeed: number;
  schoolId: number;
  speciesIndex: number;
  scale: number;
  phase: number;
  color: THREE.Color;
}

// ── Species Definitions for 10m Photic Zone ─────────────────────────────────

const SHALLOW_SPECIES = [
  { name: 'Blue Chromis', color: '#0284c7', scale: 0.70, speed: 1.1 },
  { name: 'Yellowtail Damselfish', color: '#eab308', scale: 0.82, speed: 0.95 },
  { name: 'Silver Sardine', color: '#e2e8f0', scale: 0.65, speed: 1.3 },
  { name: 'Emerald Parrotfish', color: '#0d9488', scale: 0.88, speed: 0.85 },
];

function createShallowSchool(count: number): SchoolingBoid[] {
  const boids: SchoolingBoid[] = [];

  // 3 distinct cluster radii for natural spatial depth and open negative space
  const clusters = [
    { center: new THREE.Vector3(4.5, -1.2, 3.8), spread: 5.5 },  // Near school
    { center: new THREE.Vector3(-5.2, -1.8, -3.5), spread: 6.2 }, // Mid school
    { center: new THREE.Vector3(1.8, -2.5, -8.2), spread: 7.5 },  // Far background school
  ];

  for (let i = 0; i < count; i++) {
    const schoolId = i % clusters.length;
    const cluster = clusters[schoolId];
    const spIdx = i % SHALLOW_SPECIES.length;
    const sp = SHALLOW_SPECIES[spIdx];

    const pos = new THREE.Vector3(
      cluster.center.x + (Math.random() - 0.5) * cluster.spread,
      cluster.center.y + (Math.random() - 0.5) * 1.6,
      cluster.center.z + (Math.random() - 0.5) * cluster.spread
    );

    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 0.12,
      (Math.random() - 0.5) * 0.8
    ).normalize().multiplyScalar(sp.speed + (Math.random() - 0.5) * 0.3);

    boids.push({
      position: pos,
      velocity: vel,
      target: cluster.center.clone(),
      speed: sp.speed + (Math.random() - 0.5) * 0.3,
      maxSpeed: sp.speed * 1.8,
      schoolId,
      speciesIndex: spIdx,
      scale: sp.scale * (0.85 + Math.random() * 0.3),
      phase: Math.random() * Math.PI * 2,
      color: new THREE.Color(sp.color),
    });
  }

  return boids;
}

// ── Species Definitions for 50m Mesopelagic Zone ────────────────────────────

function createMidSchool(count: number): SchoolingBoid[] {
  const boids: SchoolingBoid[] = [];
  const tunaColor1 = new THREE.Color('#1e3a8a'); // Deep royal blue
  const tunaColor2 = new THREE.Color('#cbd5e1'); // Silver mackerel
  const tunaColor3 = new THREE.Color('#0369a1'); // Steel ocean blue

  const clusters = [
    { center: new THREE.Vector3(5.0, -5.2, -4.5), spread: 7.5 },
    { center: new THREE.Vector3(-5.8, -6.6, 5.0), spread: 8.5 },
  ];

  for (let i = 0; i < count; i++) {
    const schoolId = i % clusters.length;
    const cluster = clusters[schoolId];
    const color = i % 3 === 0 ? tunaColor1 : i % 3 === 1 ? tunaColor2 : tunaColor3;

    const pos = new THREE.Vector3(
      cluster.center.x + (Math.random() - 0.5) * cluster.spread,
      cluster.center.y + (Math.random() - 0.5) * 2.2,
      cluster.center.z + (Math.random() - 0.5) * cluster.spread
    );

    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 1.0,
      (Math.random() - 0.5) * 0.15,
      (Math.random() - 0.5) * 1.0
    ).normalize().multiplyScalar(1.2 + Math.random() * 0.6);

    boids.push({
      position: pos,
      velocity: vel,
      target: cluster.center.clone(),
      speed: 1.1 + Math.random() * 0.6,
      maxSpeed: 2.2,
      schoolId,
      speciesIndex: 0,
      scale: 1.5 + Math.random() * 0.6, // 1.5m to 2.1m pelagic tuna
      phase: Math.random() * Math.PI * 2,
      color,
    });
  }

  return boids;
}

// ── Component ───────────────────────────────────────────────────────────────

interface FishSchoolProps {
  depth: DepthLevel;
}

export function FishSchool({ depth }: FishSchoolProps) {
  const shallowMeshRef = useRef<THREE.InstancedMesh>(null!);
  const midMeshRef = useRef<THREE.InstancedMesh>(null!);

  const { camera } = useThree();

  // Controlled, balanced fish population (very small quantity as requested)
  const shallowCount = 1;
  const midCount = 1;

  const shallowBoids = useMemo(() => createShallowSchool(shallowCount), []);
  const midBoids = useMemo(() => createMidSchool(midCount), []);

  const reefFishGeometry = useMemo(() => createHighFidelityFishGeometry(), []);
  const tunaGeometry = useMemo(() => createTunaGeometry(), []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (shallowMeshRef.current) {
      shallowBoids.forEach((b, i) => shallowMeshRef.current.setColorAt(i, b.color));
      if (shallowMeshRef.current.instanceColor) shallowMeshRef.current.instanceColor.needsUpdate = true;
    }
    if (midMeshRef.current) {
      midBoids.forEach((b, i) => midMeshRef.current.setColorAt(i, b.color));
      if (midMeshRef.current.instanceColor) midMeshRef.current.instanceColor.needsUpdate = true;
    }
  }, [shallowBoids, midBoids]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    const camY = camera.position.y;

    // 1. Update 10m Shallow School
    if (shallowMeshRef.current) {
      const shallowVisibility = Math.max(0, Math.min(1, (camY + 8) / 7)) * (camY < 0.5 ? 1 : 0);
      shallowMeshRef.current.visible = shallowVisibility > 0.01;

      if (shallowMeshRef.current.visible) {
        const clusterCenters = [
          new THREE.Vector3(Math.cos(t * 0.22) * 6.5, -1.3 + Math.sin(t * 0.35) * 0.4, Math.sin(t * 0.22) * 6.5),
          new THREE.Vector3(Math.cos(t * 0.26 + 2) * 7.5, -1.9 + Math.sin(t * 0.42) * 0.45, Math.sin(t * 0.26 + 2) * 5.8),
          new THREE.Vector3(Math.cos(t * 0.18 + 4) * 8.8, -2.5 + Math.sin(t * 0.25) * 0.4, Math.sin(t * 0.18 + 4) * 7.2),
        ];

        for (let i = 0; i < shallowCount; i++) {
          const b = shallowBoids[i];
          const center = clusterCenters[b.schoolId];

          const toCenter = center.clone().sub(b.position);
          if (toCenter.length() > 3.6) {
            toCenter.normalize().multiplyScalar(0.75);
            b.velocity.add(toCenter.multiplyScalar(dt * 1.6));
          }

          b.velocity.clampLength(0.5, b.maxSpeed);
          b.position.addScaledVector(b.velocity, dt);

          dummy.position.copy(b.position);
          dummy.lookAt(b.position.clone().add(b.velocity));

          // Natural tail oscillation propagating along the spine
          const tailWag = 1 + Math.sin(t * 11 * b.speed + b.phase) * 0.07;
          const currentScale = b.scale * shallowVisibility;
          dummy.scale.set(currentScale, currentScale * tailWag, currentScale);

          dummy.updateMatrix();
          shallowMeshRef.current.setMatrixAt(i, dummy.matrix);
        }
        shallowMeshRef.current.instanceMatrix.needsUpdate = true;
      }
    }

    // 2. Update 50m Mid-Water School
    if (midMeshRef.current) {
      const midVisibility = Math.max(0, Math.min(1, 1 - Math.abs(camY - (-5.5)) / 9));
      midMeshRef.current.visible = midVisibility > 0.01;

      if (midMeshRef.current.visible) {
        const midCenters = [
          new THREE.Vector3(Math.cos(t * 0.16) * 11, -5.2 + Math.sin(t * 0.25) * 0.6, Math.sin(t * 0.16) * 9.0),
          new THREE.Vector3(Math.cos(t * 0.20 + 3) * 13, -6.8 + Math.sin(t * 0.30) * 0.8, Math.sin(t * 0.20 + 3) * 11),
        ];

        for (let i = 0; i < midCount; i++) {
          const b = midBoids[i];
          const center = midCenters[b.schoolId];

          const toCenter = center.clone().sub(b.position);
          if (toCenter.length() > 5.5) {
            toCenter.normalize().multiplyScalar(1.0);
            b.velocity.add(toCenter.multiplyScalar(dt * 1.5));
          }

          b.velocity.clampLength(0.8, b.maxSpeed);
          b.position.addScaledVector(b.velocity, dt);

          dummy.position.copy(b.position);
          dummy.lookAt(b.position.clone().add(b.velocity));

          const tailWag = 1 + Math.sin(t * 8.5 * b.speed + b.phase) * 0.05;
          const currentScale = b.scale * midVisibility;
          dummy.scale.set(currentScale, currentScale * tailWag, currentScale);

          dummy.updateMatrix();
          midMeshRef.current.setMatrixAt(i, dummy.matrix);
        }
        midMeshRef.current.instanceMatrix.needsUpdate = true;
      }
    }
  });

  return (
    <group name="FishSchoolSystem">
      {/* 10m Shallow High-Fidelity Reef Fish */}
      <instancedMesh
        ref={shallowMeshRef}
        args={[reefFishGeometry, undefined, shallowCount]}
      >
        <meshStandardMaterial
          roughness={0.22}
          metalness={0.75}
          envMapIntensity={1.0}
        />
      </instancedMesh>

      {/* 50m Pelagic Tuna Pod */}
      <instancedMesh
        ref={midMeshRef}
        args={[tunaGeometry, undefined, midCount]}
      >
        <meshStandardMaterial
          roughness={0.28}
          metalness={0.85}
          envMapIntensity={0.8}
        />
      </instancedMesh>
    </group>
  );
}
