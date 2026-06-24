const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  getScreenBounds: () =>
    new Promise((resolve) => {
      ipcRenderer.once('screen-bounds', (_e, bounds) => resolve(bounds));
      ipcRenderer.send('get-screen-bounds');
    }),
  movePet: (x, y) => ipcRenderer.send('move-pet', { x, y }),
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
  onCursorMove: (callback) => {
    ipcRenderer.on('cursor-move', (_event, point) => callback(point));
  },
  
  // Custom Pet APIs
  getPlugins: () => ipcRenderer.invoke('get-plugins'),
  onPluginChanged: (callback) => {
    ipcRenderer.on('plugin-changed', (_event, pluginId) => callback(pluginId));
  },
  resizeWindow: (width, height) => ipcRenderer.send('resize-window', { width, height }),
  setCursorTracking: (active) => ipcRenderer.send('set-cursor-tracking', active),
  sendGeminiMessage: (prompt, petName, history) => ipcRenderer.invoke('send-gemini-message', { prompt, petName, history }),
  onOpenChat: (callback) => {
    ipcRenderer.on('open-chat', () => callback());
  },
  onResetNeeds: (callback) => {
    ipcRenderer.on('reset-needs', () => callback());
  },
  updatePetName: (newName) => ipcRenderer.send('update-pet-name', newName),
  onDisplayChanged: (callback) => {
    ipcRenderer.on('display-changed', () => callback());
  }
});
