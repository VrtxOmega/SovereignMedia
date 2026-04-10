const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

let io;

function setupRemote(ipcMain, mainWindow, app) {
    const expressApp = express();
    const server = http.createServer(expressApp);
    io = new Server(server, { cors: { origin: '*' } });

    // Serve mobile front-end
    expressApp.use(express.static(path.join(__dirname, 'mobile_public')));

    // Dynamic file serving for covers and posters securely
    expressApp.get('/media-file', (req, res) => {
        const filePath = req.query.path;
        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(404).send('Not Found');
        }
        res.sendFile(filePath);
    });

    io.on('connection', (socket) => {
        console.log('[Remote] Phone connected:', socket.id);

        socket.on('action', (actionData) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('remote-action', actionData);
            }
        });
    });

    server.listen(5075, '0.0.0.0', () => {
        console.log('[Remote] Sovereign Media Mobile Controller listening on port 5075');
        
        // Execute ADB reverse proxy so the phone can access localhost:5075
        exec('adb reverse tcp:5075 tcp:5075', (error, stdout, stderr) => {
            if (error) {
                console.log('[Remote] ADB Reverse failed (no device connected over ADB?)');
            } else {
                console.log('[Remote] ADB Reverse successful. Phone can access http://localhost:5075');
            }
        });
    });

    // Listen for state updates from the Desktop App and broadcast to all connected phones
    ipcMain.on('remote-state', (event, stateData) => {
        if (io) {
            io.emit('state', stateData);
        }
    });

    // Request to launch URL on phone directly
    ipcMain.handle('remote-launch', async () => {
        return new Promise((resolve) => {
            exec('adb shell am start -a android.intent.action.VIEW -d "http://localhost:5075"', (err) => {
                resolve(!err);
            });
        });
    });

    // Request QR code for wireless wifi pairing
    ipcMain.handle('remote-get-qr', async () => {
        try {
            const QRCode = require('qrcode');
            const localtunnel = require('localtunnel');
            
            // We use a fixed subdomain (or random) to keep the connection persistent if possible
            // Let it generate a random secure tunnel to absolutely bypass the strict VPN routing
            const tunnel = await localtunnel({ port: 5075 });
            console.log('[Remote] VPN Bypass Tunnel Opened:', tunnel.url);

            const url = tunnel.url;
            const qrDataUrl = await QRCode.toDataURL(url, {
                color: {
                    dark: '#c5a365', // Veritas Gold
                    light: '#0a0a0c' // Veritas Obsidian
                },
                width: 300,
                margin: 2
            });

            return { url, qrDataUrl };
        } catch (e) {
            console.error('[Remote] QR Code Generation / Tunneling Failed', e);
            return null;
        }
    });
}

module.exports = { setupRemote };
