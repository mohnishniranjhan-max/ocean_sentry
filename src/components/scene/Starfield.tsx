import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const starVertexShader = `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;

  uniform float uTime;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;
    
    // Subtle, realistic cosmic twinkle
    float twinkle = sin(uTime * 1.5 + aPhase) * 0.25 + 0.75;
    vAlpha = twinkle;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // Point size with distance attenuation
    gl_PointSize = aSize * (160.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const starFragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Crisp circular point star with soft glowing core
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);

    if (dist > 0.5) {
      discard;
    }

    // Soft Gaussian-like pinprick falloff
    float intensity = exp(-dist * dist * 12.0);
    gl_FragColor = vec4(vColor, intensity * vAlpha);
  }
`;

export function Starfield({ count = 3200 }: { count?: number }) {
  const pointsRef = useRef<THREE.Points>(null!);

  const { positions, colors, sizes, phases } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    const ph = new Float32Array(count);

    // Realistic star color spectrum palette
    const colorPalette = [
      new THREE.Color(1.0, 1.0, 1.0),       // Pure diamond white
      new THREE.Color(0.85, 0.92, 1.0),     // Ice blue (Class O/B)
      new THREE.Color(1.0, 0.95, 0.85),     // Warm yellow-white (Class F/G)
      new THREE.Color(1.0, 0.88, 0.80),     // Amber star (Class K)
      new THREE.Color(0.78, 0.88, 1.0),     // Pale celestial cyan
    ];

    for (let i = 0; i < count; i++) {
      // Distribute evenly across a celestial sphere at radius 60 to 180
      const radius = 60 + Math.random() * 120;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = radius * Math.cos(phi);

      // Tiny, sharp pinprick sizes (1.2 to 2.4 px)
      sz[i] = 1.0 + Math.random() * 1.4;
      // Occasional bright landmark star
      if (Math.random() < 0.04) {
        sz[i] = 2.6 + Math.random() * 0.8;
      }

      // Random phase for independent twinkling
      ph[i] = Math.random() * Math.PI * 2;

      // Select natural astronomical color
      const c = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }

    return { positions: pos, colors: col, sizes: sz, phases: ph };
  }, [count]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
  }), []);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    uniforms.uTime.value = state.clock.elapsedTime;
    // Ultra-slow cosmic rotation for living background
    pointsRef.current.rotation.y += delta * 0.0006;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-aColor"
          args={[colors, 3]}
        />
        <bufferAttribute
          attach="attributes-aSize"
          args={[sizes, 1]}
        />
        <bufferAttribute
          attach="attributes-aPhase"
          args={[phases, 1]}
        />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={starVertexShader}
        fragmentShader={starFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
