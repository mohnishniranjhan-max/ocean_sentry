import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { DepthLevel } from '../../types/ocean';

interface CloudLayerProps {
  depth?: DepthLevel;
  sunPosition?: [number, number, number];
}

const cloudVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const cloudFragmentShader = `
  uniform sampler2D cloudTexture;
  uniform vec3 sunDirection;
  uniform float cloudOpacity;
  uniform float uTime;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    // Subtle living fluid wind advection (clouds gently swirl and deform like real weather systems)
    vec2 flow = vec2(
      sin(vUv.y * 12.56 + uTime * 0.12) * 0.0018,
      cos(vUv.x * 12.56 + uTime * 0.10) * 0.0012
    );
    vec4 cloudTex = texture2D(cloudTexture, vUv + flow);
    float density = cloudTex.a;

    if (density < 0.015) {
      discard;
    }

    vec3 N = normalize(vNormal);
    vec3 L = normalize(sunDirection);
    vec3 V = normalize(cameraPosition - vWorldPosition);

    float dotNL = dot(N, L);
    float dotNV = max(dot(N, V), 0.0);

    // Smooth daylight falloff with warm terminator transition
    float sunFactor = smoothstep(-0.18, 0.28, dotNL);
    float terminator = smoothstep(-0.18, 0.12, dotNL) * (1.0 - smoothstep(0.12, 0.38, dotNL));

    // Volumetric Beer-Lambert self-shadowing in dense storm cores
    float internalExtinction = exp(-density * 0.65);
    vec3 cloudLit = mix(vec3(0.92, 0.94, 0.98), vec3(1.0, 1.0, 1.0), internalExtinction);

    // Warm golden peach tint at the twilight terminator
    vec3 sunsetTint = vec3(1.0, 0.72, 0.45);
    cloudLit = mix(cloudLit, sunsetTint, terminator * 0.35);

    // Shadowed underbelly (natural ambient sky scatter)
    vec3 cloudDark = vec3(0.012, 0.025, 0.065);
    vec3 color = mix(cloudDark, cloudLit, sunFactor);

    // Forward Mie scattering (silver lining glint when viewing toward the sun)
    float forwardScatter = pow(max(dot(V, -L), 0.0), 4.5);
    color += vec3(0.18, 0.17, 0.14) * forwardScatter * sunFactor;

    // Atmospheric limb Rayleigh blue blend at the silhouette
    float fresnel = pow(1.0 - dotNV, 3.8);
    color = mix(color, vec3(0.18, 0.48, 0.92), fresnel * 0.35 * sunFactor);

    // Silky alpha curve
    float alpha = density * cloudOpacity;
    float limbEnhance = 1.0 + fresnel * 0.45;
    alpha = clamp(alpha * limbEnhance, 0.0, 1.0);

    gl_FragColor = vec4(color, alpha);
  }
`;

export function CloudLayer({ depth = 0, sunPosition = [12, 5, 8] }: CloudLayerProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const textureLoader = useMemo(() => new THREE.TextureLoader(), []);

  const cloudTexture = useMemo(() => {
    // Cache buster guarantees instant load of the silky 2048x1024 map
    const tex = textureLoader.load('/textures/earth_clouds.png?v=5');
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 16;
    return tex;
  }, [textureLoader]);

  const sunDir = useMemo(() => {
    return new THREE.Vector3(...sunPosition).normalize();
  }, [sunPosition]);

  const uniforms = useMemo(() => ({
    cloudTexture: { value: cloudTexture },
    sunDirection: { value: sunDir },
    cloudOpacity: { value: 0.90 },
    uTime: { value: 0.0 },
  }), [cloudTexture, sunDir]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    // Visible, graceful planetary atmospheric rotation (~1.4 deg/sec, clearly moving!)
    meshRef.current.rotation.y += delta * 0.024;
    uniforms.uTime.value = state.clock.elapsedTime;

    // Maintain strong cloud visibility
    const targetOpacity = depth > 0 ? Math.max(0.20, 0.90 - (depth / 1000) * 0.65) : 0.90;
    uniforms.cloudOpacity.value = THREE.MathUtils.lerp(uniforms.cloudOpacity.value, targetOpacity, 0.1);
  });


  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[2.012, 96, 96]} />
      <shaderMaterial
        vertexShader={cloudVertexShader}
        fragmentShader={cloudFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </mesh>
  );
}
