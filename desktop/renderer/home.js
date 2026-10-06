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
      '<div class="empty"><h2>لا توجد مشاريع بعد</h2><p>ابدأ مشروعاً جديداً، أو استورد ملف مشروع (JSON) أو ملف Excel كامل.</p><div class="actions"><button class="btn primary" data-act="new">+ مشروع جديد</button><button class="btn" data-act="import">استيراد مشروع من ملف</button></div></div>' :
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
    dialog('<h2>مشروع جديد</h2><label class="f">اسم المشروع<input class="in" name="name" required placeholder="مثال: توريد وتركيب مضخات محطة حي بدر"></label>' +
      '<p class="meta" style="margin:0">يُنشأ المشروع بكل الأقسام: لوحة المتابعة، حصر الأعمال، الجدول الزمني، البنود المركبة، التوريدات، المصاريف، الإيقاف والمدد، خطة العمل، التقرير، بيانات المشروع.</p>' +
      '<div class="dlg-f"><button type="button" class="btn" data-close>إلغاء</button><button class="btn primary">إنشاء وفتح المشروع</button></div>',
    function (f) {
      var name = f.elements.name.value.trim();
      api.create(name, 'valves').then(function (id) { go(id, '&name=' + encodeURIComponent(name) + '&blank=1'); });
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
      api.restore().then(function (ok) { return ok ? api.kv('defaults_v2', '1').then(function () { return ok; }) : ok; }).then(function (ok) { if (ok) { toast('تم استرجاع النسخة الاحتياطية'); load(); } });
    });
    else if (a === 'folder') api.openData();
  });
  $('#q').addEventListener('input', render);

  api.info().then(function (i) { $('#dbinfo').textContent = i.dbPath; $('#ver').textContent = '· الإصدار ' + i.version; });

  /* Default content: the valves project and the lift-stations remaining-works project.
     Runs on first start, after a factory reset, and once when upgrading (archived and old plan projects are removed). */
  // Projects made automatically by version 1.4; removed on upgrade when never edited, so they are rebuilt with the current converter.
  var AUTO_NAMES = ['توسعة وتأهيل وإصلاح محطات الرفع للبنية التحتية – المشروع كامل', 'الأعمال المتبقية – محطات رفع حي بدر والتعاون و200 فيلا'];
  function projectDocs(st) {
    var meta = JSON.parse(JSON.stringify(st.meta)); delete meta.updated;
    var out = { 'project/meta': meta, 'project/report': st.report, 'project/settings': { expCats: st.expCats, v: 1 } };
    ['boq', 'groups', 'tasks', 'events', 'installs', 'supplies', 'expenses', 'sections', 'team', 'equip', 'rates', 'risks', 'conditions'].forEach(function (c) {
      (st[c] || []).forEach(function (r, i) { var b = JSON.parse(JSON.stringify(r)); b._o = i; out[c + '/' + r.id] = b; });
    });
    return out;
  }
  function addProject(st) {
    return api.create(st.meta.name, 'valves').then(function (id) {
      var docs = projectDocs(st);
      return Object.keys(docs).reduce(function (c, path) { return c.then(function () { return api.set(id, path, docs[path]); }); }, Promise.resolve());
    });
  }
  function setupDefaults() {
    return api.kv('defaults_v2').then(function (done) {
      if (done) return false;
      return api.cleanup(AUTO_NAMES).then(function () { return Promise.all([api.projects(), api.planTemplate()]); }).then(function (r) {
        var names = r[0].map(function (p) { return (p.summary && p.summary.name) || p.name || ''; }), add = [];
        var valves = DEFAULT_PROJECT();
        if (names.indexOf(valves.meta.name) < 0) add.push(valves);
        var rem = ((r[1] && r[1].projects) || []).filter(function (p) { return /الأعمال المتبقية/.test((p.meta || {}).project || ''); })[0];
        if (rem && !names.some(function (n) { return /الأعمال المتبقية/.test(n); })) add.push(planToValves(rem, DEFAULT_PROJECT()));
        return add.reduce(function (c, st) { return c.then(function () { return addProject(st); }); }, Promise.resolve())
          .then(function () { return api.kv('defaults_v2', '1'); }).then(function () { return true; });
      });
    }).catch(function () { return false; });
  }

  /* Database tools */
  function exportDb() { return api.exportDb().then(function (f) { if (f) toast('تم نسخ قاعدة البيانات إلى: ' + f); }); }
  function loadDb() {
    api.pickDb().then(function (r) {
      if (!r) return;
      if (r.error) { toast('الملف المختار ليس قاعدة بيانات للبرنامج'); return; }
      var list = r.projects.map(function (p) { return '<li>' + esc(p.name || 'مشروع') + '</li>'; }).join('') || '<li>لا توجد مشاريع</li>';
      var d = $('#dlg');
      d.innerHTML = '<form method="dialog"><h2>تحميل قاعدة بيانات</h2><p style="margin:0">الملف يحتوي على ' + r.projects.length + ' مشروع:</p><ul style="margin:0;max-height:180px;overflow:auto">' + list + '</ul>' +
        '<p class="meta" style="margin:0">«إضافة» يضيف هذه المشاريع بجانب مشاريعك الحالية. «استبدال» يجعل البرنامج مطابقاً للملف (تُحفظ نسخة احتياطية من الوضع الحالي أولاً).</p>' +
        '<div class="dlg-f"><button type="button" class="btn" data-close>إلغاء</button><button type="button" class="btn" data-mode="merge">إضافة للمشاريع الحالية</button><button type="button" class="btn danger" data-mode="replace">استبدال كل المشاريع</button></div></form>';
      d.querySelector('[data-close]').onclick = function () { d.close(); };
      d.querySelectorAll('[data-mode]').forEach(function (b) {
        b.onclick = function () {
          d.close();
          api.loadDb(r.file, b.getAttribute('data-mode')).then(function (n) { return (n === -1 ? api.kv('defaults_v2', '1') : Promise.resolve()).then(function () { return n; }); }).then(function (n) {
            toast(n === -1 ? 'تم تحميل قاعدة البيانات واستبدال المشاريع' : 'تمت إضافة ' + n + ' مشروع'); load();
          }).catch(function () { toast('تعذّر تحميل قاعدة البيانات'); });
        };
      });
      d.showModal();
    });
  }
  function resetApp() {
    var d = $('#dlg');
    d.innerHTML = '<form method="dialog"><h2>إعادة ضبط البرنامج</h2>' +
      '<p style="margin:0;line-height:1.8">سيتم حذف كل المشاريع وقاعدة البيانات وكل النسخ الاحتياطية المخزنة من النسخ السابقة، ويعود البرنامج كأول تثبيت بمشروعين فقط: مشروع المحابس، ومشروع الأعمال المتبقية في محطات الرفع.</p>' +
      '<p style="margin:0"><button type="button" class="btn sm" data-export>نسخ قاعدة البيانات أولاً</button></p>' +
      '<label class="f">للتأكيد اكتب كلمة: تصفير<input class="in" name="word" autocomplete="off"></label>' +
      '<div class="dlg-f"><button type="button" class="btn" data-close>إلغاء</button><button class="btn danger" disabled>إعادة ضبط البرنامج</button></div></form>';
    var f = d.querySelector('form'), ok = f.querySelector('.btn.danger');
    f.elements.word.addEventListener('input', function () { ok.disabled = f.elements.word.value.trim() !== 'تصفير'; });
    d.querySelector('[data-close]').onclick = function () { d.close(); };
    d.querySelector('[data-export]').onclick = function () { exportDb(); };
    f.addEventListener('submit', function (e) {
      e.preventDefault(); if (ok.disabled) return; d.close();
      api.wipeDb().then(setupDefaults).then(function () { toast('تمت إعادة ضبط البرنامج'); load(); });
    });
    d.showModal(); f.elements.word.focus();
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tool]'); if (!b) return;
    var t = b.getAttribute('data-tool');
    if (t === 'export') exportDb(); else if (t === 'load') loadDb(); else if (t === 'reset') resetApp();
  });

  setupDefaults().then(function (added) {
    if (added) toast('تم تجهيز المشاريع الافتراضية: مشروع المحابس، والأعمال المتبقية في محطات الرفع.');
    load();
  });
})();
