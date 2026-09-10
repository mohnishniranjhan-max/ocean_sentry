import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { DepthLevel } from '../../../../types/ocean';
import { MARINE_SPECIES_REGISTRY } from './MarineModelRegistry';

// ── Volumetric 3D Anatomical Manta Ray Geometry ──────────────────────────────
// Generates a true 3D volumetric organism with realistic body thickness,
// rounded leading edge, cephalic lobes (horns), counter-shaded ventral/dorsal
// surfaces, and a slender whip tail.

export function createVolumetricMantaRayGeometry(): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();

  const resX = 32; // Spanwise segments across wings
  const resZ = 24; // Chordwise segments from head to tail

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // 1. Upper Dorsal Surface (Dark Navy Slate)
  for (let iz = 0; iz <= resZ; iz++) {
    const tz = iz / resZ; // 0 = head leading edge, 1 = tail root
    const z = 0.9 - tz * 2.2; // Length ~2.2m

    // Leading edge curvature and trailing edge sweep
    const chordWidth = tz < 0.28
      ? Math.sin((tz / 0.28) * Math.PI * 0.5) * 3.8
      : (1 - (tz - 0.28) / 0.72) * 3.8;

    for (let ix = 0; ix <= resX; ix++) {
      const tx = ix / resX; // 0 = left wingtip, 1 = right wingtip
      const normX = (tx - 0.5) * 2.0; // -1 to +1
      const x = (normX * chordWidth) * 0.5;

      const distFromCenter = Math.abs(normX);
      const spineProfile = Math.sin((1 - tz) * Math.PI * 0.85);

      // Hydrodynamic camber: thick central spine (0.28m) tapering out to wingtips (0.015m)
      const thickness = Math.max(0.012, (1 - Math.pow(distFromCenter, 1.4)) * 0.26 * spineProfile);
      const y = thickness * 0.65;

      positions.push(x, y, z);
      normals.push(0, 1, 0);
      uvs.push(tx, tz);
    }
  }

  const stride = resX + 1;
  for (let iz = 0; iz < resZ; iz++) {
    for (let ix = 0; ix < resX; ix++) {
      const a = iz * stride + ix;
      const b = (iz + 1) * stride + ix;
      const c = (iz + 1) * stride + (ix + 1);
      const d = iz * stride + (ix + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  // 2. Lower Ventral Surface (Pale Silver / White Belly)
  const ventralOffset = positions.length / 3;
  for (let iz = 0; iz <= resZ; iz++) {
    const tz = iz / resZ;
    const z = 0.9 - tz * 2.2;

    const chordWidth = tz < 0.28
      ? Math.sin((tz / 0.28) * Math.PI * 0.5) * 3.8
      : (1 - (tz - 0.28) / 0.72) * 3.8;

    for (let ix = 0; ix <= resX; ix++) {
      const tx = ix / resX;
      const normX = (tx - 0.5) * 2.0;
      const x = (normX * chordWidth) * 0.5;

      const distFromCenter = Math.abs(normX);
      const spineProfile = Math.sin((1 - tz) * Math.PI * 0.85);

      const thickness = Math.max(0.012, (1 - Math.pow(distFromCenter, 1.4)) * 0.26 * spineProfile);
      const y = -thickness * 0.45; // Ventral belly profile

      positions.push(x, y, z);
      normals.push(0, -1, 0);
      uvs.push(tx, tz);
    }
  }

  for (let iz = 0; iz < resZ; iz++) {
    for (let ix = 0; ix < resX; ix++) {
      const a = ventralOffset + iz * stride + ix;
      const b = ventralOffset + (iz + 1) * stride + ix;
      const c = ventralOffset + (iz + 1) * stride + (ix + 1);
      const d = ventralOffset + iz * stride + (ix + 1);

      // Reverse winding for downward-facing normals
      indices.push(a, d, b);
      indices.push(b, d, c);
    }
  }

  // 3. Forward Cephalic Lobes (Curled Feeding Horns at Head)
  const lobeBaseIdx = positions.length / 3;
  const lobeVerts = [
    // Left Cephalic Horn
    0.32, 0.04, 0.88,
    0.42, -0.06, 1.35,
    0.20, 0.02, 1.18,
    // Right Cephalic Horn
    -0.32, 0.04, 0.88,
    -0.42, -0.06, 1.35,
    -0.20, 0.02, 1.18,
  ];

  for (let i = 0; i < lobeVerts.length; i += 3) {
    positions.push(lobeVerts[i], lobeVerts[i + 1], lobeVerts[i + 2]);
    normals.push(0, 1, 0);
    uvs.push(0.5, 0.5);
  }

  const lb = lobeBaseIdx;
  indices.push(
    lb, lb + 1, lb + 2,
    lb, lb + 2, lb + 1,
    lb + 3, lb + 4, lb + 5,
    lb + 3, lb + 5, lb + 4
  );

  // 4. Slender Whip Tail (Extending 2.5m behind body)
  const tailBaseIdx = positions.length / 3;
  const tailSegments = 12;
  for (let i = 0; i <= tailSegments; i++) {
    const t = i / tailSegments;
    const z = -1.3 - t * 2.5;
    const radius = (1 - t) * 0.035 + 0.006;

    positions.push(0, radius, z);
    positions.push(radius, 0, z);
    positions.push(0, -radius, z);
    positions.push(-radius, 0, z);

    normals.push(0, 1, 0, 1, 0, 0, 0, -1, 0, -1, 0, 0);
    uvs.push(0, t, 0.33, t, 0.66, t, 1, t);
  }

  for (let i = 0; i < tailSegments; i++) {
    const b = tailBaseIdx + i * 4;
    const n = tailBaseIdx + (i + 1) * 4;
    for (let j = 0; j < 4; j++) {
      const jNext = (j + 1) % 4;
      indices.push(b + j, n + j, b + jNext);
      indices.push(n + j, n + jNext, b + jNext);
    }
  }

  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  return geom;
}

// ── Component Implementation ────────────────────────────────────────────────

interface MantaRayInstanceConfig {
  id: number;
  center: THREE.Vector3;
  orbitRadiusX: number;
  orbitRadiusZ: number;
  speed: number;
  phase: number;
  scale: number;
}

function SingleMantaRay({ config }: { config: MantaRayInstanceConfig }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const { camera } = useThree();

  const originalGeo = useMemo(() => createVolumetricMantaRayGeometry(), []);
  const workingGeo = useMemo(() => originalGeo.clone(), [originalGeo]);

  const meta = MARINE_SPECIES_REGISTRY.manta_ray;

  // Realistic PBR Manta Ray Material
  const rayMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: meta.colorPalette.dorsal,
    roughness: 0.32,
    metalness: 0.28,
    envMapIntensity: 0.9,
    side: THREE.DoubleSide,
  }), [meta]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    const angle = t * config.speed + config.phase;

    // 1. Cruise in smooth wide elliptical glide path
    const x = config.center.x + Math.cos(angle) * config.orbitRadiusX;
    const z = config.center.z + Math.sin(angle) * config.orbitRadiusZ;
    const y = config.center.y + Math.sin(t * 0.7 + config.phase) * 0.45;

    meshRef.current.position.set(x, y, z);

    // 2. Heading alignment & graceful banking into turns
    const nextAngle = angle + 0.03;
    const nextX = config.center.x + Math.cos(nextAngle) * config.orbitRadiusX;
    const nextZ = config.center.z + Math.sin(nextAngle) * config.orbitRadiusZ;
    meshRef.current.lookAt(nextX, y, nextZ);

    const bankAngle = Math.sin(angle) * 0.28;
    meshRef.current.rotateZ(bankAngle);

    // 3. Dynamic Organic Wing Flapping (Sinusoidal Traveling Wave across Wingtips)
    const basePos = originalGeo.attributes.position as THREE.BufferAttribute;
    const workPos = workingGeo.attributes.position as THREE.BufferAttribute;
    const flapFreq = t * 2.4 + config.phase;

    for (let i = 0; i < basePos.count; i++) {
      const origX = basePos.getX(i);
      const origY = basePos.getY(i);
      const origZ = basePos.getZ(i);

      const spanDist = Math.abs(origX);
      if (spanDist > 0.25) {
        // Wing undulation amplitude grows quadratically toward the wingtips
        const flapAmp = Math.pow((spanDist - 0.25) / 1.6, 1.8) * 0.38;
        const wave = Math.sin(flapFreq - spanDist * 1.2 + origZ * 0.5);
        workPos.setY(i, origY + wave * flapAmp);
      } else {
        workPos.setY(i, origY);
      }
    }
    workPos.needsUpdate = true;
    workingGeo.computeVertexNormals();

    // 4. Depth visibility (active between Y: 0 and -14: 10m & 50m zones)
    const camY = camera.position.y;
    const visibility = Math.max(0, Math.min(1, 1 - Math.abs(camY - (-4.0)) / 9));
    meshRef.current.visible = visibility > 0.02;
    meshRef.current.scale.setScalar(config.scale * visibility);
  });

  return (
    <mesh
      ref={meshRef}
      geometry={workingGeo}
      material={rayMaterial}
    />
  );
}

export function MantaRayModel({ depth }: { depth: DepthLevel }) {
  // 2 majestic cruising rays with plenty of negative space
  const rays: MantaRayInstanceConfig[] = useMemo(() => [
    {
      id: 1,
      center: new THREE.Vector3(4.5, -2.8, -3.5),
      orbitRadiusX: 13.0,
      orbitRadiusZ: 10.5,
      speed: 0.24,
      phase: 0.0,
      scale: 4.8, // 4.8m Giant Oceanic Manta
    },
    {
      id: 2,
      center: new THREE.Vector3(-5.0, -5.5, 4.0),
      orbitRadiusX: 15.5,
      orbitRadiusZ: 12.0,
      speed: 0.20,
      phase: Math.PI * 0.85,
      scale: 5.4, // 5.4m Hero Manta Ray
    },
  ], []);

  return (
    <group name="MantaRaySystem">
      {rays.map((r) => (
        <SingleMantaRay key={r.id} config={r} />
      ))}
    </group>
  );
}
