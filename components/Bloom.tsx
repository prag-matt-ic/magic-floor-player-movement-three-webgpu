'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import { type FC, useEffect, useMemo, useRef } from 'react'
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js'
import { blendScreen, float, mix, mrt, output, pass, uniform } from 'three/tsl'
import { WebGPURenderer } from 'three/webgpu'
import * as THREE from 'three/webgpu'

// https://github.com/ektogamat/r3f-webgpu-starter/blob/main/src/components/WebGPUPostProcessing.js

const Bloom: FC = () => {
  const scene = useThree((s) => s.scene)
  const renderer = useThree((s) => s.gl) as unknown as WebGPURenderer
  const camera = useThree((s) => s.camera)
  const postProcessing = useRef<THREE.PostProcessing | null>(null)

  const uBloomMix = useMemo(() => {
    return uniform(float(1.0))
  }, [])

  const { isEnabled, bloomIntensity } = useControls('Bloom', {
    isEnabled: true,
    bloomMix: {
      value: 1.0,
      min: 0,
      max: 1,
      step: 0.1,
      onChange: (v) => {
        uBloomMix.value = v
      },
    },
    bloomIntensity: {
      value: 0.3,
      min: 0,
      max: 3,
      step: 0.1,
    },
  })

  useEffect(() => {
    if (!renderer || !scene || !camera) return

    if (isEnabled) {
      const scenePass = pass(scene, camera, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      })

      // Setup Multiple Render Targets (MRT)
      scenePass.setMRT(
        mrt({
          output,
        }),
      )

      // Get texture nodes - these represent the rendered outputs
      const scenePassColor = scenePass.getTextureNode('output')
      // const scenePassEmissive = scenePass.getTextureNode('emissive')

      // Apply bloom with dynamic intensity
      // 1 - Generate bloom pass
      // 2 - Blend it over the scene colour based on intensity uniform
      // This prevents details being lost in the bloom pass
      const bloomPass = bloom(scenePassColor, bloomIntensity, 0.3)
      const finalPass = mix(scenePassColor, blendScreen(bloomPass, scenePassColor), uBloomMix)

      postProcessing.current = new THREE.PostProcessing(renderer)
      postProcessing.current.outputNode = finalPass
    }

    return () => {
      postProcessing.current?.dispose()
      postProcessing.current = null
    }
  }, [camera, renderer, scene, bloomIntensity, uBloomMix, isEnabled])

  useFrame(({ gl }) => {
    if (!isEnabled) return gl.render(scene, camera)
    if (!postProcessing.current) return
    gl.clear()
    postProcessing.current.render()
  }, 1) // Priority 1 ensures this runs after the main scene render

  return null
}

export default Bloom
