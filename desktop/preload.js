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
  restore: () => call('app:restore')
});
