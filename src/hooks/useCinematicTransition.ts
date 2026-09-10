import { useRef, useCallback, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CinematicCameraControllerLogic } from '../camera/CinematicCameraController';
import type { CinematicTransitionConfig } from '../camera/cameraTransitions';
import type { EffectState } from '../gestures/gestureTypes';

export interface CinematicTransitionState {
  effectState: EffectState;
  cameraPhase: string;
  progress: number;
  atmosphereIntensity: number;
  particleIntensity: number;
  markerVisibility: number;
  anomalyPulse: number;
  oceanLighting: number;
}

export function useCinematicTransition(currentTargetRef: React.MutableRefObject<THREE.Vector3>) {
  const { camera } = useThree();
  const controllerRef = useRef(new CinematicCameraControllerLogic());
  const effectStateRef = useRef<EffectState>('IDLE');
  const effectStartRef = useRef(0);
  const transitionCompleteTimeRef = useRef(0);

  const [transitionState, setTransitionState] = useState<CinematicTransitionState>({
    effectState: 'IDLE',
    cameraPhase: 'idle',
    progress: 0,
    atmosphereIntensity: 0,
    particleIntensity: 0,
    markerVisibility: 0,
    anomalyPulse: 0,
    oceanLighting: 0,
  });

  const startTransition = useCallback((config?: Partial<CinematicTransitionConfig>) => {
    if (effectStateRef.current !== 'IDLE') return;

    const controller = controllerRef.current;
    controller.startTransition(camera, currentTargetRef.current, config);
    effectStateRef.current = 'TRIGGERING';
    effectStartRef.current = performance.now();

    setTransitionState(s => ({ ...s, effectState: 'TRIGGERING' }));
  }, [camera, currentTargetRef]);

  useFrame(() => {
    const controller = controllerRef.current;
    const now = performance.now();

    if (!controller.isActive && effectStateRef.current === 'IDLE') return;

    // Drive camera if active
    if (controller.isActive) {
      controller.update(camera, currentTargetRef.current, now);
    }

    // Handle state machine
    const progress = controller.currentProgress;

    if (effectStateRef.current === 'TRIGGERING' && progress > 0.14) {
      effectStateRef.current = 'ACTIVE';
    }

    if (!controller.isActive && effectStateRef.current === 'ACTIVE') {
      effectStateRef.current = 'FADING';
      transitionCompleteTimeRef.current = now;
    }

    if (effectStateRef.current === 'FADING') {
      const fadeElapsed = now - transitionCompleteTimeRef.current;
      if (fadeElapsed > 1200) {
        effectStateRef.current = 'COOLDOWN';
        setTimeout(() => {
          effectStateRef.current = 'IDLE';
          setTransitionState({
            effectState: 'IDLE',
            cameraPhase: 'idle',
            progress: 0,
            atmosphereIntensity: 0,
            particleIntensity: 0,
            markerVisibility: 0,
            anomalyPulse: 0,
            oceanLighting: 0,
          });
        }, 4000);
      } else {
        const fadeProg = fadeElapsed / 1200;
        setTransitionState(s => ({
          ...s,
          effectState: 'FADING',
          atmosphereIntensity: s.atmosphereIntensity * (1 - fadeProg * 0.05),
          anomalyPulse: s.anomalyPulse * (1 - fadeProg * 0.05),
          oceanLighting: s.oceanLighting * (1 - fadeProg * 0.05),
        }));
      }
      return;
    }

    if (effectStateRef.current === 'TRIGGERING' || effectStateRef.current === 'ACTIVE') {
      const atmosphereRamp = Math.min(1, progress / 0.4);
      const particleRamp = Math.max(0, (progress - 0.3) / 0.4);
      const markerRamp = Math.max(0, (progress - 0.5) / 0.3);
      const anomalyRamp = Math.max(0, (progress - 0.6) / 0.3);
      const lightingRamp = Math.min(1, progress / 0.5);

      setTransitionState({
        effectState: effectStateRef.current,
        cameraPhase: controller.currentPhase,
        progress,
        atmosphereIntensity: atmosphereRamp * 0.6,
        particleIntensity: Math.min(1, particleRamp),
        markerVisibility: Math.min(1, markerRamp),
        anomalyPulse: Math.min(1, anomalyRamp),
        oceanLighting: lightingRamp * 0.3,
      });
    }
  });

  useEffect(() => {
    return () => {
      controllerRef.current.cancel();
    };
  }, []);

  return {
    startTransition,
    transitionState,
    isTransitioning: effectStateRef.current !== 'IDLE' && effectStateRef.current !== 'COOLDOWN',
  };
}
