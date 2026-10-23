/* 启核图策 · 桌面壳（Electron）

   启动时做三件事：
   1. 用当前进程 fork 本地服务（server.js，零外部依赖），端口随机；
   2. 等服务 ready 后开窗口，加载 http://127.0.0.1:<port>/index.html；
   3. 第一次打开（没配置 AI Key）先展示 setup.html，填完 Key 再进主界面。

   本地服务退出会一并关掉；点关闭窗口即退出整个应用。
*/
'use strict';
const { app, BrowserWindow, shell, dialog, Menu } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let child = null;
let win = null;
let port = 0;

function startServer() {
  return new Promise((resolve, reject) => {
    /* 默认放用户目录；NXG_DATA_DIR 可指定别的目录（便携/测试用） */
    const dataDir = process.env.NXG_DATA_DIR || path.join(app.getPath('userData'), 'data');
    child = fork(path.join(__dirname, 'server.js'), [], {
      env: Object.assign({}, process.env, {
        ELECTRON_RUN_AS_NODE: '1',   /* 关键：让 fork 出来的进程按 Node 跑，而不是又开一个 Electron 应用 */
        NXG_DATA_DIR: dataDir,
        NXG_WEB_DIR: path.join(__dirname, 'web'),
        PORT: '0'
      }),
      stdio: ['ignore', 'pipe', 'pipe', 'ipc']
    });
    const timer = setTimeout(() => reject(new Error('本地服务启动超时')), 15000);
    child.on('message', (msg) => {
      if (msg && msg.type === 'ready') {
        clearTimeout(timer);
        port = msg.port;
        resolve(port);
      }
    });
    child.on('exit', (code) => {
      if (code !== 0 && !app.isQuiting) {
        dialog.showErrorBox('本地服务已退出', '退出码 ' + code + '。请重试，或查看应用数据目录下的日志。');
      }
    });
    child.stdout.on('data', (d) => process.stdout.write('[server] ' + d));
    child.stderr.on('data', (d) => process.stderr.write('[server] ' + d));
    child.on('error', reject);
  });
}

async function firstRunNeedsSetup() {
  try {
    const res = await fetch('http://127.0.0.1:' + port + '/api/config/ai');
    const j = await res.json();
    return !j.configured;
  } catch (e) {
    return false;
  }
}

async function createWindow() {
  const needSetup = await firstRunNeedsSetup();
  win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    title: '启核图策 NexcoreGraph',
    backgroundColor: '#F5F9FB',
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  await win.loadURL('http://127.0.0.1:' + port + (needSetup ? '/setup.html' : '/index.html'));
  if (process.env.NXG_DEVTOOLS === '1') win.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(async () => {
  try {
    await startServer();
    await createWindow();
  } catch (e) {
    dialog.showErrorBox('启动失败', (e && e.message) || String(e));
    app.quit();
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => { app.isQuiting = true; });
app.on('window-all-closed', () => {
  if (child && child.connected) child.kill();
  app.quit();
});
