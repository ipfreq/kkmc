// Projects home: list, create, copy, archive, delete, import, backups.
// Copyright (c) 2026 Yasser Mohamed Abdelgaber. All rights reserved.
(function () {
  'use strict';
  var api = window.DESKTOP;
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var DAY = 864e5;
  var fd = new Intl.DateTimeFormat('ar-u-nu-latn-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  var fdt = new Intl.DateTimeFormat('ar-u-nu-latn-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  var qn = function (n) { return (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }); };
  var pct = function (x) { return Math.round(Math.max(0, x) * 1000) / 10; };
  var view = 'active', list = [];
  $('#yr').textContent = Math.max(2026, new Date().getFullYear());

  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(function () { t.hidden = true; }, 3500); }
  function go(id, extra) { location.href = 'valves.html?p=' + encodeURIComponent(id) + (extra || ''); }

  function status(s) {
    if (!s || s.empty) return '<span class="pill n">لم يُفتح بعد</span>';
    if (s.qty && s.inst >= s.qty) return '<span class="pill ok">مكتمل</span>';
    if (s.ongoingStop) return '<span class="pill bad">إيقاف سارٍ</span>';
    if (s.revEnd == null) return '';
    var today = Math.floor(Date.now() / DAY) * DAY, left = Math.round((s.revEnd - today) / DAY);
    return left >= 0 ? '<span class="pill ok">متبقٍ ' + left + ' يوماً</span>' : '<span class="pill warn">متجاوز ' + (-left) + ' يوماً</span>';
  }

  function planCard(p) {
    var s = p.summary || {};
    var body = s.empty ? '<p class="meta">افتح المشروع لإعداد خطته.</p>' :
      '<div class="prog"><div class="row"><span>نسبة الإنجاز حسب الجدول الزمني</span><b>' + pct(s.progress) + '%</b></div>' +
      '<div class="track"><i class="d" style="width:' + pct(s.progress) + '%"></i></div></div>' +
      '<dl class="facts"><div><dt>الخطط داخل المشروع</dt><dd>' + s.plans.length + '</dd></div><div><dt>المهام</dt><dd>' + s.tasks + '</dd></div><div><dt>النوع</dt><dd>خطة عمل وجدول زمني</dd></div></dl>' +
      '<div class="meta">' + s.plans.map(function (n) { return '<span>• ' + esc(n) + '</span>'; }).join('') + '</div>';
    return '<article class="card"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><h2>' + esc(p.name || s.name || 'خطة عمل') + '</h2><span class="pill n">خطة عمل</span></div>' +
      '<div class="meta">' + (s.client ? '<span>' + esc(s.client) + '</span>' : '') + '<span>آخر تعديل ' + fdt.format(new Date(p.updated)) + '</span></div>' + body + acts(p) + '</article>';
  }
  function acts(p) {
    return '<div class="acts"><button class="btn primary" data-act="open" data-id="' + p.id + '">فتح المشروع</button><span class="grow"></span>' +
      '<button class="btn sm ghost" data-act="dup" data-id="' + p.id + '">نسخة</button>' +
      '<button class="btn sm ghost" data-act="arch" data-id="' + p.id + '">' + (p.archived ? 'إلغاء الأرشفة' : 'أرشفة') + '</button>' +
      '<button class="btn sm ghost danger" data-act="del" data-id="' + p.id + '">حذف</button></div>';
  }

  function card(p) {
    if (p.type === 'plan') return planCard(p);
    var s = p.summary || {}, name = s.name || p.name || 'مشروع بدون اسم', q = s.qty || 0;
    var body = s.empty ? '<p class="meta">افتح المشروع لإعداد بياناته وبنوده.</p>' :
      '<div class="prog"><div class="row"><span>نسبة التركيب</span><b>' + pct(q ? s.inst / q : 0) + '%</b></div>' +
      '<div class="track" title="موَرَّد ' + qn(s.sup) + ' · مركب ' + qn(s.inst) + ' من ' + qn(q) + '"><i class="s" style="width:' + pct(q ? s.sup / q : 0) + '%"></i><i class="d" style="width:' + pct(q ? s.inst / q : 0) + '%"></i></div>' +
      '<div class="row"><span>مركب ' + qn(s.inst) + ' من ' + qn(q) + '</span><span>موَرَّد ' + qn(s.sup) + '</span></div></div>' +
      '<dl class="facts"><div><dt>المصاريف</dt><dd>' + qn(s.expenses || 0) + ' ' + esc(s.currency) + '</dd></div>' +
      '<div><dt>الانتهاء المعدّل</dt><dd>' + (s.revEnd != null ? fd.format(new Date(s.revEnd)) : '—') + '</dd></div>' +
      '<div><dt>السجلات</dt><dd>' + (s.counts.installs + s.counts.supplies + s.counts.expenses) + '</dd></div></dl>';
    return '<article class="card"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><h2>' + esc(name) + '</h2>' + status(s) + '</div>' +
      '<div class="meta">' + (s.client ? '<span>' + esc(s.client) + '</span>' : '') + (s.po ? '<span>أمر الشراء ' + esc(s.po) + '</span>' : '') + '<span>آخر تعديل ' + fdt.format(new Date(p.updated)) + '</span></div>' + body + acts(p) + '</article>';
  }

  function render() {
    var q = $('#q').value.trim();
    var act = list.filter(function (p) { return !p.archived; }), arch = list.filter(function (p) { return p.archived; });
    $('#n-active').textContent = act.length; $('#n-arch').textContent = arch.length;
    var shown = (view === 'active' ? act : arch).filter(function (p) {
      if (!q) return true; var s = p.summary || {}; return [p.name, s.name, s.client, s.po].concat(s.plans || []).join(' ').indexOf(q) >= 0;
    });
    document.querySelectorAll('[data-act=filter]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === view)); });
    $('#grid').innerHTML = shown.length ? shown.map(card).join('') : (view === 'active' && !q && !act.length ?
      '<div class="empty"><h2>لا توجد مشاريع بعد</h2><p>ابدأ مشروعاً جديداً من قالب مشروع المحابس، أو استورد ملف مشروع (JSON) أو ملف Excel كامل من النسخة السابقة.</p><div class="actions"><button class="btn primary" data-act="new">+ مشروع جديد</button><button class="btn" data-act="import">استيراد مشروع من ملف</button></div></div>' :
      '<div class="empty"><p>' + (q ? 'لا توجد مشاريع مطابقة للبحث.' : 'لا توجد مشاريع مؤرشفة.') + '</p></div>');
  }

  function load() { return api.projects().then(function (p) { list = p; render(); }); }

  function dialog(html, onOk) {
    var d = $('#dlg');
    d.innerHTML = '<form method="dialog">' + html + '</form>';
    var f = d.querySelector('form');
    f.addEventListener('submit', function (e) { e.preventDefault(); if (!f.checkValidity()) return; d.close(); onOk(f); });
    f.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { d.close(); }); });
    d.showModal();
    var first = f.querySelector('input[type=text],input:not([type])'); if (first) first.focus();
  }
  function confirmBox(msg, okTxt, onOk) {
    dialog('<h2>تأكيد</h2><p style="margin:0;line-height:1.8">' + esc(msg) + '</p><div class="dlg-f"><button type="button" class="btn" data-close>إلغاء</button><button class="btn danger">' + esc(okTxt) + '</button></div>', onOk);
  }

  function newProject() {
    dialog('<h2>مشروع جديد</h2><label class="f">اسم المشروع<input class="in" name="name" required value="مشروع توريد وتركيب محابس"></label>' +
      '<label class="opt"><input type="radio" name="tpl" value="kkmc" checked><div><b>قالب مشروع المحابس الكامل</b><span>البنود التسعة، الجدول الزمني المعتمد، خطة العمل، فريق العمل والمعدات، الشروط. تعدّل أي شيء بعدها.</span></div></label>' +
      '<label class="opt"><input type="radio" name="tpl" value="blank"><div><b>مشروع محابس فارغ</b><span>بدون بنود أو جدول زمني، تبدأ تضيفها بنفسك.</span></div></label>' +
      '<label class="opt"><input type="radio" name="tpl" value="plan"><div><b>خطة عمل وجدول زمني</b><span>نفس برنامج خطط محطات الرفع: مراحل ومهام وجدول Gantt وجدول كميات وتقرير PDF، ويمكن أن يضم أكثر من خطة.</span></div></label>' +
      '<div class="dlg-f"><button type="button" class="btn" data-close>إلغاء</button><button class="btn primary">إنشاء وفتح المشروع</button></div>',
    function (f) {
      var name = f.elements.name.value.trim(), tpl = f.elements.tpl.value;
      if (tpl === 'plan') { api.create(name, 'plan').then(function (id) { api.openPlan(id); }); return; }
      api.create(name, 'valves').then(function (id) { go(id, '&name=' + encodeURIComponent(name) + (tpl === 'blank' ? '&blank=1' : '')); });
    });
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var a = b.getAttribute('data-act'), id = b.getAttribute('data-id');
    var p = list.filter(function (x) { return x.id === id; })[0], nm = p ? ((p.summary && p.summary.name) || p.name) : '';
    if (a === 'new') newProject();
    else if (a === 'open') { if (p && p.type === 'plan') api.openPlan(id); else go(id); }
    else if (a === 'filter') { view = b.getAttribute('data-v'); render(); }
    else if (a === 'dup') api.duplicate(id).then(function () { toast('تم عمل نسخة من المشروع'); return load(); });
    else if (a === 'arch') api.archive(id, !p.archived).then(function () { toast(p.archived ? 'تمت إعادة المشروع للمشاريع الحالية' : 'تمت أرشفة المشروع'); return load(); });
    else if (a === 'del') confirmBox('حذف مشروع «' + nm + '» بكل سجلاته؟ تُحفظ نسخة احتياطية من قاعدة البيانات قبل الحذف.', 'حذف المشروع', function () {
      api.remove(id).then(function () { toast('تم حذف المشروع'); return load(); });
    });
    else if (a === 'import') api.importProject().then(function (nid) { if (nid) go(nid, '&import=1'); });
    else if (a === 'backup') api.backupNow().then(function (f) { toast('تم حفظ نسخة احتياطية: ' + f); });
    else if (a === 'restore') confirmBox('استرجاع نسخة احتياطية يستبدل كل المشاريع الحالية بمحتوى النسخة المختارة. تُحفظ نسخة من الوضع الحالي قبل الاسترجاع.', 'اختيار النسخة', function () {
      api.restore().then(function (ok) { if (ok) { toast('تم استرجاع النسخة الاحتياطية'); load(); } });
    });
    else if (a === 'folder') api.openData();
  });
  $('#q').addEventListener('input', render);

  api.info().then(function (i) { $('#dbinfo').textContent = i.dbPath; $('#ver').textContent = '· الإصدار ' + i.version; });
  load();
})();
