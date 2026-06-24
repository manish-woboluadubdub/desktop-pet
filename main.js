const { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env file manually (zero dependencies)
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const firstEqual = trimmed.indexOf('=');
          if (firstEqual !== -1) {
            const key = trimmed.substring(0, firstEqual).trim();
            const val = trimmed.substring(firstEqual + 1).trim().replace(/^['"]|['"]$/g, '');
            process.env[key] = val;
          }
        }
      }
    } catch (e) {
      console.error('Failed to load .env file:', e);
    }
  }
}
loadEnv();

function getTrayIcon() {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">' +
    '<circle cx="8" cy="9" r="6" fill="#ff8c42"/>' +
    '<polygon points="4,5 6,1 8,5" fill="#ff8c42"/>' +
    '<polygon points="8,5 10,1 12,5" fill="#ff8c42"/>' +
    '</svg>';
  return nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  );
}

let petWindow = null;
let tray = null;
let cursorTimer = null;
let pluginsList = [];
let activePluginId = 'classic-cat';

const DEFAULT_PET_SIZE = 120;

function loadPlugins() {
  const pluginsDir = path.join(__dirname, 'plugins');
  const plugins = [];
  if (!fs.existsSync(pluginsDir)) {
    fs.mkdirSync(pluginsDir);
  }
  const dirs = fs.readdirSync(pluginsDir);
  for (const dirName of dirs) {
    const dirPath = path.join(pluginsDir, dirName);
    if (fs.statSync(dirPath).isDirectory()) {
      const jsonPath = path.join(dirPath, 'plugin.json');
      if (fs.existsSync(jsonPath)) {
        try {
          const content = fs.readFileSync(jsonPath, 'utf8');
          const data = JSON.parse(content);
          plugins.push(data);
        } catch (e) {
          console.error(`Failed to load plugin from ${dirName}:`, e);
        }
      }
    }
  }
  return plugins;
}

function createPetWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  petWindow = new BrowserWindow({
    width: DEFAULT_PET_SIZE,
    height: DEFAULT_PET_SIZE,
    x: Math.floor(width / 2 - DEFAULT_PET_SIZE / 2),
    y: height - DEFAULT_PET_SIZE - 40,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  petWindow.setAlwaysOnTop(true, 'screen-saver');
  petWindow.setIgnoreMouseEvents(true, { forward: true });
  petWindow.loadFile('index.html');

  petWindow.on('closed', () => {
    petWindow = null;
  });
}

function createTray() {
  pluginsList = loadPlugins();
  tray = new Tray(getTrayIcon());
  updateTrayMenu();
}

function updateTrayMenu() {
  const petSubmenu = pluginsList.map(p => ({
    label: p.name,
    type: 'radio',
    checked: p.id === activePluginId,
    click: () => {
      activePluginId = p.id;
      if (petWindow) {
        petWindow.webContents.send('plugin-changed', p.id);
      }
      updateTrayMenu();
    }
  }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Select Pet',
      submenu: petSubmenu
    },
    {
      label: 'Chat with Pet',
      click: () => {
        if (petWindow) {
          petWindow.webContents.send('open-chat');
        }
      }
    },
    {
      label: 'Reset Pet Needs',
      click: () => {
        if (petWindow) {
          petWindow.webContents.send('reset-needs');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Hide Pet',
      click: () => petWindow?.hide(),
    },
    {
      label: 'Show Pet',
      click: () => petWindow?.show(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ]);

  tray.setToolTip('Desktop Pet');
  tray.setContextMenu(contextMenu);
}

// IPC Handlers
ipcMain.on('get-screen-bounds', (event) => {
  const display = screen.getDisplayNearestPoint(
    petWindow ? petWindow.getBounds() : { x: 0, y: 0 }
  );
  event.reply('screen-bounds', display.workArea);
});

ipcMain.handle('get-plugins', () => {
  return pluginsList;
});

ipcMain.on('move-pet', (_event, { x, y }) => {
  if (petWindow) petWindow.setPosition(Math.round(x), Math.round(y));
});

ipcMain.on('set-ignore-mouse', (_event, ignore) => {
  if (petWindow) {
    petWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
});

ipcMain.on('resize-window', (_event, { width, height }) => {
  if (petWindow) {
    const bounds = petWindow.getBounds();
    const dx = width - bounds.width;
    const dy = height - bounds.height;
    
    // Anchor positions to screen bottom-right stability
    petWindow.setBounds({
      x: Math.round(bounds.x - dx),
      y: Math.round(bounds.y - dy),
      width: Math.round(width),
      height: Math.round(height)
    });
  }
});

ipcMain.on('update-pet-name', (_event, newName) => {
  const plugin = pluginsList.find(p => p.id === activePluginId);
  if (plugin) {
    plugin.name = newName;
    updateTrayMenu();
  }
});

// Optimized Cursor Tracking
function startCursorTracking(intervalMs = 30) {
  if (cursorTimer) clearInterval(cursorTimer);
  cursorTimer = setInterval(() => {
    if (!petWindow) return;
    const point = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(point);
    petWindow.webContents.send('cursor-move', {
      x: point.x,
      y: point.y,
      bounds: display.workArea
    });
  }, intervalMs);
}

function stopCursorTracking() {
  if (cursorTimer) {
    clearInterval(cursorTimer);
    cursorTimer = null;
  }
}

ipcMain.on('set-cursor-tracking', (event, active) => {
  if (active) {
    if (petWindow) {
      const point = screen.getCursorScreenPoint();
      const display = screen.getDisplayNearestPoint(point);
      petWindow.webContents.send('cursor-move', {
        x: point.x,
        y: point.y,
        bounds: display.workArea
      });
    }
    startCursorTracking(16); // 16ms (60 FPS) for smooth tracking
  } else {
    stopCursorTracking();
  }
});

// Gemini AI Content Request
ipcMain.handle('send-gemini-message', async (_event, { prompt, petName, history }) => {
  let apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const configPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        apiKey = config.geminiApiKey;
      } catch (e) {
        console.error('Failed to read config.json:', e);
      }
    } 
  }
  if (!apiKey) {
    return { success: false, error: 'NO_API_KEY' };
  }
  const models = [
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-pro',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest',
    'gemini-pro-latest'
  ];

  let lastError = null;

  for (const model of models) {
    try {
      const systemInstruction = `You are a tiny, cute, responsive, and highly DRAMATIC desktop pet cat named ${petName}. Respond in character with a very dramatic, expressive cat personality (e.g. easily excited, sassy, demanding naps, complaining about empty bowls, obsessed with laser pointers, or wanting head scratches). Keep responses very short, cute, playful, and within 1 or 2 sentences. ALWAYS start your response with a matching emoji to express the feeling behind your message (e.g. 😺, 😾, 😿, 🐾, 💤, 😋). IMPORTANT: Speak in fluent English like a human, do not output literal cat sounds like 'meow' or 'purr', but do describe dramatic cat actions in asterisks (e.g. *glares dramatically*, *stretches lazily*, *knocks a virtual glass off your screen*). Always respond to the name ${petName} and the keywords 'kitty' or 'cat'.`;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      // Construct request contents incorporating history
      const contents = [];
      if (history && Array.isArray(history)) {
        contents.push(...history);
      }
      contents.push({
        role: 'user',
        parts: [{ text: prompt }]
      });

      const requestBody = {
        contents: contents,
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        generationConfig: {
          maxOutputTokens: 80,
          temperature: 0.7
        }
      };

      console.log(`\n--- [GEMINI REQUEST (${model})] ---`);
      console.log(JSON.stringify(requestBody, null, 2));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      const data = await response.json();
      console.log(`\n--- [GEMINI RESPONSE (${model})] ---`);
      console.log(JSON.stringify(data, null, 2));

      if (data.error) {
        throw new Error(`Model ${model} returned error: ${data.error.message} (${data.error.status})`);
      }

      const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return { success: true, text: replyText.trim() };
    } catch (err) {
      console.warn(`[API WARNING] Fallback triggered. Model ${model} failed:`, err.message);
      lastError = err;
    }
  }

  console.error('All Gemini models failed:', lastError);
  return { success: false, error: lastError ? lastError.message : 'All models failed' };
});

app.whenReady().then(() => {
  createPetWindow();
  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
