import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { getWaveDisplacement, getWaveNormal, computeWaveParams } from '../../utils/waveMath';
import type { Station } from '../../types/ocean';

interface ArgoBuoyMarkerProps {
  station: Station;
  isDifference?: boolean;
}

function DepthMarker({ depth, yPos }: { depth: number; yPos: number }) {
  const htmlRef = useRef<HTMLDivElement>(null!);
  
  useFrame(({ camera }) => {
    if (htmlRef.current) {
      const distY = Math.abs(camera.position.y - yPos);
      if (distY > 15) {
        htmlRef.current.style.opacity = '0';
        htmlRef.current.style.display = 'none';
      } else {
        htmlRef.current.style.opacity = '1';
        htmlRef.current.style.display = 'block';
      }
    }
  });

  return (
    <group position={[0, yPos, 0]}>
      <mesh>
        <ringGeometry args={[0.03, 0.06, 12]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      <Html position={[0.1, 0, 0]} center={false}>
        <div
          ref={htmlRef}
          style={{
            pointerEvents: 'none',
            color: 'rgba(34,211,238,0.6)',
            fontSize: '8px',
            fontFamily: 'monospace',
            letterSpacing: '0.1em',
            transition: 'opacity 0.3s',
          }}
        >
          {depth}m
        </div>
      </Html>
    </group>
  );
}

function StationLabel({ station }: { station: Station }) {
  const htmlRef = useRef<HTMLDivElement>(null!);
  
  useFrame(({ camera }) => {
    if (htmlRef.current) {
      const distY = Math.abs(camera.position.y - 0.7);
      if (distY > 15) {
        htmlRef.current.style.opacity = '0';
        htmlRef.current.style.display = 'none';
      } else {
        htmlRef.current.style.opacity = '1';
        htmlRef.current.style.display = 'flex';
      }
    }
  });

  return (
    <Html
      position={[0.3, 0.7, 0]}
      center={false}
      style={{
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <div
        ref={htmlRef}
        style={{
          background: 'rgba(2, 8, 18, 0.85)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '4px',
          padding: '6px 10px',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          transition: 'opacity 0.3s',
        }}
      >
        <div style={{
          fontSize: '11px',
          fontFamily: 'monospace',
          fontWeight: 600,
          color: '#f8fafc',
          letterSpacing: '0.05em',
        }}>
          {station.id}
        </div>
        <div style={{
          fontSize: '8px',
          color: '#64748b',
          letterSpacing: '0.12em',
        }}>
          {(station.region || 'Unknown Region').toUpperCase()}
        </div>
        <div style={{
          fontSize: '8px',
          color: '#94a3b8',
          fontFamily: 'monospace',
        }}>
          {(station.latitude || 0).toFixed(2)}°N, {(station.longitude || 0).toFixed(2)}°E
        </div>
      </div>
    </Html>
  );
}

export function ArgoBuoyMarker({ station, isDifference }: ArgoBuoyMarkerProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const ghostGroupRef = useRef<THREE.Group>(null!);
  const beaconRef = useRef<THREE.Mesh>(null!);
  const measureLineRef = useRef<THREE.Line>(null!);

  // Status-driven beacon color
  const beaconColor = useMemo(() => {
    switch (station.status) {
      case 'critical': return '#ef4444';
      case 'warning': return '#f59e0b';
      default: return '#22c55e';
    }
  }, [station.status]);

  // Measurement line extending downward 1000m (100 units)
  const lineGeometry = useMemo(() => {
    const points = [];
    for (let i = 0; i <= 200; i++) { // down to -100 with 0.5 spacing
      points.push(new THREE.Vector3(0, -i * 0.5, 0));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    return geo;
  }, []);

  // Animate buoy bob and beacon pulse
  // Create deterministic wave params based on the station data
  const waveParams = useMemo(() => {
    return computeWaveParams(
      station.waveHeight || 0,
      station.modelWaveHeight || 0,
      station.currentSpeed || 0,
      station.temperature || 0
    );
  }, [station.waveHeight, station.modelWaveHeight, station.currentSpeed, station.temperature]);

  const modelWaveParams = useMemo(() => {
    return computeWaveParams(
      station.modelWaveHeight || 0,
      station.waveHeight || 0,
      station.currentSpeed || 0,
      station.temperature || 0
    );
  }, [station.waveHeight, station.modelWaveHeight, station.currentSpeed, station.temperature]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const up = new THREE.Vector3(0, 1, 0);
    
    if (groupRef.current) {
      // Get the exact wave height and normal at X=0, Z=0 for actual observed wave
      const displacement = getWaveDisplacement(0, 0, t, waveParams);
      const normal = getWaveNormal(0, 0, t, waveParams);
      
      // Update Y position to float perfectly on the wave
      groupRef.current.position.y = displacement.y;
      
      // Update rotation to pitch/roll with the wave normal
      groupRef.current.quaternion.setFromUnitVectors(up, normal);
    }

    if (isDifference && ghostGroupRef.current) {
      // Get the wave height and normal for the model's predicted wave
      const modelDisplacement = getWaveDisplacement(0, 0, t, modelWaveParams);
      const modelNormal = getWaveNormal(0, 0, t, modelWaveParams);
      
      ghostGroupRef.current.position.y = modelDisplacement.y;
      ghostGroupRef.current.quaternion.setFromUnitVectors(up, modelNormal);
    }

    if (beaconRef.current) {
      const mat = beaconRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.6 + Math.sin(t * 3) * 0.4;
    }
  });

  return (
    <>
      <group ref={groupRef} position={[0, 0, 0]}>
        {/* Lower Submerged Hull (Dark pressure-tolerant casing) */}
        <mesh position={[0, -0.08, 0]} castShadow>
          <cylinderGeometry args={[0.11, 0.08, 0.22, 24]} />
          <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.6} />
        </mesh>

        {/* Main Flotation Collar (Marine International Orange) */}
        <mesh position={[0, 0.12, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.13, 0.22, 24]} />
          <meshStandardMaterial
            color="#f95700"
            roughness={0.35}
            metalness={0.15}
          />
        </mesh>

        {/* Solar/Reflective High-Vis Band */}
        <mesh position={[0, 0.21, 0]}>
          <cylinderGeometry args={[0.152, 0.152, 0.05, 24]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.5} metalness={0.2} />
        </mesh>

        {/* Upper Electronics & Sensor Deck (Metallic Aluminum/Titanium) */}
        <mesh position={[0, 0.26, 0]}>
          <cylinderGeometry args={[0.11, 0.14, 0.08, 24]} />
          <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.8} />
        </mesh>

        {/* Sensor Guard Cage / Protective Bars */}
        <mesh position={[0, 0.36, 0]}>
          <cylinderGeometry args={[0.07, 0.09, 0.14, 8, 1, true]} />
          <meshStandardMaterial color="#64748b" roughness={0.2} metalness={0.9} wireframe />
        </mesh>

        {/* Primary Telemetry & Antenna Mast */}
        <mesh position={[0, 0.52, 0]}>
          <cylinderGeometry args={[0.007, 0.01, 0.32, 12]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
        </mesh>

        {/* GPS Receiver Dome */}
        <mesh position={[0, 0.42, 0.05]}>
          <sphereGeometry args={[0.022, 16, 12]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.4} metalness={0.1} />
        </mesh>

        {/* Oceanographic Strobe Beacon */}
        <mesh ref={beaconRef} position={[0, 0.69, 0]}>
          <sphereGeometry args={[0.024, 16, 12]} />
          <meshStandardMaterial
            color={beaconColor}
            emissive={beaconColor}
            emissiveIntensity={1.2}
            roughness={0.1}
          />
        </mesh>

        {/* Beacon Light Flash */}
        <pointLight
          position={[0, 0.69, 0]}
          color={beaconColor}
          intensity={0.45}
          distance={3.5}
          decay={2}
        />

        {/* Water Contact / Surface Wake Ring */}
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.14, 0.24, 32]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* Underwater measurement line (dashed) */}
        <line ref={measureLineRef as any} {...({ geometry: lineGeometry } as any)}>
          <lineDashedMaterial
            color="#22d3ee"
            dashSize={0.1}
            gapSize={0.08}
            opacity={0.35}
            transparent
          />
        </line>

        {/* Depth markers along measurement line */}
        {[10, 50, 100, 500, 1000].map((depth) => (
          <DepthMarker key={depth} depth={depth} yPos={-(depth / 10)} />
        ))}

        <StationLabel station={station} />
      </group>

      {/* Ghost Holographic Model Buoy */}
      {isDifference && (
        <group ref={ghostGroupRef} position={[0, 0, 0]}>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.6, 16, 1, true]} />
            <meshBasicMaterial 
              color="#f59e0b" 
              wireframe 
              transparent 
              opacity={0.7} 
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <Html position={[0.22, 0.4, 0]} center={false} zIndexRange={[100, 0]}>
            <div style={{ 
              color: '#f59e0b', 
              fontSize: '9px', 
              fontFamily: 'monospace', 
              letterSpacing: '0.1em',
              background: 'rgba(245, 158, 11, 0.1)',
              padding: '2px 6px',
              borderRadius: '2px',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              textShadow: '0 0 4px #f59e0b'
            }}>
              MODEL PRED
            </div>
          </Html>
        </group>
      )}
    </>
  );
}
