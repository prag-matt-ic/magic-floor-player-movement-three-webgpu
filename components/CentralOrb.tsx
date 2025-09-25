"use client";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { type FC, useMemo } from "react";
import {
  color,
  float,
  Fn,
  mix,
  mx_noise_float,
  sin,
  smoothstep,
  time,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import * as THREE from "three/webgpu";

import { Stage, useGameStore } from "@/hooks/useGameStore";

const CentralOrb: FC = () => {
  const stage = useGameStore((s) => s.stage);

  const uIntensity = useMemo(() => uniform(float(0.5)), []);

  const colorNode = Fn(() => {
    const currentUv = uv();
    const distanceToCenter = currentUv.distance(vec2(0.5));

    const noise = mx_noise_float(
      vec3(currentUv.mul(2.0).mul(distanceToCenter.oneMinus()), time)
    ).mul(0.1);

    const mixAmount = smoothstep(
      0.4,
      0.1,
      distanceToCenter.add(noise)
    ).oneMinus();

    const colour = mix(
      vec4(color("#fff"), 1.0),
      vec4(color("#000"), 0.0),
      mixAmount
    ).toVar();

    colour.a.mulAssign(uIntensity.min(1.0)); // Clamp max alpha to 1.0

    return colour;
  })();

  // Create oscillating scale using sin function
  const scaleNode = Fn(() => {
    // sin oscillates between -1 and 1, so we map it to 0.8-1.2 range
    const oscillation = sin(time);
    const scale = oscillation.mul(0.2).add(0.8).mul(uIntensity); // Maps [-1,1] to [0.8,1.2]
    return scale;
  })();

  const INTENSITY_STAGES: Record<Stage, number> = {
    [Stage.LANDING]: 0.5,
    [Stage.INTRO]: 0.5,
    [Stage.OUTER]: 0.8,
    [Stage.INNER]: 1.2,
    [Stage.CENTER]: 2.2,
  };

  useGSAP(() => {
    // Update the intensity uniform based on the stage
    gsap.to(uIntensity, {
      value: INTENSITY_STAGES[stage],
      duration: 1.2,
      ease: "power2.out",
    });
  }, [uIntensity, stage]);

  return (
    <sprite position={[0, 0, 0]}>
      <spriteNodeMaterial
        transparent={true}
        depthTest={true}
        key={colorNode.uuid}
        colorNode={colorNode}
        scaleNode={scaleNode}
        blending={THREE.AdditiveBlending}
      />
    </sprite>
  );
};

export default CentralOrb;
