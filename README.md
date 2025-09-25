# Split Fiction Inspired "Magic Floor" - Player movement ripple effect built with ThreeJS WebGPU 🎮 ✨

_I fell in love with a misty ethereal plane_ in a final chapter of Split Fiction... so I set about creating it for the web.

This serves no purpose except as a fun learning exercise for me - diving deeper into Three.js Shading Language.

Feel free to adapt and share.

Ps. There's no `GLSL` code in site! 😉

**[Have a play](https://magic-floor.vercel.app)**

![welcome](https://github.com/prag-matt-ic/magic-floor-player-movement-three-webgpu/blob/main/public/screenshots/welcome.png?raw=true)

## Split Fiction Game - The Inspiration

In the game you use a magic power to enable hidden surfaces so that you and your companion can move through the arena.

![reference](https://github.com/prag-matt-ic/magic-floor-player-movement-three-webgpu/blob/main/public/screenshots/reference.jpg?raw=true)

I think it looks amazing - radial god rays, pulsating rings, floating particles and the ripple of footsteps as you traverse over it.

## This Implementation

The project is built with Next.js, Three.js (React Three Fiber), GSAP, Zustand and a sprinkling of TailwindCSS.

### Player Movement

![move](https://github.com/prag-matt-ic/magic-floor-player-movement-three-webgpu/blob/main/public/screenshots/move.png?raw=true)

The player is controlled using keyboard input (WASD / Arrow keys).
Movement is calculated inside the `useFrame` loop which:

- Reads input and ramps speed up/down for smoother motion.
- Clamps position to inside the circular play area.
- Computes a bounce phase and vertical (Y) value.
- Updates the mesh's position and sets the shader uniforms.

### Water Simulation

The player's position drives a water ripple simulation "borrowed" from the [ThreeJS example here](https://github.com/mrdoob/three.js/blob/master/examples/webgpu_compute_water.html).

The `computeHeight` function runs over a square grid on the GPU, diffusing neighbor heights with viscosity and adding player‑driven impacts using `uPlayerPosition` and `uSpeedSmooth`.
The resulting height is visualised in the shader.

### Floor Plane

![floor](https://github.com/prag-matt-ic/magic-floor-player-movement-three-webgpu/blob/main/public/screenshots/floor.png?raw=true)

The floor plane is composed of a number of different colour generation functions, layered on top of each other.

One thing I loved about the inspiration was how it created the illusion of space beneath the plane. I gave a nod to this effect by using the screen UV coordinates (instead of the plane's) when generating the background gradient - the result is that wherever the camera is, the background faces directly at you.

Functions inside `colorNode`:

- `getFractalColor(uv)`: Generates the screen‑space background gradient by sampling fractal noise and mixing between dark and light tones.
- `getGodRays(position, distanceFromCenter)`: Computes rotating radial god rays from the center point.
- `getPulsesColour(uv, distanceFromCenter)`: Creates concentric ring pulses (color + alpha) that radiate outward over time.
- `getGrainyNoise(uv, scale)`: Adds a subtle film‑grain overlay to add texture.

### Cylindrical Text

The text is drawn onto an off‑screen 2D canvas sized to the cylinder’s surface.

This is then applied as a `CanvasTexture` to an open‑ended cylinder - so the message wraps around the scene.

When the stage changes, the current message is faded out, the new message drawn, and then faded back in again.
During idle phases there's an oscilating blur created by re-painting the text with a blur filter.

### Particles

Particle positions are generated in a WebGPU compute pass that distributes the points in a shallow hemisphere beneath the floor.

They are then animated gently using position, color, opacity and scale nodes.

## Hire Pragmattic

If you'd like to collaborate on this type of immersive web project, reach out to me at: [pragmattic.ltd@gmail.com](mailto:pragmattic.ltd@gmail.com)
