const pet = document.getElementById('pet');

const PET_SIZE = 120;
const FOLLOW_SPEED = 3;
const STOP_DISTANCE = 40;
const IDLE_TIMEOUT = 4000;
const CURSOR_MOVE_THRESHOLD = 8;
const HITS_TO_WAKE = 3;
const HIT_WINDOW_MS = 800;

const STATE = { IDLE: 'idle', WALK: 'walk', SLEEP: 'sleep' };
const MODE = {
  SLEEP: 'sleep',
  FOLLOW: 'follow',
  WALK_TO_CORNER: 'walk_to_corner',
  WANDER: 'wander',
  ANGRY: 'angry',
  HUNGRY: 'hungry'
};

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

// Dynamic sizing and plugins
let currentWidth = PET_SIZE;
let currentHeight = PET_SIZE;
let plugins = [];
let activePlugin = null;
let customPetName = null; // Customized name from localStorage
let chatOpen = false;
let isLooping = false;
let chatHistory = [];
let clickTimeout = null;
let activeChatEmoji = null;

// Pet Needs (0 - 100)
let hunger = 0;
let anger = 0;
let sleepiness = 0;

// Wandering/Collision variables
let wanderAngle = Math.random() * Math.PI * 2;
let wanderSpeed = 1.2;
let vx = Math.cos(wanderAngle) * wanderSpeed;
let vy = Math.sin(wanderAngle) * wanderSpeed;
let lastWanderChange = 0;

// Offline Responses Library
const OFFLINE_RESPONSES = {
  greetings: [
    "😺 Meow! Hello there, human!",
    "😸 Purrr... what are we doing today?",
    "🐾 Hey! Need some company?",
    "😺 Hello! I am floating on your screen!"
  ],
  hungry: [
    "😿 I'm so hungry! Feed me some fish! 🐟",
    "😭 My tummy is rumbling... 🍖",
    "🥺 Do you have any snacks? Please? *paws at screen*",
    "😋 Hungry pet needs food! Type 'feed' to feed me!"
  ],
  angry: [
    "😾 Hmph! Leave me alone! 💢",
    "😠 Don't touch me! I'm grumpy!",
    "👿 Grrr... I'm not in the mood! *hiss*",
    "😾 Stop clicking me! *vibrates angrily*"
  ],
  sleeping: [
    "😴 Zzz... so sleepy... *yawns*",
    "💤 Let me sleep a bit more...",
    "💤 Shhh... I'm dreaming of chasing laser pointers..."
  ],
  thanks: [
    "💖 Yum! Thank you for the food!",
    "😸 Purrrr... that was delicious!",
    "😋 Nom nom nom... much better!",
    "🐾 Happy pet! *wags tail*"
  ],
  default: [
    "😺 You are doing great! Keep it up!",
    "😸 I love watching you work.",
    "🐾 Let's play later! 🎈",
    "😺 I am your loyal desktop companion."
  ]
};

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getLeadingEmoji(str) {
  if (!str) return null;
  const trimmed = str.trim();
  const codePoint = trimmed.codePointAt(0);
  // Emojis/symbols live above the 0x2000 code point range
  if (codePoint > 0x2000) {
    return String.fromCodePoint(codePoint);
  }
  return null;
}

function generateOfflineResponse(message, status) {
  const msg = message.toLowerCase();
  if (msg.includes('feed') || msg.includes('food') || msg.includes('fish') || msg.includes('treat')) {
    feedPet();
    return getRandomElement(OFFLINE_RESPONSES.thanks);
  }
  if (msg.includes('kitty') || msg.includes('cat')) {
    const petName = customPetName || (activePlugin ? activePlugin.name : 'Pet');
    return `😺 Yes, I'm your cute little ${petName}! How can I help you, hooman?`;
  }
  if (status.angry) {
    return getRandomElement(OFFLINE_RESPONSES.angry);
  }
  if (status.hungry) {
    return getRandomElement(OFFLINE_RESPONSES.hungry);
  }
  if (status.sleeping) {
    return getRandomElement(OFFLINE_RESPONSES.sleeping);
  }
  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
    return getRandomElement(OFFLINE_RESPONSES.greetings);
  }
  return getRandomElement(OFFLINE_RESPONSES.default);
}

function getExpressionEmoji() {
  if (!activePlugin) return '🐾';
  
  const id = activePlugin.id;
  const isSleeping = mode === MODE.SLEEP;
  const isAngry = anger > 60;
  const isHungry = hunger > 60;
  
  if (id === 'classic-cat') {
    if (isSleeping) return '😴';
    if (isAngry) return '😾';
    if (isHungry) return '😋';
    return '😸';
  } else if (id === 'alien-slime') {
    if (isSleeping) return '😴';
    if (isAngry) return '😡';
    if (isHungry) return '🤤';
    return '👽';
  }
  
  return activePlugin.emoji || '🐾';
}

// Window sizing utility
function setWindowSize(targetWidth, targetHeight) {
  const dx = targetWidth - currentWidth;
  const dy = targetHeight - currentHeight;
  
  // Adjust position so the bottom-right corner remains stable
  posX -= dx;
  posY -= dy;
  
  currentWidth = targetWidth;
  currentHeight = targetHeight;
  
  window.petAPI.resizeWindow(targetWidth, targetHeight);
  clampPosition();
  window.petAPI.movePet(posX, posY);
}

function getCornerPosition() {
  return {
    x: screenBounds.x + screenBounds.width - currentWidth - 12,
    y: screenBounds.y + screenBounds.height - currentHeight - 12,
  };
}

function clampPosition() {
  const minX = screenBounds.x;
  const maxX = screenBounds.x + screenBounds.width - currentWidth;
  const minY = screenBounds.y;
  const maxY = screenBounds.y + screenBounds.height - currentHeight;
  posX = Math.max(minX, Math.min(maxX, posX));
  posY = Math.max(minY, Math.min(maxY, posY));
}

function setInteractive(enabled) {
  document.body.classList.toggle('interactive', enabled);
  window.petAPI.setIgnoreMouse(!enabled);
}

function setState(state) {
  currentState = state;
  const pluginId = activePlugin ? activePlugin.id : '';
  pet.className = `pet ${state} ${pluginId}`;
  pet.dataset.facing = facing;
  
  // State-driven click-through toggle (prevents DWM coordinates feedback loops)
  if (chatOpen) {
    window.petAPI.setIgnoreMouse(false);
    document.body.classList.add('interactive');
  } else if (state === STATE.SLEEP || state === STATE.IDLE) {
    window.petAPI.setIgnoreMouse(false);
    document.body.classList.add('interactive');
  } else { // STATE.WALK (clicking passes through while walking/moving)
    window.petAPI.setIgnoreMouse(true);
    document.body.classList.remove('interactive');
  }
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
    clampPosition();
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

// Needs Ticking & System States
function tickNeeds() {
  if (mode === MODE.SLEEP) {
    sleepiness = Math.max(0, sleepiness - 3);
    hunger = Math.min(100, hunger + 0.4);
    anger = Math.max(0, anger - 4);
    updateNeedsUI();
    return; // Stay asleep! Do not trigger transitions.
  }

  // Active transitions (only when awake)
  hunger = Math.min(100, hunger + 0.8);
  sleepiness = Math.min(100, sleepiness + 0.6);
  anger = Math.max(0, anger - 1.5);

  if (anger > 65 && mode !== MODE.ANGRY) {
    mode = MODE.ANGRY;
    window.petAPI.setCursorTracking(false);
  } else if (hunger > 70 && mode !== MODE.HUNGRY && mode !== MODE.ANGRY) {
    mode = MODE.HUNGRY;
    window.petAPI.setCursorTracking(false);
  } else if (sleepiness > 85 && mode !== MODE.WALK_TO_CORNER && mode !== MODE.ANGRY) {
    startSleeping();
  }

  // Calm down anger over time
  if (anger < 20 && mode === MODE.ANGRY) {
    mode = MODE.FOLLOW;
    lastActivityTime = Date.now();
    if (!chatOpen) {
      window.petAPI.setCursorTracking(true);
    }
  }

  updateNeedsUI();
}

function updateNeedsUI() {
  const bubble = document.getElementById('pet-bubble');
  
  // Clean special emotion classes first
  pet.classList.remove('angry', 'sleep');
  
  if (mode === MODE.SLEEP) {
    bubble.textContent = '💤';
    bubble.classList.remove('hidden');
    pet.classList.add('sleep');
  } else if (anger > 60) {
    bubble.textContent = '💢';
    bubble.classList.remove('hidden');
    pet.classList.add('angry');
  } else if (hunger > 60) {
    bubble.textContent = '🍖';
    bubble.classList.remove('hidden');
  } else if (chatOpen) {
    const showEmoji = activeChatEmoji || '💬';
    bubble.textContent = showEmoji;
    bubble.classList.remove('hidden');
    
    // Dynamically apply visual pet state classes matching the active chat emotion!
    if (activeChatEmoji) {
      if (['😾', '😠', '😡', '👿', '💢'].includes(activeChatEmoji)) {
        pet.classList.add('angry');
      } else if (['😴', '💤'].includes(activeChatEmoji)) {
        pet.classList.add('sleep');
      }
    }
  } else {
    bubble.textContent = '';
    bubble.classList.add('hidden');
  }
}

function feedPet() {
  hunger = 0;
  updateNeedsUI();
  
  // Happy wobble bounce
  pet.classList.add('hit');
  setTimeout(() => pet.classList.remove('hit'), 250);

  // Calm anger
  anger = Math.max(0, anger - 35);
  
  // Revert states
  if (mode === MODE.HUNGRY) {
    mode = MODE.FOLLOW;
    lastActivityTime = Date.now();
    if (!chatOpen) {
      window.petAPI.setCursorTracking(true);
    }
  }
  updateNeedsUI();
}

function wakeUp() {
  clickCount = 0;
  clearTimeout(clickResetTimer);
  
  if (mode === MODE.SLEEP || mode === MODE.WALK_TO_CORNER) {
    mode = MODE.FOLLOW;
    // Reset sleepiness and anger on wake up
    sleepiness = 0;
    anger = 0;
    // Damp hunger so it doesn't immediately wander
    if (hunger > 60) hunger = 40;
  }
  
  lastActivityTime = Date.now();
  
  // Initialize cursor position to pet's current center to avoid running to (0,0)
  cursorX = posX + currentWidth / 2;
  cursorY = posY + currentHeight / 2;
  hasCursor = true;
  
  lastCursorX = cursorX;
  lastCursorY = cursorY;
  setInteractive(false);
  setState(STATE.IDLE);
  
  // Optimization: Restart rendering engine loops
  if (!isLooping) {
    isLooping = true;
    requestAnimationFrame(gameLoop);
  }
  
  if (mode === MODE.FOLLOW && !chatOpen) {
    window.petAPI.setCursorTracking(true);
  }
  updateNeedsUI();
}

function startSleeping() {
  mode = MODE.WALK_TO_CORNER;
  cornerTarget = getCornerPosition();
  setInteractive(false);
}

function enterSleepState() {
  mode = MODE.SLEEP;
  cornerTarget = null;
  setState(STATE.SLEEP);
  setInteractive(true);
  updateNeedsUI();
  
  // Optimization: Turn off renderer gameLoop and main process cursor tracking when asleep!
  isLooping = false;
  window.petAPI.setCursorTracking(false);
}

function followCursor() {
  const speed = activePlugin ? activePlugin.config.speed : FOLLOW_SPEED;
  const stopDist = activePlugin ? activePlugin.config.stopDistance : STOP_DISTANCE;

  const targetX = cursorX - currentWidth / 2;
  const targetY = cursorY - currentHeight / 2 + 16;
  const dx = targetX - posX;
  const dy = targetY - posY;
  const dist = Math.hypot(dx, dy);

  if (dist <= stopDist) {
    setState(STATE.IDLE);
    return;
  }

  moveToward(targetX, targetY, Math.min(speed, dist - stopDist + speed));
}

// Edge Collision & Wandering Logic
function triggerCollisionEffect() {
  pet.classList.add('hit');
  setTimeout(() => pet.classList.remove('hit'), 180);
}

function wander() {
  const now = Date.now();
  if (now - lastWanderChange > 2500) {
    // Randomize angle
    wanderAngle = Math.random() * Math.PI * 2;
    const speed = (mode === MODE.ANGRY) ? 3.8 : wanderSpeed;
    vx = Math.cos(wanderAngle) * speed;
    vy = Math.sin(wanderAngle) * speed;
    lastWanderChange = now;
  }

  posX += vx;
  posY += vy;

  let collided = false;
  const minX = screenBounds.x;
  const maxX = screenBounds.x + screenBounds.width - currentWidth;
  const minY = screenBounds.y;
  const maxY = screenBounds.y + screenBounds.height - currentHeight;

  // Collision checks with boundaries
  if (posX <= minX) {
    posX = minX;
    vx = -vx;
    collided = true;
    setFacing('right');
  } else if (posX >= maxX) {
    posX = maxX;
    vx = -vx;
    collided = true;
    setFacing('left');
  }

  if (posY <= minY) {
    posY = minY;
    vy = -vy;
    collided = true;
  } else if (posY >= maxY) {
    posY = maxY;
    vy = -vy;
    collided = true;
  }

  if (collided) {
    triggerCollisionEffect();
  }

  setState(STATE.WALK);
  window.petAPI.movePet(posX, posY);
}

function onPetHit() {
  // Wobble effect
  pet.classList.add('hit');
  setTimeout(() => pet.classList.remove('hit'), 180);

  if (mode === MODE.SLEEP) {
    clickCount += 1;
    clearTimeout(clickResetTimer);
    clickResetTimer = setTimeout(() => {
      clickCount = 0;
    }, HIT_WINDOW_MS);

    if (clickCount === 1 || clickCount >= HITS_TO_WAKE) {
      wakeUp();
    }
  } else {
    // If awake, click builds anger!
    anger = Math.min(100, anger + 20);
    updateNeedsUI();
    
    if (anger > 65 && mode !== MODE.ANGRY) {
      mode = MODE.ANGRY;
      window.petAPI.setCursorTracking(false);
    }
  }
}

// Chat Overlay Panel Control
function toggleChat() {
  if (chatOpen) {
    closeChat();
  } else {
    openChat();
  }
}

function openChat() {
  if (chatOpen) return;
  chatOpen = true;
  
  // Grow window size for chat panel
  setWindowSize(300, 320);
  document.getElementById('chat-container').classList.remove('hidden');
  
  setTimeout(() => {
    document.getElementById('chat-input').focus();
  }, 100);

  // Turn off tracking
  window.petAPI.setCursorTracking(false);
  setInteractive(true);

  if (mode === MODE.SLEEP || mode === MODE.WALK_TO_CORNER) {
    wakeUp();
  }

  // Reduce anger slightly upon communication
  anger = Math.max(0, anger - 15);
  updateNeedsUI();
}

function closeChat() {
  if (!chatOpen) return;
  chatOpen = false;

  document.getElementById('chat-container').classList.add('hidden');
  
  // Collapse window size back to pet size
  setWindowSize(120, 120);

  activeChatEmoji = null;

  if (mode === MODE.SLEEP) {
    setInteractive(true);
    window.petAPI.setCursorTracking(false);
  } else {
    setInteractive(false);
    if (mode === MODE.FOLLOW) {
      window.petAPI.setCursorTracking(true);
    }
  }
  updateNeedsUI();
}

function addChatMessage(sender, text, cssClass) {
  const messagesDiv = document.getElementById('chat-messages');
  const msgEl = document.createElement('div');
  msgEl.className = `message ${cssClass}`;
  msgEl.innerHTML = `<strong>${sender}:</strong> <span class="msg-text">${text}</span>`;
  messagesDiv.appendChild(msgEl);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  return msgEl;
}

async function handleChatSend() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  addChatMessage('👤 You', text, 'user-msg');

  // Pre-calculate feeding to immediately show happy emoji on feed
  const lowercaseText = text.toLowerCase();
  const isFeeding = lowercaseText.includes('feed') || lowercaseText.includes('food') || lowercaseText.includes('fish') || lowercaseText.includes('treat') || lowercaseText.includes('cookie');
  
  const petName = customPetName || (activePlugin ? activePlugin.name : 'Pet');

  if (isFeeding) {
    feedPet();
    const reply = "Purrrr... thanks for the treat! 🐟";
    addChatMessage(`${getExpressionEmoji()} ${petName}`, reply, 'pet-msg');
    
    // Add to history and update visual emoji to eating
    activeChatEmoji = '😋';
    updateNeedsUI();

    chatHistory.push({ role: 'user', parts: [{ text: text }] });
    chatHistory.push({ role: 'model', parts: [{ text: reply }] });
    if (chatHistory.length > 12) {
      chatHistory = chatHistory.slice(chatHistory.length - 12);
    }
    return;
  }

  const responseBubble = addChatMessage(`${getExpressionEmoji()} ${petName}`, '...', 'pet-msg');
  
  // Set thinking emoji
  activeChatEmoji = '🤔';
  updateNeedsUI();

  try {
    const status = {
      angry: anger > 60,
      hungry: hunger > 60,
      sleeping: mode === MODE.SLEEP
    };

    console.log('Sending chat message to Gemini:', { text, petName, chatHistory });
    const res = await window.petAPI.sendGeminiMessage(text, petName, chatHistory);
    console.log('Received response from Gemini API handler:', res);
    
    let reply = '';
    if (res.success && res.text && res.text.trim()) {
      reply = res.text.trim();
    } else {
      // Fallback to local offline chatbot (handles empty/error responses)
      reply = generateOfflineResponse(text, status);
    }
    
    // Set the response bubble content
    responseBubble.querySelector('.msg-text').textContent = reply;

    // Parse and show the response emotion emoji in the pet's bubble
    activeChatEmoji = getLeadingEmoji(reply);
    
    // Refresh name tag emoji to match the new mood
    const currentEmoji = activeChatEmoji || getExpressionEmoji();
    responseBubble.querySelector('strong').textContent = `${currentEmoji} ${petName}:`;
    
    updateNeedsUI();

    // Update history
    chatHistory.push({ role: 'user', parts: [{ text: text }] });
    chatHistory.push({ role: 'model', parts: [{ text: reply }] });
    if (chatHistory.length > 12) {
      chatHistory = chatHistory.slice(chatHistory.length - 12);
    }
  } catch (err) {
    const reply = "Meow... *confused blink*";
    responseBubble.querySelector('.msg-text').textContent = reply;
    activeChatEmoji = null;
    updateNeedsUI();
    
    chatHistory.push({ role: 'user', parts: [{ text: text }] });
    chatHistory.push({ role: 'model', parts: [{ text: reply }] });
    if (chatHistory.length > 12) {
      chatHistory = chatHistory.slice(chatHistory.length - 12);
    }
  }
}

// Plugin engine
async function loadPlugins() {
  plugins = await window.petAPI.getPlugins();
  applyPlugin('classic-cat');
}

function applyPlugin(pluginId) {
  const plugin = plugins.find(p => p.id === pluginId);
  if (!plugin) return;

  activePlugin = plugin;

  // Clear chat history on pet change
  chatHistory = [];

  // Load custom pet name from localStorage if available
  customPetName = localStorage.getItem(`custom_pet_name_${pluginId}`) || plugin.name;

  // Apply Stylesheet
  document.getElementById('plugin-style').href = `plugins/${pluginId}/style.css`;
  
  // Insert custom HTML structure
  document.getElementById('pet-visuals').innerHTML = plugin.html;

  // Set initial class
  pet.className = `pet ${currentState} ${pluginId}`;

  // Update chat header title with emoji
  const petEmoji = getExpressionEmoji();
  document.getElementById('chat-pet-name').textContent = `Chat with ${customPetName} ${petEmoji}`;

  // Prepopulate chat with custom welcome message from the active pet
  const messagesDiv = document.getElementById('chat-messages');
  messagesDiv.innerHTML = '';
  const currentEmoji = getExpressionEmoji();
  addChatMessage(`${currentEmoji} ${customPetName}`, `Hello! I am ${customPetName}. Type below to talk, or feed me!`, 'pet-msg');

  updateNeedsUI();
}

// Setup listeners
function setupEventListeners() {
  pet.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    
    // Clear any previous click timeout
    if (clickTimeout) {
      clearTimeout(clickTimeout);
      clickTimeout = null;
    }
    
    if (e.detail === 1) {
      clickTimeout = setTimeout(() => {
        onPetHit();
      }, 220); // 220ms delay to distinguish single from double clicks
    }
  });

  pet.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    if (clickTimeout) {
      clearTimeout(clickTimeout);
      clickTimeout = null;
    }
    toggleChat();
  });

  document.getElementById('close-chat').addEventListener('click', () => {
    closeChat();
  });

  document.getElementById('edit-pet-name-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const currentName = customPetName || (activePlugin ? activePlugin.name : 'Pet');
    const newName = prompt(`Enter a new name for ${activePlugin ? activePlugin.name : 'your pet'}:`, currentName);
    if (newName && newName.trim()) {
      const trimmedName = newName.trim();
      customPetName = trimmedName;
      
      // Save locally
      if (activePlugin) {
        localStorage.setItem(`custom_pet_name_${activePlugin.id}`, trimmedName);
        window.petAPI.updatePetName(trimmedName);
      }
      
      // Update UI
      const petEmoji = getExpressionEmoji();
      document.getElementById('chat-pet-name').textContent = `Chat with ${trimmedName} ${petEmoji}`;
      addChatMessage('System', `Pet renamed to ${trimmedName}!`, 'pet-msg');
    }
  });

  document.getElementById('send-chat-btn').addEventListener('click', () => {
    handleChatSend();
  });

  document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleChatSend();
    }
  });

  // Food bubble feeding trigger
  document.getElementById('pet-bubble').addEventListener('click', (e) => {
    e.stopPropagation();
    if (hunger > 60) {
      feedPet();
      addChatMessage(activePlugin ? activePlugin.name : 'Pet', "Yummy! Thanks for clicking to feed me! 💖", 'pet-msg');
    }
  });

  // Cursor Move Listener
  window.petAPI.onCursorMove(({ x, y, bounds }) => {
    cursorX = x;
    cursorY = y;
    hasCursor = true;
    if (bounds) {
      screenBounds = bounds;
    }
  });

  // Tray menu listeners
  window.petAPI.onPluginChanged((pluginId) => {
    applyPlugin(pluginId);
  });

  window.petAPI.onOpenChat(() => {
    openChat();
  });

  window.petAPI.onResetNeeds(() => {
    hunger = 0;
    anger = 0;
    sleepiness = 0;
    updateNeedsUI();
    addChatMessage('System', 'Pet needs have been reset!', 'pet-msg');
  });
}

// Main execution loop
function gameLoop() {
  if (!isLooping) return;
  const now = Date.now();

  if (mode === MODE.FOLLOW && hasCursor && !chatOpen) {
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
    const speed = activePlugin ? activePlugin.config.speed : FOLLOW_SPEED;
    const arrived = moveToward(cornerTarget.x, cornerTarget.y, speed);
    if (arrived) {
      enterSleepState();
    }
  } else if (mode === MODE.WANDER || mode === MODE.ANGRY || mode === MODE.HUNGRY) {
    wander();
  } else {
    setState(STATE.IDLE);
  }

  requestAnimationFrame(gameLoop);
}

async function init() {
  await loadPlugins();
  
  screenBounds = await window.petAPI.getScreenBounds();
  const corner = getCornerPosition();
  posX = corner.x;
  posY = corner.y;
  window.petAPI.movePet(posX, posY);

  mode = MODE.SLEEP;
  currentState = STATE.SLEEP;
  setInteractive(true);

  // Background needs clock
  setInterval(tickNeeds, 1500);

  setupEventListeners();
  updateNeedsUI();

  // Initially stop visual looping & cursor polling since we start in corner sleeping
  isLooping = false;
  window.petAPI.setCursorTracking(false);
}

init();
