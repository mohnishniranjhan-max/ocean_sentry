import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Station } from '../../types/ocean';

interface HandInteractionControllerProps {
  targetPosRef: React.MutableRefObject<{ x: number; y: number } | null>;
  isPinchingRef: React.MutableRefObject<boolean>;
  onHover: (station: Station | null, x: number, y: number) => void;
  onSelect: (station: Station) => void;
  isActive: boolean;
}

export function HandInteractionController({
  targetPosRef,
  isPinchingRef,
  onHover,
  onSelect,
  isActive
}: HandInteractionControllerProps) {
  const { camera, scene, size } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  
  // State for debounce/cooldown
  const hoveredStationRef = useRef<Station | null>(null);
  const isPinchingProcessed = useRef<boolean>(false);

  useFrame(() => {
    if (!isActive) {
      if (hoveredStationRef.current) {
        hoveredStationRef.current = null;
        onHover(null, 0, 0);
      }
      return;
    }

    const pos = targetPosRef.current;
    if (!pos) {
      if (hoveredStationRef.current) {
        hoveredStationRef.current = null;
        onHover(null, 0, 0);
      }
      return;
    }

    // Convert normalized (0-1) coordinates to NDC (-1 to 1)
    const ndcX = (pos.x * 2) - 1;
    const ndcY = -(pos.y * 2) + 1; // Y is inverted in NDC

    // Update raycaster
    raycaster.current.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

    // Find intersections with marker meshes
    // We only want meshes that have userData.isObservationMarker = true
    const intersects = raycaster.current.intersectObjects(scene.children, true);
    
    let foundStation: Station | null = null;
    
    for (let i = 0; i < intersects.length; i++) {
      const obj = intersects[i].object;
      if (obj.userData && obj.userData.isObservationMarker && obj.userData.station) {
        foundStation = obj.userData.station as Station;
        break; // Take the first valid intersection
      }
    }

    // Calculate screen pixel coordinates for hover feedback
    const screenX = pos.x * size.width;
    const screenY = pos.y * size.height;

    // Update hover state
    if (foundStation !== hoveredStationRef.current) {
      hoveredStationRef.current = foundStation;
      onHover(foundStation, screenX, screenY);
    } else if (foundStation) {
      // Still hovering same station, update position
      onHover(foundStation, screenX, screenY);
    }

    // Process pinch selection
    if (isPinchingRef.current) {
      if (!isPinchingProcessed.current && foundStation) {
        isPinchingProcessed.current = true;
        onSelect(foundStation);
      }
    } else {
      // Reset pinch processed flag when finger is released
      isPinchingProcessed.current = false;
    }
  });

  return null; // Logic-only component
}
