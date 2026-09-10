import type { DepthLevel } from '../../../types/ocean';
import { MantaRayModel } from './models/MantaRayModel';
import { FishSchool } from './models/FishSchool';
import { SharkModel } from './models/SharkModel';
import { SeaTurtleModel } from './models/SeaTurtleModel';
import { GiantSquidModel } from './models/GiantSquidModel';
import { AbyssalLeviathanModel } from './models/AbyssalLeviathanModel';
import { VolumetricSunRays } from './VolumetricSunRays';
import { SeafloorReef } from './SeafloorReef';

interface MarineEcosystemManagerProps {
  depth: DepthLevel;
}

export function MarineEcosystemManager({ depth }: MarineEcosystemManagerProps) {
  return (
    <group name="MarineEcosystemManager">
      {/* 1. Volumetric Sun Beams & Rising Bubbles */}
      <VolumetricSunRays depth={depth} />

      {/* 2. Seafloor Outcrops & Coral Reef Formations */}
      <SeafloorReef depth={depth} />

      {/* 3. Multi-Species High-Fidelity Schooling Fish (10m & 50m) */}
      <FishSchool depth={depth} />

      {/* 4. Volumetric 3D Manta Rays (10m & 50m) — Highest Priority Overhaul */}
      <MantaRayModel depth={depth} />

      {/* 5. Realistic Green Sea Turtles (50m) */}
      <SeaTurtleModel depth={depth} />

      {/* 6. Hero-Scale (5.5m - 8.5m) Apex Predator Sharks (100m & 500m) */}
      <SharkModel depth={depth} />

      {/* 7. Colossal (8.5m - 11m) Giant Squids (500m & 1000m) */}
      <GiantSquidModel depth={depth} />

      {/* 8. 26m Abyssal Whale Leviathan, Anglerfish & Jellyfish (1000m) */}
      <AbyssalLeviathanModel depth={depth} />
    </group>
  );
}
