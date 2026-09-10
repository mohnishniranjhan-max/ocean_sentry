import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceGestureDetector } from '../gestures/FaceGestureDetector';
import { BlowBlowDetector } from '../gestures/BlowBlowDetector';
import { gestureManager } from '../gestures/GestureManager';
import type { BlowDetectorState, GestureEvent, BlowDetectorConfig } from '../gestures/gestureTypes';

export interface FaceGestureStatus {
  isEnabled: boolean;
  isReady: boolean;
  faceDetected: boolean;
  blowScore: number;
  detectorState: BlowDetectorState;
  timeSinceBlow1: number;
  lastEvent: GestureEvent | null;
  error: string | null;
}

export function useGestureControl(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  handTrackingEnabled: boolean,
  config?: Partial<BlowDetectorConfig>
) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [status, setStatus] = useState<FaceGestureStatus>({
    isEnabled: false,
    isReady: false,
    faceDetected: false,
    blowScore: 0,
    detectorState: 'IDLE',
    timeSinceBlow1: 0,
    lastEvent: null,
    error: null,
  });

  const faceDetectorRef = useRef<FaceGestureDetector | null>(null);
  const blowDetectorRef = useRef<BlowBlowDetector | null>(null);
  const rafRef = useRef<number | null>(null);
  const enabledRef = useRef(false);

  useEffect(() => {
    enabledRef.current = isEnabled;
  }, [isEnabled]);

  // Initialize detectors
  useEffect(() => {
    if (!isEnabled) return;

    const faceDetector = new FaceGestureDetector(18);
    const blowDetector = new BlowBlowDetector(config);

    faceDetectorRef.current = faceDetector;
    blowDetectorRef.current = blowDetector;

    faceDetector.onFaceDetected = (detected) => {
      setStatus(s => ({ ...s, faceDetected: detected }));
    };

    faceDetector.onError = (error) => {
      setStatus(s => ({ ...s, error }));
    };

    faceDetector.onFeaturesUpdate = (features, confidence) => {
      blowDetector.update(features, confidence, performance.now());
    };

    blowDetector.onStateChange = (state) => {
      setStatus(s => ({ ...s, detectorState: state }));
    };

    blowDetector.onScoreUpdate = (score, _state, timeSinceBlow1) => {
      setStatus(s => ({ ...s, blowScore: score, timeSinceBlow1 }));
    };

    blowDetector.onBlowEvent = (event) => {
      setStatus(s => ({ ...s, lastEvent: event }));
      gestureManager.emit(event);
    };

    faceDetector.initialize().then(success => {
      if (success && enabledRef.current) {
        setStatus(s => ({ ...s, isReady: true }));
        faceDetector.startCalibration();
      }
    });

    return () => {
      faceDetector.destroy();
      faceDetectorRef.current = null;
      blowDetectorRef.current = null;
    };
  }, [isEnabled]);

  // Processing loop: share video element with hand tracking
  useEffect(() => {
    if (!isEnabled || !handTrackingEnabled) return;

    const processLoop = (now: number) => {
      if (!enabledRef.current) return;
      rafRef.current = requestAnimationFrame(processLoop);

      const video = videoRef.current;
      const faceDetector = faceDetectorRef.current;
      if (!video || !faceDetector || !faceDetector.isReady) return;
      if (video.readyState < 2) return;

      faceDetector.processFrame(video, now);
    };

    rafRef.current = requestAnimationFrame(processLoop);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isEnabled, handTrackingEnabled, videoRef]);

  const toggleEnabled = useCallback(() => {
    setIsEnabled(prev => {
      const next = !prev;
      setStatus(s => ({
        ...s,
        isEnabled: next,
        isReady: false,
        faceDetected: false,
        blowScore: 0,
        detectorState: 'IDLE',
        timeSinceBlow1: 0,
        lastEvent: null,
        error: null,
      }));
      return next;
    });
  }, []);

  return {
    isEnabled,
    toggleEnabled,
    status,
    gestureManager,
  };
}
