"use client";
import { useFont } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { type FC, useMemo } from "react";
import {
  TextGeometry,
  TextGeometryParameters,
} from "three/examples/jsm/Addons.js";
import {
  color,
  cos,
  float,
  Fn,
  instancedArray,
  instanceIndex,
  mix,
  positionLocal,
  sin,
  smoothstep,
  storage,
  uv,
} from "three/tsl";
import { StorageBufferAttribute, WebGPURenderer } from "three/webgpu";

import { PLANE_RADIUS } from "@/hooks/useGameStore";

import { getGrainyNoise } from "../tslHelpers";

const FONT_PATH = "/Poppins SemiBold_Regular.json";

const HEADING = "MAGIC PLANE by Pragmattic";

// This wraps 3D text around a radius. I chose to use 2D canvas texture instead because I wanted to cheaply blur it and adjust opacity.

// Convert font to JSON
// https://gero3.github.io/facetype.js/

// Reference
// https://github.com/armdz/tsl_elastic_vertex_destruction/blob/main/src/main.js

const Text3D: FC = () => {
  const font = useFont(FONT_PATH);
  const renderer = useThree((s) => s.gl) as unknown as WebGPURenderer;

  const { textGeometry, positionNode, colorNode } = useMemo(() => {
    const SIZE = 1.2;

    const textParameters: TextGeometryParameters = {
      // @ts-expect-error mismatch
      font: font,
      size: SIZE,
      depth: 0.04,
      bevelEnabled: false,
      bevelThickness: 0.05,
      bevelSize: 0.01,
      bevelOffset: 0,
      bevelSegments: 1,
    };

    const textGeometry = new TextGeometry(HEADING, textParameters);

    textGeometry.computeBoundingBox();
    textGeometry.center();
    textGeometry.translate(0, 0.4, -PLANE_RADIUS);

    const count = textGeometry.attributes.position.count;

    const positions = instancedArray(
      textGeometry.attributes.position.array,
      "vec3"
    );

    const positionStorage = storage(
      new StorageBufferAttribute(count, 3),
      "vec3"
    );

    const initPositions = Fn(() => {
      const originalPosition = positions.element(instanceIndex).toVar();

      // Convert radius to a float node for TSL operations
      const radius = float(PLANE_RADIUS);

      // Calculate the angle based on X position (arc length / radius)
      const angle = originalPosition.x.div(radius);

      // Place the vertex on the circumference of the circle
      // X = radius * sin(angle), Z = radius - radius * cos(angle) (to curve inward toward center)
      const circleX = radius.mul(sin(angle));
      const circleZ = radius.sub(radius.mul(cos(angle)));

      // Assign the new positions (keeping Y unchanged)
      originalPosition.x.assign(circleX);
      originalPosition.z.assign(circleZ.add(originalPosition.z)); // Add original Z offset for text depth

      positionStorage.element(instanceIndex).assign(originalPosition);
    })().compute(count);

    renderer.computeAsync([initPositions]);

    const positionNode = positionStorage.toAttribute();

    const colorNode = Fn(() => {
      const positionY = positionLocal.y.toVar();
      const UV = uv().toVar();

      const mixAmount = smoothstep(0.0, SIZE, positionY);

      const colour = mix(color("#FDFCFA"), color("#C7C1B3"), mixAmount);

      // Grainy noise overlay
      const grainyNoise = getGrainyNoise(UV, float(80.0));
      const noiseColour = color("#686359");
      colour.assign(mix(colour, noiseColour, grainyNoise.mul(0.9)));

      return colour;
    })();

    return { textGeometry, positionNode, colorNode };
  }, [renderer, font]);

  return (
    <mesh>
      <primitive object={textGeometry} attach="geometry" />
      <meshBasicNodeMaterial
        color={"#fff"}
        depthTest={false}
        key={colorNode.uuid}
        positionNode={positionNode}
        colorNode={colorNode}
      />
    </mesh>
  );
};
export default Text3D;

useFont.preload(FONT_PATH);
