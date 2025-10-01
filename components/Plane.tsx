import { useGSAP } from "@gsap/react";
import { useThree } from "@react-three/fiber";
import gsap from "gsap";
import React, { type FC, useMemo, useRef } from "react";
import { ShaderNodeObject } from "three/src/nodes/TSL.js";
import {
  atan,
  clamp,
  color,
  cos,
  distance,
  float,
  Fn,
  If,
  instancedArray,
  instanceIndex,
  int,
  length,
  Loop,
  max,
  min,
  mix,
  mx_fractal_noise_float,
  mx_noise_float,
  positionGeometry,
  screenUV,
  sin,
  smoothstep,
  time,
  uniform,
  uv,
  vec2,
  vec4,
  vertexIndex,
} from "three/tsl";
import { AdditiveBlending, VarNode, WebGPURenderer } from "three/webgpu";

import {
  PLANE_SIZE,
  PLAYER_HEIGHT,
  PLAYER_INITIAL_POS,
  PLAYER_RADIUS,
  Stage,
  useGameStore,
} from "@/hooks/useGameStore";
import {
  COLOUR_FRACTAL_BG,
  COLOUR_LIGHT_WAVES_DARK,
  COLOUR_LIGHT_WAVES_LIGHT,
} from "@/colours";

import Player from "./Player";
import { getGrainyNoise } from "./tslHelpers";

// Hard constants
const PULSES_FREQUENCY = 32;
const PULSES_SPEED = 3;
const GOD_RAYS_ANGULAR_SCALE = 8.0;
const GOD_RAYS_RADIAL_SCALE = 30.0;

// Water tuning
// const WATER_HEIGHT_SCALE = 0.05; // visual displacement scale
const WATER_IMPACT_DEPTH = 0.16; // impulse strength
const WATER_VISCOSITY = 0.975; // damping
const WATER_IMPACT_SIZE = PLAYER_RADIUS; // radius of impact area

export const MagicPlane: FC = () => {
  const renderer = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const stage = useGameStore((s) => s.stage);
  const config = useGameStore((s) => s.config);
  const { godRaySamples, waterTextureSize, waterRippleRadius } = config;

  const {
    colorNode,
    opacityNode,
    uPlayerPosition,
    uSpeedSmooth,
    computeHeight,
    uLightAmount,
  } = useMemo(() => {
    // Pulsating Rings
    const uPulsesFrequency = uniform(float(PULSES_FREQUENCY));
    const uPulsesSpeed = uniform(float(PULSES_SPEED));
    const uLightAmount = uniform(float(0.0));

    // Player state uniform (x, y, z, w=phase)
    const uPlayerPosition = uniform(
      vec4(PLAYER_INITIAL_POS[0], PLAYER_HEIGHT, PLAYER_INITIAL_POS[2], 0.0)
    );
    const uSpeedSmooth = uniform(float(0.0)); // low-pass filtered speed for bounce
    // const uBaseY = uniform(float(PLAYER_HEIGHT)); // now handled on CPU

    // Water height buffers
    const gridCount = waterTextureSize * waterTextureSize;
    const heightArray = new Float32Array(gridCount);
    const prevHeightArray = new Float32Array(gridCount);
    const heightStorage = instancedArray(heightArray, "float").setName(
      "Height"
    );
    const prevHeightStorage = instancedArray(prevHeightArray, "float").setName(
      "PrevHeight"
    );

    // Water helper and height compute
    const getNeighborValues = (index: any, store: any) => {
      const widthF = float(waterTextureSize);
      const x = int(index.mod(widthF));
      const y = int(index.div(widthF));
      const leftX = max(0, x.sub(1));
      const rightX = min(x.add(1), int(widthF.sub(1)));
      const bottomY = max(0, y.sub(1));
      const topY = min(y.add(1), int(widthF.sub(1)));
      const westIndex = y.mul(int(widthF)).add(leftX);
      const eastIndex = y.mul(int(widthF)).add(rightX);
      const southIndex = bottomY.mul(int(widthF)).add(x);
      const northIndex = topY.mul(int(widthF)).add(x);
      const north = store.element(northIndex).toVar();
      const south = store.element(southIndex).toVar();
      const east = store.element(eastIndex).toVar();
      const west = store.element(westIndex).toVar();
      return { north, south, east, west };
    };

    const computeHeight = Fn(() => {
      const height = heightStorage.element(instanceIndex).toVar();
      const prevHeight = prevHeightStorage.element(instanceIndex).toVar();

      const x = float(instanceIndex.mod(waterTextureSize)).mul(
        1 / waterTextureSize
      );
      const y = float(instanceIndex.div(waterTextureSize)).mul(
        1 / waterTextureSize
      );
      const center = vec2(0.5);

      const player = uPlayerPosition.toVar();
      const playerPos = vec2(player.x, player.z);
      const speedLen = uSpeedSmooth; // 0..1
      const bouncePhase = player.w;
      const bounceDown = sin(bouncePhase).negate().max(0.0);

      const posInPlane = vec2(x, y).sub(center).mul(PLANE_SIZE).toVar();
      const dist = length(posInPlane.sub(playerPos)).toVar();

      If(dist.greaterThan(waterRippleRadius), () => {
        prevHeightStorage.element(instanceIndex).assign(0.0);
        heightStorage.element(instanceIndex).assign(0.0);
      }).Else(() => {
        const { north, south, east, west } = getNeighborValues(
          instanceIndex,
          heightStorage
        );
        const neighborHeight = north.add(south).add(east).add(west).mul(0.5);
        const newHeight = neighborHeight
          .sub(prevHeight)
          .mul(WATER_VISCOSITY)
          .toVar();
        const phase = clamp(
          dist.mul(Math.PI).div(WATER_IMPACT_SIZE),
          0.0,
          Math.PI
        );
        const impact = cos(phase)
          .add(1.0)
          .mul(WATER_IMPACT_DEPTH)
          .mul(speedLen)
          .mul(bounceDown);
        newHeight.addAssign(impact);
        prevHeightStorage.element(instanceIndex).assign(height);
        heightStorage.element(instanceIndex).assign(newHeight);
      });
    })().compute(waterTextureSize * waterTextureSize);

    // Prepare compute pipeline
    renderer.computeAsync([computeHeight]);

    const getFractalColor = Fn(([uv]: [uv: ShaderNodeObject<VarNode>]) => {
      const result = float(0.0).toVar();
      const p = uv.toVar();

      const octaves = 2.0;
      const lacunarity = 6.0;
      const diminish = 0.85;
      const amplitude = float(5.0).toVar();

      Loop(octaves, () => {
        result.addAssign(
          amplitude.mul(mx_fractal_noise_float(p).mul(0.5).add(0.5))
        );
        amplitude.mulAssign(diminish);
        p.mulAssign(lacunarity);
      });

      // Fractal background tint
      const colorA = color(COLOUR_FRACTAL_BG);
      const colorB = color(COLOUR_FRACTAL_BG);

      const colour = mix(colorA, colorB, result);

      return colour;
    }).setLayout({
      name: "getFractalColor",
      type: "vec4",
      inputs: [{ name: "p", type: "vec2" }],
    });

    const getGodRays = Fn(
      ([position, distanceFromCenter]: [
        position: ShaderNodeObject<VarNode>,
        distanceFromCenter: ShaderNodeObject<VarNode>
      ]) => {
        // Uses world space position to avoid UV wrapping issues
        // Get angle using atan but immediately convert to seamless coordinates
        const angle = atan(position.y, position.x).add(time.mul(0.18));

        // Create seamless coordinates using sin/cos to avoid wrapping
        const seamlessCoords = vec2(
          sin(angle).mul(0.5).add(0.5), // Maps to 0-1 seamlessly
          cos(angle).mul(0.5).add(0.5) // Maps to 0-1 seamlessly
        ).toVar();

        // Accumulate samples marching outward from center along the radial direction
        const illuminationDecay = float(1.0).toVar();
        const godRays = float(0.0).toVar();

        Loop(godRaySamples, ({ i }) => {
          const t = float(i).div(godRaySamples); // 0 -> 1 along the ray

          // Sample space: (radial progression, seamless angular coordinates)
          const sampleCoord = vec2(
            t.mul(GOD_RAYS_RADIAL_SCALE),
            seamlessCoords.x.mul(GOD_RAYS_ANGULAR_SCALE)
          );
          const sample = mx_noise_float(sampleCoord).mul(0.5).add(0.5);

          // Weight: stronger near origin (gives emanating feel)
          const weight = float(1.0).sub(t);
          godRays.addAssign(sample.mul(weight).mul(illuminationDecay));
          illuminationDecay.mulAssign(0.8);
        });
        godRays.mulAssign(distanceFromCenter.negate().add(0.6)); // Fade out toward edges

        return godRays;
      }
    ).setLayout({
      name: "getGodRays",
      type: "float",
      inputs: [
        { name: "position", type: "vec2" },
        { name: "distanceFromCenter", type: "float" },
      ],
    });

    const getPulsesColour = Fn(
      ([distanceFromCenter]: [
        distanceFromCenter: ShaderNodeObject<VarNode>
      ]) => {
        const ringSpeed = uPulsesSpeed.mul(time);

        const rings = sin(
          distanceFromCenter.mul(uPulsesFrequency).sub(ringSpeed)
        );
        const softenedRings = rings.mul(0.5).add(0.5);

        // Light waves palette
        const colourA = color(COLOUR_LIGHT_WAVES_LIGHT);
        const colourB = color(COLOUR_LIGHT_WAVES_DARK);

        const pulsesColor = vec4(
          mix(colourB, colourA, softenedRings),
          mix(0.1, 0.4, softenedRings)
        ).toVar();

        return pulsesColor;
      }
    ).setLayout({
      name: "getPulsesColour",
      type: "vec4",
      inputs: [{ name: "distanceFromCenter", type: "float" }],
    });

    const colorNode = Fn(() => {
      const finalColour = vec4(0.0, 0.0, 0.0, 0.0).toVar();

      // Rings radiating outward, controlled by uniforms
      const center = vec2(0.5);

      const currentUV = uv();
      const distanceFromCenter = distance(currentUV, center);
      const backgroundUV = screenUV.toVar();

      // Genrate noise for the background
      const backgroundNoise = mx_noise_float(
        screenUV.mul(8.0).add(time.mul(0.14))
      )
        .mul(0.5)
        .add(0.5)
        .toVar();
      // Fade the noise out toward the edges
      const radius = float(0.5);
      const softness = float(0.22);
      const noiseIntensity = smoothstep(
        radius,
        radius.sub(softness),
        distanceFromCenter
      );

      backgroundNoise.mulAssign(noiseIntensity);
      backgroundUV.y.addAssign(backgroundNoise);

      // Background gradient
      const backgroundColor = getFractalColor(backgroundUV);
      const backgroundIntensity = uLightAmount.mul(0.2).add(0.2);
      finalColour.assign(backgroundColor.mul(backgroundIntensity));

      // Radial god rays
      const godRays = getGodRays(positionGeometry.xy, distanceFromCenter);
      // Light amount boosts god rays intensity
      finalColour.addAssign(godRays.add(uLightAmount.mul(0.2)).mul(0.9));

      // Pulses overlay, gated by light amount
      const pulses = getPulsesColour(distanceFromCenter);
      finalColour.addAssign(pulses.mul(uLightAmount));

      // Water height visualization
      const h = heightStorage.element(vertexIndex);
      const peakColour = color("#fff");
      const bottomColour = color("#000");
      const v = clamp(h.mul(2.0), 0.0, 1.0);
      const heightColor = mix(bottomColour, peakColour, v);
      finalColour.xyz.addAssign(heightColor);

      // Grainy noise overlay
      const grainyNoise = getGrainyNoise(screenUV, float(800.0));
      finalColour.addAssign(grainyNoise.mul(0.2));

      return finalColour;
    })();

    const opacityNode = Fn(() => {
      const dist = distance(uv(), vec2(0.5));
      // Soft circular edge fade
      const radius = float(0.5);
      const softness = float(0.25);
      const opacity = smoothstep(radius, radius.sub(softness), dist);
      // Cut a circle out in the center of the plane
      const cutoutRadius = float(0.08);
      const cutoutSoftness = float(0.08);
      const cutout = smoothstep(
        cutoutRadius,
        cutoutRadius.sub(cutoutSoftness),
        dist
      ).oneMinus();

      opacity.mulAssign(cutout);
      opacity.mulAssign(0.8);

      return opacity;
    })();

    return {
      colorNode,
      opacityNode,
      computeHeight,
      uSpeedSmooth,
      uPulsesFrequency,
      uPulsesSpeed,
      uLightAmount,
      uPlayerPosition,
    };
  }, [godRaySamples, renderer, waterTextureSize, waterRippleRadius]);

  const lightAmount = useRef({ value: 0 });

  useGSAP(
    () => {
      const LIGHT_AMOUNTS: Record<Stage, number> = {
        [Stage.LANDING]: 0.0,
        [Stage.INTRO]: 0.0,
        [Stage.OUTER]: 0.1,
        [Stage.INNER]: 0.35,
        [Stage.CENTER]: 1.0,
      };

      const targetValue = LIGHT_AMOUNTS[stage];

      gsap.to(lightAmount.current, {
        value: targetValue,
        duration: 2,
        ease: "power2.out",
        onUpdate: () => {
          uLightAmount.value = lightAmount.current.value;
        },
      });
    },
    { dependencies: [stage, uLightAmount] }
  );

  return (
    <group>
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry
          args={[
            PLANE_SIZE,
            PLANE_SIZE,
            waterTextureSize - 1,
            waterTextureSize - 1,
          ]}
        />
        <meshLambertNodeMaterial
          key={colorNode.uuid}
          colorNode={colorNode}
          opacityNode={opacityNode}
          transparent={true}
          blending={AdditiveBlending}
          depthTest={false}
        />
      </mesh>

      <Player
        computeHeight={computeHeight}
        uPlayerPosition={uPlayerPosition}
        uSpeedSmooth={uSpeedSmooth}
      />
    </group>
  );
};
