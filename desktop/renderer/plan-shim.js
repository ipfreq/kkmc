// Runs inside the work-plan page on the desktop: saves every edit to the database
// and adds a way back to the projects list.
// Copyright (c) 2026 Yasser Mohamed Abdelgaber. All rights reserved.
(function () {
  'use strict';
  var api = window.DESKTOP, id = new URLSearchParams(location.search).get('p');
  var KEY = 'kkmc-remaining-plan-draft-v1', timer = null, pending = null, chip = null;
  // The database is the source of truth: drop any copy the browser kept from another project.
  try { localStorage.removeItem(KEY); } catch (e) { /* storage unavailable */ }
  if (!api || !id) return;

  function show(state) {
    if (!chip) return;
    var t = { pending: ['جارٍ الحفظ…', 'warn'], ok: ['محفوظ في قاعدة البيانات', 'ok'], err: ['تعذّر الحفظ', 'bad'] }[state];
    chip.textContent = t[0]; chip.className = 'dp-chip ' + t[1];
  }
  function flush() {
    clearTimeout(timer); timer = null;
    if (pending == null) return Promise.resolve();
    var root; try { root = JSON.parse(pending).state; } catch (e) { pending = null; return Promise.resolve(); }
    pending = null;
    return api.planSave(id, root).then(function () { if (!timer) show('ok'); }, function () { show('err'); });
  }
  var setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    setItem.call(this, k, v);
    if (this === window.localStorage && k === KEY) { pending = v; clearTimeout(timer); timer = setTimeout(flush, 250); show('pending'); }
  };
  window.addEventListener('beforeunload', function () { if (timer) flush(); });

  document.addEventListener('DOMContentLoaded', function () {
    var css = document.createElement('style');
    css.textContent = '#btn-save,#save-chip{display:none!important}' +
      '.dp-bar{position:fixed;inset-inline-start:16px;bottom:16px;z-index:40;display:flex;gap:8px;align-items:center;background:var(--surface,#fff);border:1px solid var(--line,#D4DDE1);border-radius:10px;padding:6px 8px;box-shadow:0 6px 18px rgba(0,0,0,.12);font:13px "IBM Plex Sans Arabic",Tahoma,sans-serif;direction:rtl}' +
      '.dp-bar button{border:1px solid var(--line,#D4DDE1);background:var(--surface,#fff);color:inherit;border-radius:6px;padding:5px 12px;cursor:pointer;font:inherit}' +
      '.dp-bar button:hover{border-color:var(--accent,#0A6C88);color:var(--accent,#0A6C88)}' +
      '.dp-chip{font-size:12px;padding:3px 10px;border-radius:999px;white-space:nowrap}' +
      '.dp-chip.ok{background:var(--ok-soft,#E0F0E6);color:var(--ok,#2C7A4D)}.dp-chip.warn{background:var(--warn-soft,#F9EDD6);color:var(--warn,#A86E12)}.dp-chip.bad{background:var(--bad-soft,#FAE2DD);color:var(--bad,#BF3F2B)}';
    document.head.appendChild(css);
    var bar = document.createElement('div');
    bar.className = 'dp-bar';
    bar.innerHTML = '<button type="button">→ كل المشاريع</button><span class="dp-chip ok">محفوظ في قاعدة البيانات</span>';
    chip = bar.querySelector('.dp-chip');
    bar.querySelector('button').addEventListener('click', function () { flush().then(function () { api.home(); }); });
    document.body.appendChild(bar);
  });
})();
