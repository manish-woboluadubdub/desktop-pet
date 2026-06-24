# Desktop Pet - Technical Q&A

This document provides answers to technical questions regarding the design, optimization, and system integration of the Desktop Pet application.

---

### Q1: Did you write the animation engine?
**Yes.** The application uses a custom-built, lightweight hybrid animation system designed from scratch without any external dependencies (like GSAP, Anime.js, or Velocity.js). 

*   **Logic & Movement Control**: The high-level game loop is written in JavaScript ([pet.js](file:///c:/Users/devop/OneDrive/Desktop/desktop-pet/pet.js#L796-L826)) using the browser's `requestAnimationFrame` API. It dynamically updates the window position by calculating distances, velocities, and tracking the cursor or wander path.
*   **Visual Rendering**: The individual visual parts of the pet (ears, tail, eyes, legs) are styled and animated in CSS using `@keyframes` (like `cat-step`, `cat-bob`, `cat-wag`, and `cat-blink`). State transitions (e.g., from `WALK` to `SLEEP` or `ANGRY`) are handled by updating the pet element's CSS classes in JavaScript, which prompts the browser to render the corresponding CSS animations.

---

### Q2: How do you handle multiple monitors?
Multiple monitors are managed dynamically by leveraging Electron's `screen` API:

*   **Active Display Tracking**: The main process ([main.js](file:///c:/Users/devop/OneDrive/Desktop/desktop-pet/main.js#L167-L173)) tracks where the pet window or cursor is located. It calls `screen.getDisplayNearestPoint()` to get the display coordinates of that location.
*   **Bounding Coordinates**: The active display's `workArea` (which excludes OS taskbars/docks) is sent to the renderer. The renderer ([pet.js](file:///c:/Users/devop/OneDrive/Desktop/desktop-pet/pet.js#L187-L194)) clamps the pet's coordinates (`posX`, `posY`) relative to `screenBounds.x` and `screenBounds.y` rather than assuming a single screen coordinate system starting at `(0,0)`.
*   **Layout Changes**: We listen to Electron's display change events (`display-added`, `display-removed`, and `display-metrics-changed`). When the monitor configuration changes, the main process signals the renderer to re-query the screen bounds and automatically re-align/clamp the pet's position (e.g. keeping it tucked into the corner of the current display even if the monitor layout changed while it was asleep).

---

### Q3: What is the CPU usage while idle?
The idle CPU usage is **extremely close to 0%** thanks to the following resource optimizations:

*   **Dynamic Animation Pausing**: When the pet enters the `SLEEP` state, the 60-FPS rendering engine loop (`requestAnimationFrame`) is completely paused. The application stops requesting new frames and stops tracking the cursor.
*   **Background Needs Ticking**: While asleep, the app drops back to a slow interval timer (running once every 1.5 seconds) just to update needs (hunger, sleepiness, anger), eliminating redundant operations.
*   **Smart Cursor Tracking**: Cursor tracking in the main process is only active when the pet is awake and in `FOLLOW` mode. It is disabled while the pet is sleeping, wandering, or when the chat overlay is open.
*   **GPU Offloading**: Animations are written using hardware-accelerated CSS properties (like 3D transforms `translate3d` and scale), shifting the painting work to the GPU and freeing up the system processor.

---

### Q4: How do you keep the window always on top?
The window is set to the highest stacking level available to applications:

*   **Window Creation**: The BrowserWindow is initialized with `alwaysOnTop: true`.
*   **System-level Stacking**: In [main.js](file:///c:/Users/devop/OneDrive/Desktop/desktop-pet/main.js#L97), we call `petWindow.setAlwaysOnTop(true, 'screen-saver')`. The `'screen-saver'` level ensures the pet window floats on top of normal application windows, system utility overlays, taskbars, and full-screen windows on Windows, macOS, and Linux.

---

### Q5: How do you handle different screen resolutions?
The positioning system is resolution-independent:

*   **Relative Coordinates**: All boundary collisions, movement clamps, and corner targeting are calculated dynamically using the active display's `workArea` bounds (`screenBounds.width` and `screenBounds.height`).
*   **Dynamic Scaling & Centering**: When resizing the window (such as expanding it to 300x320 for the chat window or collapsing it back to 120x120), the application offsets the position relative to the bottom-right corner to keep the pet fully visible on-screen.
*   **Resolution Events**: When display metrics (like screen resolution, scaling factor, or orientation) change, Electron's `display-metrics-changed` event triggers a recalculation. The pet window is instantly repositioned and clamped to the new resolution layout bounds to prevent it from ending up off-screen.
