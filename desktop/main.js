// Project Tracker desktop program: main process.
// Copyright (c) 2026 Yasser Mohamed Abdelgaber. All rights reserved.
'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const fs = require('fs');
const path = require('path');
const { Store } = require('./db');

const APP_TITLE = 'متابعة المشاريع';
let store, win;
const pendingImports = new Map();

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.setAppUserModelId('com.yasser.projecttracker');

function dataDir() {
  const dir = process.env.PROJECT_TRACKER_DATA || path.join(app.getPath('documents'), 'Project Tracker');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 900, minHeight: 600, show: false,
    title: APP_TITLE, backgroundColor: '#F2F5F6', autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, spellcheck: false }
  });
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.on('page-title-updated', e => { e.preventDefault(); });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); } });
  win.loadFile(path.join(__dirname, 'renderer', 'home.html'));
}

/* ---- work-plan projects (lift stations): the plan page is the offline plan app with this project's data ---- */
const PLAN_APP = path.join(__dirname, 'renderer', 'plan-app.html');
const PLAN_DATA_TAG = '<script type="application/json" id="plan-data">';
const PLAN_SHIM = '<script id="desktop-plan">' + fs.readFileSync(path.join(__dirname, 'renderer', 'plan-shim.js'), 'utf8') + '</script>';

function planTemplateData() {
  const html = fs.readFileSync(PLAN_APP, 'utf8');
  const i = html.indexOf(PLAN_DATA_TAG), j = html.indexOf('</script>', i);
  return JSON.parse(html.slice(i + PLAN_DATA_TAG.length, j));
}

function openPlan(id) {
  const root = store.planGet(id) || planTemplateData();
  let html = fs.readFileSync(PLAN_APP, 'utf8');
  const i = html.indexOf(PLAN_DATA_TAG), j = html.indexOf('</script>', i);
  html = html.slice(0, i + PLAN_DATA_TAG.length) + JSON.stringify(root).replace(/</g, '\\u003c') + html.slice(j);
  const k = html.indexOf('<script id="app-js">');
  html = html.slice(0, k) + PLAN_SHIM + html.slice(k);
  const file = path.join(app.getPath('userData'), 'plan-view.html');
  fs.writeFileSync(file, html);
  return win.loadFile(file, { query: { p: id } });
}

function seedPlan() {
  if (store.kv('seeded_plan')) return;
  if (!store.all("SELECT id FROM projects WHERE type='plan'").length && fs.existsSync(PLAN_APP)) {
    const id = store.create('خطط محطات الرفع – مدينة الملك خالد العسكرية', 'plan');
    store.planSave(id, planTemplateData());
  }
  store.kv('seeded_plan', '1');
}

function safeName(name) { return String(name || 'ملف').replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 150) || 'ملف'; }

function filtersFor(name) {
  const ext = path.extname(name).slice(1).toLowerCase();
  const map = { pdf: 'ملف PDF', xlsx: 'ملف Excel', csv: 'ملف CSV', json: 'ملف مشروع', html: 'صفحة HTML' };
  return [{ name: map[ext] || 'ملف', extensions: [ext || '*'] }];
}

async function saveAs(sender, name, bytes) {
  const w = BrowserWindow.fromWebContents(sender);
  const r = await dialog.showSaveDialog(w, { title: 'حفظ الملف', defaultPath: path.join(app.getPath('documents'), safeName(name)), filters: filtersFor(name) });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, Buffer.from(bytes));
  return r.filePath;
}

function handlers() {
  const h = (ch, fn) => ipcMain.handle(ch, (e, ...a) => fn(e, ...a));
  h('db:list', (e, p, c) => store.list(p, c));
  h('db:set', (e, p, docPath, data) => { store.set(p, docPath, data); return true; });
  h('db:del', (e, p, docPath) => { store.del(p, docPath); return true; });

  h('projects:list', () => store.projects());
  h('projects:create', (e, name, type) => {
    const id = store.create(name, type);
    if (type === 'plan') store.planSave(id, planTemplateData());
    return id;
  });
  h('plan:open', (e, id) => { openPlan(id); return true; });
  h('plan:save', (e, id, root) => { store.planSave(id, root); return true; });
  h('app:home', () => { win.loadFile(path.join(__dirname, 'renderer', 'home.html')); return true; });
  h('projects:duplicate', (e, id) => store.duplicate(id));
  h('projects:remove', (e, id) => { store.remove(id); return true; });
  h('projects:archive', (e, id, flag) => { store.archive(id, flag); return true; });
  h('projects:import', async e => {
    const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
      title: 'استيراد مشروع', properties: ['openFile'],
      filters: [{ name: 'ملف مشروع أو Excel', extensions: ['json', 'xlsx'] }]
    });
    if (r.canceled || !r.filePaths[0]) return null;
    const file = r.filePaths[0];
    const id = store.create(path.basename(file, path.extname(file)), 'valves');
    pendingImports.set(id, { name: path.basename(file), bytes: fs.readFileSync(file) });
    return id;
  });
  h('projects:takeImport', (e, id) => { const f = pendingImports.get(id) || null; pendingImports.delete(id); return f; });

  h('file:save', (e, name, bytes) => saveAs(e.sender, name, bytes));
  h('file:pdf', async (e, name) => {
    const pdf = await e.sender.printToPDF({ pageSize: 'A4', printBackground: true, preferCSSPageSize: true, margins: { marginType: 'none' } });
    return saveAs(e.sender, name, pdf);
  });

  h('app:info', () => ({ version: app.getVersion(), dbPath: store.file, backups: store.backups }));
  h('app:backup', () => path.basename(store.backupNow()));
  h('app:openData', () => shell.openPath(store.dir));
  h('app:restore', async e => {
    const w = BrowserWindow.fromWebContents(e.sender);
    const r = await dialog.showOpenDialog(w, { title: 'استرجاع نسخة احتياطية', defaultPath: store.backups, properties: ['openFile'], filters: [{ name: 'قاعدة بيانات', extensions: ['db'] }] });
    if (r.canceled || !r.filePaths[0]) return false;
    store.restore(r.filePaths[0]);
    return true;
  });
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  store = new Store(dataDir());
  try { await store.open(); } catch (err) {
    dialog.showErrorBox(APP_TITLE, 'تعذّر فتح قاعدة البيانات:\n' + store.file + '\n\n' + (err && err.message));
    app.quit(); return;
  }
  seedPlan();
  handlers();
  createWindow();
});

app.on('before-quit', () => { try { if (store && store.db) store.flush(); } catch (e) { /* file locked: the last 300 ms of edits may be lost */ } });
app.on('window-all-closed', () => app.quit());
