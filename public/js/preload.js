const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getDemoInfo: () => ipcRenderer.invoke('getDemoInfo'),
    onDemoInfo: (callback) => ipcRenderer.on('demo-info', (_event, info) => callback(info))
});
