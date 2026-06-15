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
});
