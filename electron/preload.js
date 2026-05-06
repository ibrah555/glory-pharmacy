const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    // We can add IPC methods here if needed later
    platform: process.platform
});
