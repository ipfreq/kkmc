// License page: device code, activation with a serial key, and the publisher's key-issuing tool.
// Copyright (c) 2026 Yasser Mohamed Abdelgaber. All rights reserved.
(function () {
  'use strict';
  var api = window.DESKTOP, $ = function (s) { return document.getElementById(s); };
  var day = function (t) { var d = new Date(t); return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(); };
  var days = function (n) { return n === 1 ? 'يوم واحد' : n === 2 ? 'يومان' : n + ' أيام'; };
  function toast(m) { var t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(function () { t.hidden = true; }, 3000); }
  $('yr').textContent = Math.max(2026, new Date().getFullYear());
  api.info().then(function (i) { $('ver').textContent = '· الإصدار ' + i.version; });
  var REASON = { format: 'رقم الترخيص غير مكتمل أو به خطأ في الكتابة. انسخه كما هو.', device: 'رقم الترخيص لا يخص هذا الجهاز أو غير صحيح.', expired: 'رقم الترخيص منتهي الصلاحية.' };
  function show(l) {
    var h = $('head'), a = $('head-acts');
    $('dev').textContent = l.device;
    if (l.state === 'licensed') {
      h.className = 'lic-head ok'; h.innerHTML = '<h2>البرنامج مفعّل على هذا الجهاز</h2><p>' + (l.expires ? 'الترخيص سارٍ حتى ' + day(l.expires) + '.' : 'ترخيص دائم.') + '</p>';
      a.innerHTML = '<button class="btn primary" id="go">العودة للبرنامج</button>';
    } else if (l.state === 'trial') {
      h.className = 'lic-head'; h.innerHTML = '<h2>نسخة تجريبية – متبقٍ ' + days(l.daysLeft) + '</h2><p>تنتهي الفترة التجريبية في ' + day(l.trialEnds) + '. فعّل البرنامج برقم ترخيص لهذا الجهاز للاستمرار بعدها.</p>';
      a.innerHTML = '<button class="btn" id="go">متابعة النسخة التجريبية</button>';
    } else {
      h.className = 'lic-head bad';
      h.innerHTML = '<h2>' + (l.rollback ? 'تم اكتشاف تغيير في تاريخ الجهاز' : l.keyError === 'expired' ? 'انتهت صلاحية ترخيص البرنامج' : 'انتهت الفترة التجريبية') + '</h2><p>' +
        (l.rollback ? 'تاريخ الجهاز أقدم من آخر استخدام للبرنامج. صحّح تاريخ ووقت الجهاز أو فعّل البرنامج برقم ترخيص.' : 'لاستخدام البرنامج أرسل رقم هذا الجهاز للمطور وأدخل رقم الترخيص الذي يصلك.') + '</p>';
      a.innerHTML = '';
    }
    var g = document.getElementById('go'); if (g) g.onclick = function () { api.licenseHome(); };
  }
  function refresh() { return api.license().then(show); }
  $('copy-dev').onclick = function () { api.copy($('dev').textContent).then(function () { toast('تم نسخ رقم الجهاز'); }); };
  $('activate').onclick = function () {
    var k = $('key').value.trim(), m = $('msg');
    if (!k) { m.className = 'msg bad'; m.textContent = 'الصق رقم الترخيص أولاً.'; return; }
    api.activate(k).then(function (r) {
      if (r && r.ok) { m.className = 'msg ok'; m.textContent = 'تم تفعيل البرنامج بنجاح' + (r.expires ? ' حتى ' + day(r.expires) : ' (ترخيص دائم)') + '.'; refresh(); setTimeout(function () { api.licenseHome(); }, 1400); }
      else { m.className = 'msg bad'; m.textContent = REASON[r && r.reason] || 'تعذّر التفعيل.'; }
    });
  };
  $('export').onclick = function () { api.exportDb().then(function (f) { if (f) toast('تم نسخ قاعدة البيانات'); }); };
  $('folder').onclick = function () { api.openData(); };
  $('pick').onclick = function () {
    api.issuerKey().then(function (ok) {
      if (ok === null) return;
      $('pick-msg').className = 'msg ' + (ok ? 'ok' : 'bad'); $('pick-msg').textContent = ok ? 'تم تحميل المفتاح الخاص.' : 'هذا الملف ليس مفتاح إصدار التراخيص الخاص بهذا البرنامج.';
      $('i-go').disabled = !ok;
    });
  };
  $('i-this').onclick = function () { $('i-dev').value = $('dev').textContent; };
  $('i-go').onclick = function () {
    api.issue($('i-dev').value, $('i-exp').value).then(function (k) { $('i-out').value = k; $('i-copy').disabled = false; })
      .catch(function () { toast('رقم الجهاز غير صحيح'); });
  };
  $('i-copy').onclick = function () { api.copy($('i-out').value).then(function () { toast('تم نسخ رقم الترخيص'); }); };
  document.addEventListener('keydown', function (e) { if (e.ctrlKey && e.shiftKey && (e.key === 'K' || e.key === 'k')) $('issuer').open = true; });
  refresh();
})();
