import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { DepthLevel } from '../../../types/ocean';

// ── Cinematic Underwater God Rays ───────────────────────────────────────────

const rayVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const rayFrag = /* glsl */ `
uniform float uTime;
uniform float uIntensity;
varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  // Attenuation: fade out as depth increases below -22m and fade near surface
  float depthFade = smoothstep(-24.0, -1.0, vWorldPos.y) * smoothstep(1.0, -0.2, vWorldPos.y);
  
  // Soft beam edges along width
  float beam = sin(vUv.x * 3.14159);
  
  // Shimmering caustic wave bands
  float wave = sin(vWorldPos.x * 0.4 + uTime * 0.7) * cos(vWorldPos.z * 0.4 + uTime * 0.5);
  
  float alpha = beam * depthFade * (0.6 + wave * 0.4) * uIntensity * 0.065;
  
  vec3 rayColor = mix(vec3(0.2, 0.7, 0.95), vec3(0.85, 0.95, 1.0), depthFade);
  gl_FragColor = vec4(rayColor, alpha);
}
`;

function SunBeams({ depth }: { depth: DepthLevel }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const { camera } = useThree();

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uIntensity: { value: 1.0 },
  }), []);

  // Geometry: 12 soft angled sun shaft planes
  const beamGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const verts: number[] = [];
    const uvs: number[] = [];
    const count = 12;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const widthTop = 1.8;
      const widthBottom = 6.5;

      const cx1 = Math.cos(angle) * 3.0;
      const cz1 = Math.sin(angle) * 3.0;
      const cx2 = Math.cos(angle) * 16.0;
      const cz2 = Math.sin(angle) * 16.0;

      const dx1 = -Math.sin(angle) * (widthTop * 0.5);
      const dz1 = Math.cos(angle) * (widthTop * 0.5);
      const dx2 = -Math.sin(angle) * (widthBottom * 0.5);
      const dz2 = Math.cos(angle) * (widthBottom * 0.5);

      // Quad: (p1, p2, p3) and (p3, p2, p4)
      const p1 = [cx1 - dx1, 0, cz1 - dz1];
      const p2 = [cx2 - dx2, -24, cz2 - dz2];
      const p3 = [cx1 + dx1, 0, cz1 + dz1];
      const p4 = [cx2 + dx2, -24, cz2 + dz2];

      verts.push(
        p1[0], p1[1], p1[2],
        p2[0], p2[1], p2[2],
        p3[0], p3[1], p3[2],

        p3[0], p3[1], p3[2],
        p2[0], p2[1], p2[2],
        p4[0], p4[1], p4[2]
      );

      uvs.push(
        0, 0,
        0, 1,
        1, 0,

        1, 0,
        0, 1,
        1, 1
      );
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    return geo;
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const camY = camera.position.y;

    uniforms.uTime.value = t;

    const intensity = Math.max(0, Math.min(1, (camY + 28) / 25)) * (camY < 0.5 ? 1 : 0);
    uniforms.uIntensity.value = intensity;

    if (meshRef.current) {
      meshRef.current.visible = intensity > 0.01;
    }
  });

  return (
    <mesh ref={meshRef} geometry={beamGeo}>
      <shaderMaterial
        vertexShader={rayVert}
        fragmentShader={rayFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ── Rising Underwater Bubbles ───────────────────────────────────────────────

function BubbleColumns() {
  const pointsRef = useRef<THREE.Points>(null!);
  const count = 100;

  const { posArray, speeds, offsets } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sp = new Float32Array(count);
    const off = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 18.0;
      pos[i * 3 + 1] = -Math.random() * 22.0;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 18.0;

      off[i * 3 + 0] = pos[i * 3 + 0];
      off[i * 3 + 1] = pos[i * 3 + 1];
      off[i * 3 + 2] = pos[i * 3 + 2];

      sp[i] = 0.6 + Math.random() * 1.2;
    }
    return { posArray: pos, speeds: sp, offsets: off };
  }, []);

  const bubbleGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    return geo;
  }, [posArray]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const t = state.clock.elapsedTime;
    const pos = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;

    for (let i = 0; i < count; i++) {
      let y = offsets[i * 3 + 1] + t * speeds[i];
      y = ((y % 22) + 22) % 22 - 22;

      const x = offsets[i * 3 + 0] + Math.sin(t * 2.8 + i) * 0.12;
      const z = offsets[i * 3 + 2] + Math.cos(t * 2.2 + i) * 0.12;

      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={bubbleGeo}>
      <pointsMaterial
        color="#bae6fd"
        size={0.07}
        transparent
        opacity={0.5}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ── Master Component ────────────────────────────────────────────────────────

export function VolumetricSunRays({ depth }: { depth: DepthLevel }) {
  return (
    <group>
      <SunBeams depth={depth} />
      <BubbleColumns />
    </group>
  );
}
