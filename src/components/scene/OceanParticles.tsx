import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLonToXYZ } from '../../utils/oceanCalc';

interface OceanParticlesProps {
  visible: boolean;
  parameter?: string;
}

const COUNT = 600;
const RADIUS = 2.028;

// Predefined flow paths inspired by Indian Ocean gyre circulation
const FLOW_SEED = (i: number) => {
  // Concentrate in Indian Ocean / Bay of Bengal / Arabian Sea
  const regionSeed = (i * 31 % 100) / 100;
  let lat: number, lon: number;
  if (regionSeed < 0.45) {
    lat = 5 + ((i * 17) % 17);
    lon = 75 + ((i * 13) % 20);
  } else if (regionSeed < 0.75) {
    lat = 5 + ((i * 11) % 17);
    lon = 58 + ((i * 7) % 18);
  } else {
    lat = -5 + ((i * 3) % 10);
    lon = 60 + ((i * 19) % 30);
  }
  return { lat, lon };
};

export function OceanParticles({ visible }: OceanParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null!);

  // Build geometry once
  const { geometry, velocities, phases } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const velocities: { lat: number; lon: number; speed: number; dir: number }[] = [];
    const phases = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      const { lat, lon } = FLOW_SEED(i);
      const [x, y, z] = latLonToXYZ(lat, lon, RADIUS);
      positions[i * 3]     = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      velocities.push({
        lat,
        lon,
        speed: 0.04 + (i % 7) * 0.01,
        dir: (i % 2 === 0) ? 1 : -1,
      });
      phases[i] = (i * 0.37) % (Math.PI * 2);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { geometry: geo, velocities, phases };
  }, []);

  useFrame((state) => {
    if (!pointsRef.current || !visible) return;
    const t = state.clock.elapsedTime;
    const pos = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;

    for (let i = 0; i < COUNT; i++) {
      const v = velocities[i];
      const wave = Math.sin(t * v.speed * 2 + phases[i]) * 0.4;
      const newLon = v.lon + t * v.speed * v.dir * 0.12 + wave * 0.05;
      const newLat = v.lat + Math.sin(t * v.speed + phases[i]) * 0.8;
      const [x, y, z] = latLonToXYZ(newLat, newLon, RADIUS);
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;

    // Fade particles in/out
    if (pointsRef.current.material) {
      const mat = pointsRef.current.material as THREE.PointsMaterial;
      mat.opacity = visible ? Math.min(mat.opacity + 0.02, 0.65) : Math.max(mat.opacity - 0.02, 0);
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color="#22d3ee"
        size={0.012}
        transparent
        opacity={0}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
