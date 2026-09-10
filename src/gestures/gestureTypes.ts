export type GestureEventType = 'BLOW_BLOW' | 'PINCH' | 'OPEN_PALM' | 'FIST';

export interface GestureEvent {
  type: GestureEventType;
  confidence: number;
  timestamp: number;
}

export type BlowDetectorState =
  | 'IDLE'
  | 'BLOW_CANDIDATE'
  | 'BLOW_1_CONFIRMED'
  | 'WAITING_FOR_BLOW_2'
  | 'BLOW_2_CANDIDATE'
  | 'BLOW_BLOW_CONFIRMED'
  | 'COOLDOWN';

export type EffectState = 'IDLE' | 'TRIGGERING' | 'ACTIVE' | 'FADING' | 'COOLDOWN';

export interface BlowFeatures {
  mouthOpen: number;
  mouthWidth: number;
  mouthHeight: number;
  lipPurse: number;
  leftCheekExpansion: number;
  rightCheekExpansion: number;
}

export interface BlowDetectorConfig {
  blowThreshold: number;
  minBlowDuration: number;
  maxBlowDuration: number;
  timeBetweenBlowsMin: number;
  timeBetweenBlowsMax: number;
  cooldownDuration: number;
  calibrationDuration: number;
}

export const DEFAULT_BLOW_CONFIG: BlowDetectorConfig = {
  blowThreshold: 0.75,
  minBlowDuration: 150,
  maxBlowDuration: 1200,
  timeBetweenBlowsMin: 800,
  timeBetweenBlowsMax: 1800,
  cooldownDuration: 4000,
  calibrationDuration: 1000,
};

export interface GestureListener {
  (event: GestureEvent): void;
}
