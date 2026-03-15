const { app, BrowserWindow, Notification, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const RENDERER_PORT = Number.parseInt(process.env.ELECTRON_RENDERER_PORT || '3000', 10);
const RENDERER_HOST = process.env.ELECTRON_RENDERER_HOST || '127.0.0.1';
const API_URL = process.env.ELECTRON_API_URL || process.env.NEXT_PUBLIC_API_URL || '';

let mainWindow = null;
let isQuitting = false;
let rendererServerStarted = false;

function stopWindowFlash() {
  if (process.platform === 'win32' && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.flashFrame(false);
  }
}

function registerNotificationHandler() {
  ipcMain.handle('desktop:notify', (_event, payload) => {
    if (!Notification.isSupported()) {
      return { shown: false, reason: 'unsupported' };
    }

    const title = typeof payload?.title === 'string' ? payload.title.trim() : '';
    const body = typeof payload?.body === 'string' ? payload.body.trim() : '';

    if (!title || !body) {
      return { shown: false, reason: 'invalid-payload' };
    }

    const notification = new Notification({
      title,
      body,
      urgency: 'normal',
    });

    notification.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.show();
        mainWindow.focus();
      }
    });

    if (process.platform === 'win32' && mainWindow && !mainWindow.isFocused()) {
      mainWindow.flashFrame(true);
    }

    notification.show();
    return { shown: true };
  });
}

function getRendererUrl() {
  return `http://${RENDERER_HOST}:${RENDERER_PORT}`;
}

function getStandaloneServerEntry() {
  const basePath = app.isPackaged
    ? path.join(process.resourcesPath, 'web', 'standalone')
    : path.join(__dirname, '..', 'web', '.next', 'standalone');

  const candidates = [
    path.join(basePath, 'apps', 'web', 'server.js'),
    path.join(basePath, 'server.js'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on('error', () => {
        if (Date.now() >= deadline) {
          reject(new Error(`Renderer did not start in time: ${url}`));
          return;
        }

        setTimeout(tryConnect, 500);
      });
    };

    tryConnect();
  });
}

async function ensureRendererAvailable() {
  if (!app.isPackaged) {
    await waitForServer(getRendererUrl());
    return;
  }

  if (rendererServerStarted) {
    await waitForServer(getRendererUrl());
    return;
  }

  const serverEntry = getStandaloneServerEntry();
  if (!serverEntry) {
    throw new Error('Unable to locate the packaged Next.js standalone server.');
  }

  process.env.HOSTNAME = RENDERER_HOST;
  process.env.PORT = String(RENDERER_PORT);
  process.env.NEXT_PUBLIC_API_URL = API_URL;

  require(serverEntry);
  rendererServerStarted = true;

  await waitForServer(getRendererUrl());
}

async function createWindow() {
  await ensureRendererAvailable();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  await mainWindow.loadURL(getRendererUrl());

  mainWindow.on('focus', () => {
    stopWindowFlash();
  });

  mainWindow.on('show', () => {
    stopWindowFlash();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function stopRendererServer() {
  return;
}

app.whenReady().then(async () => {
  registerNotificationHandler();
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
}).catch((error) => {
  console.error(error);
  app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
  stopRendererServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
