const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('omega', {
    file: {
        openAudioFolder: () => ipcRenderer.invoke('media:openAudioFolder'),
        getLibrary: () => ipcRenderer.invoke('media:getLibrary'),
        getChapters: (filePath) => ipcRenderer.invoke('media:getChapters', filePath),
    },
    window: {
        minimize: () => ipcRenderer.send('window:minimize'),
        maximize: () => ipcRenderer.send('window:maximize'),
        close:    () => ipcRenderer.send('window:close'),
    }
});
