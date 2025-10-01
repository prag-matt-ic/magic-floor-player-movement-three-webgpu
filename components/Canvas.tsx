"use client";
import { PerformanceMonitor, Stats } from "@react-three/drei";
import { Canvas, extend, type ThreeToJSXElements } from "@react-three/fiber";
import { type FC, useLayoutEffect, useMemo, useState } from "react";
import { type WebGPURendererParameters } from "three/src/renderers/webgpu/WebGPURenderer.js";
import { color, Fn, mix, screenUV, smoothstep } from "three/tsl";
import {
  COLOUR_BACKGROUND_NODE_A,
  COLOUR_BACKGROUND_NODE_B,
} from "@/colours";
import { WebGPURenderer } from "three/webgpu";
import * as THREE from "three/webgpu";

// import Bloom from "./Bloom";
import { Stage, useGameStore } from "@/hooks/useGameStore";

import Camera, { STAGE_POSITION } from "./Camera";
import CentralOrb from "./CentralOrb";
import { Particles } from "./Particles";
import { MagicPlane } from "./Plane";
import TextCylinder from "./TextCylinder";

declare module "@react-three/fiber" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
extend(THREE as any);

type Props = {
  isMobile: boolean;
};

const MagicPlaneCanvas: FC<Props> = ({ isMobile }) => {
  const config = useGameStore((s) => s.config);
  const qualityMode = useGameStore((s) => s.qualityMode);
  const stepQuality = useGameStore((s) => s.stepQuality);
  const [dpr, setDpr] = useState(1);

  useLayoutEffect(() => {
    setDpr(Math.min(window.devicePixelRatio ?? 1, config.maxDPR));
  }, [config.maxDPR]);

  const backgroundNode = useMemo(() => {
    return Fn(() => {
      const mixAmount = smoothstep(0.1, 0.4, screenUV.y);
      return mix(
        color(COLOUR_BACKGROUND_NODE_A),
        color(COLOUR_BACKGROUND_NODE_B),
        mixAmount
      );
    })();
  }, []);

  if (isMobile) return null;

  return (
    <Canvas
      className="!fixed inset-0 !h-lvh cursor-grab active:cursor-grabbing"
      performance={{ min: 0.5, debounce: 300 }}
      scene={{ backgroundNode: backgroundNode }}
      camera={{
        position: [
          STAGE_POSITION[Stage.LANDING].x,
          STAGE_POSITION[Stage.LANDING].y,
          STAGE_POSITION[Stage.LANDING].z,
        ],
        far: 30,
        fov: 70,
      }}
      flat={true}
      dpr={dpr}
      gl={async (props) => {
        const renderer = new WebGPURenderer(props as WebGPURendererParameters);
        renderer.toneMapping = THREE.NeutralToneMapping;
        await renderer.init();
        return renderer;
      }}
    >
      <PerformanceMonitor
        // Create an upper/lower FPS band relative to device refresh rate
        // If avg fps > upper => incline (step quality up); if < lower => decline (step down)
        bounds={(refreshrate) => (refreshrate > 90 ? [50, 80] : [50, 60])}
        onIncline={() => stepQuality(true)}
        onDecline={() => stepQuality(false)}
        flipflops={3}
        onFallback={() => {
          console.log("performance fallback triggered");
        }}
      >
        <Stats />
        <ambientLight intensity={1} />
        {/* <OrbitControls
            makeDefault={true}
            minDistance={4}
            maxDistance={12}
            maxPolarAngle={degToRad(75)}
          /> */}
        <Camera isMobile={false} />
        <Particles key={qualityMode} />
        <TextCylinder />
        <CentralOrb key={qualityMode} />
        <MagicPlane key={qualityMode} />
        {/* <Bloom /> */}
      </PerformanceMonitor>
    </Canvas>
  );
};

export default MagicPlaneCanvas;
