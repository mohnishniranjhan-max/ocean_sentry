import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Station, OceanLayer, OceanParameter, DepthLevel } from '../../types/ocean';
import { latLonToXYZ, statusColor, getComparisons } from '../../utils/oceanCalc';

interface GliderMarkersProps {
  stations: Station[];
  layer: OceanLayer;
  parameter: OceanParameter;
  depth: DepthLevel;
  selectedStation: Station | null;
  visible?: boolean;
  onSelect: (station: Station) => void;
  onHover: (station: Station | null, x: number, y: number) => void;
}

export function GliderMarkers({
  stations, layer, parameter, depth, selectedStation, visible = true, onSelect, onHover
}: GliderMarkersProps) {
  const gliders = useMemo(() => stations.filter((s) => s.type === 'glider'), [stations]);

  if (!visible || gliders.length === 0) return null;

  return (
    <group>
      {gliders.map((glider) => (
        <GliderMarker
          key={glider.id}
          station={glider}
          layer={layer}
          parameter={parameter}
          depth={depth}
          isSelected={selectedStation?.id === glider.id}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}
    </group>
  );
}

interface GliderMarkerProps {
  station: Station;
  layer: OceanLayer;
  parameter: OceanParameter;
  depth: DepthLevel;
  isSelected: boolean;
  onSelect: (s: Station) => void;
  onHover: (s: Station | null, x: number, y: number) => void;
}

function GliderMarker({ station, layer, parameter, depth, isSelected, onSelect, onHover }: GliderMarkerProps) {
  const { gl } = useThree();
  const meshRef = useRef<THREE.Mesh>(null!);
  
  // Base color
  const color = useMemo(() => {
    if (layer === 'anomaly') return statusColor(station.status);
    if (layer === 'difference') {
      const comp = getComparisons(station).find(c => c.parameter === parameter);
      if (!comp) return '#22d3ee';
      const abs = Math.abs(comp.percentageDifference);
      if (abs > 40) return '#ef4444';
      if (abs > 18) return '#f59e0b';
      return '#22d3ee';
    }
    if (!station.isOnline) return '#6b7280';
    return statusColor(station.status);
  }, [layer, parameter, station]);

  const isDepthMatched = depth === 0 ? true : Math.abs(station.depth - depth) <= 100;
  
  // Calculate glider position based on its depth
  const getRadius = (d: number) => 2.032 - (d / 1000) * 0.04;
  const position = useMemo(() => {
    const [x, y, z] = latLonToXYZ(station.latitude, station.longitude, getRadius(station.depth));
    return new THREE.Vector3(x, y, z);
  }, [station.latitude, station.longitude, station.depth]);

  // Construct Trajectory points
  const trajectoryLine = useMemo(() => {
    if (!station.trajectory || station.trajectory.length === 0) return null;
    
    const points = station.trajectory.map(pt => {
      const [x, y, z] = latLonToXYZ(pt.latitude, pt.longitude, getRadius(pt.depth));
      return new THREE.Vector3(x, y, z);
    });

    const curve = new THREE.CatmullRomCurve3(points);
    return { points, curve };
  }, [station.trajectory]);

  // Make glider face its heading if available
  const rotation = useMemo(() => {
    if (station.heading !== undefined) {
      // rough approximation to orient it based on heading
      // In a spherical coordinate, heading means rotation around the local normal
      // This is simplified.
      return new THREE.Euler(0, 0, THREE.MathUtils.degToRad(-station.heading));
    }
    return new THREE.Euler();
  }, [station.heading]);

  useFrame((state) => {
    if (meshRef.current && meshRef.current.material) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      if (isSelected) {
        mat.emissiveIntensity = 0.8 + Math.sin(state.clock.elapsedTime * 6) * 0.2;
      } else {
        mat.emissiveIntensity = 0.4;
      }
    }
  });

  return (
    <group>
      {/* Glider Mesh - capsule shape to distinguish from sphere/Argo */}
      <group position={position} rotation={rotation}>
        <mesh
          ref={meshRef}
          userData={{ station, isObservationMarker: true }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(station);
          }}
          onPointerEnter={(e) => {
            e.stopPropagation();
            gl.domElement.style.cursor = 'pointer';
            const rect = gl.domElement.getBoundingClientRect();
            onHover(station, e.clientX - rect.left, e.clientY - rect.top);
          }}
          onPointerLeave={(e) => {
            e.stopPropagation();
            gl.domElement.style.cursor = 'default';
            onHover(null, 0, 0);
          }}
        >
          {/* A capsule to look like a glider */}
          <capsuleGeometry args={[0.015, 0.04, 4, 8]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={isSelected ? 1.0 : 0.4}
            roughness={0.2}
            metalness={0.8}
            transparent={!isDepthMatched}
            opacity={isDepthMatched ? 1.0 : 0.35}
          />
        </mesh>
        
        {/* Selection ring */}
        {isSelected && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.04, 0.045, 32]} />
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.8} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        )}
      </group>

      {/* Trajectory Sawtooth Path */}
      {trajectoryLine && (
        <mesh>
          <tubeGeometry args={[trajectoryLine.curve, 64, 0.002, 8, false]} />
          <meshBasicMaterial 
            color={color} 
            transparent 
            opacity={isSelected ? 0.6 : 0.2} 
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
