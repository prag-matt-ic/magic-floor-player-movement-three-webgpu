'use client'
import { PerformanceMonitor } from '@react-three/drei'
import { Canvas, extend, type ThreeToJSXElements } from '@react-three/fiber'
import { type FC, useLayoutEffect, useState } from 'react'
import { type WebGPURendererParameters } from 'three/src/renderers/webgpu/WebGPURenderer.js'
import { color, Fn, mix, screenUV, smoothstep } from 'three/tsl'
import { WebGPURenderer } from 'three/webgpu'
import * as THREE from 'three/webgpu'

import Camera, { STAGE_POSITION } from '@/components/Camera'
import CentralOrb from '@/components/CentralOrb'
import { Particles } from '@/components/Particles'
import { MagicPlane } from '@/components/Plane'
import TextCylinder from '@/components/TextCylinder'
// import Bloom from "@/components/Bloom";
import { Stage, useGameStore } from '@/hooks/useGameStore'

declare module '@react-three/fiber' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
extend(THREE as any)

type Props = {
  isMobile: boolean
}

const backgroundNode = Fn(() => {
  const mixAmount = smoothstep(0.1, 0.4, screenUV.y)
  return mix(color('#292826'), color('#191818'), mixAmount)
})()

const MagicPlaneCanvas: FC<Props> = ({ isMobile }) => {
  const config = useGameStore((s) => s.config)
  const qualityMode = useGameStore((s) => s.qualityMode)
  const onPerformanceChange = useGameStore((s) => s.onPerformanceChange)
  const [dpr, setDpr] = useState(1)

  useLayoutEffect(() => {
    setDpr(Math.min(window.devicePixelRatio ?? 1, config.maxDPR))
  }, [config.maxDPR])

  if (isMobile) return null

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
        const renderer = new WebGPURenderer(props as WebGPURendererParameters)
        renderer.toneMapping = THREE.NeutralToneMapping
        renderer.toneMappingExposure = 1.4
        await renderer.init()
        return renderer
      }}>
      <PerformanceMonitor
        // Create an upper/lower FPS band relative to device refresh rate
        // If avg fps > upper => incline (step quality up); if < lower => decline (step down)
        bounds={(refreshrate) => (refreshrate > 90 ? [50, 80] : [50, 60])}
        onIncline={() => onPerformanceChange(true)}
        onDecline={() => onPerformanceChange(false)}
        flipflops={2}
        onFallback={() => {
          console.warn('performance fallback triggered')
        }}>
        {/* <Stats /> */}
        <ambientLight intensity={1} />
        {/* <OrbitControls
            makeDefault={true}
            minDistance={4}
            maxDistance={12}
            maxPolarAngle={degToRad(75)}
          /> */}
        <Camera isMobile={false} />
        <Particles key={`${qualityMode}-particles`} />
        <TextCylinder />
        <CentralOrb key={`${qualityMode}-central-orb`} />
        <MagicPlane key={`${qualityMode}-magic-plane`} />
        {/* <Bloom /> */}
      </PerformanceMonitor>
    </Canvas>
  )
}

export default MagicPlaneCanvas
