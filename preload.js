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
        refreshVideoFolder: () => ipcRenderer.invoke('video:refreshFolder'),
        getVideoLibrary: () => ipcRenderer.invoke('video:getLibrary'),
        getThumbnail: (filePath) => ipcRenderer.invoke('video:getThumbnail', filePath),
        autoDownloadSubtitles: (filePath) => ipcRenderer.invoke('video:autoDownloadSubtitles', filePath),
        extractInternalSubtitles: (filePath) => ipcRenderer.invoke('video:extractInternalSubtitles', filePath),
        optimizeLibrary: () => ipcRenderer.invoke('video:optimizeLibrary'),
        onOptimizeProgress: (callback) => ipcRenderer.on('optimize-progress', (_e, data) => callback(data)),
    },
    window: {
        minimize: () => ipcRenderer.send('window:minimize'),
        maximize: () => ipcRenderer.send('window:maximize'),
        close:    () => ipcRenderer.send('window:close'),
        setMiniMode: (mode) => ipcRenderer.send('window:setMiniMode', mode)
    },
    remote: {
        sendState: (state) => ipcRenderer.send('remote-state', state),
        onAction: (callback) => ipcRenderer.on('remote-action', (event, actionData) => callback(actionData)),
        launchMobile: () => ipcRenderer.invoke('remote-launch'),
        getQr: () => ipcRenderer.invoke('remote-get-qr')
    }
});
