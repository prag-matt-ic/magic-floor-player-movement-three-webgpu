// Centralised colour constants used across the app.
// For now, this lists all unique hex values found in the codebase
// and the new palette used going forward.

import { COSINE_GRADIENTS } from "@thi.ng/color";

// Colour palette values taken from: http://dev.thi.ng/gradients/
// vec3 cosineGradientColour(in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d) {
//   return clamp(a + b * cos(6.28318 * (c * t + d)), 0.0, 1.0);
// }

// New palette
export const COLOUR_BACKGROUND_NODE_A = "#04254B";
export const COLOUR_BACKGROUND_NODE_B = "#081223";

export const COLOUR_LIGHT_WAVES_LIGHT = "#5CFADB";
export const COLOUR_LIGHT_WAVES_DARK = "#27AC94";

export const COLOUR_FRACTAL_BG = "#27AC94";

export const COLOUR_PARTICLES = "#9FE9DA";

export const COLOUR_FFFFFF = "#ffffff";
export const COLOUR_F3F1ED = "#F3F1ED";
export const COLOUR_D7D1C3 = "#D7D1C3";
export const COLOUR_D9D9D9 = "#D9D9D9";
export const COLOUR_FFF = "#fff";
export const COLOUR_000 = "#000";
export const COLOUR_191818 = "#191818";
export const COLOUR_C7C1B3 = "#C7C1B3";
export const COLOUR_FDFCFA = "#FDFCFA";
export const COLOUR_292826 = "#292826";
export const COLOUR_686359 = "#686359";
export const COLOUR_88AAFF = "#88aaff";

// Optional grouped export for convenience (tree-shakeable named exports above remain primary)
export const COLOURS = {
  // New palette
  BACKGROUND_NODE_A: COLOUR_BACKGROUND_NODE_A,
  BACKGROUND_NODE_B: COLOUR_BACKGROUND_NODE_B,
  LIGHT_WAVES_LIGHT: COLOUR_LIGHT_WAVES_LIGHT,
  LIGHT_WAVES_DARK: COLOUR_LIGHT_WAVES_DARK,
  FRACTAL_BG: COLOUR_FRACTAL_BG,
  PARTICLES: COLOUR_PARTICLES,
  // Legacy/extracted literals
  FFFFFF: COLOUR_FFFFFF,
  F3F1ED: COLOUR_F3F1ED,
  D7D1C3: COLOUR_D7D1C3,
  D9D9D9: COLOUR_D9D9D9,
  FFF: COLOUR_FFF,
  "000": COLOUR_000,
  "191818": COLOUR_191818,
  C7C1B3: COLOUR_C7C1B3,
  FDFCFA: COLOUR_FDFCFA,
  "292826": COLOUR_292826,
  "686359": COLOUR_686359,
  "88AAFF": COLOUR_88AAFF,
} as const;
