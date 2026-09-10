import { useRef, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { latLonToXYZ } from '../../utils/oceanCalc';
import type { DepthLevel } from '../../types/ocean';
import type { ObservationRecord, AnomalyRecord } from '../../services/oceanApi';

interface SubsurfaceMarkersProps {
  observations: ObservationRecord[];
  anomalies: AnomalyRecord[];
  depth: DepthLevel;
  visible: boolean;
  onAnomalySelect: (anomaly: AnomalyRecord) => void;
  selectedAnomalyId?: string | null;
}

function statusColor(status: string): string {
  const s = status.toUpperCase();
  if (s === 'HIGH') return '#ef4444';
  if (s === 'WARNING') return '#f59e0b';
  return '#22d3ee';
}

function ObsMarker({ obs, depth }: { obs: ObservationRecord; depth: DepthLevel }) {
  const meshRef = useRef<THREE.Mesh>(null!);

  const depthOffset = (obs.depth / 1000) * 0.04;
  const radius = 2.032 - depthOffset;
  const position = useMemo(
    () => new THREE.Vector3(...latLonToXYZ(obs.latitude, obs.longitude, radius) as [number, number, number]),
    [obs.latitude, obs.longitude, radius]
  );

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.014, 12, 12]} />
      <meshStandardMaterial
        color="#22d3ee"
        emissive="#22d3ee"
        emissiveIntensity={0.3}
        roughness={0.2}
        metalness={0.1}
        transparent
        opacity={0.7}
      />
    </mesh>
  );
}

function AnomalyMarker({
  anomaly,
  isSelected,
  onSelect,
}: {
  anomaly: AnomalyRecord;
  isSelected: boolean;
  onSelect: (a: AnomalyRecord) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const { gl } = useThree();

  const depthOffset = (anomaly.depth / 1000) * 0.04;
  const radius = 2.032 - depthOffset;
  const position = useMemo(
    () => new THREE.Vector3(...latLonToXYZ(anomaly.latitude, anomaly.longitude, radius) as [number, number, number]),
    [anomaly.latitude, anomaly.longitude, radius]
  );

  const color = statusColor(anomaly.status);
  const size = isSelected ? 0.032 : 0.024;

  useFrame((state) => {
    if (ringRef.current) {
      const scale = 1 + Math.abs(Math.sin(state.clock.elapsedTime * 0.9)) * 1.5;
      ringRef.current.scale.setScalar(scale);
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.75 - (scale - 1) * 0.5);
    }
    if (meshRef.current && isSelected) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.0 + Math.sin(state.clock.elapsedTime * 4) * 0.3;
    }
  });

  return (
    <group position={position}>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[size * 1.6, size * 2.2, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(anomaly);
        }}
        onPointerEnter={(e) => {
          e.stopPropagation();
          gl.domElement.style.cursor = 'pointer';
        }}
        onPointerLeave={(e) => {
          e.stopPropagation();
          gl.domElement.style.cursor = 'default';
        }}
      >
        <sphereGeometry args={[size, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 1.0 : 0.7}
          roughness={0.1}
          metalness={0.2}
        />
      </mesh>

      {isSelected && (
        <>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[size * 1.8, size * 2.3, 32]} />
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.9} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <Html style={{ pointerEvents: 'none' }} occlude={false}>
            <div style={{
              background: 'rgba(2,10,26,0.94)',
              border: `1px solid ${color}50`,
              borderRadius: '4px',
              padding: '6px 10px',
              color: '#e2e8f0',
              fontSize: '10px',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              transform: 'translate(12px, -50%)',
              backdropFilter: 'blur(8px)',
            }}>
              <div style={{ color, fontWeight: 600, marginBottom: 2 }}>{anomaly.status.toUpperCase()}</div>
              <div>Score: {anomaly.anomaly_score.toFixed(3)}</div>
              <div>{anomaly.depth.toFixed(1)}m · {anomaly.station_id}</div>
            </div>
          </Html>
        </>
      )}
    </group>
  );
}

export function SubsurfaceMarkers({
  observations,
  anomalies,
  depth,
  visible,
  onAnomalySelect,
  selectedAnomalyId,
}: SubsurfaceMarkersProps) {
  if (!visible) return null;

  // Deduplicate observations by rounding to 0.01 degree grid to avoid marker clutter
  const dedupedObs = useMemo(() => {
    const seen = new Set<string>();
    return observations.filter((obs) => {
      const key = `${obs.latitude.toFixed(2)}_${obs.longitude.toFixed(2)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [observations]);

  return (
    <group>
      {dedupedObs.map((obs, i) => (
        <ObsMarker key={`obs-${i}-${obs.latitude}-${obs.longitude}`} obs={obs} depth={depth} />
      ))}
      {anomalies.map((a, i) => (
        <AnomalyMarker
          key={`anom-${a.station_id}-${a.depth}-${i}`}
          anomaly={a}
          isSelected={selectedAnomalyId === `${a.station_id}-${a.depth}-${a.timestamp}`}
          onSelect={onAnomalySelect}
        />
      ))}
    </group>
  );
}
