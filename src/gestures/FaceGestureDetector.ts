import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { BlowFeatures } from './gestureTypes';

export class FaceGestureDetector {
  private landmarker: FaceLandmarker | null = null;
  private initialized = false;
  private initializing = false;
  private lastProcessTime = 0;
  private readonly frameInterval: number;
  private baseline: BlowFeatures | null = null;
  private calibrationFrames: BlowFeatures[] = [];
  private isCalibrating = false;

  onFeaturesUpdate: ((features: BlowFeatures, confidence: number) => void) | null = null;
  onFaceDetected: ((detected: boolean) => void) | null = null;
  onError: ((error: string) => void) | null = null;

  constructor(targetFps = 18) {
    this.frameInterval = 1000 / targetFps;
  }

  get isReady(): boolean {
    return this.initialized && this.landmarker !== null;
  }

  async initialize(): Promise<boolean> {
    if (this.initialized || this.initializing) return this.initialized;
    this.initializing = true;

    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      this.landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
      });

      this.initialized = true;
      this.initializing = false;
      return true;
    } catch (err) {
      console.warn('Face Landmarker initialization failed:', err);
      this.initializing = false;
      this.onError?.('Face gesture control unavailable');
      return false;
    }
  }

  startCalibration(): void {
    this.calibrationFrames = [];
    this.isCalibrating = true;
    this.baseline = null;
  }

  private finishCalibration(): void {
    if (this.calibrationFrames.length < 5) {
      this.isCalibrating = false;
      return;
    }

    const avg: BlowFeatures = {
      mouthOpen: 0, mouthWidth: 0, mouthHeight: 0,
      lipPurse: 0, leftCheekExpansion: 0, rightCheekExpansion: 0,
    };

    for (const f of this.calibrationFrames) {
      avg.mouthOpen += f.mouthOpen;
      avg.mouthWidth += f.mouthWidth;
      avg.mouthHeight += f.mouthHeight;
      avg.lipPurse += f.lipPurse;
      avg.leftCheekExpansion += f.leftCheekExpansion;
      avg.rightCheekExpansion += f.rightCheekExpansion;
    }

    const n = this.calibrationFrames.length;
    avg.mouthOpen /= n;
    avg.mouthWidth /= n;
    avg.mouthHeight /= n;
    avg.lipPurse /= n;
    avg.leftCheekExpansion /= n;
    avg.rightCheekExpansion /= n;

    this.baseline = avg;
    this.isCalibrating = false;
  }

  processFrame(video: HTMLVideoElement, timestamp: number): void {
    if (!this.landmarker || !this.initialized) return;
    if (timestamp - this.lastProcessTime < this.frameInterval) return;
    if (video.readyState < 2) return;

    this.lastProcessTime = timestamp;

    try {
      const results = this.landmarker.detectForVideo(video, timestamp);

      if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
        this.onFaceDetected?.(false);
        return;
      }

      this.onFaceDetected?.(true);

      const landmarks = results.faceLandmarks[0];
      const blendshapes = results.faceBlendshapes?.[0]?.categories;

      const features = this.extractFeatures(landmarks, blendshapes);
      const confidence = this.computeTrackingConfidence(results);

      if (this.isCalibrating) {
        this.calibrationFrames.push(features);
        if (this.calibrationFrames.length >= 15) {
          this.finishCalibration();
        }
        return;
      }

      const normalizedFeatures = this.baseline
        ? this.normalizeAgainstBaseline(features)
        : features;

      this.onFeaturesUpdate?.(normalizedFeatures, confidence);
    } catch (err) {
      // Silently skip frame errors
    }
  }

  private extractFeatures(
    landmarks: Array<{ x: number; y: number; z: number }>,
    blendshapes: Array<{ categoryName: string; score: number }> | undefined
  ): BlowFeatures {
    // Face width for normalization (ear-to-ear approximation using landmarks 234, 454)
    const faceWidth = Math.hypot(
      landmarks[234].x - landmarks[454].x,
      landmarks[234].y - landmarks[454].y
    );

    // Mouth landmarks:
    // 13: upper lip top center, 14: lower lip bottom center
    // 78: right mouth corner, 308: left mouth corner
    // 82: upper lip inner top, 87: upper lip inner bottom (near center)
    // 312: lower lip inner top, 317: lower lip inner bottom
    const upperLip = landmarks[13];
    const lowerLip = landmarks[14];
    const mouthLeft = landmarks[308];
    const mouthRight = landmarks[78];

    const rawMouthHeight = Math.hypot(
      upperLip.x - lowerLip.x,
      upperLip.y - lowerLip.y
    );
    const rawMouthWidth = Math.hypot(
      mouthLeft.x - mouthRight.x,
      mouthLeft.y - mouthRight.y
    );

    const mouthHeight = rawMouthHeight / faceWidth;
    const mouthWidth = rawMouthWidth / faceWidth;
    const mouthOpen = mouthHeight / Math.max(mouthWidth, 0.001);
    const lipPurse = 1.0 - Math.min(mouthWidth / 0.35, 1.0);

    // Cheek expansion via blendshapes if available
    let leftCheekExpansion = 0;
    let rightCheekExpansion = 0;

    if (blendshapes) {
      const cheekPuffLeft = blendshapes.find(b => b.categoryName === 'cheekPuff')?.score ?? 0;
      const cheekPuffRight = cheekPuffLeft; // MediaPipe uses single cheekPuff
      const jawOpen = blendshapes.find(b => b.categoryName === 'jawOpen')?.score ?? 0;
      const mouthPucker = blendshapes.find(b => b.categoryName === 'mouthPucker')?.score ?? 0;
      const mouthFunnel = blendshapes.find(b => b.categoryName === 'mouthFunnel')?.score ?? 0;

      leftCheekExpansion = Math.min(1, cheekPuffLeft + mouthPucker * 0.3 + mouthFunnel * 0.2);
      rightCheekExpansion = Math.min(1, cheekPuffRight + mouthPucker * 0.3 + mouthFunnel * 0.2);

      // Enhance lipPurse with blendshape data
      const purseFactor = (mouthPucker + mouthFunnel) * 0.5;
      return {
        mouthOpen: Math.min(1, mouthOpen * 2.5 - jawOpen * 0.3),
        mouthWidth,
        mouthHeight,
        lipPurse: Math.min(1, lipPurse + purseFactor * 0.5),
        leftCheekExpansion,
        rightCheekExpansion,
      };
    }

    // Fallback: estimate cheek expansion from landmark geometry
    // Cheek landmarks: 123 (left cheek outer), 352 (right cheek outer)
    // Nose tip: 1
    const nose = landmarks[1];
    const leftCheek = landmarks[123];
    const rightCheek = landmarks[352];

    const leftCheekDist = Math.hypot(leftCheek.x - nose.x, leftCheek.y - nose.y) / faceWidth;
    const rightCheekDist = Math.hypot(rightCheek.x - nose.x, rightCheek.y - nose.y) / faceWidth;

    leftCheekExpansion = Math.min(1, Math.max(0, (leftCheekDist - 0.2) * 3));
    rightCheekExpansion = Math.min(1, Math.max(0, (rightCheekDist - 0.2) * 3));

    return {
      mouthOpen: Math.min(1, mouthOpen * 2.5),
      mouthWidth,
      mouthHeight,
      lipPurse,
      leftCheekExpansion,
      rightCheekExpansion,
    };
  }

  private normalizeAgainstBaseline(features: BlowFeatures): BlowFeatures {
    if (!this.baseline) return features;
    return {
      mouthOpen: Math.max(0, features.mouthOpen - this.baseline.mouthOpen * 0.5),
      mouthWidth: features.mouthWidth,
      mouthHeight: features.mouthHeight,
      lipPurse: Math.max(0, features.lipPurse - this.baseline.lipPurse * 0.3),
      leftCheekExpansion: Math.max(0, features.leftCheekExpansion - this.baseline.leftCheekExpansion * 0.5),
      rightCheekExpansion: Math.max(0, features.rightCheekExpansion - this.baseline.rightCheekExpansion * 0.5),
    };
  }

  private computeTrackingConfidence(results: any): number {
    if (results.faceBlendshapes?.[0]?.categories) {
      return 0.95;
    }
    return results.faceLandmarks?.[0] ? 0.8 : 0;
  }

  destroy(): void {
    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
    }
    this.initialized = false;
  }
}
