import type { BlowFeatures, BlowDetectorState, BlowDetectorConfig, GestureEvent } from './gestureTypes';
import { DEFAULT_BLOW_CONFIG } from './gestureTypes';

interface BlowPhase {
  risingEdge: boolean;
  peak: boolean;
  fallingEdge: boolean;
  peakScore: number;
  startTime: number;
  duration: number;
}

export class BlowBlowDetector {
  private state: BlowDetectorState = 'IDLE';
  private config: BlowDetectorConfig;
  private blowScore = 0;
  private smoothedScore = 0;
  private prevSmoothedScore = 0;
  private scoreVelocity = 0;

  private currentPhase: BlowPhase = this.resetPhase();
  private blow1Time = 0;
  private blow1Confidence = 0;
  private cooldownStart = 0;

  private historyWindow: number[] = [];
  private readonly HISTORY_SIZE = 8;

  onStateChange: ((state: BlowDetectorState) => void) | null = null;
  onBlowEvent: ((event: GestureEvent) => void) | null = null;
  onScoreUpdate: ((score: number, state: BlowDetectorState, timeSinceBlow1: number) => void) | null = null;

  constructor(config?: Partial<BlowDetectorConfig>) {
    this.config = { ...DEFAULT_BLOW_CONFIG, ...config };
  }

  get currentState(): BlowDetectorState {
    return this.state;
  }

  get currentScore(): number {
    return this.smoothedScore;
  }

  updateConfig(config: Partial<BlowDetectorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  update(features: BlowFeatures, trackingConfidence: number, timestamp: number): void {
    const now = timestamp;

    if (this.state === 'COOLDOWN') {
      if (now - this.cooldownStart >= this.config.cooldownDuration) {
        this.transitionTo('IDLE');
      }
      return;
    }

    this.blowScore = this.computeBlowScore(features, trackingConfidence);
    this.prevSmoothedScore = this.smoothedScore;
    this.smoothedScore = this.smoothedScore * 0.6 + this.blowScore * 0.4;
    this.scoreVelocity = this.smoothedScore - this.prevSmoothedScore;

    this.historyWindow.push(this.smoothedScore);
    if (this.historyWindow.length > this.HISTORY_SIZE) {
      this.historyWindow.shift();
    }

    const timeSinceBlow1 = this.blow1Time > 0 ? now - this.blow1Time : 0;
    this.onScoreUpdate?.(this.smoothedScore, this.state, timeSinceBlow1);

    switch (this.state) {
      case 'IDLE':
        this.handleIdle(now);
        break;
      case 'BLOW_CANDIDATE':
        this.handleBlowCandidate(now);
        break;
      case 'BLOW_1_CONFIRMED':
        this.handleBlow1Confirmed(now);
        break;
      case 'WAITING_FOR_BLOW_2':
        this.handleWaitingForBlow2(now);
        break;
      case 'BLOW_2_CANDIDATE':
        this.handleBlow2Candidate(now);
        break;
      case 'BLOW_BLOW_CONFIRMED':
        this.handleConfirmed(now);
        break;
    }
  }

  reset(): void {
    this.state = 'IDLE';
    this.blowScore = 0;
    this.smoothedScore = 0;
    this.prevSmoothedScore = 0;
    this.scoreVelocity = 0;
    this.currentPhase = this.resetPhase();
    this.blow1Time = 0;
    this.blow1Confidence = 0;
    this.cooldownStart = 0;
    this.historyWindow = [];
  }

  private computeBlowScore(features: BlowFeatures, trackingConfidence: number): number {
    // Weighted combination for blow detection
    // Pursed lips + slight mouth opening + cheek expansion = blow
    const lipPurseWeight = 0.30;
    const mouthShapeWeight = 0.25;
    const cheekWeight = 0.25;
    const velocityWeight = 0.10;
    const confidenceWeight = 0.10;

    // Mouth shape: blowing = slightly open, narrow mouth
    const mouthShapeScore = Math.min(1, features.lipPurse * 0.7 + features.mouthOpen * 0.3);

    // Cheek expansion average
    const cheekScore = (features.leftCheekExpansion + features.rightCheekExpansion) / 2;

    // Velocity bonus (rising = starting to blow)
    const velocityBonus = Math.max(0, this.scoreVelocity * 5);

    const score =
      features.lipPurse * lipPurseWeight +
      mouthShapeScore * mouthShapeWeight +
      cheekScore * cheekWeight +
      velocityBonus * velocityWeight +
      trackingConfidence * confidenceWeight;

    // Penalty for wide-open mouth (talking/yawning)
    const talkingPenalty = features.mouthWidth > 0.3 && features.mouthOpen > 0.5 ? 0.4 : 0;
    // Penalty for features that look like smiling
    const smilePenalty = features.mouthWidth > 0.35 && features.lipPurse < 0.2 ? 0.3 : 0;

    return Math.max(0, Math.min(1, score - talkingPenalty - smilePenalty));
  }

  private handleIdle(now: number): void {
    if (this.smoothedScore > this.config.blowThreshold && this.scoreVelocity > 0.02) {
      this.currentPhase = {
        risingEdge: true,
        peak: false,
        fallingEdge: false,
        peakScore: this.smoothedScore,
        startTime: now,
        duration: 0,
      };
      this.transitionTo('BLOW_CANDIDATE');
    }
  }

  private handleBlowCandidate(now: number): void {
    const duration = now - this.currentPhase.startTime;

    if (duration > this.config.maxBlowDuration) {
      this.transitionTo('IDLE');
      return;
    }

    if (this.smoothedScore > this.currentPhase.peakScore) {
      this.currentPhase.peakScore = this.smoothedScore;
    }

    if (this.smoothedScore >= this.config.blowThreshold) {
      if (this.scoreVelocity <= 0.005 && this.currentPhase.risingEdge) {
        this.currentPhase.peak = true;
        this.currentPhase.risingEdge = false;
      }
    }

    if (this.currentPhase.peak && this.smoothedScore < this.config.blowThreshold * 0.7) {
      this.currentPhase.fallingEdge = true;
      this.currentPhase.duration = duration;
    }

    if (this.currentPhase.fallingEdge && duration >= this.config.minBlowDuration) {
      this.blow1Time = now;
      this.blow1Confidence = this.currentPhase.peakScore;
      this.transitionTo('BLOW_1_CONFIRMED');
      setTimeout(() => {
        if (this.state === 'BLOW_1_CONFIRMED') {
          this.transitionTo('WAITING_FOR_BLOW_2');
        }
      }, 50);
    }

    if (this.smoothedScore < this.config.blowThreshold * 0.4 && !this.currentPhase.peak) {
      if (duration < this.config.minBlowDuration) {
        this.transitionTo('IDLE');
      }
    }
  }

  private handleBlow1Confirmed(now: number): void {
    // Brief transition state, moves to WAITING_FOR_BLOW_2
    const elapsed = now - this.blow1Time;
    if (elapsed > 200) {
      this.transitionTo('WAITING_FOR_BLOW_2');
    }
  }

  private handleWaitingForBlow2(now: number): void {
    const elapsed = now - this.blow1Time;

    if (elapsed > this.config.timeBetweenBlowsMax) {
      this.transitionTo('IDLE');
      return;
    }

    if (elapsed >= this.config.timeBetweenBlowsMin * 0.5) {
      if (this.smoothedScore > this.config.blowThreshold && this.scoreVelocity > 0.02) {
        this.currentPhase = {
          risingEdge: true,
          peak: false,
          fallingEdge: false,
          peakScore: this.smoothedScore,
          startTime: now,
          duration: 0,
        };
        this.transitionTo('BLOW_2_CANDIDATE');
      }
    }
  }

  private handleBlow2Candidate(now: number): void {
    const elapsed = now - this.blow1Time;
    const duration = now - this.currentPhase.startTime;

    if (elapsed > this.config.timeBetweenBlowsMax) {
      this.transitionTo('IDLE');
      return;
    }

    if (duration > this.config.maxBlowDuration) {
      this.transitionTo('IDLE');
      return;
    }

    if (this.smoothedScore > this.currentPhase.peakScore) {
      this.currentPhase.peakScore = this.smoothedScore;
    }

    if (this.smoothedScore >= this.config.blowThreshold) {
      if (this.scoreVelocity <= 0.005 && this.currentPhase.risingEdge) {
        this.currentPhase.peak = true;
        this.currentPhase.risingEdge = false;
      }
    }

    if (this.currentPhase.peak && this.smoothedScore < this.config.blowThreshold * 0.7) {
      this.currentPhase.fallingEdge = true;
      this.currentPhase.duration = duration;
    }

    if (this.currentPhase.fallingEdge && duration >= this.config.minBlowDuration) {
      const timeBetween = now - this.blow1Time;
      if (
        timeBetween >= this.config.timeBetweenBlowsMin &&
        timeBetween <= this.config.timeBetweenBlowsMax &&
        this.blow1Confidence >= this.config.blowThreshold &&
        this.currentPhase.peakScore >= this.config.blowThreshold
      ) {
        this.transitionTo('BLOW_BLOW_CONFIRMED');
        const combinedConfidence = (this.blow1Confidence + this.currentPhase.peakScore) / 2;
        this.onBlowEvent?.({
          type: 'BLOW_BLOW',
          confidence: combinedConfidence,
          timestamp: now,
        });
      } else {
        this.transitionTo('IDLE');
      }
    }

    if (this.smoothedScore < this.config.blowThreshold * 0.4 && !this.currentPhase.peak) {
      if (duration < this.config.minBlowDuration) {
        this.transitionTo('WAITING_FOR_BLOW_2');
      }
    }
  }

  private handleConfirmed(now: number): void {
    this.cooldownStart = now;
    this.transitionTo('COOLDOWN');
  }

  private transitionTo(newState: BlowDetectorState): void {
    if (newState === this.state) return;
    this.state = newState;
    this.onStateChange?.(newState);
  }

  private resetPhase(): BlowPhase {
    return {
      risingEdge: false,
      peak: false,
      fallingEdge: false,
      peakScore: 0,
      startTime: 0,
      duration: 0,
    };
  }
}
