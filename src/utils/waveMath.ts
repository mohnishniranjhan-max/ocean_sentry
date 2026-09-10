import * as THREE from 'three';

export interface WaveParams {
  amplitude: number;
  choppiness: number;
  frequency: number;
  direction: THREE.Vector2;
  deepColor: THREE.Color;
  shallowColor: THREE.Color;
}

/**
 * Computes deterministic wave parameters based on ocean data.
 */
export function computeWaveParams(
  waveHeight: number,
  modelWaveHeight: number,
  currentSpeed: number,
  temperature: number
): WaveParams {
  // Drastically scale up amplitude so waves are visually obvious and roll realistically
  const amplitude = Math.max(0.5, waveHeight * 2.5);
  
  const deviation = Math.abs(waveHeight - modelWaveHeight);
  const choppiness = Math.min(1.0, 0.6 + deviation * 0.4);
  const frequency = Math.max(0.2, 0.8 - waveHeight * 0.05);
  
  const angle = currentSpeed * 0.5;
  const direction = new THREE.Vector2(Math.cos(angle), Math.sin(angle)).normalize();
  
  const tempNorm = Math.max(0, Math.min(1, (temperature - 15) / 20));
  const deepColor = new THREE.Color().setHSL(0.55 - tempNorm * 0.05, 0.7, 0.08);
  const shallowColor = new THREE.Color().setHSL(0.5 - tempNorm * 0.03, 0.6, 0.25 + tempNorm * 0.05);

  return { amplitude, choppiness, frequency, direction, deepColor, shallowColor };
}

/**
 * Replicates the Gerstner wave displacement from the WaveSurface GLSL vertex shader.
 * Ensures that JS-calculated heights (for buoys) precisely match the visual GPU mesh.
 */
function gerstnerWave(
  pos: THREE.Vector2,
  amp: number,
  freq: number,
  dir: THREE.Vector2,
  phase: number,
  steep: number,
  target: THREE.Vector3
) {
  const d = dir.dot(pos);
  const s = Math.sin(d * freq - phase);
  const c = Math.cos(d * freq - phase);

  target.x += steep * amp * dir.x * c;
  target.z += steep * amp * dir.y * c;
  target.y += amp * s;
}

function rotateVec2(v: THREE.Vector2, angle: number): THREE.Vector2 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new THREE.Vector2(v.x * c - v.y * s, v.x * s + v.y * c);
}

/**
 * Calculates the exact 3D displacement (x, y, z offset) at a given (x, z) coordinate.
 */
export function getWaveDisplacement(
  x: number,
  z: number,
  t: number,
  params: WaveParams,
  target: THREE.Vector3 = new THREE.Vector3()
): THREE.Vector3 {
  target.set(0, 0, 0);

  const pos = new THREE.Vector2(x, z);
  const { amplitude: amp, frequency: freq, choppiness: steep, direction: dir } = params;

  const d1 = dir;
  const d2 = rotateVec2(dir, 0.5);
  const d3 = rotateVec2(dir, -0.7);
  const d4 = rotateVec2(dir, 1.2);

  gerstnerWave(pos, amp, freq, d1, t * 1.2, steep, target);
  gerstnerWave(pos, amp * 0.45, freq * 1.7, d2, t * 1.5, steep * 0.8, target);
  gerstnerWave(pos, amp * 0.3, freq * 2.3, d3, t * 1.8, steep * 0.6, target);
  gerstnerWave(pos, amp * 0.15, freq * 4.1, d4, t * 2.5, steep * 0.3, target);

  return target;
}

/**
 * Calculates the normal vector via finite differences, exactly like the shader.
 */
export function getWaveNormal(
  x: number,
  z: number,
  t: number,
  params: WaveParams,
  target: THREE.Vector3 = new THREE.Vector3()
): THREE.Vector3 {
  const eps = 0.1;
  
  const basePos = new THREE.Vector3(x, 0, z);
  const displacedBase = getWaveDisplacement(x, z, t, params);
  const p0 = basePos.clone().add(displacedBase);

  // px
  const pX = new THREE.Vector3(x + eps, 0, z);
  const dX = getWaveDisplacement(x + eps, z, t, params);
  pX.add(dX);

  // pz
  const pZ = new THREE.Vector3(x, 0, z + eps);
  const dZ = getWaveDisplacement(x, z + eps, t, params);
  pZ.add(dZ);

  // pX - p0
  const v1 = pX.sub(p0);
  // pZ - p0
  const v2 = pZ.sub(p0);

  target.crossVectors(v2, v1).normalize();
  return target;
}
