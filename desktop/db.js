// Project database: one SQLite file holding every project, row by row.
// Copyright (c) 2026 Yasser Mohamed Abdelgaber. All rights reserved.
'use strict';
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects(
  id TEXT PRIMARY KEY, type TEXT NOT NULL DEFAULT 'valves', name TEXT NOT NULL DEFAULT '',
  created TEXT NOT NULL, updated TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS records(
  project TEXT NOT NULL, coll TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL,
  PRIMARY KEY(project, coll, id));
CREATE TABLE IF NOT EXISTS kv(key TEXT PRIMARY KEY, value TEXT);
`;
const COLLS = ['boq', 'groups', 'tasks', 'events', 'installs', 'supplies', 'expenses', 'sections', 'team', 'equip', 'rates', 'risks', 'conditions'];
const DAY = 864e5;

class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'projects.db');
    this.backups = path.join(dir, 'backups');
    this.timer = null;
  }

  async open() {
    fs.mkdirSync(this.backups, { recursive: true });
    this.SQL = await initSqlJs({ locateFile: f => path.join(path.dirname(require.resolve('sql.js')), f) });
    this.db = fs.existsSync(this.file) ? new this.SQL.Database(fs.readFileSync(this.file)) : new this.SQL.Database();
    this.db.run(SCHEMA);
    this.flush();
    this.dailyBackup();
  }

  all(sql, params) {
    const st = this.db.prepare(sql);
    st.bind(params || []);
    const out = [];
    while (st.step()) out.push(st.getAsObject());
    st.free();
    return out;
  }

  // Writes go to memory first; the file is rewritten shortly after, atomically.
  touch() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 300);
  }

  flush() {
    clearTimeout(this.timer);
    this.timer = null;
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, Buffer.from(this.db.export()));
    fs.renameSync(tmp, this.file);
  }

  backupNow(tag) {
    this.flush();
    const d = new Date();
    const stamp = d.toISOString().slice(0, 10) + (tag ? '' : '_' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0'));
    const out = path.join(this.backups, 'projects_' + stamp + '.db');
    fs.copyFileSync(this.file, out);
    return out;
  }

  dailyBackup() {
    const today = new Date().toISOString().slice(0, 10);
    if (!fs.existsSync(path.join(this.backups, 'projects_' + today + '.db'))) this.backupNow('daily');
    const daily = fs.readdirSync(this.backups).filter(f => /^projects_\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort();
    daily.slice(0, Math.max(0, daily.length - 30)).forEach(f => fs.unlinkSync(path.join(this.backups, f)));
  }

  // Replace the whole database with a backup file (validated first).
  restore(file) {
    const probe = new this.SQL.Database(fs.readFileSync(file));
    probe.exec('SELECT count(*) FROM projects; SELECT count(*) FROM records;');
    probe.close();
    this.backupNow();
    this.db.close();
    this.db = new this.SQL.Database(fs.readFileSync(file));
    this.db.run(SCHEMA);
    this.flush();
  }

  /* ---- records (one row per sheet line) ---- */
  list(project, coll) {
    return this.all('SELECT id, data FROM records WHERE project=? AND coll=?', [project, coll])
      .map(r => ({ id: r.id, data: JSON.parse(r.data) }));
  }

  set(project, docPath, data) {
    const [coll, id] = splitPath(docPath);
    this.db.run('INSERT INTO records(project,coll,id,data) VALUES(?,?,?,?) ON CONFLICT(project,coll,id) DO UPDATE SET data=excluded.data',
      [project, coll, id, JSON.stringify(data)]);
    const now = new Date().toISOString();
    if (coll === 'project' && id === 'meta') this.db.run('UPDATE projects SET name=?, updated=? WHERE id=?', [String(data.name || ''), now, project]);
    else this.db.run('UPDATE projects SET updated=? WHERE id=?', [now, project]);
    this.touch();
  }

  del(project, docPath) {
    const [coll, id] = splitPath(docPath);
    this.db.run('DELETE FROM records WHERE project=? AND coll=? AND id=?', [project, coll, id]);
    this.db.run('UPDATE projects SET updated=? WHERE id=?', [new Date().toISOString(), project]);
    this.touch();
  }

  /* ---- projects ---- */
  create(name, type) {
    const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const now = new Date().toISOString();
    this.db.run('INSERT INTO projects(id,type,name,created,updated) VALUES(?,?,?,?,?)', [id, type || 'valves', name || '', now, now]);
    this.touch();
    return id;
  }

  duplicate(src) {
    const p = this.all('SELECT * FROM projects WHERE id=?', [src])[0];
    if (!p) throw new Error('not found');
    const id = this.create(p.name + ' – نسخة', p.type);
    this.all('SELECT coll, id, data FROM records WHERE project=?', [src]).forEach(r => {
      let data = r.data;
      if (r.coll === 'project' && r.id === 'meta') {
        const m = JSON.parse(data); m.name = (m.name || '') + ' – نسخة'; m.short = (m.short || '') + ' – نسخة'; data = JSON.stringify(m);
      }
      this.db.run('INSERT INTO records(project,coll,id,data) VALUES(?,?,?,?)', [id, r.coll, r.id, data]);
    });
    this.db.run('UPDATE projects SET name=? WHERE id=?', [p.name + ' – نسخة', id]);
    this.touch();
    return id;
  }

  remove(id) {
    this.backupNow();
    this.db.run('DELETE FROM records WHERE project=?', [id]);
    this.db.run('DELETE FROM projects WHERE id=?', [id]);
    this.touch();
  }

  archive(id, flag) {
    this.db.run('UPDATE projects SET archived=? WHERE id=?', [flag ? 1 : 0, id]);
    this.touch();
  }

  projects() {
    return this.all('SELECT * FROM projects ORDER BY archived, updated DESC').map(p => Object.assign(p, { summary: this.summary(p.id) }));
  }

  summary(id) {
    const rows = {}, proj = {};
    this.all('SELECT coll, id, data FROM records WHERE project=?', [id]).forEach(r => {
      const d = JSON.parse(r.data);
      if (r.coll === 'project') proj[r.id] = d; else (rows[r.coll] = rows[r.coll] || []).push(d);
    });
    const meta = proj.meta || null;
    if (!meta) return { empty: true };
    const boq = rows.boq || [], ids = new Set(boq.map(b => b.id));
    const sum = (list, f, keep) => (list || []).reduce((s, x) => s + (keep && !keep(x) ? 0 : num(x[f])), 0);
    const qty = sum(boq, 'qty');
    const inst = Math.min(sum(rows.installs, 'qty', x => ids.has(x.boq)), qty || Infinity);
    const sup = Math.min(sum(rows.supplies, 'qty', x => ids.has(x.boq)), qty || Infinity);
    const today = Math.floor(Date.now() / DAY);
    const dn = s => s ? Math.round(Date.parse(String(s).slice(0, 10) + 'T00:00:00Z') / DAY) : NaN;
    let adds = 0;
    (rows.events || []).forEach(e => {
      let days = 0;
      if (e.type === 'ext') days = Math.max(0, num(e.days));
      else { const a = dn(e.from), b = e.to ? dn(e.to) : today; if (!isNaN(a) && b >= a) days = b - a + 1; }
      const counts = e.type === 'ext' ? true : e.type === 'stop' ? e.adds !== false : !!e.adds;
      if (counts) adds += days;
    });
    const end = dn(meta.end), start = dn(meta.start);
    return {
      name: meta.name, short: meta.short, client: meta.client, po: meta.po, currency: meta.currency || '',
      qty, inst, sup, expenses: sum(rows.expenses, 'amount'),
      start: isNaN(start) ? null : start * DAY, end: isNaN(end) ? null : end * DAY,
      revEnd: isNaN(end) ? null : (end + adds) * DAY, adds,
      ongoingStop: (rows.events || []).some(e => e.type === 'stop' && e.from && !e.to),
      counts: { installs: (rows.installs || []).length, supplies: (rows.supplies || []).length, expenses: (rows.expenses || []).length }
    };
  }
}

function splitPath(p) {
  const s = String(p).split('/');
  if (s.length !== 2 || !s[0] || !s[1]) throw new Error('bad path');
  if (s[0] !== 'project' && COLLS.indexOf(s[0]) < 0) throw new Error('bad collection');
  return s;
}
function num(v) { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isNaN(n) ? 0 : n; }

module.exports = { Store };
