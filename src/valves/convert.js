/* Converts a work plan from the lift-stations planner (phases, tasks, BOQ, quantities, risks)
   into a project with the full valves-project structure. Pure function: (plan, defaults) -> project.
   Copyright (c) 2026 Yasser Mohamed Abdelgaber. All rights reserved. */
function planToValves(p, base) {
  var m = p.meta || {}, info = {};
  (m.info || []).forEach(function (x) { if (x && x.label) info[String(x.label).trim()] = x.value; });
  var pick = function () { for (var i = 0; i < arguments.length; i++) { var v = info[arguments[i]]; if (v != null && String(v).trim()) return String(v).trim(); } return ''; };
  var n = function (v) { var x = parseFloat(String(v == null ? '' : v).replace(/[٠-٩]/g, function (c) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(c); }).replace(/[,،\s]/g, '')); return isNaN(x) ? 0 : x; };
  var ok = function (id) { return /^[A-Za-z0-9_\-.~:@+]{1,100}$/.test(String(id || '')); };
  var DAY = 864e5, now = new Date();
  var todayIso = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10);
  var startIso = String(m.workStart || m.receiptDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startIso)) startIso = todayIso;
  var s0 = Date.parse(startIso + 'T00:00:00Z');
  var dayIso = function (d) { return new Date(s0 + (Math.max(1, d) - 1) * DAY).toISOString().slice(0, 10); };
  var st = JSON.parse(JSON.stringify(base)), labels = m.labels || {};

  var lastDay = 1;
  (p.tasks || []).forEach(function (t) { lastDay = Math.max(lastDay, n(t.start) + Math.max(0, n(t.dur)) - 1); });
  var cd = n(m.contractDays) || lastDay;
  st.meta = Object.assign(st.meta, {
    name: m.project || 'مشروع', short: String(m.project || 'مشروع').slice(0, 70),
    client: pick('الجهة المالكة', 'العميل', 'الجهة المستفيدة'),
    po: pick('رقم أمر الشراء', 'رقم العقد', 'رقم طلب عرض الأسعار', 'رقم الطلب'),
    location: pick('الموقع'), contractor: m.company || st.meta.contractor,
    preparer: m.preparer || '', engineer: pick('المهندس المشرف', 'الاستشاري'),
    start: startIso, end: dayIso(cd), value: '', vat: m.vat != null && m.vat !== '' ? n(m.vat) : 15,
    currency: m.currency || 'ريال', supplyPct: 0, weekend: [], kind: 'works', terms: {}, logo: '', updated: ''
  });

  // BOQ items keep their numbers, units, quantities and rates; executed quantities become one record each.
  var bmap = {};
  st.boq = (p.boq || []).map(function (b, i) {
    var id = ok(b.id) ? b.id : 'b' + (i + 1); bmap[b.no || String(i + 1)] = id;
    return { id: id, no: String(b.no || i + 1), dia: '', unit: b.unit || '', qty: n(b.qty), rate: b.rate === '' || b.rate == null ? '' : n(b.rate), desc: b.item || b.desc || '' };
  });
  // A plan without contract items (remaining works) takes its items from the per-station quantity table.
  if (!st.boq.length) {
    st.boq = (p.qty || []).map(function (q, i) {
      return { id: 'b' + (i + 1), no: String(i + 1), dia: '', unit: q.unit || '', qty: (q.q || []).reduce(function (s, v) { return s + n(v); }, 0), rate: '', desc: q.item || '' };
    });
    st.boq.forEach(function (b) { bmap[b.no] = b.id; });
  }
  st.installs = []; st.supplies = []; st.expenses = []; st.events = [];
  (p.boq || []).forEach(function (b, i) {
    if (n(b.done) > 0) st.installs.push({ id: 'i' + (i + 1), date: todayIso, boq: st.boq[i].id, qty: n(b.done), loc: '', serial: '', test: '', shut: '', team: '', notes: 'الكمية المنفذة المسجلة في الخطة السابقة' });
  });
  if (n(m.extDays) > 0) st.events.push({ id: 'vext', type: 'ext', ref: '', date: startIso, from: '', to: '', days: n(m.extDays), reason: 'أيام التمديد المعتمدة (منقولة من الخطة السابقة)', adds: true });

  // Phases become schedule groups; tasks keep durations and links (calendar days, no weekly holiday).
  var gmap = {};
  st.groups = (p.phases || []).map(function (ph, i) {
    var id = ok(ph.id) ? 'g' + ph.id : 'g' + (i + 1); gmap[ph.id] = id;
    return { id: id, name: ph.name || 'مرحلة ' + (i + 1), color: ph.color != null ? +ph.color : i % 8 };
  });
  if (!st.groups.length) st.groups = [{ id: 'g1', name: 'الأعمال', color: 0 }];
  var tmap = {}, seq = {};
  (p.tasks || []).forEach(function (t, i) { tmap[t.id] = ok(t.id) ? 't' + t.id : 't' + (i + 1); });
  st.tasks = (p.tasks || []).map(function (t) {
    var g = gmap[t.phase] || st.groups[0].id, gi = st.groups.map(function (x) { return x.id; }).indexOf(g) + 1;
    seq[g] = (seq[g] || 0) + 1;
    var station = t.station && t.station !== 'عام' ? ' – ' + t.station : '';
    var links = String(t.boq || '').split(/[،,\s]+/).filter(function (x) { return x && bmap[x]; });
    return {
      id: tmap[t.id], code: gi + '.' + seq[g], name: (t.name || 'مهمة') + station, group: g,
      dur: t.ms ? 0 : Math.max(1, n(t.dur)), ms: !!t.ms,
      preds: (t.preds || []).filter(function (x) { return tmap[x]; }).map(function (x) { return { id: tmap[x], type: 'FS', lag: 0 }; }),
      nb: dayIso(n(t.start) || 1), link: '', prog: Math.max(0, Math.min(100, n(t.progress))), as: '', af: '',
      notes: [t.owner ? 'المسؤول: ' + t.owner : '', links.length ? 'بنود العقد: ' + links.join('، ') : '', t.notes || ''].filter(Boolean).join(' – '),
      color: ''
    };
  });

  // Narrative sections, phase descriptions and the per-station quantity table.
  var secs = [
    [labels.scope || 'نطاق الأعمال', m.scope], [labels.method || 'أسلوب التنفيذ وتوزيع الفرق', m.method],
    [labels.hse || 'السلامة والجودة', m.hse], [labels.governance || 'آلية المتابعة والتقارير', m.governance]
  ];
  var phases = (p.phases || []).filter(function (ph) { return ph.desc; }).map(function (ph) { return '• ' + ph.name + ': ' + ph.desc; }).join('\n');
  if (phases) secs.splice(1, 0, [labels.phases || 'مراحل التنفيذ', phases]);
  var stations = p.stations || [];
  var qty = (p.qty || []).map(function (q) {
    var parts = (q.q || []).map(function (v, k) { return v !== '' && v != null ? (stations[k] || ('موقع ' + (k + 1))) + ': ' + v : ''; }).filter(Boolean);
    var total = (q.q || []).reduce(function (s, v) { return s + n(v); }, 0);
    return '• ' + q.item + (q.unit ? ' (' + q.unit + ')' : '') + ' – ' + parts.join('، ') + (parts.length > 1 ? ' – الإجمالي ' + total : '');
  }).join('\n');
  if (qty) secs.push([labels.qty || 'جدول الكميات', qty]);
  st.sections = secs.filter(function (x) { return String(x[1] || '').trim(); }).map(function (x, i) { return { id: 's' + (i + 1), title: x[0], body: String(x[1]).trim(), rep: true }; });

  st.risks = (p.risks || []).map(function (r, i) {
    return { id: 'k' + (i + 1), risk: r.risk || '', level: r.prob || 'متوسطة', desc: r.impact ? 'الأثر: ' + r.impact : '', mit: r.mitigation || '' };
  });
  st.team = []; st.equip = []; st.rates = []; st.conditions = [];
  if (m.docTitle) st.report.title = m.docTitle;
  return st;
}
