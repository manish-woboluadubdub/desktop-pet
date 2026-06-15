const { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage } = require('electron');
const path = require('path');

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

const PET_SIZE = 120;

function createPetWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  petWindow = new BrowserWindow({
    width: PET_SIZE,
    height: PET_SIZE,
    x: Math.floor(width / 2 - PET_SIZE / 2),
    y: height - PET_SIZE - 40,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
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
  tray = new Tray(getTrayIcon());

  const contextMenu = Menu.buildFromTemplate([
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
  tray.on('double-click', () => {
    if (petWindow?.isVisible()) petWindow.hide();
    else petWindow?.show();
  });
}

ipcMain.on('get-screen-bounds', (event) => {
  const display = screen.getDisplayNearestPoint(
    petWindow ? petWindow.getBounds() : { x: 0, y: 0 }
  );
  event.reply('screen-bounds', display.workArea);
});

ipcMain.on('move-pet', (_event, { x, y }) => {
  if (petWindow) petWindow.setPosition(Math.round(x), Math.round(y));
});

ipcMain.on('set-ignore-mouse', (_event, ignore) => {
  if (petWindow) {
    petWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
});

function startCursorTracking() {
  cursorTimer = setInterval(() => {
    if (!petWindow) return;
    const point = screen.getCursorScreenPoint();
    petWindow.webContents.send('cursor-move', point);
  }, 16);
}

app.whenReady().then(() => {
  createPetWindow();
  createTray();
  startCursorTracking();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
