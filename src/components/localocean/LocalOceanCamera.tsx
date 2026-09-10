import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { DepthLevel } from '../../types/ocean';

interface LocalOceanCameraProps {
  depth: DepthLevel;
  handDeltaRef?: React.MutableRefObject<{ dx: number; dy: number }>;
  handZoomRef?: React.MutableRefObject<number>;
  numHands?: number;
  isHandEnabled?: boolean;
}

// Map depth levels to Y positions in local ocean scene (10 units = 100 meters)
function depthToY(depth: DepthLevel): number {
  const depthMap: Record<number, number> = {
    0:    2.0,    // Above surface
    10:   -1.0,   // Shallow
    50:   -5.0,
    100:  -10.0,
    500:  -50.0,
    1000: -100.0,
  };
  return depthMap[depth] ?? 2.0;
}

export function LocalOceanCamera({
  depth,
  handDeltaRef,
  handZoomRef,
  numHands = 0,
  isHandEnabled = false,
}: LocalOceanCameraProps) {
  const { camera, gl } = useThree();
  const targetY = useRef(2.0);
  const currentY = useRef(2.0);
  const orbitAngle = useRef(0);    // horizontal orbit angle
  const orbitRadius = useRef(8.0); // distance from center
  const tiltAngle = useRef(0.2);   // vertical tilt (positive = look down)

  // Mouse drag state
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });

  // Set initial camera position
  useEffect(() => {
    camera.position.set(0, 2, 8);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  // Mouse event listeners for rotation and zoom
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      isDragging.current = true;
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      
      const deltaX = e.clientX - previousMousePosition.current.x;
      const deltaY = e.clientY - previousMousePosition.current.y;
      
      // Update angles based on mouse movement
      orbitAngle.current -= deltaX * 0.005;
      tiltAngle.current = Math.max(-0.2, Math.min(1.2, tiltAngle.current - deltaY * 0.005));
      
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = () => {
      isDragging.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      // Zoom with scroll wheel
      const zoomDelta = e.deltaY * 0.01;
      orbitRadius.current = Math.max(3, Math.min(18, orbitRadius.current + zoomDelta));
    };

    const domElement = gl.domElement;
    domElement.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    domElement.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      domElement.removeEventListener('wheel', handleWheel);
    };
  }, [gl.domElement]);

  useFrame((state, dt) => {
    // Update target Y based on depth
    targetY.current = depthToY(depth);

    // Cinematic camera descent — use smooth damping based on distance
    const dist = targetY.current - currentY.current;
    
    // Constant velocity for long dives, exponential ease for short adjustments
    if (Math.abs(dist) > 0.05) {
      const speed = Math.max(1.5, Math.abs(dist) * 0.8); 
      currentY.current += Math.sign(dist) * Math.min(Math.abs(dist), speed * dt);
    } else {
      currentY.current = targetY.current;
    }

    // Hand gesture controls — two-hand rotation and zoom
    if (isHandEnabled && numHands === 2 && handDeltaRef?.current) {
      const delta = handDeltaRef.current;
      if (delta) {
        orbitAngle.current += delta.dx * 0.3;
        tiltAngle.current = Math.max(-0.2, Math.min(1.2, tiltAngle.current - delta.dy * 0.2));
      }

      const zoom = handZoomRef?.current;
      if (zoom !== undefined && zoom !== 1.0) {
        orbitRadius.current = Math.max(3, Math.min(18, orbitRadius.current / zoom));
      }

      // Reset hand refs after consumption
      if (handDeltaRef?.current) {
        handDeltaRef.current = { dx: 0, dy: 0 };
      }
      if (handZoomRef?.current !== undefined) {
        handZoomRef.current = 1.0;
      }
    }

    // Compute camera position on orbit
    const r = orbitRadius.current;
    const angle = orbitAngle.current;
    const y = currentY.current;

    // Camera orbits around center column
    const camX = Math.sin(angle) * r;
    const camZ = Math.cos(angle) * r;
    const camY = y + Math.sin(tiltAngle.current) * r * 0.3;

    camera.position.set(camX, camY, camZ);

    // Provide a perfectly stable submarine view looking forward horizontally.
    // By looking at the exact center (0, y, 0), and orbiting around it,
    // the camera maintains a steady forward direction that does not pitch up or down.
    camera.lookAt(0, currentY.current, 0);
  });

  return null;
}
