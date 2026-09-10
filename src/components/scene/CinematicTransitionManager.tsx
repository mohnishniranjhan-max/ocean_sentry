import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useCinematicTransition } from '../../hooks/useCinematicTransition';
import { OceanTransitionEffects } from '../../effects/OceanTransitionEffects';
import type { CinematicTransitionConfig } from '../../camera/cameraTransitions';
import type { CinematicTransitionState } from '../../hooks/useCinematicTransition';

export interface CinematicTransitionManagerHandle {
  startTransition: (config?: Partial<CinematicTransitionConfig>) => void;
  transitionState: CinematicTransitionState;
  isTransitioning: boolean;
}

interface CinematicTransitionManagerProps {
  currentTargetRef: React.MutableRefObject<THREE.Vector3>;
  targetLatitude?: number;
  targetLongitude?: number;
  onTransitionStateChange?: (state: CinematicTransitionState) => void;
}

export const CinematicTransitionManager = forwardRef<
  CinematicTransitionManagerHandle,
  CinematicTransitionManagerProps
>(function CinematicTransitionManager(
  {
    currentTargetRef,
    targetLatitude = 13.08,
    targetLongitude = 80.27,
    onTransitionStateChange,
  },
  ref
) {
  const { startTransition, transitionState, isTransitioning } = useCinematicTransition(currentTargetRef);

  useImperativeHandle(ref, () => ({
    startTransition,
    transitionState,
    isTransitioning,
  }), [startTransition, transitionState, isTransitioning]);

  useEffect(() => {
    onTransitionStateChange?.(transitionState);
  }, [transitionState, onTransitionStateChange]);

  return (
    <OceanTransitionEffects
      transitionState={transitionState}
      targetLatitude={targetLatitude}
      targetLongitude={targetLongitude}
    />
  );
});
