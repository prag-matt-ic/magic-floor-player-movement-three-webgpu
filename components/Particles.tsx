import { useThree } from '@react-three/fiber'
import React, { type FC, useMemo } from 'react'
import { AdditiveBlending } from 'three'
import {
  color,
  cos,
  distance,
  float,
  Fn,
  hash,
  instancedArray,
  instanceIndex,
  mix,
  mod,
  mx_noise_float,
  PI2,
  positionWorld,
  pow,
  sin,
  smoothstep,
  step,
  time,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'
import { WebGPURenderer } from 'three/webgpu'

import { PLANE_RADIUS, useGameStore } from '@/hooks/useGameStore'

import { rotate2D } from '../utils/tslHelpers'

export const Particles: FC = () => {
  const particleCount = useGameStore((s) => s.config.particleCount)
  const renderer = useThree((s) => s.gl) as unknown as WebGPURenderer

  const { key, positionNode, colorNode, opacityNode, scaleNode } = useMemo(() => {
    const seeds = new Float32Array(particleCount)
    for (let i = 0; i < particleCount; i += 1) {
      seeds[i] = Math.random()
    }

    const seedBuffer = instancedArray(seeds, 'float')
    const positionBuffer = instancedArray(particleCount, 'vec3')

    const maxRadius = float(PLANE_RADIUS - 1)

    const initPositions = Fn(() => {
      const idx = instanceIndex.toVar()
      const seed = seedBuffer.element(idx).toVar()
      const position = positionBuffer.element(idx)
      const idxFloat = float(instanceIndex)

      // Generate random values using noise
      const noise1 = mx_noise_float(vec3(seed, idxFloat, seed.pow2()))

      const noise2 = mx_noise_float(vec3(seed.add(0.5), idxFloat.mul(0.7), seed.mul(2.34)))
      const noise3 = mx_noise_float(vec3(seed.mul(0.8), idxFloat.add(1.0), seed.add(3.45)))

      // Radius: 0 to maxRadius
      const radius = seed.mul(maxRadius).sub(noise1)

      // Theta (azimuth): 0 to 2π
      const theta = noise2.mul(PI2)

      // Phi (elevation): π/2 to π for bottom half-sphere, biased towards π/2 for denser near Y=0
      const phiBias = pow(noise3, float(2.0)) // Exponent >1 makes distribution denser near 0
      const phi = mix(float(Math.PI / 2.0), PI2, phiBias)

      // Convert to Cartesian coordinates
      const sinPhi = sin(phi)
      const cosPhi = cos(phi)
      const sinTheta = sin(theta)
      const cosTheta = cos(theta)

      const x = radius.mul(sinPhi).mul(cosTheta)
      const y = radius.mul(cosPhi) // Negative for bottom half
      const z = radius.mul(sinPhi).mul(sinTheta)

      position.assign(vec3(x, y, z))
    })().compute(particleCount)

    renderer.computeAsync([initPositions])

    const basePositionAttribute = positionBuffer.toAttribute().xyz
    const seedAttribute = seedBuffer.toAttribute()

    const lateralStrength = float(0.3)
    const quarterTurn = PI2.mul(0.5)

    const positionNode = Fn(() => {
      const position = basePositionAttribute.toVar()
      const seed = seedAttribute.toVar()
      const phase = hash(seed).mul(PI2)

      // Apply Y-axis rotation (XZ plane)
      const rotYA = rotate2D(time.mul(0.05).add(phase))
      position.xz.mulAssign(rotYA)

      const driftPhase = time.mul(0.4).add(phase)
      position.x.subAssign(sin(driftPhase).mul(lateralStrength))
      position.z.subAssign(sin(driftPhase.add(quarterTurn)).mul(lateralStrength))

      return position
    })()

    const colorNode = Fn(() => {
      const particleDistanceFromCenter = distance(positionWorld.xz, vec2(0.0))

      const softness = smoothstep(float(0.0), float(2.0), particleDistanceFromCenter)

      const centeredUv = uv().distance(vec2(0.5))
      const sharpCircle = step(0.5, centeredUv).oneMinus()
      const softCircle = smoothstep(0.0, 0.35, centeredUv).oneMinus()
      const circle = mix(sharpCircle, softCircle, softness)
      const c = color('#fff')
      return vec4(c, circle)
    })()

    // Simple flickering opacity (seed-based phase + varying speed)
    const opacityNode = Fn(() => {
      const seedValue = seedAttribute.toVar()
      // Per-particle offset and period to desync cycles
      const offset = hash(seedValue.mul(3.0))
      const period = mix(float(3.0), float(6.0), hash(seedValue.mul(7.0))).toVar()
      // Cycle time within [0, period)
      const tCycle = mod(time.add(offset.mul(period)), period).toVar()
      const fadeDuration = period.mul(0.3).toVar()
      // Fade in and out across the cycle
      const fadeIn = smoothstep(0.0, fadeDuration, tCycle)
      const fadeOut = float(1.0).sub(smoothstep(period.sub(fadeDuration), period, tCycle))
      const flickerAlpha = fadeIn.mul(fadeOut)
      // Map to usable opacity range (keeps prior look)
      return mix(float(0.1), float(0.6), flickerAlpha)
    })()

    const minSize = float(0.3)
    const maxSize = float(0.5)

    const scaleNode = Fn(() => {
      const seedValue = seedAttribute.toVar()
      const randomSize = mix(minSize, maxSize, seedValue)
      const distanceFromCenter = distance(positionWorld, vec3(0.0))
      const attenuation = smoothstep(float(PLANE_RADIUS), float(1.0), distanceFromCenter)
        .oneMinus()
        .add(0.3)
      return randomSize.mul(attenuation)
    })()

    return {
      key: positionNode.uuid,
      positionNode,
      colorNode,
      opacityNode,
      scaleNode,
    }
  }, [particleCount, renderer])

  return (
    <instancedMesh
      key={particleCount}
      position={[0, 0, 0]}
      args={[undefined, undefined, particleCount]}
      frustumCulled={false}>
      <planeGeometry args={[0.1, 0.1]} />
      <spriteNodeMaterial
        key={key}
        positionNode={positionNode}
        colorNode={colorNode}
        opacityNode={opacityNode}
        scaleNode={scaleNode}
        transparent={true}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </instancedMesh>
  )
}
