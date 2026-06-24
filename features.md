# Desktop Pet Features Guide

This document explains in simple terms how all the new features in the Desktop Pet application work.

---

## 1. Multiple Pet Behaviors (Sleeping, Angry, Hungry)

The pet now has three distinct moods that influence how it acts and looks:

*   **Sleeping 💤**: By default, when you don't interact with the pet, its sleepiness level increases. Once it gets tired, it walks back to the bottom-right corner of your screen, curls up, and goes to sleep.
*   **Angry 💢**: If you spam-click the pet while it is awake, its anger level rises. When it gets too angry, it enters a "Grumpy" state. It turns reddish, starts vibrating, ignores your mouse cursor, and runs around the screen in irritation. Talking to it in the chat or feeding it will calm it down.
*   **Hungry 🍖**: Over time, the pet gets hungry. When its hunger level passes 70%, it displays a food bubble and wanders the screen searching for snacks. You can feed it by typing `"feed"` in the chat, or by clicking directly on its food bubble!

---

## 2. Collision Detection with Screen Edges

When the pet is in a state where it is wandering around (like when it is angry or hungry), it has **physics-based screen collision detection**:

*   The pet tracks where the screen edges are.
*   When its path crosses a boundary (left, right, top, or bottom of your screen), it instantly detects the collision.
*   It **bounces off** the edge by reversing its velocity (direction) and plays a cute "squash-and-stretch" wobble animation to simulate physical contact with the sides of your screen!

---

## 3. AI-Powered Chat Interaction

You can now have conversations with your pet:

*   **How to open**: Double-click the pet, or right-click the system tray icon and select **Chat with Pet**.
*   **How it works**: The transparent pet window dynamically expands upwards to display a premium chat interface.
*   **Gemini AI integration**: If you have a Gemini API key configured in your environment variables (`GEMINI_API_KEY`), the pet will talk to you using a real Google Gemini AI model, acting exactly like your pet (cute, playful, or slightly sassy!).
*   **Offline fallback**: If there is no internet connection or API key, a built-in smart local chatbot takes over. It understands keywords and context (like "hello", "feed", "sleep") and responds based on the pet's current mood.

---

## 4. Plugin System for Custom Pets

The pet is no longer limited to just the orange cat. We created a modular plugin system:

*   All pets are located inside the `plugins/` directory.
*   Each plugin has:
    *   `plugin.json`: Metadata, custom speeds, and the HTML skeletal structure.
    *   `style.css`: The styling, colors, glow effects, and specific animations.
*   **Switching Pets**: You can switch pets on-the-fly! Right-click the desktop system tray icon, hover over **Select Pet**, and choose between the **Classic Orange Cat** or the new glowing **Cosmic Slime**!

---

## 5. Resource Optimization (CPU & RAM)

Electron applications can sometimes consume a lot of computer resources. We implemented several optimizations to keep CPU and RAM usage near 0%:

*   **Smart Cursor Tracking**: Normally, the app tracks your mouse pointer 60 times a second. Now, mouse tracking is **completely turned off** when the pet is sleeping, wandering, or when the chat is open. It only runs when the pet is actively following your cursor, saving significant CPU cycles.
*   **Dynamic Animation Pausing**: When the pet is sleeping, the 60-FPS rendering engine (`requestAnimationFrame`) is completely paused. The app switches to a slow background timer (once every 1.5 seconds) just to update needs, reducing GPU and CPU usage to 0% while the pet is sleeping.
*   **Hardware Accelerated CSS**: All animations use CSS transforms (`translate3d`), letting the graphics card handle the drawing instead of putting load on the main computer processor.
