// Gives the project page its database, file saving and PDF output on the desktop.
// Copyright (c) 2026 Yasser Mohamed Abdelgaber. All rights reserved.
(function () {
  'use strict';
  var api = window.DESKTOP;
  if (!api) return;
  var q = new URLSearchParams(location.search), project = q.get('p');
  if (!project) { location.replace('home.html'); return; }

  function snapshot(rows) {
    var docs = rows.map(function (r) {
      return { id: r.id, exists: true, data: function () { return r.data; }, metadata: { fromCache: false, hasPendingWrites: false } };
    });
    return { docs: docs, size: docs.length, empty: !docs.length, docChanges: function () { return []; }, metadata: { fromCache: false, hasPendingWrites: false } };
  }
  var db = {
    doc: function (docPath) {
      return {
        set: function (data) { return api.set(project, docPath, data); },
        delete: function () { return api.del(project, docPath); }
      };
    },
    collection: function (c) {
      return {
        get: function () { return api.list(project, c).then(snapshot); },
        onSnapshot: function () { return function () {}; },
        doc: function (id) { return db.doc(c + '/' + id); }
      };
    }
  };
  function bytes(data) {
    if (typeof data === 'string') return Promise.resolve(new TextEncoder().encode(data));
    if (data instanceof Blob) return data.arrayBuffer().then(function (b) { return new Uint8Array(b); });
    if (data instanceof ArrayBuffer) return Promise.resolve(new Uint8Array(data));
    return Promise.resolve(data);
  }
  var downloads = {
    save: function (o) {
      return bytes(o.data).then(function (b) { return api.saveFile(o.filename, b); }).then(function (file) {
        if (!file) { var e = new Error('declined'); e.code = 'declined'; throw e; }
        return { status: 'saved' };
      });
    }
  };
  window.PLAN_HOST = {
    desktop: true, print: true, project: project,
    newName: q.get('name') || '', blank: q.get('blank') === '1',
    use: function (n) { return Promise.resolve(n === 'db' ? db : n === 'downloads' ? downloads : null); },
    pdf: function (name) { return api.printPdf(name); },
    takeImport: function () { return q.get('import') === '1' ? api.takeImport(project) : Promise.resolve(null); },
    info: api.info, backupNow: api.backupNow, openData: api.openData,
    home: function () { location.href = 'home.html'; }
  };
})();
