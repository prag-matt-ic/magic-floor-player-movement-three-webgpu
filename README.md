## Inspiration

I set out to capture the essence of a shimmering, ethereal floor I'd seen (and loved) in the Split Fiction game - rippling footsteps, radial light, drifting particles.

The result is a WebGPU-powered plane that reacts to player movement and evolves with lighting and pulses.

**[Have a play](https://magic-floor.vercel.app)**

![Reference](https://github.com/prag-matt-ic/magic-floor-player-movement-three-webgpu/blob/main/public/screenshots/reference.jpg?raw=true)

## Overview

This project serves no purpose except as a fun learning exercise and mini showcase.

Feel free to adapt and share.

### Tech Stack

- **Next.js**
- **React Three Fiber** (WebGPU renderer)
- **Three.js Shading Language** (TSL) for node-based shading - There's no `GLSL` code in site!
- **Zustand** for state management
- **GSAP** for timelines
- **Tailwind** for UI styling

## Player Movement

Keyboard input (WASD/Arrows) is captured in an event listener and stored in a ref.

Inside the frame hook, there are 2 helper functions:

- `updatePlayerSpeed` - eases the speed up/down for smoother motion, and sets the speed uniform.
- `updatePlayerPosition` - calculates the new player position and clamps it to the arena; calculates the bounce; sets the mesh position; and updates the shader uniform.

In order to synchronise the mesh position with the ripple impact, an additional 'bounce' value is stored in the player position vector.

Finally, the `renderer.compute([computeHeight])` is called to update the ripple simulation.

[👉 Player Code Here 👈](https://github.com/prag-matt-ic/magic-floor-player-movement-three-webgpu/blob/main/components/Player.tsx)

## Water Ripple Simulation

The player's position and speed drive a simple, efficient height-field simulation.

When the player bounces down at speed, it applies an impulse that spreads out as ripples.

The `computeHeight` function runs over a square grid on the GPU, diffusing neighbor heights with viscosity.
The resulting height is visualised in the shader.

The water ripple simulation was gratefully "borrowed" from the [ThreeJS example here](https://github.com/mrdoob/three.js/blob/master/examples/webgpu_compute_water.html).

## Floor Plane Shading

![Plane shaders](https://github.com/prag-matt-ic/magic-floor-player-movement-three-webgpu/blob/main/public/screenshots/plane.png?raw=true)

The surface is coloured using several functions layered together:

- `getFractalColour`: background gradient with fractal noise
- `getGodRays`: soft radial beams from the center
- `getPulsesColour`: concentric pulses that breathe over time
- `getHeightColour`: visualises water simulation height
- `getGrainyNoise`: adds subtle film grain for texture

In combination these create a rich, dynamic surface that changes over time and with player movement.

[👉 Plane Code Here 👈](https://github.com/prag-matt-ic/magic-floor-player-movement-three-webgpu/blob/main/components/Plane.tsx)

## 3D Wrapped Text with Noise and Blur

![Cylindrical text](https://github.com/prag-matt-ic/magic-floor-player-movement-three-webgpu/blob/main/public/screenshots/text.png?raw=true)

I experimented first with true 3D text, but it was not going to be easy or performant to apply the effects that I wanted (e.g blur and noise).

So I opted for a texture based approach instead. Seeing as the text is on the outside, having it "flat" isn't a big deal.

The text is drawn to an off-screen 2D canvas sized to match the cylinder's surface.
It's then applied to the node material as a `CanvasTexture`.
This allows me to easily apply an additional noise effect in the `colorNode` to give it a grainy, imperfect look.

On stage changes (as the player moves closer to the center), GSAP is used to blur out, update the text, and then blur back in.
Between these stage transitions it gently animates between transparent blurred and opaque sharp.

[👉 Text Code Here 👈](https://github.com/prag-matt-ic/magic-floor-player-movement-three-webgpu/blob/main/components/TextCylinder.tsx)

## Drifting Particles

![Particles](https://github.com/prag-matt-ic/magic-floor-player-movement-three-webgpu/blob/main/public/screenshots/particles.png?raw=true)

Particles are distributed in a shallow hemisphere under the plane in an initial compute pass.
They then drift and flicker using custom position and opacity nodes.

## The future of Web(GPU) is bright

It's becoming increasingly feasible to build complex, game-like web experiences that run almost as smoothly as native apps.

**As hardware continues to improve, I predict that more web experiences will utilise GPU capabilities and 3D environments to deliver rich, interactive content.**

I'm excited for the future of `WebGPU` and `TSL` - these advancements empower web developers to bring ambitious ideas to life with greater ease and performance.

[Live Demo](https://magic-floor.vercel.app)
