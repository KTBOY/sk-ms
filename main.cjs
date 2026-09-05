const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const isDev = !app.isPackaged;
const BOOT_T0 = Date.now();

/* 启动计时（MOSHU_BOOT_LOG=1 时写 %TEMP%/moshu-boot.log，量化启动各阶段耗时） */
function bootLog(msg) {
  if (!process.env.MOSHU_BOOT_LOG) return;
  fs.appendFile(path.join(os.tmpdir(), 'moshu-boot.log'), `${new Date().toISOString()} [boot +${Date.now() - BOOT_T0}ms] ${msg}\n`, () => undefined);
}

let splashWin = null;
let mainWin = null;
let splashDismissed = false;
let splashGuard = null;

/* 启动画面：无框 HUD 小窗，置顶显示；主窗口就绪后加 .is-done 淡出再关闭 */
function createSplash() {
  splashWin = new BrowserWindow({
    width: 480,
    height: 300,
    useContentSize: true,
    center: true,
    show: false,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#14161a',
    title: '墨枢 NovelAtlas',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  splashWin.once('ready-to-show', () => { bootLog('splash ready-to-show'); splashWin?.show(); });
  splashWin.on('closed', () => { splashWin = null; });
  splashWin.loadFile(path.join(__dirname, 'splash.html'), { query: { v: app.getVersion() } });
}

/* 撤掉启动画面（幂等）：先显示主窗口，splash 在其上层淡出，形成交叉过渡 */
function dismissSplash() {
  if (splashDismissed) return;
  splashDismissed = true;
  clearTimeout(splashGuard);
  bootLog('dismiss-splash (main window visible)');
  if (mainWin && !mainWin.isDestroyed() && !mainWin.isVisible()) mainWin.show();
  if (splashWin && !splashWin.isDestroyed()) {
    splashWin.webContents.executeJavaScript('document.body.classList.add("is-done")').catch(() => {});
    setTimeout(() => splashWin?.close(), 450);
  }
}

function createWindow() {
  // 打包后窗口图标取自 exe 资源；开发模式显式指定品牌图标
  const devIcon = path.join(__dirname, '../build/icon.ico');
  mainWin = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: '墨枢 NovelAtlas',
    autoHideMenuBar: true,
    backgroundColor: '#14161a',
    // 无边框窗口：原生标题栏移除，顶栏承担拖拽与窗口控制（右上角最小化/最大化/关闭）
    frame: false,
    // 等 ready-to-show 再显示，避免白屏；首屏由 splash 覆盖
    show: false,
    ...(isDev && fs.existsSync(devIcon) ? { icon: devIcon } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  mainWin.once('ready-to-show', () => {
    bootLog('main ready-to-show');
    if (mainWin && !mainWin.isDestroyed() && !mainWin.isVisible()) mainWin.show();
    dismissSplash();
  });
  mainWin.webContents.on('did-finish-load', () => {
    bootLog('main did-finish-load');
    mainWin?.webContents
      .executeJavaScript('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(Math.round(performance.now())))))')
      .then((t) => bootLog(`renderer first-paint +2rAF = ${t}ms (perf.now)`))
      .catch(() => undefined);
  });
  // 主框架加载失败（如 dev 服务器未启动）时的兜底：撤 splash 并显示窗口
  mainWin.webContents.on('did-fail-load', (_e, _code, _desc, _url, isMainFrame) => {
    if (isMainFrame === false) return;
    setTimeout(dismissSplash, 300);
  });
  mainWin.on('closed', () => { mainWin = null; });

  Menu.setApplicationMenu(null);

  if (isDev) {
    mainWin.loadURL('http://localhost:5175');
  } else {
    mainWin.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

/* 无边框窗口控制：最小化 / 最大化切换 / 关闭 + 最大化状态推送（图标切换）。
   以 sender 定位窗口，注册一次即可，多开也不会重复绑定。 */
function registerWindowControls() {
  ipcMain.on('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
  ipcMain.on('window:toggle-maximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());
  ipcMain.handle('window:is-maximized', (e) => BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false);

  ipcMain.on('window:maximized-changed:subscribe', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return;
    win.on('maximize', () => win.webContents.send('window:maximized-changed', true));
    win.on('unmaximize', () => win.webContents.send('window:maximized-changed', false));
  });
}

/* ---------- 数据存放目录 ----------
   桌面端项目数据落盘为 JSON 文件（<数据目录>/projects/<id>.json）。
   默认位于软件安装目录的 data/ 下（便携/绿色心智一致）；安装目录不可写
   （如被装进 Program Files）时自动回退到系统用户数据目录。
   用户自选目录记录在 userData/data-dir.json —— 指针文件必须放在数据目录
   之外，否则换目录后选择本身会丢失。 */

const readDataConfig = () => {
  try { return JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'data-dir.json'), 'utf8')); }
  catch { return {}; }
};

function defaultDataDir() {
  // 打包后 = exe 所在目录；开发模式 = 项目根目录
  return path.join(app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath(), 'data');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** 解析当前生效的数据目录：自选 > 安装目录 > 用户数据目录（兜底）。 */
function resolveDataDir() {
  const custom = readDataConfig().dataDir;
  if (custom) {
    try { ensureDir(custom); return { dir: custom, source: 'custom' }; }
    catch { /* 自选目录失效（被删/掉线），落回默认 */ }
  }
  try { ensureDir(defaultDataDir()); return { dir: defaultDataDir(), source: 'default' }; }
  catch {
    return { dir: ensureDir(path.join(app.getPath('userData'), 'data')), source: 'fallback' };
  }
}

const projectsDirOf = (info) => path.join(info.dir, 'projects');
const safeFileName = (id) => String(id).replace(/[^A-Za-z0-9_-]/g, '_');
const projectFileOf = (info, id) => path.join(projectsDirOf(info), `${safeFileName(id)}.json`);

/** 把旧数据目录的作品迁移到新目录（不覆盖已有文件，非破坏性）。 */
function migrateProjects(fromDir, toDir) {
  const to = ensureDir(path.join(toDir, 'projects'));
  let files = [];
  try { files = fs.readdirSync(path.join(fromDir, 'projects')).filter((f) => f.endsWith('.json')); }
  catch { /* 旧目录没有数据 */ }
  for (const f of files) {
    const target = path.join(to, f);
    if (!fs.existsSync(target)) fs.copyFileSync(path.join(fromDir, 'projects', f), target);
  }
}

function registerDataStorage() {
  ipcMain.handle('data:get-info', () => resolveDataDir());

  ipcMain.handle('data:list-projects', () => {
    const dir = projectsDirOf(resolveDataDir());
    let files = [];
    try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')); } catch { return []; }
    const metas = [];
    for (const f of files) {
      try {
        const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        if (p && p.id) metas.push({ id: p.id, name: p.name ?? '未命名作品', genre: p.genre ?? '', updatedAt: p.updatedAt ?? 0 });
      } catch { /* 跳过损坏文件，不阻塞列表 */ }
    }
    return metas.sort((a, b) => b.updatedAt - a.updatedAt);
  });

  ipcMain.handle('data:load-project', (_e, id) => {
    try { return JSON.parse(fs.readFileSync(projectFileOf(resolveDataDir(), id), 'utf8')); }
    catch { return null; }
  });

  ipcMain.handle('data:save-project', (_e, project) => {
    if (!project || typeof project !== 'object' || !project.id) throw new Error('作品数据不合法');
    const info = resolveDataDir();
    ensureDir(projectsDirOf(info));
    fs.writeFileSync(projectFileOf(info, project.id), JSON.stringify(project));
    return true;
  });

  ipcMain.handle('data:delete-project', (_e, id) => {
    try { fs.rmSync(projectFileOf(resolveDataDir(), id), { force: true }); } catch { /* 忽略 */ }
    return true;
  });

  ipcMain.handle('data:open-folder', () => {
    shell.openPath(resolveDataDir().dir);
    return true;
  });

  ipcMain.handle('data:choose-dir', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const info = resolveDataDir();
    const res = await dialog.showOpenDialog(win, {
      title: '选择数据存放目录',
      defaultPath: info.dir,
      buttonLabel: '使用此目录',
      properties: ['openDirectory', 'createDirectory'],
    });
    const next = res.canceled ? null : res.filePaths?.[0];
    if (!next) return null;
    try { ensureDir(path.join(next, 'projects')); }
    catch (err) { return { dir: next, source: 'custom', error: `目录不可写：${err.message}` }; }
    // 不允许选到当前数据目录内部，否则迁移会把目录套进自己
    const rel = path.relative(info.dir, next);
    if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
      return { dir: info.dir, source: info.source, error: '不能选择当前数据目录内部' };
    }
    migrateProjects(info.dir, next);
    fs.writeFileSync(path.join(app.getPath('userData'), 'data-dir.json'), JSON.stringify({ dataDir: next }, null, 2));
    return { dir: next, source: 'custom' };
  });

  ipcMain.handle('data:reset-dir', () => {
    const info = resolveDataDir();
    try { fs.rmSync(path.join(app.getPath('userData'), 'data-dir.json'), { force: true }); } catch { /* 忽略 */ }
    const next = resolveDataDir();
    // 恢复默认也迁移，避免自选目录里的作品"消失"
    if (path.resolve(next.dir) !== path.resolve(info.dir)) migrateProjects(info.dir, next.dir);
    return next;
  });
}

registerWindowControls();
registerDataStorage();

app.whenReady().then(() => {
  bootLog('app whenReady');
  createSplash();
  createWindow();
  // 全局兜底：主窗口迟迟未就绪（资源异常）时 15s 后强制撤掉 splash
  splashGuard = setTimeout(dismissSplash, 15000);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
