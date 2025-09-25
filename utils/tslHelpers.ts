import {
  clamp,
  color,
  cos,
  distance,
  exp,
  float,
  Fn,
  If,
  mat2,
  mix,
  mx_cell_noise_float,
  mx_noise_float,
  PI,
  ShaderNodeObject,
  sin,
  smoothstep,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { VarNode } from "three/webgpu";

export const rotate2D = /*#__PURE__*/ Fn(
  ([angle_immutable]: [angle: ShaderNodeObject<VarNode>]) => {
    const angle = float(angle_immutable).toVar();
    const s = float(sin(angle)).toVar();
    const c = float(cos(angle)).toVar();

    // Return rotation matrix components as vec4 (row-major: [col1, col2])
    // Then we can construct mat2 from this vec4
    // const matrixValues = vec4(c, s, s.negate(), c)
    // @ts-expect-error - ignore
    return mat2(c, s, s.negate(), c);
  }
).setLayout({
  name: "rotate2D",
  type: "mat2",
  inputs: [{ name: "angle", type: "float" }],
});

export const getGrainyNoise = /*#__PURE__*/ Fn(
  ([uv, scale]: [
    uv: ShaderNodeObject<VarNode>,
    scale: ShaderNodeObject<VarNode>
  ]) => {
    const noise = mx_cell_noise_float(uv.mul(scale)).mul(0.5).add(0.5);
    return noise;
  }
).setLayout({
  name: "getGrainyNoise",
  type: "float",
  inputs: [
    { name: "uv", type: "vec2" },
    { name: "scale", type: "float" },
  ],
});

// Pure ripple wave falloff (mask) — 1 at center, fades to 0 at radius
export const getRippleWave = /*#__PURE__*/ Fn(
  ([pos, ripplePos, rippleRadius, playerVelocity, timeParam]: [
    pos: ShaderNodeObject<VarNode>,
    ripplePos: ShaderNodeObject<VarNode>,
    rippleRadius: ShaderNodeObject<VarNode>,
    playerVelocity: ShaderNodeObject<VarNode>,
    timeParam: ShaderNodeObject<VarNode>
  ]) => {
    const d = distance(pos, ripplePos).toVar();
    const edgeSoftness = rippleRadius.mul(0.18).toVar();

    If(d.greaterThan(rippleRadius.add(edgeSoftness)), () => {
      // Outside ripple radius + edge: return 0
      return float(0.0);
    });

    // Inside mask: 1 at center, fades to 0 approaching radius, 0 beyond
    const maskInside = smoothstep(
      rippleRadius,
      rippleRadius.sub(edgeSoftness),
      d
    ).toVar();

    // Outward-moving phase driven by time
    const frequency = float(16.0);
    const rippleSpeed = float(4.0);
    const phase = d.mul(frequency).sub(timeParam.mul(rippleSpeed));

    // Amplitude scales with player velocity (0..1)
    const wave = sin(phase).mul(playerVelocity).mul(maskInside);
    return wave;
  }
).setLayout({
  name: "getRippleWave",
  type: "float",
  inputs: [
    { name: "pos", type: "vec2" },
    { name: "ripplePos", type: "vec2" },
    { name: "rippleRadius", type: "float" },
    { name: "playerVelocity", type: "float" },
    { name: "time", type: "float" },
  ],
});

// https://boytchev.github.io/tsl-textures/

// getClouds: Fractal noise-based clouds. Pure function.
// Returns vec4(color, alpha). Higher density/opacity => thicker clouds.
export const getClouds = /*#__PURE__*/ Fn(
  ([pos, scale, density, opacity, colorB, colorA, seed]: [
    pos: ShaderNodeObject<VarNode>,
    scale: ShaderNodeObject<VarNode>,
    density: ShaderNodeObject<VarNode>,
    opacity: ShaderNodeObject<VarNode>,
    colorB: ShaderNodeObject<VarNode>,
    colorA: ShaderNodeObject<VarNode>,
    seed: ShaderNodeObject<VarNode>
  ]) => {
    // Exponential scale shaping for octave frequency spacing
    const s = exp(scale.div(1.5).sub(0.5)).toVar();

    // Octave positions
    const p1 = pos.mul(s).add(seed);
    const p2 = pos.mul(s.mul(2.0)).add(seed);
    const p3 = pos.mul(s.mul(6.0)).add(seed);
    const p4 = pos.mul(s.mul(8.0)).add(seed);

    // Fractal fBm mix
    const n1 = mx_noise_float(p1).toVar();
    // Slightly reduce higher-octave contribution for a softer look
    const n2 = mx_noise_float(p2).mul(0.7).toVar();
    const n3 = mx_noise_float(p3).mul(0.08).toVar();
    const n4 = mx_noise_float(p4).mul(0.05).mul(opacity).toVar();

    // Density remap 0..1 -> -0.5..1.5
    const dRemap = density.mul(1.8).sub(0.4);

    const k = n1.add(n2).add(n3).add(n4).add(dRemap).clamp(0.0, 1.0).toVar();

    // Opacity shaping
    const a = k
      .mul(1.8)
      .pow(1.35)
      .sub(1.0)
      .mul(opacity)
      .clamp(0.0, 1.0)
      .toVar();

    const col = mix(colorB, colorA, k);
    return vec4(col, a);
  }
).setLayout({
  name: "getClouds",
  type: "vec4",
  inputs: [
    { name: "pos", type: "vec3" },
    { name: "scale", type: "float" },
    { name: "density", type: "float" },
    { name: "opacity", type: "float" },
    { name: "colorB", type: "vec3" },
    { name: "color", type: "vec3" },
    { name: "seed", type: "float" },
  ],
});
