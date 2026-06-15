const pet = document.getElementById('pet');

const PET_SIZE = 120;
const FOLLOW_SPEED = 3;
const STOP_DISTANCE = 40;
const IDLE_TIMEOUT = 4000;
const CURSOR_MOVE_THRESHOLD = 8;
const HITS_TO_WAKE = 3;
const HIT_WINDOW_MS = 800;

const STATE = { IDLE: 'idle', WALK: 'walk', SLEEP: 'sleep' };
const MODE = { SLEEP: 'sleep', FOLLOW: 'follow', WALK_TO_CORNER: 'walk_to_corner' };

let mode = MODE.SLEEP;
let currentState = STATE.SLEEP;
let facing = 'right';
let screenBounds = { x: 0, y: 0, width: 1920, height: 1080 };
let posX = 0;
let posY = 0;
let cursorX = 0;
let cursorY = 0;
let lastCursorX = 0;
let lastCursorY = 0;
let hasCursor = false;
let lastActivityTime = 0;
let cornerTarget = null;
let clickCount = 0;
let clickResetTimer = null;

function getCornerPosition() {
  return {
    x: screenBounds.x + screenBounds.width - PET_SIZE - 12,
    y: screenBounds.y + screenBounds.height - PET_SIZE - 12,
  };
}

function clampPosition() {
  const minX = screenBounds.x;
  const maxX = screenBounds.x + screenBounds.width - PET_SIZE;
  const minY = screenBounds.y;
  const maxY = screenBounds.y + screenBounds.height - PET_SIZE;
  posX = Math.max(minX, Math.min(maxX, posX));
  posY = Math.max(minY, Math.min(maxY, posY));
}

function setInteractive(enabled) {
  document.body.classList.toggle('interactive', enabled);
  window.petAPI.setIgnoreMouse(!enabled);
}

function setState(state) {
  currentState = state;
  pet.className = `pet ${state}`;
  pet.dataset.facing = facing;
}

function setFacing(direction) {
  facing = direction;
  pet.dataset.facing = facing;
}

function moveToward(targetX, targetY, speed, arriveAt = 4) {
  const dx = targetX - posX;
  const dy = targetY - posY;
  const dist = Math.hypot(dx, dy);

  if (dist <= arriveAt) {
    posX = targetX;
    posY = targetY;
    window.petAPI.movePet(posX, posY);
    return true;
  }

  setFacing(dx > 0 ? 'right' : 'left');
  setState(STATE.WALK);

  const step = Math.min(speed, dist);
  posX += (dx / dist) * step;
  posY += (dy / dist) * step;
  clampPosition();
  window.petAPI.movePet(posX, posY);
  return false;
}

function wakeUp() {
  clickCount = 0;
  clearTimeout(clickResetTimer);
  mode = MODE.FOLLOW;
  lastActivityTime = Date.now();
  lastCursorX = cursorX;
  lastCursorY = cursorY;
  setInteractive(false);
  setState(STATE.IDLE);
}

function startSleeping() {
  mode = MODE.WALK_TO_CORNER;
  cornerTarget = getCornerPosition();
  setInteractive(false);
}

function followCursor() {
  const targetX = cursorX - PET_SIZE / 2;
  const targetY = cursorY - PET_SIZE / 2 + 16;
  const dx = targetX - posX;
  const dy = targetY - posY;
  const dist = Math.hypot(dx, dy);

  if (dist <= STOP_DISTANCE) {
    setState(STATE.IDLE);
    return;
  }

  moveToward(targetX, targetY, Math.min(FOLLOW_SPEED, dist - STOP_DISTANCE + FOLLOW_SPEED));
}

function onPetHit() {
  pet.classList.add('hit');
  setTimeout(() => pet.classList.remove('hit'), 180);

  clickCount += 1;
  clearTimeout(clickResetTimer);
  clickResetTimer = setTimeout(() => {
    clickCount = 0;
  }, HIT_WINDOW_MS);

  if (clickCount === 1 || clickCount >= HITS_TO_WAKE) {
    wakeUp();
  }
}

async function init() {
  screenBounds = await window.petAPI.getScreenBounds();
  const corner = getCornerPosition();
  posX = corner.x;
  posY = corner.y;
  window.petAPI.movePet(posX, posY);
  mode = MODE.SLEEP;
  setState(STATE.SLEEP);
  setInteractive(true);
  gameLoop();
}

function gameLoop() {
  const now = Date.now();

  if (mode === MODE.FOLLOW && hasCursor) {
    const moved = Math.hypot(cursorX - lastCursorX, cursorY - lastCursorY);
    if (moved > CURSOR_MOVE_THRESHOLD) {
      lastActivityTime = now;
      lastCursorX = cursorX;
      lastCursorY = cursorY;
    }

    if (now - lastActivityTime >= IDLE_TIMEOUT) {
      startSleeping();
    } else {
      followCursor();
    }
  } else if (mode === MODE.WALK_TO_CORNER && cornerTarget) {
    const arrived = moveToward(cornerTarget.x, cornerTarget.y, FOLLOW_SPEED);
    if (arrived) {
      mode = MODE.SLEEP;
      cornerTarget = null;
      setState(STATE.SLEEP);
      setInteractive(true);
    }
  }

  requestAnimationFrame(gameLoop);
}

window.petAPI.onCursorMove(({ x, y }) => {
  cursorX = x;
  cursorY = y;
  hasCursor = true;
});

pet.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || mode !== MODE.SLEEP) return;
  onPetHit();
});

init();
