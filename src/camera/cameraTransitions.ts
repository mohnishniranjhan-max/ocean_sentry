export interface CinematicTransitionConfig {
  target: {
    latitude: number;
    longitude: number;
  };
  duration: number;
  easing: 'easeInOutCubic' | 'easeInOutQuart';
  zoom: number;
  rotation: boolean;
  onPhase?: (phase: string, progress: number) => void;
}

export const DEFAULT_TRANSITION: CinematicTransitionConfig = {
  target: {
    latitude: 13.08,
    longitude: 80.27,
  },
  duration: 3500,
  easing: 'easeInOutCubic',
  zoom: 1.2,
  rotation: true,
};

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeInOutQuart(t: number): number {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

export function getEasing(name: 'easeInOutCubic' | 'easeInOutQuart'): (t: number) => number {
  return name === 'easeInOutQuart' ? easeInOutQuart : easeInOutCubic;
}
