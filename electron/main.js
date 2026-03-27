const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

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

  // Start the Express server
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
          console.error("Failed to load URL:", err);
        });
        loaded = true;
      }, 1000); // Give it a second to bind
    }
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Server Error: ${data}`);
  });

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
