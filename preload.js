const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('omega', {
    file: {
        openAudioFolder: () => ipcRenderer.invoke('media:openAudioFolder'),
        getLibrary: () => ipcRenderer.invoke('media:getLibrary'),
        getChapters: (filePath) => ipcRenderer.invoke('media:getChapters', filePath),
    },
    books: {
        openBookFolder: () => ipcRenderer.invoke('books:openFolder'),
        getBookLibrary: () => ipcRenderer.invoke('books:getLibrary'),
        getBookFile: (filePath) => ipcRenderer.invoke('books:getFile', filePath),
    },
    video: {
        openVideoFolder: () => ipcRenderer.invoke('video:openFolder'),
        getVideoLibrary: () => ipcRenderer.invoke('video:getLibrary'),
        getThumbnail: (filePath) => ipcRenderer.invoke('video:getThumbnail', filePath),
        autoDownloadSubtitles: (filePath) => ipcRenderer.invoke('video:autoDownloadSubtitles', filePath),
        extractInternalSubtitles: (filePath) => ipcRenderer.invoke('video:extractInternalSubtitles', filePath),
    },
    window: {
        minimize: () => ipcRenderer.send('window:minimize'),
        maximize: () => ipcRenderer.send('window:maximize'),
        close:    () => ipcRenderer.send('window:close'),
        setMiniMode: (mode) => ipcRenderer.send('window:setMiniMode', mode)
    }
});
