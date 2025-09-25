"use client";
import { useFrame, useThree } from "@react-three/fiber";
import React, { FC, useEffect, useRef } from "react";
import * as THREE from "three";
import { ShaderNodeObject } from "three/tsl";
import { ComputeNode, UniformNode, WebGPURenderer } from "three/webgpu";

import {
  CENTER_RADIUS,
  PLANE_RADIUS,
  PLAYER_HEIGHT,
  PLAYER_INITIAL_POS,
  PLAYER_RADIUS,
  Stage,
  stageFromRadius,
  useGameStore,
} from "@/hooks/useGameStore";

const MAX_SPEED = 1.0;
const MOVE_SPEED = 2.0;
const ACCEL = 0.4;
const FRICTION = 0.6;
const WATER_SPEED_GAIN = 0.7; // scales uSpeedSmooth contribution

type Props = {
  computeHeight: ShaderNodeObject<ComputeNode>;
  uPlayerPosition: UniformNode<THREE.Vector4>; // uniform(vec4) (x,y,z,bouncePhase)
  uSpeedSmooth: UniformNode<number>; // uniform(float)
};

export const Player: FC<Props> = ({
  computeHeight,
  uPlayerPosition,
  uSpeedSmooth,
}) => {
  const renderer = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const stage = useGameStore((s) => s.stage);
  const setStage = useGameStore((s) => s.setStage);
  const playerSegments = useGameStore((s) => s.config.playerSegments);

  // Player input state
  const input = usePlayerInput();

  const playerMeshRef = useRef<THREE.Mesh>(null);

  const speedRef = useRef(0); // [0..1]
  const speedSmoothRef = useRef(0); // low-pass filtered speed
  const position = useRef(new THREE.Vector4(...PLAYER_INITIAL_POS, 0)); // x,y,z,bouncePhase

  const stageCheckCounterRef = useRef(0);
  // When leaving CENTER via UI (manual), temporarily disable auto stage detection
  const autoStageLockedRef = useRef(false);
  const prevStageRef = useRef(stage);

  function checkForNewStage() {
    const radius = Math.hypot(position.current.x, position.current.z);
    const newStage = stageFromRadius(radius);
    if (newStage !== stage) setStage(newStage);
  }

  function updatePlayerSpeed({
    intentLen,
    delta,
  }: {
    intentLen: number;
    delta: number;
  }) {
    // Speed ramp/decay
    const s = speedRef.current;
    if (intentLen > 0) {
      speedRef.current = Math.min(MAX_SPEED, s + ACCEL * delta);
    } else {
      const decay = Math.max(0, 1 - FRICTION * delta);
      speedRef.current = s * decay;
    }

    const lambda = 10;
    const alpha = 1 - Math.exp(-lambda * delta);
    speedSmoothRef.current +=
      (speedRef.current - speedSmoothRef.current) * alpha;

    uSpeedSmooth.value = speedSmoothRef.current * WATER_SPEED_GAIN;
  }

  function updatePlayerPosition({
    dx,
    dz,
    delta,
  }: {
    dx: number;
    dz: number;
    delta: number;
  }) {
    // Normalize intent like the compute pass: dir = v / max(len, 1)
    const len = Math.hypot(dx, dz);
    const denom = Math.max(len, 1);
    const dirX = dx / denom;
    const dirZ = dz / denom;

    // Step = MOVE_SPEED * speed * dt in X/Z
    const stepX = dirX * MOVE_SPEED * speedRef.current * delta;
    const stepZ = dirZ * MOVE_SPEED * speedRef.current * delta;

    let nx = position.current.x + stepX;
    let nz = position.current.z + stepZ;
    let nb = position.current.w; // bounce phase

    // Clamp to circular bounds with tiny inset to avoid jitter
    const allowed = PLANE_RADIUS - PLAYER_RADIUS;
    const r = Math.hypot(nx, nz);
    if (r > allowed) {
      const s = (allowed - 1e-3) / (r || 1);
      nx *= s;
      nz *= s;
    }

    // Bounce phase and Y calculation
    const minAmp = 0.01;
    const maxAmp = 0.08;
    const amp =
      minAmp + Math.pow(speedSmoothRef.current, 0.85) * (maxAmp - minAmp);
    const baseHz = 2.5;
    const hzGain = 2.5;
    const omega = (baseHz + speedSmoothRef.current * hzGain) * Math.PI * 2;
    nb = (nb + omega * delta) % (Math.PI * 2);
    const y = PLAYER_HEIGHT + amp * Math.sin(nb);

    position.current.set(nx, y, nz, nb);

    // Update player mesh position
    playerMeshRef.current!.position.set(
      position.current.x,
      position.current.y,
      position.current.z
    );
    // Update uniform for shaders/compute
    uPlayerPosition.value.set(
      position.current.x,
      position.current.y,
      position.current.z,
      position.current.w
    );
  }

  useEffect(() => {
    // Detect manual exit from CENTER -> INNER via UI
    if (prevStageRef.current === Stage.CENTER && stage === Stage.INNER) {
      autoStageLockedRef.current = true;
    }
    prevStageRef.current = stage;
  }, [stage]);

  useFrame((_, delta) => {
    if (!playerMeshRef.current) return;
    if (stage === Stage.LANDING || stage === Stage.INTRO) return;

    // Input direction
    let dx = 0;
    let dz = 0;
    // Block movement in CENTER stage
    const movementBlocked = stage === Stage.CENTER;
    if (!movementBlocked) {
      if (input.current.left) dx -= 1;
      if (input.current.right) dx += 1;
      if (input.current.forward) dz -= 1;
      if (input.current.backward) dz += 1;
    }

    const intentLen = Math.hypot(dx, dz);
    if (intentLen > 0) {
      dx /= intentLen;
      dz /= intentLen;
    }

    // If movement is blocked, still decay speed smoothly
    updatePlayerSpeed({ intentLen: movementBlocked ? 0 : intentLen, delta });

    // Update position; when blocked, this only updates bounce/Y and uniforms
    updatePlayerPosition({
      dx: movementBlocked ? 0 : dx,
      dz: movementBlocked ? 0 : dz,
      delta,
    });

    renderer.compute([computeHeight]);

    // Throttled stage check
    stageCheckCounterRef.current = (stageCheckCounterRef.current + 1) % 20;
    if (stageCheckCounterRef.current === 0) {
      // If we manually exited center but haven't actually moved outside the center radius,
      // keep auto stage detection locked to avoid snapping back to CENTER.
      if (autoStageLockedRef.current) {
        const radius = Math.hypot(position.current.x, position.current.z);
        if (radius > CENTER_RADIUS) {
          autoStageLockedRef.current = false;
        } else {
          return;
        }
      }
      // Do not auto-transition while in CENTER (UI-driven)
      if (stage !== Stage.CENTER) checkForNewStage();
    }
  });

  return (
    <mesh ref={playerMeshRef} position={PLAYER_INITIAL_POS}>
      <sphereGeometry args={[PLAYER_RADIUS, playerSegments, playerSegments]} />
      <meshBasicNodeMaterial color={"#ffffff"} />
    </mesh>
  );
};

type Input = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
};

function usePlayerInput() {
  const stage = useGameStore((s) => s.stage);
  const shouldListen = stage !== Stage.LANDING && stage !== Stage.INTRO;

  const input = useRef<Input>({
    forward: false,
    backward: false,
    left: false,
    right: false,
  });

  // Keyboard listeners (WASD + Arrows)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case "ArrowUp":
        case "KeyW":
          input.current.forward = true;
          break;
        case "ArrowDown":
        case "KeyS":
          input.current.backward = true;
          break;
        case "ArrowLeft":
        case "KeyA":
          input.current.left = true;
          break;
        case "ArrowRight":
        case "KeyD":
          input.current.right = true;
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case "ArrowUp":
        case "KeyW":
          input.current.forward = false;
          break;
        case "ArrowDown":
        case "KeyS":
          input.current.backward = false;
          break;
        case "ArrowLeft":
        case "KeyA":
          input.current.left = false;
          break;
        case "ArrowRight":
        case "KeyD":
          input.current.right = false;
          break;
      }
    };

    if (shouldListen) {
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [shouldListen]);

  return input;
}

export default Player;
