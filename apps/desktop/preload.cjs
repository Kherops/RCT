const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rtcDesktop', {
  apiUrl: process.env.ELECTRON_API_URL || process.env.NEXT_PUBLIC_API_URL || '',
  platform: process.platform,
  notify: (payload) => ipcRenderer.invoke('desktop:notify', payload),
});
