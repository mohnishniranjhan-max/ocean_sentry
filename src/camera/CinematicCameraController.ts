import * as THREE from 'three';
import { type CinematicTransitionConfig, DEFAULT_TRANSITION, getEasing } from './cameraTransitions';

export type CinematicPhase = 'idle' | 'rotating' | 'zooming' | 'approaching' | 'settling';

export interface CinematicState {
  isActive: boolean;
  phase: CinematicPhase;
  progress: number;
  startTime: number;
}

function latLonToPosition(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

export class CinematicCameraControllerLogic {
  private config: CinematicTransitionConfig = DEFAULT_TRANSITION;
  private state: CinematicState = { isActive: false, phase: 'idle', progress: 0, startTime: 0 };
  private startPos = new THREE.Vector3();
  private startTarget = new THREE.Vector3();
  private endPos = new THREE.Vector3();
  private endTarget = new THREE.Vector3();
  private midPos = new THREE.Vector3();

  onPhaseChange: ((phase: CinematicPhase, progress: number) => void) | null = null;
  onComplete: (() => void) | null = null;

  get isActive(): boolean {
    return this.state.isActive;
  }

  get currentPhase(): CinematicPhase {
    return this.state.phase;
  }

  get currentProgress(): number {
    return this.state.progress;
  }

  startTransition(camera: THREE.Camera, currentTarget: THREE.Vector3, config?: Partial<CinematicTransitionConfig>): void {
    this.config = { ...DEFAULT_TRANSITION, ...config };
    this.startPos.copy(camera.position);
    this.startTarget.copy(currentTarget);

    const targetSurface = latLonToPosition(
      this.config.target.latitude,
      this.config.target.longitude,
      2.0
    );
    const cameraDistance = 4.2 / this.config.zoom;
    this.endPos = latLonToPosition(
      this.config.target.latitude,
      this.config.target.longitude,
      cameraDistance
    );
    this.endTarget.copy(targetSurface);

    // Mid-point for the curve (pull back slightly for cinematic arc)
    this.midPos.lerpVectors(this.startPos, this.endPos, 0.4);
    this.midPos.multiplyScalar(1.15);

    this.state = {
      isActive: true,
      phase: 'rotating',
      progress: 0,
      startTime: performance.now(),
    };
  }

  update(camera: THREE.Camera, currentTarget: THREE.Vector3, now: number): boolean {
    if (!this.state.isActive) return false;

    const elapsed = now - this.state.startTime;
    const totalProgress = Math.min(1, elapsed / this.config.duration);
    this.state.progress = totalProgress;

    const ease = getEasing(this.config.easing);
    const t = ease(totalProgress);

    // Determine phase
    let newPhase: CinematicPhase;
    if (totalProgress < 0.12) {
      newPhase = 'rotating';
    } else if (totalProgress < 0.35) {
      newPhase = 'zooming';
    } else if (totalProgress < 0.8) {
      newPhase = 'approaching';
    } else {
      newPhase = 'settling';
    }

    if (newPhase !== this.state.phase) {
      this.state.phase = newPhase;
      this.onPhaseChange?.(newPhase, totalProgress);
    }

    this.config.onPhase?.(this.state.phase, totalProgress);

    // Quadratic bezier interpolation for position (arc path)
    const oneMinusT = 1 - t;
    const posX = oneMinusT * oneMinusT * this.startPos.x + 2 * oneMinusT * t * this.midPos.x + t * t * this.endPos.x;
    const posY = oneMinusT * oneMinusT * this.startPos.y + 2 * oneMinusT * t * this.midPos.y + t * t * this.endPos.y;
    const posZ = oneMinusT * oneMinusT * this.startPos.z + 2 * oneMinusT * t * this.midPos.z + t * t * this.endPos.z;

    camera.position.set(posX, posY, posZ);

    // Smooth target interpolation
    currentTarget.lerpVectors(this.startTarget, this.endTarget, t);

    if (totalProgress >= 1) {
      this.state.isActive = false;
      this.state.phase = 'idle';
      this.onComplete?.();
      return false;
    }

    return true;
  }

  cancel(): void {
    this.state.isActive = false;
    this.state.phase = 'idle';
    this.state.progress = 0;
  }
}
