const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

function getConfiguredWebUrl() {
  const fromEnv = process.env.REVIEWROLL_WEB_URL;
  if (fromEnv) return fromEnv;

  const configPath = path.join(__dirname, 'build-config.json');
  if (!fs.existsSync(configPath)) return null;

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.webUrl === 'string' && parsed.webUrl.trim()) {
      return parsed.webUrl.trim();
    }
  } catch (err) {
    console.error('Failed to read desktop build config:', err);
  }

  return null;
}

function loadHostedApp(webUrl) {
  mainWindow.loadURL(webUrl).catch(err => {
    console.error('Failed to load hosted URL:', err);
  });
}

function startLocalServerAndLoad() {
  const serverPath = path.join(__dirname, '..', 'server', 'server.js');
  serverProcess = spawn('node', [serverPath], {
    env: { ...process.env, PORT: 3000 }
  });

  let loaded = false;

  serverProcess.stdout.on('data', (data) => {
    console.log(`Server: ${data}`);
    if (!loaded) {
      setTimeout(() => {
        mainWindow.loadURL('http://localhost:3000').catch(err => {
          console.error('Failed to load local URL:', err);
        });
        loaded = true;
      }, 1000);
    }
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Server Error: ${data}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: "ReviewRoll",
    autoHideMenuBar: true,
    show: false // Don't show until loaded
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const hostedWebUrl = getConfiguredWebUrl();
  if (hostedWebUrl) {
    console.log(`Loading hosted ReviewRoll app: ${hostedWebUrl}`);
    loadHostedApp(hostedWebUrl);
  } else {
    startLocalServerAndLoad();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Ensure single instance lock for database connections
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on('ready', createWindow);

  app.on('window-all-closed', () => {
    if (serverProcess) {
      serverProcess.kill();
    }
    app.quit();
  });

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow();
    }
  });
}
