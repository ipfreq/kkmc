// Bridge between the pages and the main process.
// Copyright (c) 2026 Yasser Mohamed Abdelgaber. All rights reserved.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const call = (ch, ...a) => ipcRenderer.invoke(ch, ...a);

contextBridge.exposeInMainWorld('DESKTOP', {
  list: (p, c) => call('db:list', p, c),
  set: (p, docPath, data) => call('db:set', p, docPath, data),
  del: (p, docPath) => call('db:del', p, docPath),
  projects: () => call('projects:list'),
  purchases: () => call('purchases:all'),
  create: (name, type) => call('projects:create', name, type),
  duplicate: id => call('projects:duplicate', id),
  remove: id => call('projects:remove', id),
  archive: (id, flag) => call('projects:archive', id, flag),
  importProject: () => call('projects:import'),
  takeImport: id => call('projects:takeImport', id),
  saveFile: (name, bytes) => call('file:save', name, bytes),
  printPdf: name => call('file:pdf', name),
  info: () => call('app:info'),
  backupNow: () => call('app:backup'),
  openData: () => call('app:openData'),
  restore: () => call('app:restore'),
  openPlan: id => call('plan:open', id),
  planSave: (id, root) => call('plan:save', id, root),
  home: () => call('app:home'),
  planGet: id => call('plan:get', id),
  kv: (key, value) => call('app:kv', key, value),
  planTemplate: () => call('plan:template'),
  cleanup: name => call('projects:cleanup', name),
  exportDb: () => call('db:export'),
  pickDb: () => call('db:pick'),
  loadDb: (file, mode) => call('db:load', file, mode),
  wipeDb: () => call('db:wipe')
});
