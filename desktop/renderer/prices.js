// Price list: every purchase recorded in any project, searchable in Arabic and English, with item history and printable invoices.
// Copyright (c) 2026 Yasser Mohamed Abdelgaber. All rights reserved.
(function () {
  'use strict';
  var api = window.DESKTOP;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var DAY = 864e5, DOWS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  var num = function (v) { var n = parseFloat(String(v == null ? '' : v).replace(/[٠-٩]/g, function (c) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(c); }).replace(/[,،\s]/g, '')); return isNaN(n) ? 0 : n; };
  var money = function (n) { return (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var qn = function (n) { return (Math.round(n * 1000) / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 }); };
  var pad = function (x) { return (x < 10 ? '0' : '') + x; };
  var dn = function (s) { return s ? Math.round(Date.parse(String(s).slice(0, 10) + 'T00:00:00Z') / DAY) : NaN; };
  var fs = function (s) { var n = dn(s); if (isNaN(n)) return '—'; var d = new Date(n * DAY); return pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear(); };
  var dayOf = function (s) { var n = dn(s); return isNaN(n) ? '' : DOWS[new Date(n * DAY).getUTCDay()]; };
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(function () { t.hidden = true; }, 3500); }
  /* Arabic-aware search: drop diacritics and tatweel, unify alef/yaa/taa marbuta forms, digits and case */
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/[٠-٩]/g, function (c) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(c); }).replace(/[^\w؀-ۿ.\/"-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  var rows = [], F = { q: '', proj: '', cat: '', from: '', to: '', sort: 'new' }, sel = {}, cfg = null, open = false;
  var DEF = { title: 'فاتورة', company: 'شركة اللامع لخدمات الأعمال (Shining Business Services)', address: '', phone: '', vatNo: '', crNo: '', logo: '', color: '#0A6C88', footer: '', to: '', notes: '',
    show: { en: true, unit: true, cat: false, project: true, pdate: true, vendor: true, ref: true, qty: true, price: true, vat: true, sign: true } };

  function line(r) {
    var d = r.d, q = num(d.qty), p = num(d.price), net = q && p ? Math.round(q * p * 100) / 100 : num(d.amount), vr = num(d.vat), vat = Math.round(net * vr) / 100;
    return { key: r.project + '/' + r.id, r: r, d: d, date: d.date || '', desc: String(d.desc || '').trim() || '—', en: String(d.en || '').trim(), unit: String(d.unit || '').trim(), cat: d.cat || '',
      qty: q, unitPrice: p || (q ? net / q : net), net: net, vr: vr, vat: vat, total: Math.round((net + vat) * 100) / 100, vendor: d.vendor || '', ref: d.ref || '', cur: r.currency || 'ريال',
      hay: norm([d.desc, d.en, d.cat, d.vendor, d.ref, d.unit, r.pname, r.pshort, r.po].join(' ')), item: norm(d.desc), iten: norm(d.en) };
  }
  function load() {
    return Promise.all([api.purchases(), api.kv('invoice_cfg')]).then(function (x) {
      rows = (x[0] || []).map(line);
      try { cfg = Object.assign({}, DEF, JSON.parse(x[1] || '{}')); cfg.show = Object.assign({}, DEF.show, cfg.show || {}); } catch (e) { cfg = JSON.parse(JSON.stringify(DEF)); }
    });
  }
  function saveCfg() { return api.kv('invoice_cfg', JSON.stringify(cfg)); }
  function filtered() {
    var toks = norm(F.q).split(' ').filter(Boolean), a = F.from ? dn(F.from) : -Infinity, b = F.to ? dn(F.to) : Infinity;
    var out = rows.filter(function (x) {
      if (F.proj && x.r.project !== F.proj) return false;
      if (F.cat && x.cat !== F.cat) return false;
      var d = dn(x.date); if ((a > -Infinity || b < Infinity) && (isNaN(d) || d < a || d > b)) return false;
      return toks.every(function (t) { return x.hay.indexOf(t) >= 0; });
    });
    var by = { new: function (x, y) { return (dn(y.date) || 0) - (dn(x.date) || 0); }, old: function (x, y) { return (dn(x.date) || 0) - (dn(y.date) || 0); },
      hi: function (x, y) { return y.unitPrice - x.unitPrice; }, lo: function (x, y) { return x.unitPrice - y.unitPrice; }, name: function (x, y) { return x.desc.localeCompare(y.desc, 'ar'); } };
    return out.sort(by[F.sort] || by.new);
  }
  function stats(list) {
    var ps = list.map(function (x) { return x.unitPrice; }).filter(function (v) { return v > 0; });
    var last = list.slice().sort(function (x, y) { return (dn(y.date) || 0) - (dn(x.date) || 0); })[0];
    return { n: list.length, spend: list.reduce(function (s, x) { return s + x.total; }, 0), min: ps.length ? Math.min.apply(null, ps) : 0, max: ps.length ? Math.max.apply(null, ps) : 0,
      avg: ps.length ? ps.reduce(function (s, v) { return s + v; }, 0) / ps.length : 0, last: last };
  }

  /* ---------- view ---------- */
  function show(on) {
    open = on;
    $('#app .bar').hidden = on; $('#grid').hidden = on; $('#prices').hidden = !on;
    $$('[data-pl=open]').forEach(function (b) { b.setAttribute('aria-pressed', String(on)); });
    if (on) load().then(render).catch(function () { toast('تعذّر قراءة المشتريات'); });
  }
  function render() {
    var list = filtered(), st = stats(list), cur = (list[0] || rows[0] || {}).cur || 'ريال', nSel = Object.keys(sel).length;
    var projs = {}, cats = {};
    rows.forEach(function (x) { projs[x.r.project] = x.r.pname + (x.r.archived ? ' (مؤرشف)' : ''); if (x.cat) cats[x.cat] = 1; });
    var tr = list.map(function (x) {
      return '<tr data-row="' + esc(x.key) + '" class="' + (sel[x.key] ? 'on' : '') + '"><td class="c"><input type="checkbox" data-sel="' + esc(x.key) + '"' + (sel[x.key] ? ' checked' : '') + ' aria-label="تحديد"></td>' +
        '<td class="nw">' + fs(x.date) + '<small>' + dayOf(x.date) + '</small></td><td class="it"><b>' + esc(x.desc) + '</b>' + (x.en ? '<small dir="ltr">' + esc(x.en) + '</small>' : '') + '</td><td>' + esc(x.cat) + '</td>' +
        '<td class="n">' + (x.qty ? qn(x.qty) : '—') + (x.unit ? ' <small>' + esc(x.unit) + '</small>' : '') + '</td><td class="n"><b>' + money(x.unitPrice) + '</b></td><td class="n">' + money(x.net) + '</td><td class="n">' + (x.vat ? money(x.vat) + ' <small>(' + x.vr + '%)</small>' : '–') + '</td><td class="n"><b>' + money(x.total) + '</b></td>' +
        '<td>' + esc(x.vendor) + '</td><td class="nw">' + esc(x.ref) + '</td><td class="pj">' + esc(x.r.pshort || x.r.pname) + '</td></tr>';
    }).join('');
    $('#prices').innerHTML =
      '<div class="pl-bar"><input id="pl-q" class="in grow" type="search" placeholder="ابحث باسم الصنف بالعربي أو الإنجليزي، المورد، رقم الفاتورة، المشروع…" value="' + esc(F.q) + '" autofocus>' +
      '<select class="in sm" data-f="proj"><option value="">كل المشاريع</option>' + Object.keys(projs).map(function (k) { return '<option value="' + esc(k) + '"' + (F.proj === k ? ' selected' : '') + '>' + esc(projs[k]) + '</option>'; }).join('') + '</select>' +
      '<select class="in sm" data-f="cat"><option value="">كل التصنيفات</option>' + Object.keys(cats).sort().map(function (k) { return '<option' + (F.cat === k ? ' selected' : '') + '>' + esc(k) + '</option>'; }).join('') + '</select>' +
      '<label class="lf">من <input class="in sm" type="date" data-f="from" value="' + esc(F.from) + '"></label><label class="lf">إلى <input class="in sm" type="date" data-f="to" value="' + esc(F.to) + '"></label>' +
      '<select class="in sm" data-f="sort">' + [['new', 'الأحدث أولاً'], ['old', 'الأقدم أولاً'], ['hi', 'السعر الأعلى'], ['lo', 'السعر الأقل'], ['name', 'اسم الصنف']].map(function (o) { return '<option value="' + o[0] + '"' + (F.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
      '<button class="btn sm" data-pl="clear">مسح</button></div>' +
      '<div class="pl-stats"><div><span>عدد مرات الشراء</span><b>' + st.n + '</b></div><div><span>إجمالي المشتريات</span><b>' + money(st.spend) + ' <small>' + esc(cur) + '</small></b></div>' +
      '<div><span>أقل سعر وحدة</span><b>' + money(st.min) + '</b></div><div><span>متوسط سعر الوحدة</span><b>' + money(st.avg) + '</b></div><div><span>أعلى سعر وحدة</span><b>' + money(st.max) + '</b></div>' +
      '<div><span>آخر شراء</span><b>' + (st.last ? money(st.last.unitPrice) : '—') + '</b><small>' + (st.last ? fs(st.last.date) + ' · ' + esc(st.last.r.pshort || st.last.r.pname) : '') + '</small></div></div>' +
      '<div class="pl-acts"><span class="muted2">' + (rows.length ? 'اضغط على أي سطر لعرض تفاصيل الشراء وسجل أسعار الصنف. حدد سطراً أو أكثر لطباعة فاتورة.' : '') + '</span><span class="grow"></span>' +
      '<button class="btn sm" data-pl="all">' + (list.length && list.every(function (x) { return sel[x.key]; }) ? 'إلغاء تحديد الكل' : 'تحديد كل النتائج') + '</button>' +
      '<button class="btn sm primary" data-pl="inv"' + (nSel ? '' : ' disabled') + '>فاتورة للمحدد' + (nSel ? ' (' + nSel + ')' : '') + '</button><button class="btn sm" data-pl="cfg">إعدادات الفاتورة</button><button class="btn sm" data-pl="csv">تصدير Excel (CSV)</button></div>' +
      (list.length ? '<div class="tw"><table class="pt"><thead><tr><th></th><th>التاريخ</th><th>الصنف</th><th>التصنيف</th><th class="n">الكمية</th><th class="n">سعر الوحدة</th><th class="n">قبل الضريبة</th><th class="n">الضريبة</th><th class="n">الإجمالي</th><th>المورد</th><th>الفاتورة</th><th>المشروع</th></tr></thead><tbody>' + tr + '</tbody></table></div>' :
        '<div class="empty"><h2>' + (rows.length ? 'لا توجد نتائج مطابقة' : 'لا توجد مشتريات مسجلة بعد') + '</h2><p>' + (rows.length ? 'جرّب كلمة أخرى أو امسح الفلاتر.' : 'كل مصروف أو طلب شراء تسجله في تبويب «المصاريف» داخل أي مشروع يظهر هنا تلقائياً.') + '</p></div>');
  }
  var qT;
  document.addEventListener('input', function (e) {
    if (!open) return;
    if (e.target.id === 'pl-q') { F.q = e.target.value; clearTimeout(qT); qT = setTimeout(function () { var p = e.target.selectionStart; render(); var i = $('#pl-q'); i.focus(); try { i.setSelectionRange(p, p); } catch (er) {} }, 180); }
  });
  document.addEventListener('change', function (e) {
    if (!open) return;
    var f = e.target.getAttribute && e.target.getAttribute('data-f');
    if (f && e.target.closest('#prices')) { F[f] = e.target.value; render(); return; }
    var k = e.target.getAttribute && e.target.getAttribute('data-sel');
    if (k) { if (e.target.checked) sel[k] = 1; else delete sel[k]; render(); }
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pl]');
    if (b) {
      var a = b.getAttribute('data-pl');
      if (a === 'open') show(!open);
      else if (a === 'close') show(false);
      else if (a === 'clear') { F = { q: '', proj: '', cat: '', from: '', to: '', sort: F.sort }; render(); }
      else if (a === 'all') { var l = filtered(), allOn = l.length && l.every(function (x) { return sel[x.key]; }); l.forEach(function (x) { if (allOn) delete sel[x.key]; else sel[x.key] = 1; }); render(); }
      else if (a === 'inv') invoice(rows.filter(function (x) { return sel[x.key]; }));
      else if (a === 'cfg') settings();
      else if (a === 'csv') csv(filtered());
      return;
    }
    var tr = e.target.closest('#prices tr[data-row]');
    if (tr && !e.target.closest('input')) { var x = rows.filter(function (r) { return r.key === tr.getAttribute('data-row'); })[0]; if (x) details(x); }
  });

  /* ---------- item details and price history ---------- */
  function sameItem(x) { return rows.filter(function (y) { return (x.item && y.item === x.item) || (x.iten && y.iten === x.iten); }).sort(function (p, q) { return (dn(q.date) || 0) - (dn(p.date) || 0); }); }
  function details(x) {
    var h = sameItem(x), st = stats(h), d = $('#pl-dlg');
    var f = [['التاريخ', fs(x.date) + ' (' + dayOf(x.date) + ')'], ['المشروع', x.r.pname], ['رقم أمر الشراء / العقد', x.r.po], ['التصنيف', x.cat], ['الصنف', x.desc], ['الاسم بالإنجليزي', x.en],
      ['الكمية', x.qty ? qn(x.qty) + (x.unit ? ' ' + x.unit : '') : '—'], ['سعر الوحدة', money(x.unitPrice) + ' ' + x.cur], ['المبلغ قبل الضريبة', money(x.net) + ' ' + x.cur], ['الضريبة', x.vr + '% = ' + money(x.vat) + ' ' + x.cur],
      ['الإجمالي شامل الضريبة', money(x.total) + ' ' + x.cur], ['المورد / الجهة', x.vendor], ['رقم الفاتورة', x.ref]];
    d.innerHTML = '<form method="dialog"><div class="dlg-h"><h2>' + esc(x.desc) + (x.en ? ' <small dir="ltr">' + esc(x.en) + '</small>' : '') + '</h2><button type="button" class="btn sm ghost" data-close aria-label="إغلاق">✕</button></div>' +
      '<dl class="kv">' + f.map(function (p) { return '<div><dt>' + p[0] + '</dt><dd>' + esc(p[1] || '—') + '</dd></div>'; }).join('') + '</dl>' +
      '<h3>سجل شراء هذا الصنف (' + h.length + ' مرة)</h3><div class="pl-stats sm"><div><span>أقل سعر</span><b>' + money(st.min) + '</b></div><div><span>المتوسط</span><b>' + money(st.avg) + '</b></div><div><span>أعلى سعر</span><b>' + money(st.max) + '</b></div><div><span>إجمالي الكمية</span><b>' + qn(h.reduce(function (s, y) { return s + y.qty; }, 0)) + '</b></div></div>' +
      '<div class="tw"><table class="pt"><thead><tr><th>التاريخ</th><th>المشروع</th><th class="n">الكمية</th><th class="n">سعر الوحدة</th><th class="n">الإجمالي</th><th>المورد</th><th>الفاتورة</th></tr></thead><tbody>' +
      h.map(function (y) { return '<tr class="' + (y.key === x.key ? 'on' : '') + '"><td class="nw">' + fs(y.date) + '</td><td class="pj">' + esc(y.r.pshort || y.r.pname) + '</td><td class="n">' + qn(y.qty) + '</td><td class="n"><b>' + money(y.unitPrice) + '</b></td><td class="n">' + money(y.total) + '</td><td>' + esc(y.vendor) + '</td><td>' + esc(y.ref) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="dlg-f"><button type="button" class="btn" data-go="' + esc(x.r.project) + '">فتح المشروع</button><span class="grow"></span><button type="button" class="btn" data-inv="hist">فاتورة بكل مرات الشراء</button><button type="button" class="btn primary" data-inv="one">فاتورة لهذا الشراء</button></div></form>';
    d.querySelector('[data-close]').onclick = function () { d.close(); };
    d.querySelector('[data-go]').onclick = function () { location.href = 'valves.html?p=' + encodeURIComponent(x.r.project); };
    d.querySelector('[data-inv=one]').onclick = function () { d.close(); invoice([x]); };
    d.querySelector('[data-inv=hist]').onclick = function () { d.close(); invoice(h.slice().reverse()); };
    d.showModal();
  }

  /* ---------- invoice ---------- */
  var SHOW = [['en', 'الاسم بالإنجليزي'], ['unit', 'الوحدة'], ['qty', 'الكمية'], ['price', 'الأسعار والمبالغ'], ['vat', 'الضريبة'], ['vendor', 'المورد'], ['ref', 'رقم فاتورة المورد'], ['pdate', 'تاريخ الشراء'], ['project', 'المشروع'], ['cat', 'التصنيف'], ['sign', 'التوقيعات']];
  function nowLocal() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function invHtml(items, o) {
    var S = cfg.show, cur = (items[0] || {}).cur || 'ريال', c = cfg.color || '#0A6C88', dt = new Date(o.at || Date.now());
    var cols = [['#', function (x, i) { return i + 1; }], ['الصنف', function (x) { return '<b>' + esc(x.desc) + '</b>' + (S.en && x.en ? '<small dir="ltr">' + esc(x.en) + '</small>' : ''); }, 'it']];
    if (S.cat) cols.push(['التصنيف', function (x) { return esc(x.cat); }]);
    if (S.project) cols.push(['المشروع', function (x) { return esc(x.r.pshort || x.r.pname); }, 'it']);
    if (S.pdate) cols.push(['تاريخ الشراء', function (x) { return fs(x.date); }]);
    if (S.vendor) cols.push(['المورد', function (x) { return esc(x.vendor); }, 'it']);
    if (S.ref) cols.push(['فاتورة المورد', function (x) { return esc(x.ref); }]);
    if (S.unit) cols.push(['الوحدة', function (x) { return esc(x.unit || '—'); }]);
    if (S.qty) cols.push(['الكمية', function (x) { return x.qty ? qn(x.qty) : '—'; }]);
    if (S.price) { cols.push(['سعر الوحدة', function (x) { return money(x.unitPrice); }]); cols.push(['المبلغ', function (x) { return money(x.net); }]); }
    if (S.price && S.vat) { cols.push(['الضريبة', function (x) { return x.vat ? money(x.vat) + '<small>' + x.vr + '%</small>' : '–'; }]); cols.push(['الإجمالي', function (x) { return '<b>' + money(x.total) + '</b>'; }]); }
    var net = items.reduce(function (s, x) { return s + x.net; }, 0), vat = items.reduce(function (s, x) { return s + x.vat; }, 0);
    var vendors = items.map(function (x) { return x.vendor; }).filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; });
    var co = [cfg.address, cfg.phone ? 'هاتف: ' + cfg.phone : '', cfg.vatNo ? 'الرقم الضريبي: ' + cfg.vatNo : '', cfg.crNo ? 'السجل التجاري: ' + cfg.crNo : ''].filter(Boolean);
    return '<div class="inv" style="--ic:' + esc(c) + '">' +
      '<header class="inv-h">' + (cfg.logo ? '<img src="' + cfg.logo + '" alt="">' : '') + '<div class="co"><b>' + esc(cfg.company) + '</b>' + co.map(function (s) { return '<span>' + esc(s) + '</span>'; }).join('') + '</div>' +
      '<div class="ti"><h1>' + esc(o.title || cfg.title || 'فاتورة') + '</h1><dl><div><dt>الرقم</dt><dd>' + esc(o.no) + '</dd></div><div><dt>التاريخ</dt><dd>' + pad(dt.getDate()) + '/' + pad(dt.getMonth() + 1) + '/' + dt.getFullYear() + ' – ' + DOWS[dt.getDay()] + '</dd></div><div><dt>الساعة</dt><dd>' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + '</dd></div></dl></div></header>' +
      ((o.to || (S.vendor && vendors.length === 1)) ? '<div class="inv-p">' + (o.to ? '<div><span>إلى</span><b>' + esc(o.to) + '</b></div>' : '') + (S.vendor && vendors.length === 1 ? '<div><span>المورد</span><b>' + esc(vendors[0]) + '</b></div>' : '') + '</div>' : '') +
      '<table class="inv-t"><thead><tr>' + cols.map(function (k) { return '<th>' + k[0] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      items.map(function (x, i) { return '<tr>' + cols.map(function (k) { return '<td class="' + (k[2] || '') + '">' + k[1](x, i) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>' +
      (S.price ? '<div class="inv-sum"><dl>' + (S.vat ? '<div><dt>الإجمالي قبل الضريبة</dt><dd>' + money(net) + ' ' + esc(cur) + '</dd></div><div><dt>ضريبة القيمة المضافة</dt><dd>' + money(vat) + ' ' + esc(cur) + '</dd></div><div class="g"><dt>الإجمالي شامل الضريبة</dt><dd>' + money(net + vat) + ' ' + esc(cur) + '</dd></div>' :
        '<div class="g"><dt>الإجمالي</dt><dd>' + money(net) + ' ' + esc(cur) + '</dd></div>') + '</dl></div>' : '') +
      (o.notes ? '<div class="inv-n"><b>ملاحظات</b><p>' + esc(o.notes) + '</p></div>' : '') +
      (S.sign ? '<div class="inv-s"><div><b>المستلم</b><span>الاسم: ....................</span><span>التوقيع: ....................</span></div><div><b>المحاسب</b><span>الاسم: ....................</span><span>التوقيع: ....................</span></div><div><b>الختم</b></div></div>' : '') +
      (cfg.footer ? '<footer class="inv-f">' + esc(cfg.footer) + '</footer>' : '') + '</div>';
  }
  function nextNo() { return api.kv('invoice_seq').then(function (v) { var n = (parseInt(v, 10) || 0) + 1; return 'INV-' + new Date().getFullYear() + '-' + String(n).padStart(4, '0'); }); }
  function bumpNo(no) { return api.kv('invoice_seq').then(function (v) { var n = (parseInt(v, 10) || 0) + 1; if (no === 'INV-' + new Date().getFullYear() + '-' + String(n).padStart(4, '0')) return api.kv('invoice_seq', String(n)); }); }
  function invoice(items) {
    if (!items.length) { toast('حدد سطراً واحداً على الأقل'); return; }
    nextNo().then(function (no) {
      var o = { no: no, at: Date.now(), title: cfg.title, to: cfg.to || '', notes: '' }, d = $('#inv-dlg');
      d.innerHTML = '<div class="inv-wrap"><aside class="inv-cfg"><div class="dlg-h"><h2>فاتورة (' + items.length + ' بند)</h2><button type="button" class="btn sm ghost" data-x aria-label="إغلاق">✕</button></div>' +
        '<label class="f">عنوان المستند<input class="in" data-o="title" value="' + esc(o.title) + '" list="inv-titles"></label><datalist id="inv-titles"><option value="فاتورة"><option value="فاتورة ضريبية"><option value="بيان أسعار"><option value="بيان مشتريات"><option value="أمر شراء"><option value="عرض سعر"></datalist>' +
        '<label class="f">رقم المستند<input class="in" data-o="no" value="' + esc(o.no) + '" dir="ltr"></label><label class="f">التاريخ والساعة<input class="in" type="datetime-local" data-o="at" value="' + nowLocal() + '"></label>' +
        '<label class="f">إلى (العميل / الجهة)<input class="in" data-o="to" value="' + esc(o.to) + '"></label><label class="f">ملاحظات<textarea class="in" data-o="notes" rows="2"></textarea></label>' +
        '<fieldset><legend>المعلومات الظاهرة</legend>' + SHOW.map(function (s) { return '<label class="ck"><input type="checkbox" data-s="' + s[0] + '"' + (cfg.show[s[0]] ? ' checked' : '') + '> ' + s[1] + '</label>'; }).join('') + '</fieldset>' +
        '<button type="button" class="btn sm" data-pl="cfg">بيانات الشركة واللوجو والألوان</button>' +
        '<div class="dlg-f"><button type="button" class="btn" data-print>طباعة</button><button type="button" class="btn primary" data-pdf>حفظ PDF</button></div></aside><div class="inv-pv" id="inv-pv"></div></div>';
      var pv = function () { $('#inv-pv').innerHTML = '<div class="inv-paper">' + invHtml(items, o) + '</div>'; };
      d.oninput = function (e) {
        var k = e.target.getAttribute('data-o'); if (k) { o[k] = k === 'at' ? (Date.parse(e.target.value) || Date.now()) : e.target.value; if (k === 'title' || k === 'to') { cfg[k] = e.target.value; saveCfg(); } pv(); }
      };
      d.onchange = function (e) { var s = e.target.getAttribute('data-s'); if (s) { cfg.show[s] = e.target.checked; saveCfg(); pv(); } };
      var out = function (pdf) {
        var root = $('#print-inv'); root.innerHTML = invHtml(items, o);
        var done = function () { root.innerHTML = ''; bumpNo(o.no); };
        if (pdf) api.printPdf(String((o.title || 'فاتورة') + ' ' + o.no).replace(/[\\/:*?"<>|\n]+/g, ' ').replace(/\s+/g, '-') + '.pdf').then(function (ok) { if (ok) toast('تم حفظ الفاتورة PDF'); done(); }).catch(function () { toast('تعذّر حفظ PDF'); done(); });
        else { window.addEventListener('afterprint', done, { once: true }); setTimeout(function () { window.print(); }, 80); }
      };
      d.querySelector('[data-x]').onclick = function () { d.close(); };
      d.querySelector('[data-print]').onclick = function () { out(false); };
      d.querySelector('[data-pdf]').onclick = function () { out(true); };
      d._refresh = pv; pv(); d.showModal();
    });
  }
  function shrink(src, w, cb) { var im = new Image(); im.onload = function () { var s = Math.min(1, w / im.width), c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); cb(c.toDataURL('image/png')); }; im.onerror = function () { cb(''); }; im.src = src; }
  function settings() {
    var d = $('#pl-dlg');
    var fld = function (k, l, extra) { return '<label class="f">' + l + '<input class="in" name="' + k + '" value="' + esc(cfg[k] || '') + '"' + (extra || '') + '></label>'; };
    d.innerHTML = '<form method="dialog"><div class="dlg-h"><h2>إعدادات الفاتورة</h2><button type="button" class="btn sm ghost" data-close aria-label="إغلاق">✕</button></div>' +
      '<div class="logo-box">' + (cfg.logo ? '<img src="' + cfg.logo + '" alt="">' : '<span class="muted2">بدون لوجو</span>') + '<div class="two"><label class="btn sm">اختيار لوجو<input type="file" accept="image/*" name="logof" hidden></label>' + (cfg.logo ? '<button type="button" class="btn sm danger" data-nologo>إزالة اللوجو</button>' : '') + '</div></div>' +
      fld('company', 'اسم الشركة') + fld('address', 'العنوان') + '<div class="two">' + fld('phone', 'الهاتف', ' dir="ltr"') + fld('vatNo', 'الرقم الضريبي', ' dir="ltr"') + '</div><div class="two">' + fld('crNo', 'السجل التجاري', ' dir="ltr"') + '<label class="f">لون الفاتورة<input class="in" type="color" name="color" value="' + esc(cfg.color || '#0A6C88') + '"></label></div>' +
      fld('title', 'العنوان الافتراضي للمستند') + fld('footer', 'نص أسفل الفاتورة (اختياري)') +
      '<div class="dlg-f"><button type="button" class="btn" data-close>إلغاء</button><button class="btn primary">حفظ</button></div></form>';
    var f = d.querySelector('form');
    d.querySelectorAll('[data-close]').forEach(function (b) { b.onclick = function () { d.close(); }; });
    f.elements.logof.onchange = function () { var file = f.elements.logof.files[0]; if (!file) return; var r = new FileReader(); r.onload = function () { shrink(r.result, 500, function (u) { if (!u) { toast('تعذّر قراءة الصورة'); return; } cfg.logo = u; saveCfg().then(function () { settings(); refreshInv(); }); }); }; r.readAsDataURL(file); };
    var nl = d.querySelector('[data-nologo]'); if (nl) nl.onclick = function () { cfg.logo = ''; saveCfg().then(function () { settings(); refreshInv(); }); };
    f.addEventListener('submit', function (e) {
      e.preventDefault(); ['company', 'address', 'phone', 'vatNo', 'crNo', 'color', 'title', 'footer'].forEach(function (k) { cfg[k] = f.elements[k].value.trim(); });
      saveCfg().then(function () { d.close(); toast('تم حفظ إعدادات الفاتورة'); refreshInv(); });
    });
    d.showModal();
  }
  function refreshInv() { var d = $('#inv-dlg'); if (d.open && d._refresh) d._refresh(); }
  function csv(list) {
    var q = function (v) { v = String(v == null ? '' : v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var out = [['التاريخ', 'اليوم', 'الصنف', 'الاسم بالإنجليزي', 'التصنيف', 'الكمية', 'الوحدة', 'سعر الوحدة', 'قبل الضريبة', 'الضريبة %', 'قيمة الضريبة', 'الإجمالي', 'العملة', 'المورد', 'رقم الفاتورة', 'المشروع']]
      .concat(list.map(function (x) { return [x.date, dayOf(x.date), x.desc, x.en, x.cat, x.qty, x.unit, x.unitPrice, x.net, x.vr, x.vat, x.total, x.cur, x.vendor, x.ref, x.r.pname]; }));
    var bytes = new TextEncoder().encode('﻿' + out.map(function (r) { return r.map(q).join(','); }).join('\r\n'));
    api.saveFile('قائمة-الأسعار-' + new Date().toISOString().slice(0, 10) + '.csv', bytes).then(function (ok) { if (ok) toast('تم حفظ الملف'); });
  }
})();
