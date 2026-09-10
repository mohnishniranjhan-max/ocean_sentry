import { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { Station, OceanLayer, OceanParameter, DepthLevel } from '../../types/ocean';
import { latLonToXYZ, statusColor, getComparisons } from '../../utils/oceanCalc';
import { HAND_SELECTION_CONFIG } from '../../hooks/useHandGesture';

// ── Single marker ─────────────────────────────────────────────────────────────
interface MarkerProps {
  station: Station;
  layer: OceanLayer;
  parameter: OceanParameter;
  depth: DepthLevel;
  isSelected: boolean;
  isHandHovered?: boolean;
  onSelect: (s: Station) => void;
  onHover: (s: Station | null, x: number, y: number) => void;
}

function Marker({ station, layer, parameter, depth, isSelected, isHandHovered, onSelect, onHover }: MarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const pulseRef = useRef<number>(0);
  const { gl } = useThree();

  // Compute marker radius based on depth
  const markerRadius = useMemo(() => {
    const stationDepthOffset = (station.depth / 1000) * 0.04;
    return 2.032 - stationDepthOffset;
  }, [station.depth]);

  const position = useMemo(
    () => {
      const [x, y, z] = latLonToXYZ(station.latitude, station.longitude, markerRadius);
      return new THREE.Vector3(x, y, z);
    },
    [station.latitude, station.longitude, markerRadius]
  );

  // Determine color from layer/parameter
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
  const isLiveStream = station.id.startsWith('ARGO-590623');
  const size = isSelected ? 0.034 : isLiveStream ? 0.027 : 0.022;

  useFrame((state) => {
    if (!meshRef.current) return;
    pulseRef.current += 0.05;

    // Pulse ring for anomalies and live stream
    if (ringRef.current && (station.status !== 'normal' || isLiveStream)) {
      const scale = 1 + Math.abs(Math.sin(pulseRef.current * 0.9)) * 1.5;
      ringRef.current.scale.setScalar(scale);
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.75 - (scale - 1) * 0.5);
    }

    // Glowing pulsation on selection / anomaly
    if (meshRef.current.material) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      if (isSelected) {
        mat.emissiveIntensity = 0.8 + Math.sin(state.clock.elapsedTime * 6) * 0.2; // Faster, tighter pulse
      } else if (isHandHovered) {
        mat.emissiveIntensity = 0.7 + Math.sin(state.clock.elapsedTime * 5) * 0.2;
      } else if (station.status === 'critical') {
        mat.emissiveIntensity = 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.2; // Subdued idle glow
      }
    }
  });

  return (
    <group position={position} userData={{ station, isObservationMarker: true }}>
      {/* Invisible hit box for forgiving double-tap/pinch selection */}
      <mesh
        userData={{ station, isObservationMarker: true }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(station);
        }}
        onPointerEnter={(e) => {
          e.stopPropagation();
          // eslint-disable-next-line react/immutability
          gl.domElement.style.cursor = 'pointer';
          const rect = gl.domElement.getBoundingClientRect();
          onHover(station, e.clientX - rect.left, e.clientY - rect.top);
        }}
        onPointerLeave={(e) => {
          e.stopPropagation();
          // eslint-disable-next-line react/immutability
          gl.domElement.style.cursor = 'default';
          onHover(null, 0, 0);
        }}
      >
        <sphereGeometry args={[size * 5, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Pulse ring for anomalous stations and live API stream */}
      {(station.status !== 'normal' || isLiveStream) && (
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[size * 1.5, size * 2.2, 32]} />
          <meshBasicMaterial
            color={isLiveStream ? '#00f0ff' : color}
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* Extra outer halo specifically for live API stream */}
      {isLiveStream && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[size * 2.5, size * 3.0, 32]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* Core glowing marker sphere with refined technical finish */}
      <mesh
        ref={meshRef}
        userData={{ station, isObservationMarker: true }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(station);
        }}
        onPointerEnter={(e) => {
          e.stopPropagation();
          // eslint-disable-next-line react/immutability
          gl.domElement.style.cursor = 'pointer';
          const rect = gl.domElement.getBoundingClientRect();
          onHover(station, e.clientX - rect.left, e.clientY - rect.top);
        }}
        onPointerLeave={(e) => {
          e.stopPropagation();
          // eslint-disable-next-line react/immutability
          gl.domElement.style.cursor = 'default';
          onHover(null, 0, 0);
        }}
      >
        <sphereGeometry args={[size, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 1.0 : isHandHovered ? 0.85 : station.status === 'critical' ? 0.6 : 0.25}
          roughness={0.15}
          metalness={0.3}
          transparent={!isDepthMatched}
          opacity={isDepthMatched ? 1.0 : 0.35}
        />
      </mesh>

      {/* Selection halo - Technical multi-ring radar target */}
      {isSelected && (
        <group rotation={[Math.PI / 2, 0, 0]}>
          <mesh>
            <ringGeometry args={[size * 1.35, size * 1.55, 32]} />
            <meshBasicMaterial
              color="#22d3ee"
              transparent
              opacity={0.9}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <mesh>
            <ringGeometry args={[size * 2.1, size * 2.2, 32]} />
            <meshBasicMaterial
              color="#22d3ee"
              transparent
              opacity={0.45}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <mesh>
            <ringGeometry args={[size * 2.8, size * 2.88, 32]} />
            <meshBasicMaterial
              color="#22d3ee"
              transparent
              opacity={0.2}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}

// ── Hover Tooltip ─────────────────────────────────────────────────────────────
interface TooltipProps {
  station: Station;
  parameter: OceanParameter;
  x: number;
  y: number;
}

function HoverTooltip({ station, parameter }: TooltipProps) {
  const comp = getComparisons(station).find(c => c.parameter === parameter);
  const obs = comp ? comp.observedValue : 0;
  const unit = comp ? comp.unit : '';
  const statusLabel =
    station.status === 'critical' ? 'HIGH DEVIATION' :
    station.status === 'warning' ? 'WARNING' : 'NORMAL';
  const statusClr =
    station.status === 'critical' ? '#ef4444' :
    station.status === 'warning' ? '#f59e0b' : '#22d3ee';

  return (
    <div
      style={{
        background: 'rgba(2, 8, 20, 0.88)',
        border: `1px solid ${statusClr}60`,
        borderRadius: '5px',
        padding: '8px 12px',
        minWidth: '140px',
        pointerEvents: 'none',
        color: '#f1f5f9',
        fontSize: '10px',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: `0 8px 24px rgba(0,0,0,0.75), 0 0 12px ${statusClr}25`,
        transform: 'translate(12px, -50%)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#22d3ee', letterSpacing: '0.05em', fontSize: '11px' }}>
          {station.id}
        </span>
        <span style={{ fontSize: '7px', color: statusClr, fontWeight: 700, letterSpacing: '0.12em', border: `1px solid ${statusClr}40`, padding: '1px 4px', borderRadius: '2px' }}>
          {statusLabel}
        </span>
      </div>
      {station.id.startsWith('ARGO-590623') && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          background: 'rgba(34, 211, 238, 0.15)',
          border: '1px solid rgba(34, 211, 238, 0.4)',
          borderRadius: '3px',
          padding: '2px 5px',
          marginBottom: '5px',
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 5px #22d3ee' }} />
          <span style={{ fontSize: '7.5px', color: '#38bdf8', fontFamily: 'monospace', fontWeight: 800 }}>
            LIVE STREAM (API KEY)
          </span>
        </div>
      )}
      <div style={{ color: '#94a3b8', fontSize: '8px', letterSpacing: '0.05em', marginBottom: 5 }}>
        {(station.region || 'Unknown').toUpperCase()}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 4 }}>
        <span style={{ color: '#64748b', fontSize: '8px' }}>OBSERVED</span>
        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#f8fafc', fontSize: '9px' }}>
          {obs.toFixed(2)} <span style={{ color: '#64748b', fontSize: '7px' }}>{unit}</span>
        </span>
      </div>
    </div>
  );
}

// ── Main Observation Markers ──────────────────────────────────────────────────
interface ObservationMarkersProps {
  stations: Station[];
  layer: OceanLayer;
  parameter: OceanParameter;
  depth?: DepthLevel;
  selectedId: string | null;
  visible: boolean;
  onSelect: (s: Station | null) => void;
  onClickEvent?: (callback: () => void) => void;
  handPointerRef?: React.MutableRefObject<{ x: number; y: number; active: boolean; isTapTracking: boolean }>;
  handHoverRef?: React.MutableRefObject<boolean>;
  handHoverTargetRef?: React.MutableRefObject<string | null>;
}

export function ObservationMarkers({
  stations,
  layer,
  parameter,
  depth = 0,
  selectedId,
  visible,
  onSelect,
  onClickEvent,
  handPointerRef,
  handHoverRef,
  handHoverTargetRef,
}: ObservationMarkersProps) {
  const [hovered, setHovered] = useState<{ station: Station; x: number; y: number } | null>(null);
  const [handHoveredId, setHandHoveredId] = useState<string | null>(null);
  const currentHoveredIdRef = useRef<string | null>(null);
  const groupRef = useRef<THREE.Group>(null!);
  const { camera, raycaster, size: viewportSize, gl } = useThree();

  const handleHover = useCallback((station: Station | null, x: number, y: number) => {
    setHovered(station ? { station, x, y } : null);
  }, []);

  useFrame(() => {
    let currentHoverId: string | null = null;
    
    if (handPointerRef && handHoverRef && handPointerRef.current.active) {
      const p = handPointerRef.current;
      
      const rect = gl.domElement.getBoundingClientRect();
      const screenX = p.x * window.innerWidth;
      const screenY = p.y * window.innerHeight;
      
      const pointerNDC = new THREE.Vector2(
        ((screenX - rect.left) / rect.width) * 2 - 1,
        -((screenY - rect.top) / rect.height) * 2 + 1
      );
      
      raycaster.setFromCamera(pointerNDC, camera);
      
      // 1. Raycast Candidate
      if (groupRef.current) {
        const intersects = raycaster.intersectObjects(groupRef.current.children, true);
        if (intersects.length > 0) {
          let hit: THREE.Object3D | null = intersects[0].object;
          while (hit && !hit.userData?.station?.id && hit.parent) {
            hit = hit.parent;
          }
          if (hit && hit.userData && hit.userData.station && hit.userData.station.id) {
            currentHoverId = hit.userData.station.id;
          }
        }
      }

      // 2. Screen-Space Candidate Fallback
      if (!currentHoverId) {
        let bestDist = Infinity;
        let bestId: string | null = null;
        const tempVec = new THREE.Vector3();

        for (const station of stations) {
          const stationDepthOffset = (station.depth / 1000) * 0.04;
          const markerRadius = 2.032 - stationDepthOffset;
          const [x, y, z] = latLonToXYZ(station.latitude, station.longitude, markerRadius);
          tempVec.set(x, y, z);
          
          // Check if station is on the front hemisphere (facing camera)
          if (tempVec.dot(camera.position) > 0) {
            tempVec.project(camera); // Convert to NDC
            
            // Convert NDC distance to Screen Pixels
            const dx = (tempVec.x - pointerNDC.x) * (viewportSize.width / 2);
            const dy = (tempVec.y - pointerNDC.y) * (viewportSize.height / 2);
            const distPx = Math.hypot(dx, dy);

            // Apply hysteresis if this station was already hovered
            const isLocked = currentHoveredIdRef.current === station.id;
            const threshold = HAND_SELECTION_CONFIG.targeting.hitRadiusPx + (isLocked ? HAND_SELECTION_CONFIG.targeting.hysteresisPx : 0);

            if (distPx < threshold && distPx < bestDist) {
              bestDist = distPx;
              bestId = station.id;
            }
          }
        }
        currentHoverId = bestId;
      }
    }
    
    if (handHoverRef) handHoverRef.current = !!currentHoverId;
    if (handHoverTargetRef) handHoverTargetRef.current = currentHoverId;

    if (currentHoverId !== currentHoveredIdRef.current) {
      currentHoveredIdRef.current = currentHoverId;
      setHandHoveredId(currentHoverId);
    }
  });

  useEffect(() => {
    if (!onClickEvent) return;
    onClickEvent(() => {
      console.log("[HAND SELECT] SELECTION HANDLER ENTERED");
      console.log('[HAND SELECT]');
      console.log('gesture: LEFT_AIR_QUOTE');
      if (!handPointerRef || !handPointerRef.current.active) {
        console.log('NO TARGET');
        console.log('Right-hand crosshair is not active.');
        return;
      }
      
      const p = handPointerRef.current;
      const rect = gl.domElement.getBoundingClientRect();
      const crosshairX = p.x * window.innerWidth;
      const crosshairY = p.y * window.innerHeight;
      
      console.log(`crosshair: ${crosshairX.toFixed(1)}, ${crosshairY.toFixed(1)}`);
      
      let bestDist = Infinity;
      let bestId: string | null = null;
      const tempVec = new THREE.Vector3();
      
      for (const station of stations) {
        // Calculate the exact world position of the ARGO point
        const stationDepthOffset = (station.depth / 1000) * 0.04;
        const markerRadius = 2.032 - stationDepthOffset;
        const [x, y, z] = latLonToXYZ(station.latitude, station.longitude, markerRadius);
        tempVec.set(x, y, z);
        
        // Only check points on the front of the globe relative to camera
        if (tempVec.dot(camera.position) > 0) {
          // Project world position into Normalized Device Coordinates (NDC)
          tempVec.project(camera);
          
          // Convert NDC to actual Screen Pixels using the Canvas bounding rect
          const screenX = ((tempVec.x + 1) / 2) * rect.width + rect.left;
          const screenY = ((-tempVec.y + 1) / 2) * rect.height + rect.top;
          
          // Compare with crosshair screen position
          const distPx = Math.hypot(screenX - crosshairX, screenY - crosshairY);
          
          if (distPx < bestDist) {
            bestDist = distPx;
            bestId = station.id;
          }
        }
      }
      
      // Temporary testing radius
      const SELECTION_RADIUS = 100;
      
      if (bestId && bestDist <= SELECTION_RADIUS) {
        console.log(`nearest: ${bestId}`);
        console.log(`distance: ${bestDist.toFixed(1)} px`);
        console.log(`selected: YES`);
        
        const hitStation = stations.find(s => s.id === bestId);
        if (hitStation) {
          console.log("[HAND SELECT] TARGET:", hitStation);
          (window as any).__debugHandlerCalled = 'CALLED';
          onSelect(hitStation);
        }
      } else {
        console.log('NO TARGET');
        console.log(`nearest distance: ${bestDist === Infinity ? 'N/A' : bestDist.toFixed(1)} px`);
      }
    });
  }, [onClickEvent, stations, onSelect, handPointerRef, gl, camera]);

  if (!visible) return null;

  return (
    <group ref={groupRef}>
      {stations.map((station) => (
        <Marker
          key={station.id}
          station={station}
          layer={layer}
          parameter={parameter}
          depth={depth}
          isSelected={selectedId === station.id}
          isHandHovered={handHoveredId === station.id}
          onSelect={onSelect}
          onHover={handleHover}
        />
      ))}

      {/* Hover tooltip */}
      {hovered && (
        <group position={new THREE.Vector3(
          ...latLonToXYZ(hovered.station.latitude, hovered.station.longitude, 2.08) as [number, number, number]
        )}>
          <Html style={{ pointerEvents: 'none' }} occlude={false}>
            <HoverTooltip
              station={hovered.station}
              parameter={parameter}
              x={hovered.x}
              y={hovered.y}
            />
          </Html>
        </group>
      )}
    </group>
  );
}
