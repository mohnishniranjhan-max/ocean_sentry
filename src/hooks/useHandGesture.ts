import { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// ─── Types ───────────────────────────────────────────────────────────────────
export type GestureType = 'none' | 'drag' | 'pinch' | 'pan' | 'fist' | 'palm' | 'tap';
export type TrackingStatus = 'disabled' | 'loading' | 'ready' | 'tracking' | 'permission_denied' | 'unavailable';
export type Handedness = 'Left' | 'Right';
export type TwoHandGestureMode = 'none' | 'stabilizing' | 'scale' | 'translate' | 'rotate';

/** Per-hand tracking snapshot (all coordinates in normalised MediaPipe space). */
export interface HandState {
  detected: boolean;
  handedness: Handedness;
  confidence: number;
  landmarks: { x: number; y: number; z: number }[];
  palmCenter: { x: number; y: number; z: number };
  palmDepth: number;         // average Z of wrist + 4 MCPs
}

/** Spatial relationship between two detected hands. */
export interface TwoHandSpatial {
  handDistance: number;       // 2-D distance between palm centres
  handAngle: number;         // angle (radians) of the line between palm centres
  handCenter: { x: number; y: number };  // midpoint
  handSeparation: number;    // absolute X separation
  averageDepth: number;      // mean palmDepth of both hands
  relativeDepth: number;     // left.palmDepth - right.palmDepth
}

// ─── Configuration ───────────────────────────────────────────────────────────
export const TWO_HAND_TRACKING_CONFIG = {
  maxHands: 2,
  minDetectionConfidence: 0.6,
  minPresenceConfidence: 0.6,
  minTrackingConfidence: 0.6,
  /** Minimum handedness score to accept a classification */
  minHandednessConfidence: 0.55,
  /** EMA alpha for per-hand palm-centre XY smoothing (0=frozen, 1=raw) */
  palmSmoothing: 0.35,
};

export const HAND_GESTURE_CONFIG = {
  // Globe Rotation
  // 1.75× from previous 4.0 so small hand movements produce visible rotation
  rotationSensitivity: 7.0,
  rotationSmoothing: 0.3,
  rotationDeadzone: 0.004,

  // Double Tap Selection
  tapVelocityThreshold: -0.02,
  tapDurationMax: 250,
  doubleTapMinInterval: 100,
  doubleTapMaxInterval: 650,
};

// Palm-Depth Zoom: raw frame-delta → deadzone → scale → clamp → EMA on output
export const DEPTH_ZOOM_CONFIG = {
  deadzone:    0.003,
  sensitivity: 2.8,
  maxZoomStep: 0.035,
  smoothing:   0.35,
};

// ── Two-Hand Gesture Engine Configuration ─────────────────────────────────────
export const TWO_HAND_GESTURE_CONFIG = {
  /** ms to hold both hands before gestures begin */
  activationDelay: 200,

  /** Scale (zoom from hand distance change) */
  scale: {
    sensitivity: 2.5,     // distance delta → zoom step multiplier
    deadzone: 0.008,      // normalised distance change below this → no zoom
    maxStep: 0.04,        // max zoom factor deviation per frame
    smoothing: 0.3,       // EMA alpha on the zoom output
  },

  /** Translation (globe rotation from midpoint movement) */
  translation: {
    sensitivity: 8.75,    // midpoint delta → rotation delta multiplier (increased 1.75x)
    deadzone: 0.005,      // normalised midpoint change below this → no rotation
    smoothing: 0.3,       // EMA alpha
  },

  /** Rotation (globe roll from inter-hand angle change) */
  rotation: {
    sensitivity: 3.5,     // angle delta → rotation multiplier (increased 1.75x)
    deadzone: 0.015,      // radians of angle change below this → ignore
    smoothing: 0.3,       // EMA alpha
  },

  /** Selection (double tap configuration) */
  selection: {
    doubleTapMaxInterval: 650,  // max ms between two taps
    tapPositionTolerance: 0.08, // normalised screen distance allowed between tap 1 and tap 2
    cooldown: 800,              // ms to wait after successful selection
  },

  /** Gesture confidence threshold (0-1) to activate a gesture mode */
  confidenceThreshold: 0.4,

  /** Minimum ms to hold a gesture lock before switching to a different mode */
  gestureLockDuration: 180,

  /** Dominant motion ratio: a gesture must exceed others by this factor */
  dominanceRatio: 1.6,
};

// ── Precise Hand Selection (Phase 3B) ────────────────────────────────────────
export const HAND_SELECTION_CONFIG = {
  pinch: {
    threshold: 0.4,         // Normalized pinch distance
    releaseThreshold: 0.6,  // Hysteresis release distance
    confirmationTime: 80,   // ms to confirm pinch
    cooldown: 800           // ms before another pinch can start
  },
  targeting: {
    hitRadiusPx: 25,    // Base interaction radius in screen pixels
    hysteresisPx: 20    // Extra radius applied to current locked target
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────


const EMPTY_HAND: HandState = {
  detected: false,
  handedness: 'Left',
  confidence: 0,
  landmarks: [],
  palmCenter: { x: 0, y: 0, z: 0 },
  palmDepth: 0,
};

const EMPTY_SPATIAL: TwoHandSpatial = {
  handDistance: 0,
  handAngle: 0,
  handCenter: { x: 0, y: 0 },
  handSeparation: 0,
  averageDepth: 0,
  relativeDepth: 0,
};

function computePalmCenter(lm: { x: number; y: number; z: number }[]): { x: number; y: number; z: number } {
  // Average of wrist(0), index-MCP(5), middle-MCP(9), ring-MCP(13), pinky-MCP(17)
  const ids = [0, 5, 9, 13, 17];
  let sx = 0, sy = 0, sz = 0;
  for (const i of ids) {
    sx += lm[i].x; sy += lm[i].y; sz += lm[i].z;
  }
  return { x: sx / 5, y: sy / 5, z: sz / 5 };
}

function computePalmDepth(lm: { x: number; y: number; z: number }[]): number {
  return (lm[0].z + lm[5].z + lm[9].z + lm[13].z + lm[17].z) / 5;
}

/** Skeleton connections for canvas drawing */
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],
  [10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],
  [18,19],[19,20],[0,17],
];

// ─── Per-hand mutable tracking refs ──────────────────────────────────────────
interface PerHandRefs {
  prevPalmCenter: { x: number; y: number } | null;
  prevPalmZ: number | null;
  smoothedPalm: { x: number; y: number } | null;
}

function freshHandRefs(): PerHandRefs {
  return { prevPalmCenter: null, prevPalmZ: null, smoothedPalm: null };
}

// ═════════════════════════════════════════════════════════════════════════════
// ═══ Hook ════════════════════════════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════════════════════
export function useHandGesture() {
  // ── React state (updated sparingly) ──────────────────────────────────────
  const [isEnabled, setIsEnabled] = useState(false);
  const [isPaused, setIsPaused]   = useState(false);
  const isPausedRef               = useRef(false);
  const [status, setStatus]       = useState<TrackingStatus>('disabled');
  const [gesture, setGesture]     = useState<GestureType>('none');
  const [confidence, setConfidence] = useState(0);
  const [handCount, setHandCount] = useState(0);

  // ── AI Model State ───────────────────────────────────────────────────────
  const aiModelRef = useRef<{
    classes: string[];
    layers: { weights: number[][]; biases: number[] }[];
  } | null>(null);

  // Fetch AI model on mount
  useEffect(() => {
    fetch('/model/mlp_weights.json')
      .then(res => res.json())
      .then(data => {
        aiModelRef.current = data;
        console.log("AI Gesture Model loaded successfully.");
      })
      .catch(err => console.error("Failed to load AI Gesture Model:", err));
  }, []);

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const videoRef      = useRef<HTMLVideoElement | null>(null);
  const canvasRef     = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const rafRef        = useRef<number | null>(null);
  const lastTimeRef   = useRef<number>(0);

  // ── Two-hand tracking refs (updated every frame, NO setState) ───────────
  const leftHandRef  = useRef<HandState>({ ...EMPTY_HAND, handedness: 'Left' });
  const rightHandRef = useRef<HandState>({ ...EMPTY_HAND, handedness: 'Right' });
  const spatialRef   = useRef<TwoHandSpatial>({ ...EMPTY_SPATIAL });
  const leftRefs     = useRef<PerHandRefs>(freshHandRefs());
  const rightRefs    = useRef<PerHandRefs>(freshHandRefs());

  // ── Previous stable handedness assignment (for identity stability) ──────
  const prevLeftWristX  = useRef<number | null>(null);
  const prevRightWristX = useRef<number | null>(null);

  // ── Single-hand gesture refs (driven by primary hand) ───────────────────
  const prevPalmPos      = useRef<{ x: number; y: number } | null>(null);
  const smoothedDelta    = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const zoomFactor       = useRef<number>(1.0);
  const isFistRef        = useRef<boolean>(false);
  const prevPalmZ        = useRef<number | null>(null);
  const smoothedZoomStep = useRef<number>(0);

  // ── Pinch tracking (Phase 3E pinch-to-select) ────────────────────────
  type PinchState = 'OPEN' | 'PINCHING' | 'PINCH_CONFIRMED' | 'RELEASED';
  const pinchState       = useRef<PinchState>('OPEN');
  const pinchTimestamp   = useRef<number>(0);
  const pinchCooldownEnd = useRef<number>(0);
  const wasLeftClawRef = useRef<boolean>(false);
  const hoverTargetRef = useRef<string | null>(null);
  const onClickRef     = useRef<(() => void) | null>(null);
  const onCloseRef     = useRef<(() => void) | null>(null);
  const onRecenterRef  = useRef<(() => void) | null>(null);
  const wasLeftFistRef = useRef<boolean>(false);
  const wasTwoFistRef  = useRef<boolean>(false);

  // ── Two-hand gesture engine refs ────────────────────────────────────────
  const twoHandGestureMode = useRef<TwoHandGestureMode>('none');
  const twoHandActivationTime = useRef<number>(0);          // ms when both hands first appeared
  const prevTwoHandDistance = useRef<number | null>(null);   // for scale delta
  const prevTwoHandCenter = useRef<{ x: number; y: number } | null>(null); // for translation delta
  const prevTwoHandAngle = useRef<number | null>(null);      // for rotation delta
  // Smoothed output accumulators
  const smoothedScaleStep = useRef<number>(0);
  const smoothedTransDelta = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  // ── Pointer tracking (for crosshair and hover) ─────────────────────────
  const pointerRef = useRef<{ x: number; y: number; active: boolean; isTapTracking: boolean }>({ x: 0, y: 0, active: false, isTapTracking: false });

  // ═══ Initialize MediaPipe ════════════════════════════════════════════════
  useEffect(() => {
    let isCancelled = false;

    async function initMediaPipe() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        if (isCancelled) return;

        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: TWO_HAND_TRACKING_CONFIG.maxHands,
          minHandDetectionConfidence: TWO_HAND_TRACKING_CONFIG.minDetectionConfidence,
          minHandPresenceConfidence: TWO_HAND_TRACKING_CONFIG.minPresenceConfidence,
          minTrackingConfidence: TWO_HAND_TRACKING_CONFIG.minTrackingConfidence,
        });

        if (isCancelled) { landmarker.close(); return; }

        landmarkerRef.current = landmarker;
        if (isEnabled) setStatus('ready');
      } catch (err) {
        console.warn('MediaPipe initialization warning:', err);
        if (!isCancelled) setStatus('unavailable');
      }
    }

    if (isEnabled && !landmarkerRef.current) {
      setStatus('loading');
      initMediaPipe();
    }

    return () => {
      isCancelled = true;
      if (landmarkerRef.current) { landmarkerRef.current.close(); landmarkerRef.current = null; }
    };
  }, [isEnabled]);

  // ═══ Camera Stream ═══════════════════════════════════════════════════════
  useEffect(() => {
    if (!isEnabled) {
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      setTimeout(() => {
        setStatus('disabled');
        setGesture('none');
        setConfidence(0);
        setHandCount(0);
      }, 0);
      // Reset all tracking state
      leftHandRef.current  = { ...EMPTY_HAND, handedness: 'Left' };
      rightHandRef.current = { ...EMPTY_HAND, handedness: 'Right' };
      spatialRef.current   = { ...EMPTY_SPATIAL };
      leftRefs.current     = freshHandRefs();
      rightRefs.current    = freshHandRefs();
      prevLeftWristX.current = null;
      prevRightWristX.current = null;
      prevPalmPos.current   = null;
      smoothedDelta.current = { dx: 0, dy: 0 };
      zoomFactor.current    = 1.0;
      prevPalmZ.current     = null;
      smoothedZoomStep.current = 0;
      pinchState.current       = 'OPEN';
      pinchCooldownEnd.current = 0;
      pointerRef.current.isTapTracking = false;
      // Reset two-hand gesture state
      twoHandGestureMode.current = 'none';
      twoHandActivationTime.current = 0;
      prevTwoHandDistance.current = null;
      prevTwoHandCenter.current = null;
      prevTwoHandAngle.current = null;
      smoothedScaleStep.current = 0;
      smoothedTransDelta.current = { dx: 0, dy: 0 };
      pointerRef.current.active = false;
      return;
    }

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 24, max: 30 }, facingMode: 'user' },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); setStatus('tracking'); }
      } catch {
        setStatus('permission_denied');
        setIsEnabled(false);
      }
    }
    startCamera();

    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isEnabled]);

  // ═══ Main Tracking Loop ══════════════════════════════════════════════════
  useEffect(() => {
    if (!isEnabled || status !== 'tracking') return;
    const FRAME_INTERVAL = 1000 / 25;

    // ── AI Gesture Predictor ────────────────────────────────────────────────
    const predictGestureWithAI = (landmarks: { x: number; y: number; z: number }[]): string => {
      const model = aiModelRef.current;
      if (!model || landmarks.length !== 21) return 'none';
      
      const wrist = landmarks[0];
      let input = [];
      for (let i = 0; i < 21; i++) {
        input.push(landmarks[i].x - wrist.x);
        input.push(landmarks[i].y - wrist.y);
        input.push(landmarks[i].z - wrist.z);
      }
      
      for (let i = 0; i < model.layers.length; i++) {
        const layer = model.layers[i];
        const output = new Array(layer.biases.length).fill(0);
        
        for (let j = 0; j < layer.biases.length; j++) {
          let sum = layer.biases[j];
          for (let k = 0; k < input.length; k++) {
            sum += input[k] * layer.weights[k][j];
          }
          if (i < model.layers.length - 1) {
            output[j] = Math.max(0, sum);
          } else {
            output[j] = sum;
          }
        }
        input = output;
      }
      
      let maxIdx = 0;
      let maxVal = input[0];
      for (let i = 1; i < input.length; i++) {
        if (input[i] > maxVal) {
          maxVal = input[i];
          maxIdx = i;
        }
      }
      
      return model.classes[maxIdx];
    };

    function processFrame(now: number) {
      rafRef.current = requestAnimationFrame(processFrame);
      if (now - lastTimeRef.current < FRAME_INTERVAL) return;
      lastTimeRef.current = now;

      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      const canvas = canvasRef.current;
      if (!video || !landmarker || video.readyState < 2) return;

      try {
        const results = landmarker.detectForVideo(video, now);
        const ctx = canvas?.getContext('2d');

        // Draw camera feed (mirrored)
        if (ctx && canvas) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.save();
          ctx.scale(-1, 1);
          ctx.translate(-canvas.width, 0);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          ctx.restore();
        }

        const numDetected = isPausedRef.current ? 0 : (results.landmarks?.length ?? 0);

        // ────────────────────────────────────────────────────────────────
        // Phase 1: Classify each detected hand as Left or Right
        // ────────────────────────────────────────────────────────────────
        let leftLandmarks: { x: number; y: number; z: number }[] | null = null;
        let rightLandmarks: { x: number; y: number; z: number }[] | null = null;
        let leftScore = 0;
        let rightScore = 0;

        for (let i = 0; i < numDetected; i++) {
          const lm = results.landmarks[i];
          const handednessArr = results.handedness?.[i];
          if (!lm || lm.length < 21) continue;

          // Determine handedness from classification
          let label: Handedness = 'Right'; // default
          let score = 0.5;
          if (handednessArr && handednessArr.length > 0) {
            const cat = handednessArr[0];
            score = cat.score ?? 0.5;
            // MediaPipe reports mirrored handedness for selfie cam:
            // "Left" from MediaPipe = user's right hand when facing camera
            // We use MediaPipe's raw label directly since the video is already mirrored
            label = (cat.categoryName === 'Left' ? 'Left' : 'Right') as Handedness;
          }

          if (score < TWO_HAND_TRACKING_CONFIG.minHandednessConfidence) {
            // Ambiguous: use spatial continuity to assign
            const wristX = lm[0].x;
            if (prevLeftWristX.current !== null && prevRightWristX.current !== null) {
              const dLeft = Math.abs(wristX - prevLeftWristX.current);
              const dRight = Math.abs(wristX - prevRightWristX.current);
              label = dLeft < dRight ? 'Left' : 'Right';
            }
          }

          if (label === 'Left') {
            if (!leftLandmarks || score > leftScore) { leftLandmarks = lm; leftScore = score; }
          } else {
            if (!rightLandmarks || score > rightScore) { rightLandmarks = lm; rightScore = score; }
          }
        }

        // If both classified as the same hand, split by wrist X position
        if (numDetected === 2 && leftLandmarks && !rightLandmarks) {
          // Both classified left — give the rightmost to right
          const other = results.landmarks[leftLandmarks === results.landmarks[0] ? 1 : 0];
          if (other && other.length >= 21) {
            if (other[0].x > leftLandmarks[0].x) {
              rightLandmarks = other; rightScore = 0.5;
            } else {
              rightLandmarks = leftLandmarks; rightScore = leftScore;
              leftLandmarks = other; leftScore = 0.5;
            }
          }
        } else if (numDetected === 2 && rightLandmarks && !leftLandmarks) {
          const other = results.landmarks[rightLandmarks === results.landmarks[0] ? 1 : 0];
          if (other && other.length >= 21) {
            if (other[0].x < rightLandmarks[0].x) {
              leftLandmarks = other; leftScore = 0.5;
            } else {
              leftLandmarks = rightLandmarks; leftScore = rightScore;
              rightLandmarks = other; rightScore = 0.5;
            }
          }
        }

        // ────────────────────────────────────────────────────────────────
        // Phase 2: Build HandState for each hand
        // ────────────────────────────────────────────────────────────────
        const buildHandState = (
          lm: { x: number; y: number; z: number }[] | null,
          side: Handedness,
          score: number,
          refs: PerHandRefs,
        ): HandState => {
          if (!lm || lm.length < 21) {
            // Lost this hand — reset per-hand refs
            refs.prevPalmCenter = null;
            refs.prevPalmZ = null;
            refs.smoothedPalm = null;
            return { ...EMPTY_HAND, handedness: side };
          }

          const rawPalm = computePalmCenter(lm);
          const depth = computePalmDepth(lm);

          // Smooth palm centre XY
          let smoothed: { x: number; y: number };
          if (refs.smoothedPalm) {
            const a = TWO_HAND_TRACKING_CONFIG.palmSmoothing;
            smoothed = {
              x: refs.smoothedPalm.x + (rawPalm.x - refs.smoothedPalm.x) * a,
              y: refs.smoothedPalm.y + (rawPalm.y - refs.smoothedPalm.y) * a,
            };
          } else {
            smoothed = { x: rawPalm.x, y: rawPalm.y };
          }
          refs.smoothedPalm = smoothed;

          return {
            detected: true,
            handedness: side,
            confidence: Math.round(score * 100),
            landmarks: lm,
            palmCenter: { x: smoothed.x, y: smoothed.y, z: rawPalm.z },
            palmDepth: depth,
          };
        };

        const leftState = buildHandState(leftLandmarks, 'Left', leftScore, leftRefs.current);
        const rightState = buildHandState(rightLandmarks, 'Right', rightScore, rightRefs.current);

        leftHandRef.current = leftState;
        rightHandRef.current = rightState;

        // Save wrist positions for identity stability on next frame
        if (leftState.detected && leftLandmarks) prevLeftWristX.current = leftLandmarks[0].x;
        else prevLeftWristX.current = null;
        if (rightState.detected && rightLandmarks) prevRightWristX.current = rightLandmarks[0].x;
        else prevRightWristX.current = null;

        // ────────────────────────────────────────────────────────────────
        // Phase 4: Canvas overlay — draw skeleton(s) for all detected hands
        // ────────────────────────────────────────────────────────────────
        if (ctx && canvas) {
          ctx.save();
          // Mirror the context so the skeleton aligns with the mirrored camera feed
          ctx.scale(-1, 1);
          ctx.translate(-canvas.width, 0);
          
          const handColors: [string, string][] = [['#22d3ee', 'rgba(34,211,238,0.7)'], ['#f97316', 'rgba(249,115,22,0.7)']];
          const allHands = [leftLandmarks, rightLandmarks];
          allHands.forEach((lm, hi) => {
            if (!lm) return;
            const [fill, stroke] = handColors[hi];
            ctx.fillStyle = fill;
            ctx.strokeStyle = stroke;
            ctx.lineWidth = 1.5;
            HAND_CONNECTIONS.forEach(([a, b]) => {
              if (lm[a] && lm[b]) {
                ctx.beginPath();
                ctx.moveTo(lm[a].x * canvas.width, lm[a].y * canvas.height);
                ctx.lineTo(lm[b].x * canvas.width, lm[b].y * canvas.height);
                ctx.stroke();
              }
            });
            lm.forEach((p) => {
              ctx.beginPath();
              ctx.arc(p.x * canvas.width, p.y * canvas.height, 2, 0, Math.PI * 2);
              ctx.fill();
            });
          });
          ctx.restore();
        }

        // ────────────────────────────────────────────────────────────────
        // Phase 5: AI Gesture Evaluation & Action Mapping
        // ────────────────────────────────────────────────────────────────
        const leftAIGesture = leftState.detected ? predictGestureWithAI(leftState.landmarks) : 'none';
        const rightAIGesture = rightState.detected ? predictGestureWithAI(rightState.landmarks) : 'none';

        if (leftState.detected) setConfidence(leftState.confidence);
        if (rightState.detected) setConfidence(rightState.confidence);
        if (leftState.detected && rightState.detected) {
           setConfidence(Math.round((leftState.confidence + rightState.confidence) / 2));
        }

        // 1. Both Hands Fist -> Recenter Points
        const isTwoFist = leftAIGesture === 'fist' && rightAIGesture === 'fist';
        if (now > pinchCooldownEnd.current) {
          if (isTwoFist && !wasTwoFistRef.current) {
            if (onRecenterRef.current) onRecenterRef.current();
            pinchCooldownEnd.current = now + 1000;
          }
          wasTwoFistRef.current = isTwoFist;
        }

        // 2. Left Hand Fist -> Close Selected Item
        const isLeftFist = leftAIGesture === 'fist' && !isTwoFist;
        if (now > pinchCooldownEnd.current) {
          if (isLeftFist && !wasLeftFistRef.current) {
            if (onCloseRef.current) onCloseRef.current();
            pinchCooldownEnd.current = now + 1000;
          }
          wasLeftFistRef.current = isLeftFist;
        }

        // 3. Left Hand Short Pinch -> Select (Click)
        const isLeftPinch = leftAIGesture === 'pinch';
        if (now > pinchCooldownEnd.current) {
          if (isLeftPinch && !wasLeftClawRef.current) {
            // Started pinch
            pinchTimestamp.current = now;
          } else if (!isLeftPinch && wasLeftClawRef.current) {
            // Released pinch
            const duration = now - pinchTimestamp.current;
            if (duration < 400 && duration > 20) {
               if (onClickRef.current) onClickRef.current();
               pinchCooldownEnd.current = now + 500;
               setGesture('tap');
            }
          }
          wasLeftClawRef.current = isLeftPinch;
        }

        // 4. Right Hand Pinch -> Move Cursor
        const isRightPinch = rightAIGesture === 'pinch';
        if (rightState.detected && isRightPinch) {
          const indexTip = rightState.landmarks[8];
          const targetX = 1.0 - indexTip.x;
          const targetY = indexTip.y;
          
          if (!pointerRef.current.active) {
            pointerRef.current = { x: targetX, y: targetY, active: true, isTapTracking: pointerRef.current.isTapTracking };
          } else {
            pointerRef.current.x += (targetX - pointerRef.current.x) * 0.4;
            pointerRef.current.y += (targetY - pointerRef.current.y) * 0.4;
          }
        } else if (!rightState.detected) {
          pointerRef.current.active = false;
        }
        pointerRef.current.isTapTracking = isLeftPinch;

        // 5. Right Hand Fist -> Free Rotate Globe
        const isRightFist = rightAIGesture === 'fist' && !isTwoFist;
        if (rightState.detected && isRightFist) {
           const palmCtr = rightState.landmarks[9];
           const targetX = 1.0 - palmCtr.x;
           const targetY = palmCtr.y;

           if (prevPalmPos.current) {
              let rawDx = targetX - prevPalmPos.current.x;
              let rawDy = targetY - prevPalmPos.current.y;
              if (Math.abs(rawDx) < HAND_GESTURE_CONFIG.rotationDeadzone) rawDx = 0;
              if (Math.abs(rawDy) < HAND_GESTURE_CONFIG.rotationDeadzone) rawDy = 0;

              smoothedDelta.current.dx += (rawDx * HAND_GESTURE_CONFIG.rotationSensitivity - smoothedDelta.current.dx) * HAND_GESTURE_CONFIG.rotationSmoothing;
              smoothedDelta.current.dy += (rawDy * HAND_GESTURE_CONFIG.rotationSensitivity - smoothedDelta.current.dy) * HAND_GESTURE_CONFIG.rotationSmoothing;
              setGesture('drag');
           } else {
              smoothedDelta.current = { dx: 0, dy: 0 };
           }
           prevPalmPos.current = { x: targetX, y: targetY };
        } else {
           prevPalmPos.current = null;
           smoothedDelta.current.dx *= 0.7;
           smoothedDelta.current.dy *= 0.7;
        }

        // 6. Both Hands Pinch -> Zoom In/Out
        const isTwoPinch = leftAIGesture === 'pinch' && rightAIGesture === 'pinch';
        if (isTwoPinch && leftState.detected && rightState.detected) {
           const lp = leftState.palmCenter;
           const rp = rightState.palmCenter;
           const currentDistance = Math.hypot(lp.x - rp.x, lp.y - rp.y);

           if (prevTwoHandDistance.current !== null) {
              const distDelta = currentDistance - prevTwoHandDistance.current;
              const cfg = TWO_HAND_GESTURE_CONFIG.scale;
              if (Math.abs(distDelta) > cfg.deadzone) {
                 const rawStep = -distDelta * cfg.sensitivity;
                 const clamped = Math.max(-cfg.maxStep, Math.min(cfg.maxStep, rawStep));
                 smoothedScaleStep.current += (clamped - smoothedScaleStep.current) * cfg.smoothing;
              } else {
                 smoothedScaleStep.current *= (1 - cfg.smoothing);
              }
              if (Math.abs(smoothedScaleStep.current) < 0.0005) smoothedScaleStep.current = 0;
              zoomFactor.current = 1.0 + smoothedScaleStep.current;
              setGesture('pinch');
           }
           prevTwoHandDistance.current = currentDistance;
        } else {
           prevTwoHandDistance.current = null;
           smoothedScaleStep.current *= 0.7;
           if (Math.abs(smoothedScaleStep.current) < 0.0005) smoothedScaleStep.current = 0;
           zoomFactor.current = 1.0 + smoothedScaleStep.current;
        }

        if (!leftState.detected && !rightState.detected) {
          // No hands
          if (ctx && canvas) ctx.restore();
          setConfidence(0);
          setGesture('none');
          prevPalmPos.current = null;
          smoothedDelta.current = { dx: 0, dy: 0 };
          zoomFactor.current = 1.0;
          prevPalmZ.current = null;
          smoothedZoomStep.current = 0;
          prevPalmZ.current = null;
          pinchState.current = 'OPEN';
          isFistRef.current = false;
          // Reset two-hand gesture state
          twoHandGestureMode.current = 'none';
          prevTwoHandDistance.current = null;
          prevTwoHandCenter.current = null;
          prevTwoHandAngle.current = null;
          smoothedScaleStep.current = 0;
          smoothedTransDelta.current = { dx: 0, dy: 0 };
          pointerRef.current.active = false;
        }

      } catch (err) {
        console.warn('Tracking tick error:', err);
      }
    }

    rafRef.current = requestAnimationFrame(processFrame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isEnabled, status, handCount]);

  // ═══ Public API ══════════════════════════════════════════════════════════
  const toggleEnabled = useCallback(() => {
    setIsEnabled((prev) => {
      if (!prev) {
        setIsPaused(false);
        isPausedRef.current = false;
        return true;
      }
      const nextPaused = !isPausedRef.current;
      isPausedRef.current = nextPaused;
      setIsPaused(nextPaused);
      return true;
    });
  }, []);

  const onClickEvent = useCallback((cb: () => void) => {
    onClickRef.current = cb;
  }, []);

  const onCloseEvent = useCallback((cb: () => void) => {
    onCloseRef.current = cb;
  }, []);

  const onRecenterEvent = useCallback((cb: () => void) => {
    onRecenterRef.current = cb;
  }, []);

  return {
    isEnabled: isEnabled && !isPaused,
    toggleEnabled,
    status: isPaused ? 'disabled' : status,
    gesture,
    confidence,
    videoRef,
    canvasRef,
    deltaRot: smoothedDelta,
    zoomFactor,
    isFistRef,
    onClickEvent,
    onCloseEvent,
    onRecenterEvent,

    // Two-hand tracking foundation
    handCount,
    leftHand: leftHandRef,
    rightHand: rightHandRef,
    twoHandSpatial: spatialRef,

    // Pointer for crosshair
    pointerRef,
    hoverTargetRef,

    // Two-hand gesture engine
    twoHandGestureMode,
  };
}
