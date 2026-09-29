const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const POS_URL = process.env.PHARMAERP_POS_URL || 'https://pharma-erp-saas-five.vercel.app/pos';
const PRINT_AGENT_PORT = '17373';

let mainWindow = null;
let printAgent = null;

app.setName('PharmaERP');
app.setPath('userData', path.join(app.getPath('appData'), 'PharmaERP'));

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.whenReady().then(() => {
  startPrintAgent();
  createWindow();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  if (printAgent && !printAgent.killed) {
    printAgent.kill();
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 700,
    title: 'PharmaERP',
    autoHideMenuBar: true,
    backgroundColor: '#f8fafc',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://pharma-erp-saas-five.vercel.app')) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.removeMenu();
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(POS_URL);
}

function startPrintAgent() {
  const agentPath = getPrintAgentPath();
  if (!agentPath || !fs.existsSync(agentPath)) return;

  printAgent = spawn(agentPath, [], {
    env: {
      ...process.env,
      PRINT_AGENT_PORT,
      PRINT_AGENT_ALLOWED_ORIGINS: 'https://pharma-erp-saas-five.vercel.app,http://localhost:5173,http://127.0.0.1:5173',
    },
    stdio: 'ignore',
    windowsHide: true,
  });

  printAgent.unref();
}

function getPrintAgentPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'print-agent', 'PharmaERP-Print-Agent.exe');
  }
  return path.resolve(__dirname, '..', '..', 'tools', 'print-agent', 'dist', 'PharmaERP-Print-Agent.exe');
}
