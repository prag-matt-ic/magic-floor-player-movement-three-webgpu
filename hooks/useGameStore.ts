import { create } from "zustand";

export const PLANE_SIZE = 16;
export const PLANE_RADIUS = PLANE_SIZE / 2;
export const PLAYER_RADIUS = 0.14;
export const PLAYER_HEIGHT = PLAYER_RADIUS; // sits just above the plane
export const PLAYER_INITIAL_POS: [number, number, number] = [
  0.5,
  PLAYER_HEIGHT,
  PLANE_RADIUS - 1,
];
// Stage bounds (world units). Distances are from origin (0,0) on the plane.
// Tune as needed to choreograph transitions
export const INNER_RING_RADIUS = 4.5;
export const CENTER_RADIUS = PLAYER_RADIUS * 6.0;

export enum Stage {
  LANDING = "landing",
  INTRO = "intro",
  OUTER = "outer",
  INNER = "inner",
  CENTER = "center",
}

export enum QualityMode {
  MAX = "Max",
  HIGH = "High",
  MEDIUM = "Medium",
  LOW = "Low",
}

type PerformanceConfig = {
  godRaySamples: number; // 2..8
  waterTextureSize: number; // 128..1024
  waterRippleRadius: number;
  particleCount: number;
  playerSegments: number;
  maxDPR: number; // max device pixel ratio - maxxed at window.devicePixelRatio
};

const PERFORMANCE_PRESETS: Record<QualityMode, PerformanceConfig> = {
  [QualityMode.MAX]: {
    godRaySamples: 5,
    waterTextureSize: 1024,
    waterRippleRadius: 6.0,
    particleCount: 1024,
    playerSegments: 64,
    maxDPR: 3,
  },
  [QualityMode.HIGH]: {
    godRaySamples: 3,
    waterTextureSize: 512,
    waterRippleRadius: 5.0,
    particleCount: 1024,
    playerSegments: 48,
    maxDPR: 2,
  },
  [QualityMode.MEDIUM]: {
    godRaySamples: 2,
    waterTextureSize: 256,
    waterRippleRadius: 3.0,
    particleCount: 512,
    playerSegments: 24,
    maxDPR: 1.5,
  },
  [QualityMode.LOW]: {
    godRaySamples: 1,
    waterTextureSize: 128,
    waterRippleRadius: 2.0,
    particleCount: 512,
    playerSegments: 16,
    maxDPR: 1,
  },
};

export type GameState = {
  stage: Stage;
  setStage: (stage: Stage) => void;
  isMuted: boolean;
  setIsMuted: (isMuted: boolean) => void;
  config: PerformanceConfig;
  qualityMode: QualityMode;
  setQualityMode: (mode: QualityMode) => void;
  stepQuality: (up: boolean) => void;
};

export const useGameStore = create<GameState>((set) => ({
  stage: Stage.LANDING,
  setStage: (stage) => set({ stage }),
  isMuted: true,
  setIsMuted: (isMuted) => set({ isMuted }),
  qualityMode: QualityMode.HIGH,
  config: PERFORMANCE_PRESETS[QualityMode.HIGH],
  setQualityMode: (qualityMode) =>
    set({
      qualityMode,
      config: PERFORMANCE_PRESETS[qualityMode],
    }),
  stepQuality: (up) =>
    set((state) => {
      const order = [
        QualityMode.LOW,
        QualityMode.MEDIUM,
        QualityMode.HIGH,
        QualityMode.MAX,
      ] as const;
      const idx = order.indexOf(state.qualityMode);
      const nextIdx = Math.min(
        order.length - 1,
        Math.max(0, idx + (up ? 1 : -1))
      );
      const nextMode = order[nextIdx];
      if (nextMode === state.qualityMode) return state;
      return {
        qualityMode: nextMode,
        config: PERFORMANCE_PRESETS[nextMode],
      };
    }),
}));

// Helper to derive stage from radial distance to origin
export function stageFromRadius(radius: number): Stage {
  if (radius <= CENTER_RADIUS) return Stage.CENTER;
  if (radius <= INNER_RING_RADIUS) return Stage.INNER;
  return Stage.OUTER;
}

/*
Performance notes: potential frame-drop hotspots on low-powered devices
---------------------------------------------------------------

- Background/fractal noise (components/Plane.tsx)
  - getFractalColor uses mx_fractal_noise_float with 2 octaves; backgroundNoise uses mx_noise_float over screenUV.
  - Grain overlay via getGrainyNoise (mx_cell_noise_float) blended over the screen.
  - Impact: extra per-fragment work and overdraw; moderate but additive with other effects.

- Text cylinder canvas updates (components/TextCylinder.tsx)
  - Large CanvasTexture: CANVAS_WIDTH scales with circumference; with PLANE_RADIUS ~8, width ≈ 7000px.
  - GSAP-driven blur effect applies CSS-like canvas filter each update (blurMultipler=32) and sets texture.needsUpdate.
  - Continuous yoyo animation keeps re-uploading a large texture to GPU.
  - Impact: heavy main-thread work and frequent large GPU uploads; prime source of jank on low-powered devices.


- Stats overlay (components/Canvas.tsx)
  - <Stats /> renders each frame.
  - Impact: small but non-zero; best disabled in production on constrained devices.

*/
