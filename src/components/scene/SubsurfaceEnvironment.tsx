import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { DepthLevel } from '../../types/ocean';

// ── Props ────────────────────────────────────────────────────────────────────

interface SubsurfaceEnvironmentProps {
  depth: DepthLevel;
  visible: boolean;
}

// ── Depth-normalized helpers ─────────────────────────────────────────────────

const DEPTH_LEVELS: DepthLevel[] = [0, 10, 50, 100, 500, 1000];

/** Returns 0..1 representing relative depth (0 = surface, 1 = 1000m) */
function depthFraction(depth: DepthLevel): number {
  return depth / 1000;
}

/** Lerp between two values */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Lerp a THREE.Color in-place */
function lerpColor(out: THREE.Color, a: THREE.Color, b: THREE.Color, t: number): THREE.Color {
  out.r = lerp(a.r, b.r, t);
  out.g = lerp(a.g, b.g, t);
  out.b = lerp(a.b, b.b, t);
  return out;
}

// ── Color palette by depth ───────────────────────────────────────────────────

const FOG_COLOR_SHALLOW = new THREE.Color(0x0891b2); // bright blue-green
const FOG_COLOR_MID     = new THREE.Color(0x1e3a5f); // medium blue
const FOG_COLOR_DEEP    = new THREE.Color(0x040d1a); // near-black blue

function getFogColor(t: number, out: THREE.Color): THREE.Color {
  if (t < 0.5) {
    return lerpColor(out, FOG_COLOR_SHALLOW, FOG_COLOR_MID, t * 2);
  }
  return lerpColor(out, FOG_COLOR_MID, FOG_COLOR_DEEP, (t - 0.5) * 2);
}

function getFogOpacity(t: number): number {
  // 0.05 at surface → 0.45 at max depth
  return lerp(0.05, 0.45, t);
}

function getParticleDensity(t: number): number {
  // Returns fraction of particles to show: 1.0 at surface → 0.15 at deep
  return lerp(1.0, 0.15, t);
}

// ── Constants ────────────────────────────────────────────────────────────────

const PARTICLE_COUNT = 300;
const PARTICLE_SPREAD = 3.0; // particles float in a sphere around camera
const EARTH_RADIUS = 2.0;

// ── Caustic shader ───────────────────────────────────────────────────────────

const causticVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const causticFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vNormal;

  // Simple 2D hash for caustic pattern
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float caustic(vec2 uv, float time) {
    float c = 0.0;
    // Two overlapping layers for realism
    vec2 p1 = uv * 8.0 + vec2(time * 0.3, time * 0.2);
    vec2 p2 = uv * 6.0 - vec2(time * 0.25, time * 0.35);
    float n1 = noise(p1) + noise(p1 * 2.0) * 0.5;
    float n2 = noise(p2) + noise(p2 * 2.0) * 0.5;
    c = pow(abs(sin(n1 * 3.14159)), 3.0) * pow(abs(sin(n2 * 3.14159)), 3.0);
    return c;
  }

  void main() {
    float c = caustic(vUv, uTime);
    vec3 color = vec3(0.5, 0.9, 1.0) * c;
    gl_FragColor = vec4(color, c * uOpacity);
  }
`;

// ── Component ────────────────────────────────────────────────────────────────

export function SubsurfaceEnvironment({ depth, visible }: SubsurfaceEnvironmentProps) {
  // Refs
  const fogRef = useRef<THREE.Mesh>(null!);
  const particlesRef = useRef<THREE.Points>(null!);
  const raysGroupRef = useRef<THREE.Group>(null!);
  const causticRef = useRef<THREE.Mesh>(null!);

  // Animated state (lerped toward targets each frame)
  const animState = useRef({
    currentDepthT: 0,
    targetDepthT: 0,
    fogOpacity: 0,
    particleVisibility: 0,
    rayOpacity: 0,
    causticOpacity: 0,
    masterOpacity: 0, // overall fade in/out
  });

  // ── Particle geometry (created once) ─────────────────────────────────────

  const { particleGeometry, particleOffsets, particleSpeeds } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const offsets: THREE.Vector3[] = [];
    const speeds: number[] = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Random position in a sphere of radius PARTICLE_SPREAD
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.cbrt(Math.random()) * PARTICLE_SPREAD;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      offsets.push(new THREE.Vector3(x, y, z));
      speeds.push(0.02 + Math.random() * 0.04);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    // Variable sizes per particle
    const sizes = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      sizes[i] = 0.003 + Math.random() * 0.005;
    }
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    return { particleGeometry: geo, particleOffsets: offsets, particleSpeeds: speeds };
  }, []);

  // ── Light ray cone data ──────────────────────────────────────────────────

  const rayData = useMemo(() => {
    return [
      { angle: -0.3, offset: [-0.8, 0, 0.2], height: 5, radius: 0.15 },
      { angle: 0.1, offset: [0.3, 0, -0.5], height: 6, radius: 0.12 },
      { angle: -0.15, offset: [0.6, 0, 0.7], height: 5.5, radius: 0.18 },
      { angle: 0.25, offset: [-0.4, 0, -0.8], height: 4.5, radius: 0.1 },
    ];
  }, []);

  // ── Caustic shader material ──────────────────────────────────────────────

  const causticUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uOpacity: { value: 0 },
  }), []);

  // ── Frame update ─────────────────────────────────────────────────────────

  useFrame((state, delta) => {
    const s = animState.current;
    const dt = delta;
    const t = state.clock.elapsedTime;
    const lerpSpeed = 2.5; // transitions per second factor

    // Update targets based on props
    s.targetDepthT = visible && depth > 0 ? depthFraction(depth) : 0;
    const targetMaster = visible && depth > 0 ? 1 : 0;

    // Smooth lerp toward targets
    s.currentDepthT = lerp(s.currentDepthT, s.targetDepthT, Math.min(1, lerpSpeed * dt));
    s.masterOpacity = lerp(s.masterOpacity, targetMaster, Math.min(1, lerpSpeed * dt));

    const depthT = s.currentDepthT;
    const master = s.masterOpacity;

    // Skip rendering work if fully invisible
    if (master < 0.001) return;

    // ── Fog sphere ───────────────────────────────────────────────────────
    if (fogRef.current) {
      const mat = fogRef.current.material as THREE.MeshBasicMaterial;
      const targetOpacity = getFogOpacity(depthT);
      s.fogOpacity = lerp(s.fogOpacity, targetOpacity, Math.min(1, lerpSpeed * dt));
      mat.opacity = s.fogOpacity * master;
      getFogColor(depthT, mat.color);
    }

    // ── Underwater particles ─────────────────────────────────────────────
    if (particlesRef.current) {
      const density = getParticleDensity(depthT);
      const posAttr = particlesRef.current.geometry.attributes.position as THREE.BufferAttribute;
      const camPos = state.camera.position;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        // Only animate visible particles (based on density)
        const isVisible = i < PARTICLE_COUNT * density;
        const offset = particleOffsets[i];
        const speed = particleSpeeds[i];

        if (isVisible) {
          // Drift animation: slow random walk relative to camera
          const drift = t * speed;
          const x = camPos.x + offset.x + Math.sin(drift + i * 0.7) * 0.3;
          const y = camPos.y + offset.y + Math.cos(drift * 0.8 + i * 1.1) * 0.2;
          const z = camPos.z + offset.z + Math.sin(drift * 0.6 + i * 0.3) * 0.3;
          posAttr.setXYZ(i, x, y, z);
        } else {
          // Push invisible particles far away
          posAttr.setXYZ(i, 9999, 9999, 9999);
        }
      }
      posAttr.needsUpdate = true;

      const mat = particlesRef.current.material as THREE.PointsMaterial;
      // Particle opacity: visible at shallow, slightly less at deep
      const particleAlpha = lerp(0.6, 0.25, depthT);
      mat.opacity = particleAlpha * master;
    }

    // ── Light rays ───────────────────────────────────────────────────────
    if (raysGroupRef.current) {
      // Rays only visible at depth < 200m (depthT < 0.2)
      const rayTargetOpacity = depthT < 0.2 ? lerp(0.08, 0.0, depthT / 0.2) : 0;
      s.rayOpacity = lerp(s.rayOpacity, rayTargetOpacity, Math.min(1, lerpSpeed * dt));

      raysGroupRef.current.children.forEach((child, idx) => {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        // Each ray has slightly different opacity for variation
        const variation = 0.7 + Math.sin(t * 0.3 + idx * 1.5) * 0.3;
        mat.opacity = s.rayOpacity * variation * master;
        // Subtle sway animation
        mesh.rotation.z = Math.sin(t * 0.15 + idx * 0.8) * 0.05;
        mesh.rotation.x = Math.cos(t * 0.12 + idx * 1.2) * 0.03;
      });
    }

    // ── Caustics ─────────────────────────────────────────────────────────
    if (causticRef.current) {
      // Caustics only at depth < 100m (depthT < 0.1)
      const causticTargetOpacity = depthT < 0.1 ? lerp(0.05, 0.0, depthT / 0.1) : 0;
      s.causticOpacity = lerp(s.causticOpacity, causticTargetOpacity, Math.min(1, lerpSpeed * dt));

      causticUniforms.uTime.value = t;
      causticUniforms.uOpacity.value = s.causticOpacity * master;
    }
  });

  // Don't render anything if depth is 0 and fully faded
  // (We still render during fade-out to show smooth transition)
  const shouldRender = visible && depth > 0;
  // Keep mounted during fade-out by checking animState
  // The component handles its own visibility via masterOpacity

  return (
    <group visible={visible && depth > 0 || animState.current.masterOpacity > 0.001}>
      {/* ── Depth Fog Sphere ──────────────────────────────────────────────── */}
      <mesh ref={fogRef} renderOrder={-10}>
        <sphereGeometry args={[10, 32, 32]} />
        <meshBasicMaterial
          color={FOG_COLOR_SHALLOW}
          transparent
          opacity={0}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* ── Underwater Particles (Points) ─────────────────────────────────── */}
      <points ref={particlesRef} geometry={particleGeometry} renderOrder={5}>
        <pointsMaterial
          color="#b8e4f0"
          size={0.005}
          transparent
          opacity={0}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* ── Light Rays (Cone Geometries) ──────────────────────────────────── */}
      <group ref={raysGroupRef} renderOrder={3}>
        {rayData.map((ray, idx) => (
          <mesh
            key={idx}
            position={[
              ray.offset[0],
              4 + ray.height * 0.5,
              ray.offset[2],
            ]}
            rotation={[Math.PI, 0, ray.angle]}
          >
            <coneGeometry args={[ray.radius, ray.height, 8, 1, true]} />
            <meshBasicMaterial
              color="#7dd3fc"
              transparent
              opacity={0}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ))}
      </group>

      {/* ── Caustic Layer on Earth Surface ────────────────────────────────── */}
      <mesh ref={causticRef} renderOrder={2}>
        <sphereGeometry args={[EARTH_RADIUS + 0.005, 64, 64]} />
        <shaderMaterial
          vertexShader={causticVertexShader}
          fragmentShader={causticFragmentShader}
          uniforms={causticUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.FrontSide}
        />
      </mesh>
    </group>
  );
}
