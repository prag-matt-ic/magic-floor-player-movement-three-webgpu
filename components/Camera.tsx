"use client";

import { CameraControls, CameraControlsImpl } from "@react-three/drei";
import React, { type FC, useEffect, useRef } from "react";
import { MathUtils } from "three";

import { PLANE_RADIUS, Stage, useGameStore } from "@/hooks/useGameStore";

const { ACTION } = CameraControlsImpl;

const MIN_POLAR_ANGLE = MathUtils.degToRad(30);
const MAX_POLAR_ANGLE = MathUtils.degToRad(80);

export const STAGE_POSITION: Record<
  Stage,
  { x: number; y: number; z: number }
> = {
  [Stage.LANDING]: { x: 0, y: 16, z: PLANE_RADIUS + 3 },
  [Stage.INTRO]: { x: 0, y: 5, z: PLANE_RADIUS + 3 },
  [Stage.OUTER]: { x: 0, y: 2, z: PLANE_RADIUS + 2 },
  [Stage.INNER]: { x: 1.25, y: 1.5, z: PLANE_RADIUS },
  [Stage.CENTER]: { x: 0, y: 5, z: PLANE_RADIUS },
};

const STAGE_ZOOM: Record<Stage, number> = {
  [Stage.LANDING]: 1.0,
  [Stage.INTRO]: 1.0,
  [Stage.OUTER]: 1.4,
  [Stage.INNER]: 2.0,
  [Stage.CENTER]: 1.0,
};

type Props = {
  isMobile: boolean;
};

const Camera: FC<Props> = () => {
  const cameraControls = useRef<CameraControls>(null);
  const stage = useGameStore((s) => s.stage);
  const setStage = useGameStore((s) => s.setStage);

  useEffect(() => {
    const animateIntro = async () => {
      if (!cameraControls.current) return;
      const { x, y, z } = STAGE_POSITION[Stage.OUTER];
      await cameraControls.current.setLookAt(x, y, z, 0, 0, 0, true);
      setTimeout(() => {
        setStage(Stage.OUTER);
      }, 1800);
    };
    if (stage === Stage.INTRO) animateIntro();
  }, [stage, setStage]);

  useEffect(() => {
    if (stage === Stage.LANDING || stage === Stage.INTRO) return;
    if (!cameraControls.current) return;
    const { x, y, z } = STAGE_POSITION[stage];
    cameraControls.current.setLookAt(x, y, z, 0, 0, 0, true);
    cameraControls.current.zoomTo(STAGE_ZOOM[stage], true);
  }, [stage]);

  return (
    <CameraControls
      ref={cameraControls}
      minPolarAngle={MIN_POLAR_ANGLE}
      maxPolarAngle={MAX_POLAR_ANGLE}
      minDistance={3}
      maxDistance={11}
      minZoom={1}
      maxZoom={3}
      makeDefault={true}
      mouseButtons={{
        left: ACTION.ROTATE,
        middle: ACTION.NONE,
        right: ACTION.NONE,
        wheel: ACTION.ZOOM,
      }}
      touches={{
        one: ACTION.TOUCH_ROTATE,
        two: ACTION.NONE,
        three: ACTION.NONE,
      }}
    />
  );
};

export default Camera;
