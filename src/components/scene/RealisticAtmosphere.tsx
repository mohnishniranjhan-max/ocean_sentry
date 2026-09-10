import { useMemo } from 'react';
import * as THREE from 'three';

interface RealisticAtmosphereProps {
  sunPosition?: [number, number, number];
}

// Fresnel atmosphere shader for realistic Rayleigh scattering blue glow
const atmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const atmosphereFragmentShader = `
  uniform vec3 sunDirection;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    vec3 L = normalize(sunDirection);

    // Strict grazing-angle Fresnel (only active at planet rim)
    float dotNV = max(dot(N, V), 0.0);
    float fresnel = pow(1.0 - dotNV, 6.5);

    // Sunlight modulation on atmosphere
    float dotNL = dot(N, L);
    float sunScattering = smoothstep(-0.15, 0.40, dotNL);

    // Natural Rayleigh sky blue to limb cyan
    vec3 dayAtmo = mix(vec3(0.04, 0.25, 0.85), vec3(0.15, 0.55, 0.95), fresnel);
    vec3 nightAtmo = vec3(0.01, 0.03, 0.10);

    vec3 atmoColor = mix(nightAtmo, dayAtmo, sunScattering);
    float alpha = fresnel * (0.02 + sunScattering * 0.65) * 0.65;

    gl_FragColor = vec4(atmoColor, alpha);
  }
`;

// Outer atmospheric glow shell
const outerGlowVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const outerGlowFragmentShader = `
  uniform vec3 sunDirection;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    vec3 L = normalize(sunDirection);

    // Tight grazing falloff for thin planetary edge
    float dotNV = max(dot(N, V), 0.0);
    float intensity = pow(1.0 - dotNV, 5.5);
    float dotNL = dot(N, L);
    float sunScattering = smoothstep(-0.25, 0.35, dotNL);

    vec3 skyColor = vec3(0.06, 0.32, 0.88) * (sunScattering * 0.85 + 0.15);
    float alpha = clamp(intensity * 0.45 * (sunScattering * 0.8 + 0.2), 0.0, 0.45);

    gl_FragColor = vec4(skyColor, alpha);
  }
`;

export function RealisticAtmosphere({ sunPosition = [12, 5, 8] }: RealisticAtmosphereProps) {
  const sunDir = useMemo(() => new THREE.Vector3(...sunPosition).normalize(), [sunPosition]);

  const innerUniforms = useMemo(() => ({
    sunDirection: { value: sunDir },
  }), [sunDir]);

  const outerUniforms = useMemo(() => ({
    sunDirection: { value: sunDir },
  }), [sunDir]);

  return (
    <group>
      {/* Surface atmospheric limb shell (tight fit) */}
      <mesh>
        <sphereGeometry args={[2.018, 64, 64]} />
        <shaderMaterial
          vertexShader={atmosphereVertexShader}
          fragmentShader={atmosphereFragmentShader}
          uniforms={innerUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* Outer Rayleigh scattering halo */}
      <mesh>
        <sphereGeometry args={[2.030, 64, 64]} />
        <shaderMaterial
          vertexShader={outerGlowVertexShader}
          fragmentShader={outerGlowFragmentShader}
          uniforms={outerUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}
