'use client'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { type FC } from 'react'
import {
  deltaTime,
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
} from 'three/tsl'
import { AdditiveBlending } from 'three/webgpu'

import { Stage, useGameStore } from '@/hooks/useGameStore'

const INTENSITY_STAGES: Record<Stage, number> = {
  [Stage.LANDING]: 0.5,
  [Stage.INTRO]: 0.5,
  [Stage.OUTER]: 0.75,
  [Stage.INNER]: 1.0,
  [Stage.CENTER]: 1.6,
}

const uIntensity = uniform(float(0.5))

const colorNode = Fn(() => {
  const currentUv = uv()
  const distanceToCenter = currentUv.distance(vec2(0.5))

  const noise = mx_noise_float(vec3(currentUv.mul(4.0), deltaTime))
    .mul(0.5)
    .add(0.5)
    .mul(0.1)

  const mixAmount = smoothstep(0.1, 0.35, distanceToCenter.add(noise))

  const colour = mix(vec4(1.0), vec4(1.0, 1.0, 1.0, 0.0), mixAmount).toVar()

  colour.a.mulAssign(uIntensity.min(1.0)) // Clamp max alpha to 1.0

  return colour
})()

// oscillating scale using sin function
const scaleNode = Fn(() => {
  const oscillation = sin(time).mul(0.5).add(0.5).mul(0.4).add(0.8)
  const scale = oscillation.mul(uIntensity)
  return scale
})()

const CentralOrb: FC = () => {
  const stage = useGameStore((s) => s.stage)

  useGSAP(() => {
    // Animate the intensity uniform based on the stage
    gsap.to(uIntensity, {
      value: INTENSITY_STAGES[stage],
      duration: 1.2,
      ease: 'power2.out',
    })
  }, [uIntensity, stage])

  return (
    <sprite position={[0, 0, 0]}>
      <spriteNodeMaterial
        transparent={true}
        depthTest={true}
        key={colorNode.uuid}
        colorNode={colorNode}
        scaleNode={scaleNode}
        blending={AdditiveBlending}
      />
    </sprite>
  )
}

export default CentralOrb
