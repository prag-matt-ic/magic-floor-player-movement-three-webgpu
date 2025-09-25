import { useFrame, useThree } from '@react-three/fiber'
import React, { FC, useEffect, useMemo, useRef } from 'react'
import {
  clamp,
  cos,
  deltaTime,
  float,
  Fn,
  If,
  instancedArray,
  instanceIndex,
  int,
  length,
  max,
  min,
  mod,
  PI2,
  positionGeometry,
  positionLocal,
  sin,
  transformNormalToView,
  uniform,
  vec2,
  vec3,
  vec4,
  vertexIndex,
} from 'three/tsl'
import { AdditiveBlending, StorageTexture, WebGPURenderer } from 'three/webgpu'

import {
  PLANE_RADIUS,
  PLANE_SIZE,
  PLAYER_HEIGHT,
  PLAYER_INITIAL_POS,
  PLAYER_RADIUS,
} from '@/hooks/useGameStore'

// Movement tuning (reduced ramp and top speed influence)
const MOVE_SPEED = 2.1
const ACCEL = 0.28
const FRICTION = 1.0

// Water sim config
const WIDTH = 256 // grid resolution
const BOUNDS = PLANE_SIZE // physical size mapped to plane size

export const PlayerWater: FC = () => {
  const renderer = useThree((s) => s.gl) as unknown as WebGPURenderer

  const inputRef = usePlayerInput()

  // CPU mirrors
  const speedRef = useRef(0)
  const speedSmoothRef = useRef(0)

  const {
    colorNode,
    playerPositionNode,
    computePlayerPosition,
    computeHeight,
    uPlayerVelocity,
    uPlayerSpeed,
    uSpeedSmooth,
    waterMeshProps,
  } = useMemo(() => {
    // Player state buffer
    const playerPositionBuffer = instancedArray(
      new Float32Array([...PLAYER_INITIAL_POS, 0]),
      'vec4',
    )

    const uPlayerVelocity = uniform(vec2(0.0, 0.0))
    const uPlayerSpeed = uniform(float(0.0))
    const uSpeedSmooth = uniform(float(0.0))

    // Water params
    const uViscosity = uniform(float(0.965))
    const uImpactDepth = uniform(float(0.2))
    const uImpactSize = uniform(float(0.35))
    const uActiveRadius = uniform(float(5.0))

    // Height storages (float per grid cell)
    const count = WIDTH * WIDTH
    const heightArray = new Float32Array(count)
    const prevHeightArray = new Float32Array(count)
    // Initialize to zero
    for (let i = 0; i < count; i++) {
      heightArray[i] = 0
      prevHeightArray[i] = 0
    }
    const heightStorage = instancedArray(heightArray, 'float').setName('Height')
    const prevHeightStorage = instancedArray(prevHeightArray, 'float').setName('PrevHeight')

    // Helpers for neighbor indices/values in TSL form
    const getNeighborIndices = (index: any) => {
      const width = float(WIDTH)
      const x = int(index.mod(WIDTH))
      const y = int(index.div(WIDTH))

      const leftX = max(0, x.sub(1))
      const rightX = min(x.add(1), int(width.sub(1)))

      const bottomY = max(0, y.sub(1))
      const topY = min(y.add(1), int(width.sub(1)))

      const westIndex = y.mul(int(width)).add(leftX)
      const eastIndex = y.mul(int(width)).add(rightX)
      const southIndex = bottomY.mul(int(width)).add(x)
      const northIndex = topY.mul(int(width)).add(x)

      return { northIndex, southIndex, eastIndex, westIndex }
    }

    const getNeighborValues = (index: any, store: any) => {
      const { northIndex, southIndex, eastIndex, westIndex } = getNeighborIndices(index)
      const north = store.element(northIndex).toVar()
      const south = store.element(southIndex).toVar()
      const east = store.element(eastIndex).toVar()
      const west = store.element(westIndex).toVar()
      return { north, south, east, west }
    }

    const getNormalsFromHeight = (index: any, store: any) => {
      const { north, south, east, west } = getNeighborValues(index, store)
      const normalX = west.sub(east).mul(WIDTH / BOUNDS)
      const normalY = south.sub(north).mul(WIDTH / BOUNDS)
      return { normalX, normalY }
    }

    // Compute: update water height field
    const computeHeight = Fn(() => {
      const height = heightStorage.element(instanceIndex).toVar()
      const prevHeight = prevHeightStorage.element(instanceIndex).toVar()

      // Map instanceIndex -> normalized uv in [0..1]
      const x = float(instanceIndex.mod(WIDTH)).mul(1 / WIDTH)
      const y = float(instanceIndex.div(WIDTH)).mul(1 / WIDTH)
      const center = vec2(0.5)

      // Player position, bounce phase, and smoothed speed influence
      const player = playerPositionBuffer.element(0).toVar()
      const playerPos = vec2(player.x, player.z)
      const speedLen = uSpeedSmooth // use smoothed speed (0..1)
      const bouncePhase = player.w
      const bounceDown = sin(bouncePhase).negate().max(0.0) // 0..1 when on downstroke

      // Distance from this cell (in plane space) to playerPos
      const posInPlane = vec2(x, y).sub(center).mul(BOUNDS).toVar()
      const dist = length(posInPlane.sub(playerPos)).toVar()

      // Skip cells outside active radius: keep flat and avoid work
      If(dist.greaterThan(uActiveRadius), () => {
        prevHeightStorage.element(instanceIndex).assign(0.0)
        heightStorage.element(instanceIndex).assign(0.0)
      }).Else(() => {
        const { north, south, east, west } = getNeighborValues(instanceIndex, heightStorage)

        const neighborHeight = north.add(south).add(east).add(west).mul(0.5)
        const newHeight = neighborHeight.sub(prevHeight).mul(uViscosity).toVar()

        const phase = clamp(dist.mul(Math.PI).div(uImpactSize), 0.0, Math.PI)
        const impact = cos(phase).add(1.0).mul(uImpactDepth).mul(speedLen).mul(bounceDown)
        newHeight.addAssign(impact)

        // Commit swap buffers
        prevHeightStorage.element(instanceIndex).assign(height)
        heightStorage.element(instanceIndex).assign(newHeight)
      })
    })().compute(WIDTH * WIDTH)

    const uBaseY = uniform(float(PLAYER_HEIGHT))

    const computePlayerPosition = Fn(() => {
      const pos = playerPositionBuffer.element(0).toVar()
      const v = uPlayerVelocity.toVar()
      const len = v.length().toVar()
      const dirX = v.x.div(len.max(1.0)).toVar()
      const dirZ = v.y.div(len.max(1.0)).toVar()
      const stepX = dirX.mul(MOVE_SPEED).mul(uPlayerSpeed).mul(deltaTime).toVar()
      const stepZ = dirZ.mul(MOVE_SPEED).mul(uPlayerSpeed).mul(deltaTime).toVar()

      const candX = pos.x.add(stepX).toVar()
      const candZ = pos.z.add(stepZ).toVar()
      const allowed = float(PLANE_RADIUS - PLAYER_RADIUS)
      const cand = vec2(candX, candZ).toVar()
      const r = cand.length().toVar()

      If(r.greaterThan(allowed), () => {
        const inset = float(1e-3)
        const clamped = cand.div(r.max(1e-6)).mul(allowed.sub(inset))
        pos.x.assign(clamped.x)
        pos.z.assign(clamped.y)
      }).Else(() => {
        pos.x.assign(cand.x)
        pos.z.assign(cand.y)
      })

      // Bounce synced to ripples (phase stored in w)
      const minAmp = float(0.02)
      const maxAmp = float(0.075)
      const amp = minAmp.add(uSpeedSmooth.pow(0.85).mul(maxAmp.sub(minAmp)))
      const baseHz = float(2.5)
      const hzGain = float(2.5)
      const omega = baseHz.add(uSpeedSmooth.mul(hzGain)).mul(PI2)
      pos.w.addAssign(omega.mul(deltaTime))
      pos.w.assign(mod(pos.w, PI2))
      const bounceY = uBaseY.add(amp.mul(sin(pos.w)))
      pos.y.assign(bounceY)

      playerPositionBuffer.element(0).assign(pos)
    })().compute(1)

    // Prepare compute
    renderer.computeAsync([computeHeight])

    // Player attribute and nodes
    const playerPositionAttribute = playerPositionBuffer.toAttribute()
    const playerPositionNode = Fn(() => {
      const p = positionGeometry.toVar()
      p.addAssign(playerPositionAttribute.xyz)
      return p
    })()

    // Water plane nodes (deform with heightStorage)
    const normalNode = Fn(() => {
      const n = getNormalsFromHeight(vertexIndex, heightStorage)
      return transformNormalToView(vec3(n.normalX, n.normalY.negate(), 1.0)).toVertexStage()
    })()

    const positionNode = Fn(() => {
      // Reduce visual displacement so waves are subtler
      const h = heightStorage.element(vertexIndex)
      return vec3(positionLocal.x, positionLocal.y, h.mul(0.08))
    })()

    const colorNode = Fn(() => {
      // Visualize height as grayscale: higher = brighter
      const h = heightStorage.element(vertexIndex)
      const v = clamp(h, 0.0, 1.0) // scale and clamp for visibility
      return vec4(vec3(v), 1.0)
    })()

    const waterMeshProps = {
      normalNode,
      positionNode,
    }

    return {
      colorNode,
      playerPositionNode,
      computePlayerPosition,
      computeHeight,
      uPlayerVelocity,
      uPlayerSpeed,
      uSpeedSmooth,
      waterMeshProps,
    }
  }, [renderer])

  useFrame((_, delta) => {
    // Input intent
    let dx = 0
    let dz = 0
    const input = inputRef.current
    if (input.left) dx -= 1
    if (input.right) dx += 1
    if (input.forward) dz -= 1
    if (input.backward) dz += 1

    const intentLen = Math.hypot(dx, dz)
    if (intentLen > 0) {
      dx /= intentLen
      dz /= intentLen
    }

    // Speed ramp/decay
    const MAX_SPEED = 1.0
    const s = speedRef.current
    if (intentLen > 0) {
      speedRef.current = Math.min(MAX_SPEED, s + ACCEL * delta)
    } else {
      const decay = Math.max(0, 1 - FRICTION * delta)
      speedRef.current = s * decay
    }

    // Update GPU uniforms
    uPlayerVelocity.value.set(dx, dz)
    uPlayerSpeed.value = speedRef.current
    const lambda = 10
    const alpha = 1 - Math.exp(-lambda * delta)
    speedSmoothRef.current += (speedRef.current - speedSmoothRef.current) * alpha
    uSpeedSmooth.value = speedSmoothRef.current

    // Compute updates
    renderer.compute([computePlayerPosition, computeHeight])
  })

  return (
    <group>
      {/* Water plane */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[PLANE_SIZE, PLANE_SIZE, WIDTH - 1, WIDTH - 1]} />
        <meshStandardNodeMaterial
          key={colorNode.uuid}
          colorNode={colorNode}
          color={'#88aaff'}
          metalness={0.1}
          roughness={0.05}
          transparent={true}
          // normalNode={waterMeshProps.normalNode}
          positionNode={waterMeshProps.positionNode}
          depthWrite={true}
        />
      </mesh>

      {/* Player sphere */}
      <mesh>
        <sphereGeometry args={[PLAYER_RADIUS, 24, 24]} />
        <meshBasicNodeMaterial
          key={playerPositionNode.uuid}
          positionNode={playerPositionNode}
          color={'#ffffff'}
        />
      </mesh>
    </group>
  )
}

function usePlayerInput() {
  type Input = {
    forward: boolean
    backward: boolean
    left: boolean
    right: boolean
  }

  const input = useRef<Input>({
    forward: false,
    backward: false,
    left: false,
    right: false,
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          input.current.forward = true
          break
        case 'ArrowDown':
        case 'KeyS':
          input.current.backward = true
          break
        case 'ArrowLeft':
        case 'KeyA':
          input.current.left = true
          break
        case 'ArrowRight':
        case 'KeyD':
          input.current.right = true
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          input.current.forward = false
          break
        case 'ArrowDown':
        case 'KeyS':
          input.current.backward = false
          break
        case 'ArrowLeft':
        case 'KeyA':
          input.current.left = false
          break
        case 'ArrowRight':
        case 'KeyD':
          input.current.right = false
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  return input
}
