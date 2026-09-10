import * as THREE from 'three';
import type { DepthLevel } from '../../../../types/ocean';

// ── Marine Species Registry & Configurations ───────────────────────────────

export type MarineSpeciesId =
  | 'manta_ray'
  | 'reef_fish_blue'
  | 'reef_fish_yellow'
  | 'silver_sardine'
  | 'emerald_parrotfish'
  | 'pelagic_tuna'
  | 'great_white_shark'
  | 'deep_sleeper_shark'
  | 'sea_turtle'
  | 'giant_squid'
  | 'colossal_whale'
  | 'deep_anglerfish'
  | 'bioluminescent_jellyfish';

export interface SpeciesMetadata {
  id: MarineSpeciesId;
  name: string;
  scientificName: string;
  modelUrl: string;
  defaultScale: number;
  speedRange: [number, number];
  primaryDepth: DepthLevel[];
  colorPalette: {
    dorsal: string;
    ventral: string;
    accent?: string;
  };
  hasAnimations: boolean;
}

export const MARINE_SPECIES_REGISTRY: Record<MarineSpeciesId, SpeciesMetadata> = {
  manta_ray: {
    id: 'manta_ray',
    name: 'Giant Oceanic Manta Ray',
    scientificName: 'Mobula birostris',
    modelUrl: '/models/marine/manta_ray.glb',
    defaultScale: 4.5,
    speedRange: [0.22, 0.35],
    primaryDepth: [10, 50],
    colorPalette: {
      dorsal: '#0f172a',
      ventral: '#f8fafc',
      accent: '#38bdf8',
    },
    hasAnimations: true,
  },
  reef_fish_blue: {
    id: 'reef_fish_blue',
    name: 'Blue Chromis',
    scientificName: 'Chromis cyanea',
    modelUrl: '/models/marine/reef_fish_blue.glb',
    defaultScale: 0.75,
    speedRange: [0.8, 1.4],
    primaryDepth: [10],
    colorPalette: {
      dorsal: '#0284c7',
      ventral: '#38bdf8',
      accent: '#0369a1',
    },
    hasAnimations: true,
  },
  reef_fish_yellow: {
    id: 'reef_fish_yellow',
    name: 'Yellowtail Damselfish',
    scientificName: 'Microspathodon chrysurus',
    modelUrl: '/models/marine/reef_fish_yellow.glb',
    defaultScale: 0.85,
    speedRange: [0.75, 1.3],
    primaryDepth: [10],
    colorPalette: {
      dorsal: '#1e3a8a',
      ventral: '#3b82f6',
      accent: '#eab308',
    },
    hasAnimations: true,
  },
  silver_sardine: {
    id: 'silver_sardine',
    name: 'Pacific Sardine',
    scientificName: 'Sardinops sagax',
    modelUrl: '/models/marine/silver_sardine.glb',
    defaultScale: 0.65,
    speedRange: [0.9, 1.6],
    primaryDepth: [10],
    colorPalette: {
      dorsal: '#334155',
      ventral: '#f1f5f9',
      accent: '#94a3b8',
    },
    hasAnimations: true,
  },
  emerald_parrotfish: {
    id: 'emerald_parrotfish',
    name: 'Stoplight Parrotfish',
    scientificName: 'Sparisoma viride',
    modelUrl: '/models/marine/emerald_parrotfish.glb',
    defaultScale: 0.95,
    speedRange: [0.65, 1.1],
    primaryDepth: [10],
    colorPalette: {
      dorsal: '#0d9488',
      ventral: '#2dd4bf',
      accent: '#a855f7',
    },
    hasAnimations: true,
  },
  pelagic_tuna: {
    id: 'pelagic_tuna',
    name: 'Yellowfin Tuna',
    scientificName: 'Thunnus albacares',
    modelUrl: '/models/marine/pelagic_tuna.glb',
    defaultScale: 1.8,
    speedRange: [1.2, 2.2],
    primaryDepth: [50],
    colorPalette: {
      dorsal: '#1e3a8a',
      ventral: '#cbd5e1',
      accent: '#eab308',
    },
    hasAnimations: true,
  },
  great_white_shark: {
    id: 'great_white_shark',
    name: 'Apex Ocean Shark',
    scientificName: 'Carcharodon carcharias',
    modelUrl: '/models/marine/great_white_shark.glb',
    defaultScale: 6.5,
    speedRange: [0.22, 0.38],
    primaryDepth: [100],
    colorPalette: {
      dorsal: '#1e293b',
      ventral: '#f8fafc',
      accent: '#0f172a',
    },
    hasAnimations: true,
  },
  deep_sleeper_shark: {
    id: 'deep_sleeper_shark',
    name: 'Greenland Sleeper Shark',
    scientificName: 'Somniosus microcephalus',
    modelUrl: '/models/marine/deep_sleeper_shark.glb',
    defaultScale: 8.0,
    speedRange: [0.12, 0.22],
    primaryDepth: [500],
    colorPalette: {
      dorsal: '#090d16',
      ventral: '#1e293b',
    },
    hasAnimations: true,
  },
  sea_turtle: {
    id: 'sea_turtle',
    name: 'Green Sea Turtle',
    scientificName: 'Chelonia mydas',
    modelUrl: '/models/marine/sea_turtle.glb',
    defaultScale: 2.2,
    speedRange: [0.15, 0.28],
    primaryDepth: [50],
    colorPalette: {
      dorsal: '#365314',
      ventral: '#fef08a',
      accent: '#4d7c0f',
    },
    hasAnimations: true,
  },
  giant_squid: {
    id: 'giant_squid',
    name: 'Giant Squid',
    scientificName: 'Architeuthis dux',
    modelUrl: '/models/marine/giant_squid.glb',
    defaultScale: 9.5,
    speedRange: [0.12, 0.24],
    primaryDepth: [500, 1000],
    colorPalette: {
      dorsal: '#831843',
      ventral: '#9f1239',
      accent: '#fef08a',
    },
    hasAnimations: true,
  },
  colossal_whale: {
    id: 'colossal_whale',
    name: 'Colossal Leviathan Whale',
    scientificName: 'Balaenoptera titan',
    modelUrl: '/models/marine/colossal_whale.glb',
    defaultScale: 26.0,
    speedRange: [0.04, 0.08],
    primaryDepth: [1000],
    colorPalette: {
      dorsal: '#050c18',
      ventral: '#0a192f',
      accent: '#06b6d4',
    },
    hasAnimations: true,
  },
  deep_anglerfish: {
    id: 'deep_anglerfish',
    name: 'Deep-Sea Humpback Anglerfish',
    scientificName: 'Melanocetus johnsonii',
    modelUrl: '/models/marine/deep_anglerfish.glb',
    defaultScale: 2.2,
    speedRange: [0.18, 0.32],
    primaryDepth: [1000],
    colorPalette: {
      dorsal: '#0b1120',
      ventral: '#020617',
      accent: '#38bdf8',
    },
    hasAnimations: true,
  },
  bioluminescent_jellyfish: {
    id: 'bioluminescent_jellyfish',
    name: 'Deep-Sea Crown Jellyfish',
    scientificName: 'Atolla wyvillei',
    modelUrl: '/models/marine/bioluminescent_jellyfish.glb',
    defaultScale: 2.0,
    speedRange: [0.08, 0.16],
    primaryDepth: [500, 1000],
    colorPalette: {
      dorsal: '#06b6d4',
      ventral: '#0891b2',
      accent: '#22d3ee',
    },
    hasAnimations: true,
  },
};
