import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLonToXYZ, getComparisons } from '../../utils/oceanCalc';
import type { Station, OceanLayer, OceanParameter } from '../../types/ocean';

interface DifferenceLayerProps {
  stations: Station[];
  layer: OceanLayer;
  parameter: OceanParameter;
  visible: boolean;
}

export function DifferenceLayer({ stations, layer, parameter, visible }: DifferenceLayerProps) {
  const groupRef = useRef<THREE.Group>(null!);

  // Filter stations based on layer
  const activeStations = useMemo(() => {
    if (layer === 'model' || layer === 'observation') return [];
    return stations;
  }, [stations, layer]);

  // Compute deviation fields around each station
  const stationFields = useMemo(() => {
    return activeStations.map((station) => {
      const comp = getComparisons(station).find((c) => c.parameter === parameter);
      const pct = comp ? Math.abs(comp.percentageDifference) : 0;
      const isCritical = pct > 40 || station.status === 'critical';
      const isWarning = pct > 18 || station.status === 'warning';

      const colorHex = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#38bdf8';
      const radiusSize = isCritical ? 0.22 : isWarning ? 0.16 : 0.11;
      const [x, y, z] = latLonToXYZ(station.latitude, station.longitude, 2.022);

      // Construct normal at position
      const normal = new THREE.Vector3(x, y, z).normalize();
      const quaternion = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        normal
      );

      return {
        id: station.id,
        pos: [x, y, z] as [number, number, number],
        quaternion,
        colorHex,
        pct,
        radiusSize,
        isCritical,
      };
    });
  }, [activeStations, parameter]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    groupRef.current.children.forEach((child, i) => {
      const f = stationFields[i];
      if (!f) return;
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as THREE.MeshBasicMaterial;
        if (f.isCritical) {
          // Dynamic pulsing for critical anomalies
          const pulse = (Math.sin(t * 3.5 + i) * 0.5 + 0.5);
          child.scale.setScalar(1.0 + pulse * 0.28);
          mat.opacity = (0.35 + pulse * 0.35) * (visible ? 1 : 0);
        } else {
          mat.opacity = (visible ? 0.4 : 0);
        }
      }
    });
  });

  if (layer !== 'difference' && layer !== 'anomaly') return null;

  return (
    <group ref={groupRef}>
      {stationFields.map((field) => (
        <mesh
          key={field.id}
          position={field.pos}
          quaternion={field.quaternion}
        >
          <ringGeometry args={[field.radiusSize * 0.4, field.radiusSize, 32]} />
          <meshBasicMaterial
            color={field.colorHex}
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}
