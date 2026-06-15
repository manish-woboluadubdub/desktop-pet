# Desktop Pet

A small orange cat that lives on your desktop and stays **on top of all other apps**.

## Run

```bash
cd desktop-pet
npm install
npm start
```

## Behavior

1. **Starts asleep** in the bottom-right corner
2. **Wake up** — click the pet once, or click it 3 times quickly
3. **Awake** — follows your cursor (clicks pass through to other apps)
4. **Idle 4 seconds** — walks back to the corner and sleeps again

## Controls

- **Click sleeping pet** — wake it up
- **System tray** — right-click the tray icon to hide/show or quit

## How it works

Built with Electron: a transparent, frameless, always-on-top window (`screen-saver` level) so the pet floats above normal windows.
