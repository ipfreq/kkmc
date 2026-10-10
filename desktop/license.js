// Licensing: a 7-day trial, then a serial key signed for one device.
// Keys are Ed25519 signatures over the device code; only the publisher's private key can make them.
// Copyright (c) 2026 Yasser Mohamed Abdelgaber. All rights reserved.
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const PUBLIC_KEY = 'MCowBQYDK2VwAyEAHHAliNC7US495IqGRDSjpXA7WGIMlWFyoERLzAOYmVc=';
const TRIAL_DAYS = 7;
const DAY = 864e5, HOUR = 36e5;
const EPOCH = Date.UTC(2026, 0, 1);
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const REG = 'HKCU\\Software\\YasserMA\\ProjectTracker';
const MARK = 'PT-LIC-1|';

function b32enc(buf) {
  let bits = 0, val = 0, out = '';
  for (const b of buf) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } val &= (1 << bits) - 1; }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
function b32dec(str) {
  let bits = 0, val = 0; const out = [];
  for (const ch of str) { const i = B32.indexOf(ch); if (i < 0) return null; val = (val << 5) | i; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } val &= (1 << bits) - 1; }
  return Buffer.from(out);
}
/* typed keys: ignore spaces and dashes, accept lower case, read O as 0 and I/L as 1 */
function clean(s) { return String(s || '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, ''); }
function group(s, n) { return s.match(new RegExp('.{1,' + n + '}', 'g')).join('-'); }

function regGet(name) {
  if (process.platform !== 'win32') return null;
  try { const o = execFileSync('reg', ['query', REG, '/v', name], { encoding: 'utf8', windowsHide: true }); const m = o.match(new RegExp(name + '\\s+REG_SZ\\s+(.+)')); return m ? m[1].trim() : null; } catch (e) { return null; }
}
function regSet(name, value) {
  if (process.platform !== 'win32') return;
  try { execFileSync('reg', ['add', REG, '/v', name, '/t', 'REG_SZ', '/d', String(value), '/f'], { windowsHide: true, stdio: 'ignore' }); } catch (e) { /* ignore */ }
}

function machineSource() {
  if (process.platform === 'win32') {
    try { const o = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { encoding: 'utf8', windowsHide: true }); const m = o.match(/MachineGuid\s+REG_SZ\s+(\S+)/); if (m) return m[1].toLowerCase(); } catch (e) { /* fall through */ }
  } else {
    for (const f of ['/etc/machine-id', '/var/lib/dbus/machine-id']) { try { const v = fs.readFileSync(f, 'utf8').trim(); if (v) return v; } catch (e) { /* next */ } }
  }
  const c = os.cpus()[0] || {};
  return [os.hostname(), c.model || '', os.totalmem(), os.platform(), os.arch()].join('|');
}
function deviceBytes(code) { return b32dec(clean(code)); }

class License {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'license.key');
    this.trialFile = path.join(dir, '.ptstate');
    this.secret = crypto.createHash('sha256').update('pt-trial|' + PUBLIC_KEY).digest();
    const h = crypto.createHash('sha256').update(MARK + machineSource()).digest().subarray(0, 10);
    this.device = group(b32enc(h), 4);
    this.issuer = null;
    this.trial = null;
  }

  /* ---- keys ---- */
  static parse(key) {
    const c = clean(key); if (c.length < 100) return null;
    const b = b32dec(c); if (!b || b.length !== 67 || b[0] !== 1 || b32enc(b) !== c) return null;
    return { payload: b.subarray(0, 3), sig: b.subarray(3), exp: b.readUInt16BE(1) };
  }
  static message(device, payload) { return Buffer.concat([Buffer.from(MARK), deviceBytes(device), payload]); }
  check(key, device) {
    const k = License.parse(key); if (!k) return { ok: false, reason: 'format' };
    const dev = device || this.device, db = deviceBytes(dev);
    if (!db || db.length !== 10) return { ok: false, reason: 'device' };
    let good = false;
    try { good = crypto.verify(null, License.message(dev, k.payload), { key: Buffer.from(PUBLIC_KEY, 'base64'), format: 'der', type: 'spki' }, k.sig); } catch (e) { good = false; }
    if (!good) return { ok: false, reason: 'device' };
    const expires = k.exp ? EPOCH + k.exp * DAY : null;
    if (expires && Date.now() > expires + DAY) return { ok: false, reason: 'expired', expires };
    return { ok: true, expires };
  }
  saved() {
    try { const v = fs.readFileSync(this.file, 'utf8').trim(); if (v) return v; } catch (e) { /* none */ }
    return regGet('License');
  }
  activate(key) {
    const r = this.check(key);
    if (!r.ok) return r;
    const v = group(clean(key), 6);
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.file, v);
    regSet('License', v);
    return r;
  }

  /* ---- trial: the first-run time is kept in three places so deleting one does not restart it ---- */
  seal(o) { const s = JSON.stringify(o); return Buffer.from(s).toString('base64') + '.' + crypto.createHmac('sha256', this.secret).update(s).digest('hex').slice(0, 16); }
  open(t) {
    try { const [b, m] = String(t || '').split('.'); const s = Buffer.from(b, 'base64').toString(); if (crypto.createHmac('sha256', this.secret).update(s).digest('hex').slice(0, 16) !== m) return null; return JSON.parse(s); } catch (e) { return null; }
  }
  loadTrial(store) {
    const now = Date.now(), seen = [];
    try { seen.push(this.open(fs.readFileSync(this.trialFile, 'utf8'))); } catch (e) { /* none */ }
    seen.push(this.open(regGet('State')));
    if (store) seen.push(this.open(store.kv('pt_state')));
    const ok = seen.filter(x => x && x.f > 0);
    const first = ok.length ? Math.min.apply(null, ok.map(x => x.f)) : now;
    const last = Math.max.apply(null, [now].concat(ok.map(x => x.l || 0)));
    this.trial = { first, last, rollback: ok.length > 0 && now < last - 6 * HOUR };
    this.saveTrial(store);
  }
  saveTrial(store) {
    const t = this.trial, v = this.seal({ f: t.first, l: Math.max(t.last, Date.now()) });
    try { fs.mkdirSync(this.dir, { recursive: true }); fs.writeFileSync(this.trialFile, v); } catch (e) { /* ignore */ }
    regSet('State', v);
    if (store) try { store.kv('pt_state', v); } catch (e) { /* ignore */ }
  }

  status() {
    const key = this.saved();
    if (key) {
      const r = this.check(key);
      if (r.ok) return { state: 'licensed', device: this.device, expires: r.expires, key: key };
      var keyError = r.reason;
    }
    const t = this.trial || { first: Date.now(), last: Date.now(), rollback: false };
    if (Date.now() > t.last) t.last = Date.now();
    const end = t.first + TRIAL_DAYS * DAY, left = t.rollback ? 0 : Math.max(0, Math.ceil((end - Date.now()) / DAY));
    return { state: left > 0 ? 'trial' : 'expired', device: this.device, daysLeft: left, trialEnds: end, rollback: !!t.rollback, keyError: keyError || null };
  }
  allowed() { const s = this.status().state; return s === 'licensed' || s === 'trial'; }

  /* ---- publisher tool: issue keys with the private key file ---- */
  loadIssuer(pem) {
    const k = crypto.createPrivateKey(pem);
    const pub = crypto.createPublicKey(k).export({ format: 'der', type: 'spki' }).toString('base64');
    if (pub !== PUBLIC_KEY) throw new Error('mismatch');
    this.issuer = k;
    return true;
  }
  issue(device, expiresIso) {
    if (!this.issuer) throw new Error('no issuer');
    const db = deviceBytes(device); if (!db || db.length !== 10) throw new Error('device');
    let exp = 0;
    if (expiresIso) { const t = Date.parse(String(expiresIso).slice(0, 10) + 'T00:00:00Z'); if (!isNaN(t)) exp = Math.max(1, Math.min(65535, Math.round((t - EPOCH) / DAY))); }
    const payload = Buffer.from([1, exp >> 8, exp & 255]);
    const sig = crypto.sign(null, License.message(group(clean(device), 4), payload), this.issuer);
    return group(b32enc(Buffer.concat([payload, sig])), 6);
  }
}

module.exports = { License, TRIAL_DAYS };
