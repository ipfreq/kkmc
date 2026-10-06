(function(){
'use strict';
/* ================= utilities ================= */
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var DAY=864e5;
function dnum(iso){if(!iso)return NaN;return Math.round(Date.parse(String(iso).slice(0,10)+'T00:00:00Z')/DAY)}
function iso(n){return new Date(n*DAY).toISOString().slice(0,10)}
function todayNum(){var d=new Date();return Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/DAY}
function todayIso(){return iso(todayNum())}
var fLong=new Intl.DateTimeFormat('ar-u-nu-latn-ca-gregory',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
var fMon=new Intl.DateTimeFormat('ar-u-nu-latn-ca-gregory',{month:'long',year:'numeric',timeZone:'UTC'});
var fMonS=new Intl.DateTimeFormat('ar-u-nu-latn-ca-gregory',{month:'short',timeZone:'UTC'});
function fl(n){return isNaN(n)||n==null?'—':fLong.format(new Date(n*DAY))}
function fs(n){if(isNaN(n)||n==null)return '—';var d=new Date(n*DAY);return pad(d.getUTCDate())+'/'+pad(d.getUTCMonth()+1)+'/'+d.getUTCFullYear()}
function fsi(s){return s?fs(dnum(s)):'—'}
function pad(x){return (x<10?'0':'')+x}
function dow(n){return ((n%7)+7+4)%7}
function num(v){var s=String(v==null?'':v).replace(/[٠-٩]/g,function(c){return '٠١٢٣٤٥٦٧٨٩'.indexOf(c)}).replace(/[٫]/g,'.').replace(/[,،\s]/g,'');var n=parseFloat(s);return isNaN(n)?0:n}
function money(n){return (Math.round(n*100)/100).toLocaleString('en-US',{maximumFractionDigits:2})}
function qn(n){return (Math.round(n*100)/100).toLocaleString('en-US',{maximumFractionDigits:2})}
function pct(x){return Math.round(Math.max(0,x)*1000)/10}
function clamp(x,a,b){return Math.max(a,Math.min(b,x))}
function uid(p){return p+Math.random().toString(36).slice(2,9)}
function clone(o){return JSON.parse(JSON.stringify(o))}
function ls(fn){try{return fn()}catch(e){return null}}
function el(tag,cls,html){var e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e}
var DOWS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
var PCOL=['var(--c1)','var(--c2)','var(--c3)','var(--c4)','var(--c5)','var(--c6)','var(--c7)','var(--c8)'];
var PHEX=['#3D6F9E','#7357A6','#A87512','#8A6648','#12837F','#B0466A','#4A8636','#56636E'];
var CDN='https://cdnjs.cloudflare.com/ajax/libs/';
var KEY='kkmc-valves-project-v1', UIKEY='kkmc-valves-ui-v1';
var ASSETS=ls(function(){return JSON.parse($('#assets').textContent)})||{};

/* ================= state ================= */
var EMB=ls(function(){var t=$('#app-data');return t&&t.textContent.trim()?JSON.parse(t.textContent):null});
var DESK=!!(window.PLAN_HOST&&window.PLAN_HOST.desktop);
var saved=DESK?null:ls(function(){return JSON.parse(localStorage.getItem(KEY)||'null')});
var state,dirty=false;
if(saved&&saved.state&&(!EMB||(saved.rev||0)>=(EMB.rev||0))){state=saved.state;dirty=!EMB||JSON.stringify(saved.state)!==JSON.stringify(EMB)}
else state=EMB||DEFAULT_PROJECT();
state=normalize(state);
var ui=Object.assign({tab:'dash',zoom:'w',collapsed:{},f:{}},ls(function(){return JSON.parse(localStorage.getItem(UIKEY)||'null')})||{});
ui.f=ui.f||{};ui.collapsed=ui.collapsed||{};
var hist=[],fut=[];

function normalize(s){
  var d=DEFAULT_PROJECT();
  s.meta=Object.assign({},d.meta,s.meta||{});
  ['boq','groups','tasks','events','installs','supplies','expenses','sections','team','equip','rates','risks','conditions'].forEach(function(k){if(!Array.isArray(s[k]))s[k]=d[k]});
  if(!Array.isArray(s.expCats)||!s.expCats.length)s.expCats=d.expCats;
  s.report=Object.assign({},d.report,s.report||{});s.report.secs=Object.assign({},d.report.secs,s.report.secs||{});
  if(!Array.isArray(s.report.sign))s.report.sign=d.report.sign;
  if(!Array.isArray(s.meta.weekend))s.meta.weekend=[5];
  s.tasks.forEach(function(t){if(!Array.isArray(t.preds))t.preds=[];t.ms=!!t.ms;});
  ['boq','groups','tasks','events','installs','supplies','expenses','sections','team','equip','rates','risks','conditions'].forEach(function(k){s[k].forEach(function(r){if(!r||!/^[A-Za-z0-9_\-.~:@+]{1,120}$/.test(r.id||''))r.id=uid(k.charAt(0))})});
  s.rev=s.rev||1;
  return s;
}
function saveDraft(){tlCommit();cacheLocal();afterChange()}
function saveUi(){ls(function(){localStorage.setItem(UIKEY,JSON.stringify({tab:ui.tab,zoom:ui.zoom,collapsed:ui.collapsed,f:ui.f}))})}
function mutate(fn,opt){snap();fn();dirty=true;state.meta.updated=new Date().toISOString();saveDraft();sched();if(!(opt&&opt.quiet))renderSoon()}
var rT;function renderSoon(){clearTimeout(rT);rT=setTimeout(renderAll,0)}

function toast(msg){var e=$('#toast');if(!e){e=el('div','toast');e.id='toast';e.setAttribute('role','status');document.body.appendChild(e)}e.textContent=msg;e.hidden=false;clearTimeout(e._t);e._t=setTimeout(function(){e.hidden=true},3600)}

/* ================= lookups ================= */
function boqById(id){for(var i=0;i<state.boq.length;i++)if(state.boq[i].id===id)return state.boq[i];return null}
function boqName(id){var b=boqById(id);if(!b)return '—';if(b.dia)return 'قطر '+b.dia+' بوصة';var d=String(b.desc||'').replace(/\s+/g,' ').trim();return 'بند '+b.no+(d?' – '+(d.length>48?d.slice(0,47)+'…':d):'')}
function boqShort(id){var b=boqById(id);if(!b)return '—';return b.dia?(b.dia+'"'):('بند '+b.no)}
function taskById(id){for(var i=0;i<state.tasks.length;i++)if(state.tasks[i].id===id)return state.tasks[i];return null}
function grpIdx(id){for(var i=0;i<state.groups.length;i++)if(state.groups[i].id===id)return i;return 0}
function grpColor(id){var g=state.groups[grpIdx(id)];return PCOL[((g&&g.color!=null?g.color:grpIdx(id))%8+8)%8]}
function grpHex(id){var g=state.groups[grpIdx(id)];return PHEX[((g&&g.color!=null?g.color:grpIdx(id))%8+8)%8]}
/* wording: valve projects say المحابس/محبس/تركيب, other projects say الأعمال/وحدة/تنفيذ; each can be renamed */
var TERMS={
  valves:{itemCol:'القطر',diaCol:'القطر (بوصة)',log:'المحابس المركبة',items:'المحابس',itemsN:'محابس',unit:'محبس',unit2:'محبساً',verb:'تركيب',doneU:'مركب',supU:'موَرَّد'},
  works:{itemCol:'البند',diaCol:'المقاس',log:'الأعمال المنفذة',items:'الأعمال',itemsN:'أعمال',unit:'وحدة',unit2:'وحدة',verb:'تنفيذ',doneU:'منفذة',supU:'موردة'}
};
function TM(k){
  var base=TERMS[state.meta.kind==='works'?'works':'valves'],t=state.meta.terms||{};
  if(k==='verbAl')return 'ال'+TM('verb');
  if((k==='unit'||k==='unit2')&&state.meta.kind==='works'&&!String(t.unit||'').trim())return state.boq.some(function(b){return num(b.rate)>0})?(state.meta.currency||'ريال'):'وحدة';
  if(k==='unit2'&&t.unit)return t.unit;
  return String(t[k]||'').trim()||base[k];
}
function asProject(o){
  if(o&&o.state)o=o.state;
  if(o&&Array.isArray(o.projects)&&o.projects.length&&o.projects[0].phases){if(o.projects.length>1)toast('الملف يحتوي على '+o.projects.length+' خطط، تم استيراد الأولى: '+(o.projects[0].meta||{}).project);o=o.projects[0]}
  if(o&&Array.isArray(o.phases)&&Array.isArray(o.tasks)&&!o.groups)return planToValves(o,DEFAULT_PROJECT());
  return o&&o.meta&&o.boq?o:null;
}
function taskCol(t){return t.color||grpColor(t.group)}
function taskHex(t){return t.color||grpHex(t.group)}
function totQty(){return state.boq.reduce(function(s,b){return s+num(b.qty)},0)}
function cutoff(to){return to==null?Infinity:to}
function installedOf(id,to){to=cutoff(to);return state.installs.reduce(function(s,r){return s+((r.boq===id&&dnum(r.date)<=to)?num(r.qty):0)},0)}
function suppliedOf(id,to){to=cutoff(to);return state.supplies.reduce(function(s,r){return s+((r.boq===id&&dnum(r.date)<=to)?num(r.qty):0)},0)}
function installedAll(to){to=cutoff(to);return state.installs.reduce(function(s,r){return s+(dnum(r.date)<=to&&boqById(r.boq)?num(r.qty):0)},0)}
function suppliedAll(to){to=cutoff(to);return state.supplies.reduce(function(s,r){return s+(dnum(r.date)<=to&&boqById(r.boq)?num(r.qty):0)},0)}
function rateOf(b){return num(b.rate)}
function valueStats(to){
  var tot=0,ex=0,sp=num(state.meta.supplyPct)/100;
  state.boq.forEach(function(b){var q=num(b.qty),r=rateOf(b),i=Math.min(installedOf(b.id,to),q||Infinity),s=Math.min(suppliedOf(b.id,to),q||Infinity);tot+=q*r;ex+=i*r+Math.max(0,s-i)*r*sp});
  var hasRates=tot>0;if(!hasRates)tot=num(state.meta.value);
  var v=num(state.meta.vat)/100;
  return {tot:tot,ex:ex,hasRates:hasRates,vat:v,totV:tot*(1+v)};
}
function expNet(r){var q=num(r.qty),p=num(r.price);return q&&p?Math.round(q*p*100)/100:num(r.amount)}
function expVat(r){return Math.round(expNet(r)*num(r.vat))/100}
function expTot(r){return Math.round((expNet(r)+expVat(r))*100)/100}
function expTotal(list){return list.reduce(function(s,r){return s+expTot(r)},0)}

/* ================= calendar & schedule ================= */
var blocks=[];
function evDays(e){
  if(e.type==='ext')return Math.max(0,num(e.days));
  var a=dnum(e.from);if(isNaN(a))return 0;var b=e.to?dnum(e.to):todayNum();if(isNaN(b)||b<a)return 0;return b-a+1;
}
function evAdds(e){return e.type==='ext'?true:e.type==='stop'?e.adds!==false:!!e.adds}
function buildBlocks(){
  blocks=[];state.events.forEach(function(e){if(e.type==='ext')return;var a=dnum(e.from);if(isNaN(a))return;var b=e.to?dnum(e.to):Math.max(a,todayNum());if(b>=a)blocks.push([a,b])});
}
function isWork(n){if(state.meta.weekend.indexOf(dow(n))>=0)return false;for(var i=0;i<blocks.length;i++)if(n>=blocks[i][0]&&n<=blocks[i][1])return false;return true}
function nextWork(n){var c=0;while(!isWork(n)&&c<4000){n++;c++}return n}
function nthWork(s,k){var d=nextWork(s),c=1,g=0;while(c<k&&g<20000){d++;g++;if(isWork(d))c++}return d}
function workBetween(a,b){var c=0;for(var d=a;d<=b;d++)if(isWork(d))c++;return c}
function cStart(){var s=dnum(state.meta.start);return isNaN(s)?todayNum():s}
function cEnd(){var e=dnum(state.meta.end);return isNaN(e)?cStart()+249:e}
function addDays(){return state.events.reduce(function(s,e){return s+(evAdds(e)?evDays(e):0)},0)}
function stopDays(){return state.events.reduce(function(s,e){return s+(e.type==='stop'?evDays(e):0)},0)}
function extDays(){return state.events.reduce(function(s,e){return s+(e.type==='ext'?evDays(e):0)},0)}
function revEnd(){return cEnd()+addDays()}
var SCH={};
function sched(){
  buildBlocks();SCH={};
  var tasks=state.tasks,done={},guard=0,map={};tasks.forEach(function(t){map[t.id]=t});
  function calc(t,stack){
    if(done[t.id])return SCH[t.id];
    if(stack[t.id])return null;stack[t.id]=1;
    var es=cStart(),msd=null;
    t.preds.forEach(function(p){var q=map[p.id];if(!q)return;var r=calc(q,stack);if(!r)return;var lag=Math.max(0,parseInt(p.lag,10)||0),c;
      if(t.ms){c=p.type==='SS'?r.s:(q.ms?r.s:r.f);if(lag)c=nthWork(c+1,lag);msd=msd==null?c:Math.max(msd,c);return}
      if(p.type==='SS')c=nthWork(r.s,lag+1);else c=nthWork(q.ms?r.s:r.f+1,lag+1);
      es=Math.max(es,c)});
    var nb=dnum(t.nb);
    var res;
    if(t.ms){var d=msd!=null?msd:cStart();if(!isNaN(nb))d=Math.max(d,nb);res={s:d,f:d}}
    else{if(!isNaN(nb))es=Math.max(es,nb);var s=nextWork(es);res={s:s,f:nthWork(s,Math.max(1,parseInt(t.dur,10)||1))}}
    SCH[t.id]=res;done[t.id]=1;delete stack[t.id];return res;
  }
  tasks.forEach(function(t){calc(t,{})});
}
function tS(t){return (SCH[t.id]||{}).s}
function tF(t){return (SCH[t.id]||{}).f}
function projEnd(){var m=-Infinity;state.tasks.forEach(function(t){if(tF(t)>m)m=tF(t)});return m===-Infinity?cEnd():m}
function plannedAt(t,d){var s=tS(t),f=tF(t);if(s==null)return 0;if(t.ms)return d>=s?1:0;if(d<s)return 0;if(d>=f)return 1;return clamp(workBetween(s,d)/Math.max(1,parseInt(t.dur,10)||1),0,1)}
function progOf(t,to){
  if(t.link==='supply'){var q=totQty();return q?clamp(suppliedAll(to)/q,0,1):0}
  var b=t.link&&boqById(t.link);if(b){var qq=num(b.qty);return qq?clamp(installedOf(b.id,to)/qq,0,1):0}
  if(t.ms){var x=t.af||t.as;if(x)return dnum(x)<=cutoff(to)?1:0;if(num(t.prog)>=100)return 1;
    if(t.preds.length)return t.preds.every(function(p){var q=taskById(p.id);return !q||q===t||progOf(q,to)>=1})?1:0;
    return tS(t)<=(to==null?todayNum():to)?1:0}
  return clamp(num(t.prog)/100,0,1);
}
function actualOf(t){
  var as=t.as?dnum(t.as):NaN,af=t.af?dnum(t.af):NaN;
  if(t.link){
    var list=(t.link==='supply'?state.supplies:state.installs.filter(function(r){return r.boq===t.link})).filter(function(r){return !isNaN(dnum(r.date))&&(t.link!=='supply'||boqById(r.boq))}).sort(function(a,b){return dnum(a.date)-dnum(b.date)});
    if(list.length&&isNaN(as))as=dnum(list[0].date);
    if(isNaN(af)&&list.length){var need=t.link==='supply'?totQty():num((boqById(t.link)||{}).qty),c=0;for(var i=0;i<list.length;i++){c+=num(list[i].qty);if(need&&c>=need){af=dnum(list[i].date);break}}}
  }
  return {s:as,f:af};
}
function statusOf(t){
  var p=progOf(t),td=todayNum(),pl=plannedAt(t,td);
  if(p>=1)return 'done';
  if((td>tF(t)&&!t.ms)||(t.ms&&td>tS(t))||pl-p>0.05)return 'late';
  if(p>0||(td>=tS(t)&&td<=tF(t)))return 'active';
  return 'ns';
}
var STL={done:'منجز',late:'متأخر',active:'جارٍ',ns:'لم يبدأ'};
var STC={done:'ok',late:'bad',active:'a',ns:'n'};
function overall(to){
  if(state.meta.kind==='works'){
    var d0=to==null?todayNum():to,hasR=state.boq.some(function(b){return num(b.rate)>0}),tv=0,ti=0,ts=0,tw=0,ta=0,tp=0;
    state.boq.forEach(function(b){var q0=num(b.qty),w0=hasR?num(b.rate):1;tv+=q0*w0;ti+=Math.min(installedOf(b.id,to),q0)*w0;ts+=Math.min(suppliedOf(b.id,to),q0)*w0});
    state.tasks.forEach(function(t){if(t.ms)return;var w1=Math.max(1,parseInt(t.dur,10)||1);tw+=w1;ta+=w1*progOf(t,to);tp+=w1*plannedAt(t,d0)});
    return {q:tv,inst:ti,sup:ts,act:tw?ta/tw:(tv?ti/tv:0),sp:tv?ts/tv:0,plan:tw?tp/tw:0};
  }
  var q=totQty(),inst=Math.min(installedAll(to),q||Infinity),sup=Math.min(suppliedAll(to),q||Infinity);
  var d=to==null?todayNum():to,plq=0,pls=0,ins=state.tasks.filter(function(t){return t.link&&t.link!=='supply'&&boqById(t.link)});
  ins.forEach(function(t){var b=boqById(t.link),w=num(b.qty);plq+=w;pls+=w*plannedAt(t,d)});
  return {q:q,inst:inst,sup:sup,act:q?inst/q:0,sp:q?sup/q:0,plan:plq?pls/plq:0};
}

/* ================= header / banners / kpis ================= */
function logoSrc(){return state.meta.logo||ASSETS.logo||''}
function renderHeader(){
  var m=state.meta,lg=logoSrc();
  $('#hdr').innerHTML='<div class="brand">'+(lg?'<img src="'+lg+'" alt="">':'')+'<div class="tx"><span class="eyebrow">'+esc(m.contractor)+'</span><h1>'+esc(m.name)+'</h1><span class="sub">'+esc(m.client)+(m.po?' · أمر الشراء رقم <span class="num">'+esc(m.po)+'</span>':'')+'</span></div></div>'+
  '<div class="actions">'+(HOST&&HOST.home?'<button class="btn sm" data-act="home">→ كل المشاريع</button>':'')+'<span id="store-status" class="actions">'+storageChip()+'</span>'+
  '<button class="btn sm" data-act="undo" title="تراجع (Ctrl+Z)">↶ تراجع</button><button class="btn sm" data-act="redo" title="إعادة (Ctrl+Shift+Z)">↷ إعادة</button>'+
  (DESK?'':'<button class="btn sm" data-act="save-html">حفظ نسخة HTML محدّثة</button>')+'<button class="btn sm" data-act="xlsx">Excel منسق</button><button class="btn sm primary" data-act="tab" data-v="report">التقرير / PDF</button></div>';
}
function renderBanners(){
  var out=[],td=todayNum();
  state.events.forEach(function(e){if(e.type==='stop'&&e.from&&!e.to&&dnum(e.from)<=td)out.push(['bad','أمر إيقاف سارٍ منذ '+fl(dnum(e.from))+(e.ref?' (رقم '+esc(e.ref)+')':'')+' – مضى عليه '+(td-dnum(e.from)+1)+' يوماً. سجّل تاريخ الاستئناف عند صدوره من تبويب «الإيقاف والمدد».'])});
  var o=overall();
  if(td>revEnd()&&o.act<1)out.push(['warn','انتهت المدة التعاقدية المعدّلة في '+fl(revEnd())+' ونسبة '+TM('verbAl')+' '+pct(o.act)+'%. أضف أمر إيقاف أو إضافة مدة إن وُجد.']);
  state.boq.forEach(function(b){var i=installedOf(b.id),s=suppliedOf(b.id);if(state.supplies.length&&i>s)out.push(['warn','المركب من '+boqName(b.id)+' ('+qn(i)+') أكبر من الموَرَّد ('+qn(s)+').']);if(num(b.qty)&&i>num(b.qty))out.push(['warn','المركب من '+boqName(b.id)+' ('+qn(i)+') أكبر من الكمية التعاقدية ('+qn(num(b.qty))+').'])});
  $('#banners').innerHTML=out.map(function(b){return '<div class="banner '+(b[0]==='info'?'':b[0])+'"><p>'+b[1]+'</p>'+(b[0]==='info'?'<button class="btn sm" data-act="dismiss-draft">حسناً</button>':'')+'</div>'}).join('');
}
function kpiHtml(){
  var o=overall(),td=todayNum(),cs=cStart(),re=revEnd(),dur=re-cs+1,el_=clamp(td-cs+1,0,dur),rem=re-td,v=valueStats(),ex=expTotal(state.expenses),c=esc(state.meta.currency);
  var gap=o.act-o.plan;
  return '<div class="kpis">'+
  '<div class="kpi"><span class="k">نسبة '+TM('verbAl')+' الفعلية</span><span class="v">'+pct(o.act)+'%<small>المخطط '+pct(o.plan)+'%</small></span><div class="bar"><i class="pl" style="width:'+pct(o.plan)+'%"></i><i class="ac" style="width:'+pct(o.act)+'%"></i></div><span class="s">'+(o.q?(gap>=-0.005?'<span class="pill ok">مطابق أو متقدم</span>':'<span class="pill bad">متأخر '+pct(-gap)+'%</span>'):'')+'</span></div>'+
  '<div class="kpi"><span class="k">'+TM('log')+'</span><span class="v">'+qn(o.inst)+'<small>من '+qn(o.q)+'</small></span><span class="s">المتبقي '+qn(Math.max(0,o.q-o.inst))+' '+TM('unit')+'</span></div>'+
  '<div class="kpi"><span class="k">'+TM('items')+' الموردة</span><span class="v">'+qn(o.sup)+'<small>'+pct(o.sp)+'%</small></span><div class="bar"><i class="sup" style="width:'+pct(o.sp)+'%"></i></div></div>'+
  '<div class="kpi"><span class="k">المدة الزمنية</span><span class="v">'+(td<cs?'لم يبدأ':el_+'<small>من '+dur+' يوم</small>')+'</span><div class="bar"><i class="pl" style="width:'+pct(el_/dur)+'%"></i></div><span class="s">'+(rem>=0?'المتبقي '+rem+' يوماً حتى '+fs(re):'تجاوز النهاية المعدّلة بـ '+(-rem)+' يوماً')+'</span></div>'+
  '<div class="kpi"><span class="k">الإيقاف وإضافة المدد</span><span class="v">+'+addDays()+'<small>يوم</small></span><span class="s">إيقاف '+stopDays()+' · تمديد '+extDays()+' يوم</span></div>'+
  (v.tot?'<div class="kpi"><span class="k">قيمة الأعمال المنفذة</span><span class="v">'+money(v.ex)+'<small>'+c+'</small></span><span class="s">من '+money(v.tot)+' '+c+' قبل الضريبة'+(v.hasRates?'':' (القيمة الإجمالية فقط)')+'</span></div>':'')+
  '<div class="kpi"><span class="k">المصاريف</span><span class="v">'+money(ex)+'<small>'+c+'</small></span><span class="s">'+state.expenses.length+' بند مصروف</span></div>'+
  '</div>';
}
var TABS=[['dash','لوحة المتابعة'],['boq','حصر الأعمال'],['gantt','الجدول الزمني'],['installs','المحابس المركبة'],['supplies','التوريدات'],['expenses','المصاريف'],['events','الإيقاف والمدد'],['plan','خطة العمل'],['report','التقرير / PDF'],['settings','بيانات المشروع']];
function renderTabs(){
  var cnt={installs:state.installs.length,supplies:state.supplies.length,expenses:state.expenses.length,events:state.events.length};
  $('#tabs').innerHTML=TABS.map(function(t){return '<button role="tab" aria-selected="'+(ui.tab===t[0])+'" data-act="tab" data-v="'+t[0]+'">'+(t[0]==='installs'?esc(TM('log')):t[1])+(cnt[t[0]]?'<span class="cnt">'+cnt[t[0]]+'</span>':'')+'</button>'}).join('');
}

/* ================= binding helpers ================= */
function coll(c){return c==='meta'?state.meta:c==='report'?state.report:state[c]}
function rowOf(c,id){var a=state[c];if(!Array.isArray(a))return null;for(var i=0;i<a.length;i++)if(a[i].id===id)return a[i];return null}
function B(c,id,f){return 'data-b="'+c+'|'+(id||'')+'|'+f+'"'}
function inp(c,r,f,type,extra){var v=r[f];return '<input class="cell" type="'+(type||'text')+'" '+B(c,r.id,f)+(type==='number'?' data-t="num" step="any"':'')+' value="'+esc(v==null?'':v)+'"'+(extra||'')+'>'}
function txa(c,r,f,extra){return '<textarea class="cell" rows="1" '+B(c,r.id,f)+(extra||'')+'>'+esc(r[f]||'')+'</textarea>'}
function boqSel(c,r,f,all){return '<select class="cell" '+B(c,r.id,f)+'>'+(all?'<option value="">—</option>':'')+state.boq.map(function(b){return '<option value="'+b.id+'"'+(r[f]===b.id?' selected':'')+'>'+esc(boqName(b.id))+'</option>'}).join('')+'</select>'}
function sel(c,r,f,opts){return '<select class="cell" '+B(c,r.id,f)+'>'+opts.map(function(o){var v=Array.isArray(o)?o[0]:o,l=Array.isArray(o)?o[1]:o;return '<option value="'+esc(v)+'"'+(String(r[f])===String(v)?' selected':'')+'>'+esc(l)+'</option>'}).join('')+'</select>'}
function rowActs(c,r,noHide){return '<div class="rowact">'+(noHide?'':'<button class="btn icon ghost" data-act="hide" data-c="'+c+'" data-id="'+r.id+'" title="'+(r.hide?'إظهار في التقرير':'إخفاء من التقرير')+'" aria-label="إظهار أو إخفاء في التقرير">'+(r.hide?'🚫':'👁')+'</button>')+'<button class="btn icon ghost danger" data-act="del" data-c="'+c+'" data-id="'+r.id+'" title="حذف" aria-label="حذف">✕</button></div>'}
function setBound(key,val,elx){
  var p=key.split('|'),c=p[0],id=p[1],f=p[2];
  mutate(function(){
    var o=id?rowOf(c,id):coll(c);if(!o)return;
    if(c==='report'&&f.indexOf('secs.')===0){o.secs[f.slice(5)]=val;return}
    if(c==='report'&&f.indexOf('sign.')===0){var q=f.split('.');o.sign[+q[1]][q[2]]=val;return}
    if(c==='meta'&&f==='weekend'){return}
    if(c==='meta'&&f.indexOf('terms.')===0){o.terms=Object.assign({},o.terms);o.terms[f.slice(6)]=val;return}
    o[f]=val;
    if(c==='expenses'&&(f==='qty'||f==='price')){var a=num(o.qty)*num(o.price);if(num(o.qty)&&num(o.price))o.amount=Math.round(a*100)/100}
    if(c==='tasks'&&f==='dur'){o.dur=Math.max(1,parseInt(val,10)||1)}
  });
}
document.addEventListener('change',function(e){
  var t=e.target,k=t.getAttribute&&t.getAttribute('data-b');if(!k)return;
  var v=t.type==='checkbox'?t.checked:t.getAttribute('data-t')==='num'?(t.value===''?'':num(t.value)):t.value;
  setBound(k,v,t);
});

/* ================= dashboard ================= */
function recent(){
  var it=[];
  state.installs.forEach(function(r){it.push([dnum(r.date),TM('verb')+' '+qn(num(r.qty))+' '+TM('unit')+' '+boqName(r.boq)+(r.loc?' – '+r.loc:'')])});
  state.supplies.forEach(function(r){it.push([dnum(r.date),'توريد '+qn(num(r.qty))+' '+TM('unit')+' '+boqName(r.boq)+(r.supplier?' من '+r.supplier:'')])});
  state.expenses.forEach(function(r){it.push([dnum(r.date),'مصروف: '+(r.desc||r.cat)+' – '+money(expTot(r))+' '+state.meta.currency])});
  state.events.forEach(function(e){it.push([dnum(e.type==='ext'?e.date:e.from),EVT[e.type]+(e.ref?' رقم '+e.ref:'')+' – '+evDays(e)+' يوم'])});
  return it.filter(function(x){return !isNaN(x[0])}).sort(function(a,b){return b[0]-a[0]}).slice(0,10);
}
function renderDash(p){
  var o=overall(),td=todayNum();
  var dia=state.boq.map(function(b){var q=num(b.qty)||1,s=suppliedOf(b.id),i=installedOf(b.id);return '<span class="lbl">'+esc(boqShort(b.id))+'</span><div class="stack" title="موَرَّد '+qn(s)+' · مركب '+qn(i)+' من '+qn(num(b.qty))+'"><i class="s" style="width:'+pct(Math.min(1,s/q))+'%"></i><i class="d" style="width:'+pct(Math.min(1,i/q))+'%"></i></div><span class="val">'+qn(i)+' / '+qn(num(b.qty))+' ('+pct(i/q)+'%)</span>'}).join('');
  var late=state.tasks.filter(function(t){return !t.ms&&statusOf(t)==='late'});
  var cur=state.tasks.filter(function(t){return !t.ms&&td>=tS(t)&&td<=tF(t)});
  var rc=recent();
  p.innerHTML=kpiHtml()+
  '<div class="grid2">'+
   '<div class="card"><div class="card-h"><h2>التقدم حسب '+TM('itemCol')+'</h2><div class="legend"><span style="--c:color-mix(in srgb,var(--c3) 40%,transparent)"><i></i>موَرَّد</span><span style="--c:var(--accent)"><i></i>مركب</span></div></div><div class="dia">'+dia+'</div></div>'+
   '<div class="card"><h2>المواعيد التعاقدية</h2><dl class="facts">'+
    '<dt>تاريخ البدء</dt><dd>'+fl(cStart())+'</dd><dt>تاريخ الانتهاء الأصلي</dt><dd>'+fl(cEnd())+' ('+(cEnd()-cStart()+1)+' يوماً)</dd>'+
    '<dt>أيام الإيقاف</dt><dd>'+stopDays()+' يوماً</dd><dt>إضافة مدة</dt><dd>'+extDays()+' يوماً</dd>'+
    '<dt>تاريخ الانتهاء المعدّل</dt><dd><b>'+fl(revEnd())+'</b></dd><dt>نهاية الجدول الزمني الحالي</dt><dd>'+fl(projEnd())+(projEnd()>revEnd()?' <span class="pill bad">بعد النهاية المعدّلة بـ '+(projEnd()-revEnd())+' يوماً</span>':' <span class="pill ok">ضمن المدة</span>')+'</dd>'+
    '<dt>المهام الجارية الآن</dt><dd>'+(cur.length?cur.map(function(t){return esc(t.name)}).join('، '):'—')+'</dd>'+
    '<dt>مهام متأخرة</dt><dd>'+(late.length?'<span class="pill bad">'+late.length+'</span> '+late.slice(0,4).map(function(t){return esc(t.code)}).join('، '):'<span class="pill ok">لا يوجد</span>')+'</dd>'+
   '</dl></div>'+
  '</div>'+
  '<div class="grid2">'+
   '<div class="card"><div class="card-h"><h2>تسجيل سريع</h2></div><div class="toolbar"><button class="btn primary" data-act="tab" data-v="installs">+ '+TM('verb')+' '+TM('itemsN')+'</button><button class="btn" data-act="tab" data-v="supplies">+ توريد</button><button class="btn" data-act="tab" data-v="expenses">+ مصروف</button><button class="btn" data-act="tab" data-v="events">+ أمر إيقاف / إضافة مدة</button></div><p class="hint">كل البيانات قابلة للتعديل، وتُحفظ تلقائياً في هذا المتصفح. للاحتفاظ بنسخة دائمة استخدم «حفظ نسخة HTML محدّثة» أو «تصدير ملف المشروع» من تبويب بيانات المشروع.</p></div>'+
   '<div class="card"><h2>آخر الأحداث</h2>'+(rc.length?'<div class="tl">'+rc.map(function(x){return '<div><time>'+fs(x[0])+'</time><span>'+esc(x[1])+'</span></div>'}).join('')+'</div>':'<p class="hint">لا توجد سجلات بعد. ابدأ بتسجيل التوريدات و'+TM('verb')+' '+TM('items')+'.</p>')+'</div>'+
  '</div>';
}

/* ================= BOQ ================= */
function renderBoq(p){
  var c=esc(state.meta.currency),v=valueStats(),T={q:0,s:0,i:0,val:0,ex:0};
  var rows=state.boq.map(function(b,ix){
    var q=num(b.qty),s=suppliedOf(b.id),i=installedOf(b.id),r=rateOf(b);T.q+=q;T.s+=s;T.i+=i;T.val+=q*r;T.ex+=Math.min(i,q)*r;
    return '<tr class="'+(b.hide?'off':'')+'"><td class="n">'+inp('boq',b,'no','text')+'</td><td class="n">'+inp('boq',b,'dia','number')+'</td><td style="min-width:300px">'+txa('boq',b,'desc')+'</td><td class="n">'+inp('boq',b,'unit','text')+'</td><td class="n">'+inp('boq',b,'qty','number')+'</td><td class="n">'+inp('boq',b,'rate','number',' placeholder="—"')+'</td><td class="n">'+(r?money(q*r):'—')+'</td><td class="n">'+qn(s)+'</td><td class="n">'+qn(i)+'</td><td class="n">'+qn(Math.max(0,q-i))+'</td><td><div class="mini"><div class="bar"><i class="sup" style="width:'+pct(q?Math.min(1,s/q):0)+'%"></i><i class="ac" style="width:'+pct(q?Math.min(1,i/q):0)+'%"></i></div><b>'+pct(q?i/q:0)+'%</b></div></td><td>'+rowActs('boq',b)+'</td></tr>';
  }).join('');
  p.innerHTML='<div class="card"><div class="card-h"><h2>حصر الأعمال – جدول الكميات</h2><div class="toolbar"><button class="btn" data-act="add-boq">+ بند جديد</button><button class="btn" data-act="csv" data-v="boq">تصدير Excel (CSV)</button></div></div>'+
  '<p class="hint">الكمية الموَرَّدة والمركبة تُحسب تلقائياً من سجلي التوريدات و'+TM('log')+'. أدخل سعر الوحدة لحساب قيمة العقد وقيمة الأعمال المنفذة، أو اكتب القيمة الإجمالية من تبويب بيانات المشروع.</p>'+
  '<div class="tw"><table class="t"><thead><tr><th class="n">البند</th><th class="n">'+TM('diaCol')+'</th><th>الوصف</th><th class="n">الوحدة</th><th class="n">الكمية</th><th class="n">سعر الوحدة ('+c+')</th><th class="n">الإجمالي</th><th class="n">الموَرَّد</th><th class="n">المركب</th><th class="n">المتبقي</th><th>الإنجاز</th><th></th></tr></thead><tbody>'+rows+'</tbody>'+
  '<tfoot><tr><td colspan="4">الإجمالي</td><td class="n">'+qn(T.q)+'</td><td></td><td class="n">'+(T.val?money(T.val):'—')+'</td><td class="n">'+qn(T.s)+'</td><td class="n">'+qn(T.i)+'</td><td class="n">'+qn(Math.max(0,T.q-T.i))+'</td><td class="n">'+pct(T.q?T.i/T.q:0)+'%</td><td></td></tr></tfoot></table></div>'+
  (v.tot?'<dl class="facts"><dt>قيمة العقد قبل الضريبة</dt><dd>'+money(v.tot)+' '+c+'</dd><dt>ضريبة القيمة المضافة ('+num(state.meta.vat)+'%)</dt><dd>'+money(v.tot*v.vat)+' '+c+'</dd><dt>الإجمالي شامل الضريبة</dt><dd><b>'+money(v.totV)+' '+c+'</b></dd>'+(v.hasRates?'<dt>قيمة الأعمال المنفذة</dt><dd>'+money(v.ex)+' '+c+' ('+pct(v.tot?v.ex/v.tot:0)+'%)</dd>':'')+'</dl>':'')+
  '</div>';
}

/* ================= logs (installs / supplies / expenses) ================= */
var TESTS=['ناجح','غير ناجح','لم يُختبر'];
function filt(c,list){
  var f=ui.f[c]||{},a=f.from?dnum(f.from):-Infinity,b=f.to?dnum(f.to):Infinity,q=String(f.q||'').trim();
  return list.filter(function(r){var d=dnum(r.date);if(!isNaN(d)&&(d<a||d>b))return false;if(f.boq&&r.boq!==f.boq)return false;if(f.cat&&r.cat!==f.cat)return false;if(q&&JSON.stringify(r).indexOf(q)<0)return false;return true})
  .sort(function(x,y){return (dnum(y.date)||0)-(dnum(x.date)||0)});
}
function filterBar(c,withBoq,withCat){
  var f=ui.f[c]||{};
  return '<div class="toolbar"><label class="f"><span>من تاريخ</span><input class="in" type="date" data-f="'+c+'|from" value="'+esc(f.from||'')+'"></label><label class="f"><span>إلى تاريخ</span><input class="in" type="date" data-f="'+c+'|to" value="'+esc(f.to||'')+'"></label>'+
  (withBoq?'<label class="f"><span>'+TM('itemCol')+'</span><select class="in" data-f="'+c+'|boq"><option value="">الكل</option>'+state.boq.map(function(b){return '<option value="'+b.id+'"'+(f.boq===b.id?' selected':'')+'>'+esc(boqName(b.id))+'</option>'}).join('')+'</select></label>':'')+
  (withCat?'<label class="f"><span>التصنيف</span><select class="in" data-f="'+c+'|cat"><option value="">الكل</option>'+state.expCats.map(function(x){return '<option'+(f.cat===x?' selected':'')+'>'+esc(x)+'</option>'}).join('')+'</select></label>':'')+
  '<label class="f grow"><span>بحث</span><input class="in" type="search" data-f="'+c+'|q" value="'+esc(f.q||'')+'" placeholder="موقع، رقم، ملاحظة…"></label><span class="grow"></span><button class="btn sm" data-act="clear-f" data-c="'+c+'">مسح الفلتر</button><button class="btn sm" data-act="csv" data-v="'+c+'">تصدير Excel (CSV)</button></div>';
}
document.addEventListener('input',function(e){var k=e.target.getAttribute&&e.target.getAttribute('data-f');if(!k)return;var p=k.split('|');ui.f[p[0]]=ui.f[p[0]]||{};ui.f[p[0]][p[1]]=e.target.value;saveUi();clearTimeout(rT);rT=setTimeout(renderAll,e.target.type==='search'?250:0)});
function addForm(c){
  var d=todayIso(),b0=(ui.last&&ui.last[c+'boq'])||(state.boq[0]||{}).id;
  var bo=state.boq.map(function(b){return '<option value="'+b.id+'"'+(b.id===b0?' selected':'')+'>'+esc(boqName(b.id))+'</option>'}).join('');
  if(c==='installs')return '<form class="addform" data-add="installs"><label class="f"><span>تاريخ '+TM('verbAl')+'</span><input type="date" name="date" value="'+d+'" required></label><label class="f"><span>'+(TM('itemCol')==='القطر'?'القطر / البند':TM('itemCol'))+'</span><select name="boq">'+bo+'</select></label><label class="f"><span>العدد</span><input type="number" name="qty" value="1" min="0" step="any" required></label><label class="f w2"><span>الموقع (الحي / الشارع)</span><input name="loc" list="loc-list"></label><label class="f"><span>الرقم التسلسلي</span><input name="serial"></label><label class="f"><span>اختبار الضغط</span><select name="test">'+TESTS.map(function(x){return '<option>'+x+'</option>'}).join('')+'</select></label><label class="f"><span>مدة انقطاع المياه (ساعة)</span><input type="number" name="shut" min="0" step="any"></label><label class="f"><span>الفريق</span><input name="team" list="team-list"></label><label class="f w2"><span>ملاحظات</span><input name="notes"></label><div class="go"><button class="btn primary" type="submit">+ إضافة</button></div></form>';
  if(c==='supplies')return '<form class="addform" data-add="supplies"><label class="f"><span>تاريخ التوريد</span><input type="date" name="date" value="'+d+'" required></label><label class="f"><span>'+(TM('itemCol')==='القطر'?'القطر / البند':TM('itemCol'))+'</span><select name="boq">'+bo+'</select></label><label class="f"><span>العدد</span><input type="number" name="qty" value="1" min="0" step="any" required></label><label class="f"><span>المورد</span><input name="supplier" list="sup-list"></label><label class="f"><span>رقم سند الاستلام / الفاتورة</span><input name="ref"></label><label class="f w2"><span>ملاحظات</span><input name="notes"></label><div class="go"><button class="btn primary" type="submit">+ إضافة</button></div></form>';
  return '<form class="addform" data-add="expenses"><label class="f"><span>التاريخ</span><input type="date" name="date" value="'+d+'" required></label><label class="f"><span>التصنيف</span><select name="cat">'+state.expCats.map(function(x){return '<option'+(ui.last&&ui.last.cat===x?' selected':'')+'>'+esc(x)+'</option>'}).join('')+'</select></label><label class="f w2"><span>البيان (مثال: شراء مسامير 3/4)</span><input name="desc" required></label><label class="f"><span>الكمية</span><input type="number" name="qty" min="0" step="any"></label><label class="f"><span>سعر الوحدة</span><input type="number" name="price" min="0" step="any"></label><label class="f"><span>المبلغ قبل الضريبة ('+esc(state.meta.currency)+')</span><input type="number" name="amount" min="0" step="any"></label><label class="f"><span>الضريبة %</span><input type="number" name="vat" min="0" step="any" value="'+esc(ui.last&&ui.last.vat!=null?ui.last.vat:num(state.meta.vat))+'"></label><div class="f exp-live"><span>الإجمالي شامل الضريبة</span><output id="exp-live">—</output></div><label class="f"><span>المورد / الجهة</span><input name="vendor" list="ven-list"></label><label class="f"><span>رقم الفاتورة</span><input name="ref"></label><div class="go"><button class="btn primary" type="submit">+ إضافة</button></div></form>';
}
function dl(id,vals){var u={};vals.forEach(function(v){if(v)u[v]=1});return '<datalist id="'+id+'">'+Object.keys(u).map(function(v){return '<option value="'+esc(v)+'">'}).join('')+'</datalist>'}
function expLive(f){
  var E=f.elements,q=num(E.qty.value),pr=num(E.price.value);
  if(q&&pr)E.amount.value=Math.round(q*pr*100)/100;
  E.amount.readOnly=!!(q&&pr);
  var net=num(E.amount.value),v=num(E.vat.value),o=$('#exp-live');
  if(o)o.textContent=net?money(net*(1+v/100))+' '+state.meta.currency+(v?' (ضريبة '+money(net*v/100)+')':''):'—';
}
document.addEventListener('input',function(e){var f=e.target.form;if(f&&f.getAttribute('data-add')==='expenses')expLive(f)});
document.addEventListener('submit',function(e){
  var f=e.target,c=f.getAttribute('data-add');if(!c)return;e.preventDefault();
  var o={id:uid(c.charAt(0))};$$('[name]',f).forEach(function(i){o[i.name]=i.type==='number'?(i.value===''?'':num(i.value)):i.value.trim()});
  if(c==='expenses'){if(num(o.qty)&&num(o.price))o.amount=Math.round(num(o.qty)*num(o.price)*100)/100;if(!num(o.amount)){toast('اكتب المبلغ أو الكمية وسعر الوحدة');return}}
  if((c==='installs'||c==='supplies')&&!num(o.qty)){toast('اكتب العدد');return}
  ui.last=ui.last||{};if(o.boq)ui.last[c+'boq']=o.boq;if(o.cat)ui.last.cat=o.cat;if(c==='expenses')ui.last.vat=o.vat;
  mutate(function(){state[c].push(o)});
  toast(c==='installs'?'تم تسجيل '+TM('verb')+' '+qn(num(o.qty))+' '+TM('unit')+' '+boqName(o.boq):c==='supplies'?'تم تسجيل التوريد':'تم تسجيل المصروف');
});
function renderInstalls(p){
  var list=filt('installs',state.installs),tot=list.reduce(function(s,r){return s+num(r.qty)},0);
  var rows=list.map(function(r){return '<tr class="'+(r.hide?'off':'')+'"><td>'+inp('installs',r,'date','date')+'</td><td>'+boqSel('installs',r,'boq')+'</td><td class="n">'+inp('installs',r,'qty','number')+'</td><td style="min-width:170px">'+inp('installs',r,'loc','text',' list="loc-list"')+'</td><td>'+inp('installs',r,'serial','text')+'</td><td>'+sel('installs',r,'test',TESTS)+'</td><td class="n">'+inp('installs',r,'shut','number')+'</td><td>'+inp('installs',r,'team','text',' list="team-list"')+'</td><td style="min-width:160px">'+txa('installs',r,'notes')+'</td><td>'+rowActs('installs',r)+'</td></tr>'}).join('');
  p.innerHTML='<div class="card"><div class="card-h"><h2>سجل '+TM('log')+'</h2><span class="pill a">'+qn(installedAll())+' '+TM('unit')+' '+TM('doneU')+' من '+qn(totQty())+'</span></div>'+addForm('installs')+filterBar('installs',true)+
  (list.length?'<div class="tw"><table class="t"><thead><tr><th>التاريخ</th><th>'+TM('itemCol')+'</th><th class="n">العدد</th><th>الموقع</th><th>الرقم التسلسلي</th><th>اختبار الضغط</th><th class="n">انقطاع (س)</th><th>الفريق</th><th>ملاحظات</th><th></th></tr></thead><tbody>'+rows+'</tbody><tfoot><tr><td colspan="2">الإجمالي ('+list.length+' سجل)</td><td class="n">'+qn(tot)+'</td><td colspan="7"></td></tr></tfoot></table></div>':'<div class="empty">لا توجد سجلات '+TM('verb')+''+(state.installs.length?' مطابقة للفلتر':'')+'. أضف أول سجل من النموذج أعلاه.</div>')+
  '<p class="hint">👁 / 🚫 لإخفاء سجل من التقرير المطبوع فقط (يبقى محسوباً في نسب الإنجاز).</p></div>'+
  dl('loc-list',state.installs.map(function(r){return r.loc}))+dl('team-list',state.installs.map(function(r){return r.team}));
}
function renderSupplies(p){
  var list=filt('supplies',state.supplies),tot=list.reduce(function(s,r){return s+num(r.qty)},0);
  var rows=list.map(function(r){return '<tr class="'+(r.hide?'off':'')+'"><td>'+inp('supplies',r,'date','date')+'</td><td>'+boqSel('supplies',r,'boq')+'</td><td class="n">'+inp('supplies',r,'qty','number')+'</td><td style="min-width:150px">'+inp('supplies',r,'supplier','text',' list="sup-list"')+'</td><td>'+inp('supplies',r,'ref','text')+'</td><td style="min-width:180px">'+txa('supplies',r,'notes')+'</td><td>'+rowActs('supplies',r)+'</td></tr>'}).join('');
  var sum=state.boq.map(function(b){var s=suppliedOf(b.id),q=num(b.qty);return '<tr><td>'+esc(boqName(b.id))+'</td><td class="n">'+qn(q)+'</td><td class="n">'+qn(s)+'</td><td class="n">'+qn(Math.max(0,q-s))+'</td><td><div class="mini"><div class="bar"><i class="sup" style="width:'+pct(q?Math.min(1,s/q):0)+'%"></i></div><b>'+pct(q?s/q:0)+'%</b></div></td></tr>'}).join('');
  p.innerHTML='<div class="grid2" style="grid-template-columns:minmax(0,2fr) minmax(280px,1fr)"><div class="card"><div class="card-h"><h2>سجل التوريدات</h2><span class="pill a">'+qn(suppliedAll())+' '+TM('unit')+' '+TM('supU')+'</span></div>'+addForm('supplies')+filterBar('supplies',true)+
  (list.length?'<div class="tw"><table class="t"><thead><tr><th>التاريخ</th><th>'+TM('itemCol')+'</th><th class="n">العدد</th><th>المورد</th><th>رقم السند</th><th>ملاحظات</th><th></th></tr></thead><tbody>'+rows+'</tbody><tfoot><tr><td colspan="2">الإجمالي</td><td class="n">'+qn(tot)+'</td><td colspan="4"></td></tr></tfoot></table></div>':'<div class="empty">لا توجد توريدات مسجلة.</div>')+'</div>'+
  '<div class="card"><h2>موقف التوريد</h2><div class="tw"><table class="t"><thead><tr><th>'+TM('itemCol')+'</th><th class="n">المطلوب</th><th class="n">الموَرَّد</th><th class="n">المتبقي</th><th>%</th></tr></thead><tbody>'+sum+'</tbody></table></div></div></div>'+
  dl('sup-list',state.supplies.map(function(r){return r.supplier}));
}
function renderExpenses(p){
  var list=filt('expenses',state.expenses),tot=expTotal(list),c=esc(state.meta.currency);
  var byCat={};state.expenses.forEach(function(r){byCat[r.cat||'أخرى']=(byCat[r.cat||'أخرى']||0)+expTot(r)});
  var sNet=list.reduce(function(s,r){return s+expNet(r)},0),sVat=list.reduce(function(s,r){return s+expVat(r)},0);
  var all=expTotal(state.expenses);
  var cats=Object.keys(byCat).sort(function(a,b){return byCat[b]-byCat[a]}).map(function(k,i){return '<tr><td>'+esc(k)+'</td><td class="n">'+money(byCat[k])+'</td><td><div class="mini"><div class="bar"><i style="width:'+pct(all?byCat[k]/all:0)+'%;background:'+PCOL[i%8]+'"></i></div><b>'+pct(all?byCat[k]/all:0)+'%</b></div></td></tr>'}).join('');
  var catOpts=state.expCats.slice();list.forEach(function(r){if(r.cat&&catOpts.indexOf(r.cat)<0)catOpts.push(r.cat)});
  var rows=list.map(function(r){return '<tr class="'+(r.hide?'off':'')+'"><td>'+inp('expenses',r,'date','date')+'</td><td>'+sel('expenses',r,'cat',catOpts)+'</td><td style="min-width:200px">'+txa('expenses',r,'desc')+'</td><td class="n">'+inp('expenses',r,'qty','number')+'</td><td class="n">'+inp('expenses',r,'price','number')+'</td><td class="n">'+inp('expenses',r,'amount','number',num(r.qty)&&num(r.price)?' readonly title="محسوب من الكمية × سعر الوحدة"':'')+'</td><td class="n">'+inp('expenses',r,'vat','number',' placeholder="0"')+'</td><td class="n num">'+money(expVat(r))+'</td><td class="n num"><b>'+money(expTot(r))+'</b></td><td>'+inp('expenses',r,'vendor','text',' list="ven-list"')+'</td><td>'+inp('expenses',r,'ref','text')+'</td><td>'+rowActs('expenses',r)+'</td></tr>'}).join('');
  p.innerHTML='<div class="stack-exp"><div class="card"><div class="card-h"><h2>المصاريف</h2><span class="pill a">الإجمالي '+money(all)+' '+c+'</span></div>'+addForm('expenses')+filterBar('expenses',false,true)+
  (list.length?'<div class="tw"><table class="t"><thead><tr><th>التاريخ</th><th>التصنيف</th><th>البيان</th><th class="n">الكمية</th><th class="n">سعر الوحدة</th><th class="n">المبلغ قبل الضريبة</th><th class="n">الضريبة %</th><th class="n">قيمة الضريبة</th><th class="n">الإجمالي</th><th>المورد</th><th>الفاتورة</th><th></th></tr></thead><tbody>'+rows+'</tbody><tfoot><tr><td colspan="5">الإجمالي ('+list.length+' بند)</td><td class="n">'+money(sNet)+'</td><td></td><td class="n">'+money(sVat)+'</td><td class="n">'+money(tot)+'</td><td colspan="3"></td></tr></tfoot></table></div>':'<div class="empty">لا توجد مصاريف مسجلة. مثال: شراء مسامير، جوانات، إيجار معدة، محروقات…</div>')+
  '<p class="hint">المبلغ قبل الضريبة = الكمية × سعر الوحدة تلقائياً (أو اكتبه مباشرة لو لا توجد كمية)، والإجمالي = المبلغ + الضريبة. اكتب 0 في الضريبة للمصاريف غير الخاضعة لها. المصاريف المخفية (🚫) لا تظهر في التقرير ولا تدخل في إجماليه.</p></div>'+
  '<div class="card"><h2>حسب التصنيف</h2>'+(cats?'<div class="tw"><table class="t"><thead><tr><th>التصنيف</th><th class="n">المبلغ</th><th>النسبة</th></tr></thead><tbody>'+cats+'</tbody><tfoot><tr><td>الإجمالي</td><td class="n">'+money(all)+'</td><td></td></tr></tfoot></table></div>':'<p class="hint">—</p>')+
  '<label class="f"><span>تصنيفات المصاريف (تصنيف في كل سطر)</span><textarea class="in" data-act-cats rows="6">'+esc(state.expCats.join('\n'))+'</textarea></label></div></div>'+
  dl('ven-list',state.expenses.map(function(r){return r.vendor}));
}
document.addEventListener('change',function(e){if(e.target.hasAttribute&&e.target.hasAttribute('data-act-cats')){var v=e.target.value.split('\n').map(function(s){return s.trim()}).filter(Boolean);mutate(function(){state.expCats=v.length?v:['أخرى']})}});

/* ================= time events ================= */
var EVT={stop:'أمر إيقاف',ext:'إضافة مدة',hol:'إجازة / عطلة رسمية'};
function renderEvents(p){
  var td=todayNum();
  var rows=state.events.slice().sort(function(a,b){return (dnum(a.from||a.date)||0)-(dnum(b.from||b.date)||0)}).map(function(e){
    var ext=e.type==='ext';
    return '<tr class="'+(e.hide?'off':'')+'"><td>'+sel('events',e,'type',[['stop',EVT.stop],['ext',EVT.ext],['hol',EVT.hol]])+'</td><td>'+inp('events',e,'ref','text')+'</td><td>'+inp('events',e,'date','date')+'</td>'+
    (ext?'<td colspan="2" class="muted" style="font-size:12px">لا يوقف العمل – يمدد تاريخ الانتهاء</td><td class="n">'+inp('events',e,'days','number')+'</td>':'<td>'+inp('events',e,'from','date')+'</td><td>'+inp('events',e,'to','date')+(e.type==='stop'&&!e.to&&e.from?'<div><span class="pill bad">سارٍ</span></div>':'')+'</td><td class="n">'+evDays(e)+'</td>')+
    '<td class="c">'+(ext?'✓':e.type==='stop'?'<label class="chk"><input type="checkbox" '+B('events',e.id,'adds')+(e.adds!==false?' checked':'')+'>يضاف</label>':'<label class="chk"><input type="checkbox" '+B('events',e.id,'adds')+(e.adds?' checked':'')+'>يضاف</label>')+'</td>'+
    '<td style="min-width:200px">'+txa('events',e,'reason')+'</td><td>'+rowActs('events',e)+'</td></tr>'}).join('');
  var d0=cEnd()-cStart()+1;
  p.innerHTML='<div class="card"><div class="card-h"><h2>أوامر الإيقاف وإضافة المدد والإجازات</h2><div class="toolbar"><button class="btn primary" data-act="add-ev" data-v="stop">+ أمر إيقاف</button><button class="btn" data-act="add-ev" data-v="ext">+ إضافة مدة</button><button class="btn" data-act="add-ev" data-v="hol">+ إجازة / عطلة</button></div></div>'+
  '<p class="hint">أمر الإيقاف يوقف العمل من تاريخ البدء إلى تاريخ الاستئناف فتتأخر مهام الجدول الزمني تلقائياً، وتضاف أيامه للمدة التعاقدية. اترك «حتى» فارغاً إذا كان الإيقاف ما زال سارياً. إضافة المدة تمدد تاريخ الانتهاء فقط. الإجازة توقف العمل ولا تضاف للمدة إلا إذا اخترت ذلك.</p>'+
  (rows?'<div class="tw"><table class="t"><thead><tr><th>النوع</th><th>رقم الخطاب / الأمر</th><th>تاريخ الإصدار</th><th>من</th><th>حتى (الاستئناف)</th><th class="n">الأيام</th><th class="c">يضاف للمدة</th><th>السبب / الملاحظات</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty">لا توجد أوامر إيقاف أو إضافة مدة.</div>')+
  '</div><div class="card"><h2>أثرها على المدة التعاقدية</h2><dl class="facts"><dt>المدة الأصلية</dt><dd>'+d0+' يوماً ('+fs(cStart())+' – '+fs(cEnd())+')</dd><dt>أيام الإيقاف</dt><dd>'+stopDays()+' يوماً</dd><dt>إضافة المدد</dt><dd>'+extDays()+' يوماً</dd><dt>إجمالي المضاف للمدة</dt><dd>'+addDays()+' يوماً</dd><dt>المدة المعدّلة</dt><dd><b>'+(d0+addDays())+' يوماً</b></dd><dt>تاريخ الانتهاء المعدّل</dt><dd><b>'+fl(revEnd())+'</b>'+(td>revEnd()?' <span class="pill bad">منتهية</span>':' <span class="pill a">متبقٍ '+(revEnd()-td)+' يوماً</span>')+'</dd></dl></div>';
}

/* ================= gantt ================= */
var ZOOM={m:{ppd:2.2,l:'شهري'},w:{ppd:6,l:'أسبوعي'},d:{ppd:20,l:'يومي'}};
var tipEl;function tip(txt,e){if(!tipEl){tipEl=el('div','tip');document.body.appendChild(tipEl)}tipEl.hidden=!txt;tipEl.textContent=txt||'';if(e){var x=e.clientX+14,y=e.clientY+14;tipEl.style.left=Math.min(x,window.innerWidth-330)+'px';tipEl.style.top=Math.min(y,window.innerHeight-90)+'px'}}
function renderGantt(p){
  var ppd=ZOOM[ui.zoom].ppd,td=todayNum();
  var lo=Math.min(cStart(),td),hi=Math.max(projEnd(),revEnd(),td);state.tasks.forEach(function(t){if(t.bs)lo=Math.min(lo,dnum(t.bs));if(t.bf)hi=Math.max(hi,dnum(t.bf))});
  var d0=lo-7,d1=hi+21,W=Math.ceil((d1-d0+1)*ppd);
  var X=function(d){return (d-d0)*ppd};
  // header tiers
  var t1='',t2='',d,dt;
  for(d=d0;d<=d1;){dt=new Date(d*DAY);var y=dt.getUTCFullYear(),mo=dt.getUTCMonth(),me=Date.UTC(y,mo+1,1)/DAY-1,e=Math.min(me,d1);
    var lbl=ui.zoom==='m'?fMonS.format(dt):fMon.format(dt);
    if(ui.zoom==='m'){t2+='<div class="u" style="right:'+X(d)+'px;width:'+((e-d+1)*ppd)+'px">'+lbl+'</div>';if(mo===0||d===d0)t1+='<div class="u" style="right:'+X(d)+'px;width:'+((Math.min(Date.UTC(y+1,0,1)/DAY-1,d1)-d+1)*ppd)+'px">'+y+'</div>'}
    else t1+='<div class="u" style="right:'+X(d)+'px;width:'+((e-d+1)*ppd)+'px">'+lbl+'</div>';
    d=me+1}
  if(ui.zoom==='w'){for(d=d0;d<=d1;d++)if(dow(d)===6)t2+='<div class="u" style="right:'+X(d)+'px;width:'+(7*ppd)+'px">'+new Date(d*DAY).getUTCDate()+'</div>'}
  if(ui.zoom==='d'){for(d=d0;d<=d1;d++)t2+='<div class="u" style="right:'+X(d)+'px;width:'+ppd+'px">'+new Date(d*DAY).getUTCDate()+'</div>'}
  // overlay
  var ov='';
  if(ui.zoom!=='m'){for(d=d0;d<=d1;d++){if(state.meta.weekend.indexOf(dow(d))>=0)ov+='<div class="we" style="right:'+X(d)+'px;width:'+ppd+'px"></div>'}}
  for(d=d0;d<=d1;d++){dt=new Date(d*DAY);if(dt.getUTCDate()===1)ov+='<div class="vl" style="right:'+X(d)+'px"></div>'}
  state.events.forEach(function(e){if(e.type==='ext')return;var a=dnum(e.from);if(isNaN(a))return;var b=e.to?dnum(e.to):Math.max(a,td);ov+='<div class="'+(e.type==='stop'?'stp':'hol')+'" style="right:'+X(a)+'px;width:'+((b-a+1)*ppd)+'px" title="'+esc(EVT[e.type]+' '+(e.ref||'')+' '+fs(a)+' – '+(e.to?fs(b):'سارٍ'))+'"></div>'});
  ov+='<div class="ln ce" style="right:'+X(cEnd()+1)+'px"><span>النهاية الأصلية</span></div>';
  if(addDays())ov+='<div class="ln re" style="right:'+X(revEnd()+1)+'px"><span>النهاية المعدّلة</span></div>';
  ov+='<div class="ln today" style="right:'+X(td)+'px"><span>اليوم</span></div>';
  // rows
  var rows='';
  state.groups.forEach(function(g){
    var ts=state.tasks.filter(function(t){return t.group===g.id});
    var gs=Infinity,gf=-Infinity,wq=0,wp=0;ts.forEach(function(t){gs=Math.min(gs,tS(t));gf=Math.max(gf,tF(t));var w=t.ms?0:(parseInt(t.dur,10)||1);wq+=w;wp+=w*progOf(t)});
    var closed=!!ui.collapsed[g.id];
    rows+='<div class="r grp"><div class="side"><span><button class="caret'+(closed?' closed':'')+'" data-act="collapse" data-v="'+g.id+'" aria-label="طي أو فتح">▾</button></span><button class="nm" data-act="edit-grp" data-v="'+g.id+'"><span class="dot" style="background:'+grpColor(g.id)+'"></span><span class="t">'+esc(g.name)+'</span></button><span class="num hm">'+(ts.length&&isFinite(gs)?workBetween(gs,gf):'')+'</span><span class="num hm">'+(isFinite(gs)?fs(gs):'')+'</span><span class="num hm">'+(isFinite(gf)?fs(gf):'')+'</span><span class="num">'+(wq?pct(wp/wq)+'%':'')+'</span></div><div class="tc" style="width:'+W+'px">'+(isFinite(gs)?'<div class="gb sum" style="right:'+X(gs)+'px;width:'+((gf-gs+1)*ppd)+'px"></div>':'')+'</div></div>';
    if(closed)return;
    ts.forEach(function(t){
      var s=tS(t),f=tF(t),pr=progOf(t),st=statusOf(t),a=actualOf(t),col=taskCol(t);
      var tipTxt=t.code+' – '+t.name+'\nالبداية: '+fl(s)+'\nالنهاية: '+fl(f)+(t.ms?'':'\nالمدة: '+t.dur+' يوم عمل')+'\nالإنجاز: '+pct(pr)+'% · المخطط حتى اليوم: '+pct(plannedAt(t,td))+'%'+(t.bs?'\nخط الأساس: '+fs(dnum(t.bs))+' – '+fs(dnum(t.bf)):'')+(!isNaN(a.s)?'\nالبداية الفعلية: '+fs(a.s):'')+(!isNaN(a.f)?'\nالنهاية الفعلية: '+fs(a.f):'');
      var bar=t.ms?'<div class="ms" data-act="edit-task" data-v="'+t.id+'" data-tip="'+esc(tipTxt)+'" style="right:'+X(s)+'px;background:'+(t.color||'var(--ink)')+'"></div><span class="blab" style="right:'+(X(s)+12)+'px"><b>'+pct(pr)+'%</b> · '+fs(s)+'</span>'
        :'<div class="gb" data-act="edit-task" data-v="'+t.id+'" data-tip="'+esc(tipTxt)+'" style="--c:'+col+';right:'+X(s)+'px;width:'+Math.max(4,(f-s+1)*ppd)+'px"><i style="width:'+pct(pr)+'%"></i></div><span class="blab" style="right:'+(X(f+1)+4)+'px"><b>'+pct(pr)+'%</b></span>';
      if(t.bs&&t.bf&&!t.ms)bar+='<div class="bl" style="right:'+X(dnum(t.bs))+'px;width:'+((dnum(t.bf)-dnum(t.bs)+1)*ppd)+'px"></div>';
      if(!isNaN(a.s)&&!t.ms){var ae=!isNaN(a.f)?a.f:td;if(ae>=a.s)bar+='<div class="act" style="right:'+X(a.s)+'px;width:'+((ae-a.s+1)*ppd)+'px"></div>'}
      rows+='<div class="r"><div class="side"><span class="code">'+esc(t.code)+'</span><button class="nm" data-act="edit-task" data-v="'+t.id+'" title="'+esc(t.name)+'"><span class="dot '+st+'" title="'+STL[st]+'"></span><span class="t">'+esc(t.name)+'</span></button><span class="num hm">'+(t.ms?'◆':t.dur)+'</span><span class="num hm">'+fs(s)+'</span><span class="num hm">'+fs(f)+'</span><span class="num">'+pct(pr)+'%</span></div><div class="tc" style="width:'+W+'px">'+bar+'</div></div>';
    });
  });
  p.innerHTML='<div class="toolbar"><div class="seg" role="group" aria-label="المقياس">'+Object.keys(ZOOM).map(function(k){return '<button aria-pressed="'+(ui.zoom===k)+'" data-act="zoom" data-v="'+k+'">'+ZOOM[k].l+'</button>'}).join('')+'</div>'+
  '<button class="btn" data-act="add-task">+ مهمة</button><button class="btn" data-act="add-grp">+ مجموعة</button><button class="btn" data-act="baseline">حفظ خط الأساس</button><button class="btn" data-act="csv" data-v="tasks">تصدير (CSV)</button><span class="grow"></span>'+
  '<div class="legend"><span style="--c:var(--c5)"><i></i>المخطط (الإنجاز داكن)</span><span style="--c:var(--muted)"><i style="height:3px"></i>خط الأساس</span><span style="--c:var(--ok)"><i style="height:3px"></i>الفعلي</span><span style="--c:var(--stop)"><i style="background:repeating-linear-gradient(-45deg,var(--bad) 0 2px,transparent 2px 4px)"></i>إيقاف</span><span style="--c:var(--bad)"><i style="width:2px"></i>اليوم</span></div></div>'+
  '<div class="gantt" id="gwrap"><div class="g" style="width:calc(var(--side) + '+W+'px)"><div class="g-head"><div class="side"><span>الرمز</span><span>المهمة</span><span class="hm">المدة</span><span class="hm">البداية</span><span class="hm">النهاية</span><span>%</span></div><div class="time-h" style="width:'+W+'px"><div class="tier t1">'+t1+'</div><div class="tier t2">'+t2+'</div></div></div><div class="overlay" style="width:'+W+'px">'+ov+'</div>'+rows+'</div></div>'+
  '<p class="hint">المدة بأيام العمل (العطلة الأسبوعية: '+state.meta.weekend.map(function(x){return DOWS[x]}).join('، ')+'). اضغط على أي مهمة لتعديلها. مهام '+TM('verbAl')+' مرتبطة بسجل '+TM('log')+'، ومهمة التوريد مرتبطة بسجل التوريدات، فتتحدث نسبها تلقائياً. أوامر الإيقاف تؤخر المهام تلقائياً.</p>';
  var gw=$('#gwrap');
  if(ui.gscroll==null){var open=state.tasks.filter(function(t){return !t.ms&&progOf(t)<1}).map(tS),anchor=open.length?Math.min.apply(null,open):Math.min(td,projEnd());anchor=Math.max(d0,Math.min(anchor,td)-14);gw.scrollLeft=-Math.max(0,X(anchor))}else gw.scrollLeft=ui.gscroll;
  gw.addEventListener('scroll',function(){ui.gscroll=gw.scrollLeft});
}
document.addEventListener('mousemove',function(e){var t=e.target.closest&&e.target.closest('[data-tip]');tip(t?t.getAttribute('data-tip'):'',e)});

/* ================= dialogs ================= */
function dlg(){return $('#dlg')}
function openDlg(html,onSave){var d=dlg();if(d.open&&d._cancel){var pc=d._cancel;d._cancel=null;pc()}d.innerHTML='<form method="dialog">'+html+'</form>';d._save=onSave;d._cancel=null;if(d.showModal){if(!d.open)d.showModal()}else d.setAttribute('open','');var f=$('input,select,textarea',d);if(f)f.focus()}
function closeDlg(){var d=dlg();if(d.close)d.close();else d.removeAttribute('open');if(d._cancel){var c=d._cancel;d._cancel=null;c()}}
function taskOpts(sel,excl){return state.tasks.filter(function(t){return t.id!==excl}).map(function(t){return '<option value="'+t.id+'"'+(t.id===sel?' selected':'')+'>'+esc(t.code+' – '+t.name)+'</option>'}).join('')}
function predRow(p,excl){return '<div class="pred"><select class="in" name="pid"><option value="">—</option>'+taskOpts(p.id,excl)+'</select><select class="in" name="ptype"><option value="FS"'+(p.type!=='SS'?' selected':'')+'>بعد انتهاء</option><option value="SS"'+(p.type==='SS'?' selected':'')+'>مع بداية</option></select><input class="in" type="number" name="plag" min="0" value="'+(p.lag||0)+'" title="فاصل بأيام العمل"><button type="button" class="btn icon ghost danger" data-act="rm-pred" aria-label="حذف">✕</button></div>'}
function openTask(id){
  var t=taskById(id),fresh=!t;
  if(fresh)t={id:uid('t'),code:'A'+(1000+state.tasks.length*10+10),name:'',group:(state.groups[state.groups.length-1]||{}).id,dur:5,ms:false,preds:[],nb:'',link:'',prog:0,as:'',af:'',notes:''};
  var a=actualOf(t),linkOpts='<option value="">بدون (نسبة يدوية)</option><option value="supply"'+(t.link==='supply'?' selected':'')+'>سجل التوريدات (كل البنود)</option>'+state.boq.map(function(b){return '<option value="'+b.id+'"'+(t.link===b.id?' selected':'')+'>'+TM('verb')+' '+esc(boqName(b.id))+'</option>'}).join('');
  openDlg('<div class="dlg-h"><h2>'+(fresh?'مهمة جديدة':'تعديل مهمة')+'</h2><button type="button" class="btn icon ghost" data-act="close-dlg" aria-label="إغلاق">✕</button></div>'+
  '<div class="fields"><label class="f"><span>الرمز</span><input name="code" value="'+esc(t.code)+'"></label><label class="f" style="grid-column:span 2"><span>اسم المهمة</span><input name="name" value="'+esc(t.name)+'" required></label>'+
  '<label class="f"><span>المجموعة</span><select name="group">'+state.groups.map(function(g){return '<option value="'+g.id+'"'+(g.id===t.group?' selected':'')+'>'+esc(g.name)+'</option>'}).join('')+'</select></label>'+
  '<label class="f"><span>المدة (أيام عمل)</span><input type="number" name="dur" min="1" value="'+(t.ms?'':t.dur)+'"'+(t.ms?' disabled':'')+'></label><label class="f"><span>&nbsp;</span><span class="chk"><input type="checkbox" name="ms"'+(t.ms?' checked':'')+'> معلم رئيسي (بدون مدة)</span></label>'+
  '<label class="f"><span>لا تبدأ قبل</span><input type="date" name="nb" value="'+esc(t.nb||'')+'"></label>'+
  '<label class="f" style="grid-column:span 2"><span>ربط نسبة الإنجاز</span><select name="link">'+linkOpts+'</select></label>'+
  '<div class="f wide"><span>نسبة الإنجاز'+(t.link?' (محسوبة تلقائياً من السجلات)':'')+'</span><div class="sl"><input type="range" name="prog" min="0" max="100" step="1" value="'+(t.link?pct(progOf(t)):esc(num(t.prog)))+'"'+(t.link?' disabled':'')+'><output id="prog-out">'+(t.link?pct(progOf(t)):num(t.prog))+'%</output></div></div>'+
  '<div class="f wide"><span>لون البار</span><div class="swatches"><label class="sw" title="لون المجموعة"><input type="radio" name="color" value=""'+(t.color?'':' checked')+'><i style="background:'+grpHex(t.group)+'"></i><span>لون المجموعة</span></label>'+PHEX.map(function(c){return '<label class="sw" title="'+c+'"><input type="radio" name="color" value="'+c+'"'+(t.color===c?' checked':'')+'><i style="background:'+c+'"></i></label>'}).join('')+'<label class="sw" title="لون آخر"><input type="radio" name="color" value="custom"'+(t.color&&PHEX.indexOf(t.color)<0?' checked':'')+'><input type="color" name="colorc" value="'+esc(t.color&&PHEX.indexOf(t.color)<0?t.color:'#0A6C88')+'"><span>لون آخر</span></label></div></div>'+
  '<label class="f"><span>البداية الفعلية'+(!t.as&&!isNaN(a.s)?' (تلقائي '+fs(a.s)+')':'')+'</span><input type="date" name="as" value="'+esc(t.as||'')+'"></label><label class="f"><span>النهاية الفعلية'+(!t.af&&!isNaN(a.f)?' (تلقائي '+fs(a.f)+')':'')+'</span><input type="date" name="af" value="'+esc(t.af||'')+'"></label>'+
  '<div class="f wide"><span>تبدأ بعد (العلاقات)</span><div class="preds" id="preds">'+t.preds.map(function(p){return predRow(p,t.id)}).join('')+'</div><div><button type="button" class="btn sm" data-act="add-pred" data-v="'+t.id+'">+ علاقة</button></div></div>'+
  '<label class="f wide"><span>ملاحظات</span><textarea name="notes" rows="2">'+esc(t.notes||'')+'</textarea></label></div>'+
  '<div class="dlg-f">'+(fresh?'<span></span>':'<button type="button" class="btn danger" data-act="del-task" data-v="'+t.id+'">حذف المهمة</button>')+'<div class="toolbar"><button type="button" class="btn" data-act="close-dlg">إلغاء</button><button type="submit" class="btn primary" value="ok">حفظ</button></div></div>',
  function(f){
    var preds=$$('.pred',f).map(function(r){return {id:$('[name=pid]',r).value,type:$('[name=ptype]',r).value,lag:Math.max(0,parseInt($('[name=plag]',r).value,10)||0)}}).filter(function(p){return p.id});
    mutate(function(){
      var x=fresh?t:taskById(t.id);var E=f.elements;x.code=E.code.value.trim();x.name=E['name'].value.trim()||'مهمة';x.group=E.group.value;x.ms=E.ms.checked;x.dur=x.ms?0:Math.max(1,parseInt(E.dur.value,10)||1);x.nb=E.nb.value;x.link=E.link.value;if(!x.link)x.prog=clamp(num(E.prog.value),0,100);var cv=f.querySelector('input[name=color]:checked');cv=cv?cv.value:'';x.color=cv==='custom'?E.colorc.value:cv;x.as=E.as.value;x.af=E.af.value;x.notes=E.notes.value;x.preds=preds;
      if(fresh)state.tasks.push(x);
    });
  });
  var E=$('#dlg form').elements;E.ms.addEventListener('change',function(){E.dur.disabled=E.ms.checked});E.link.addEventListener('change',function(){E.prog.disabled=!!E.link.value});E.prog.addEventListener('input',function(){$('#prog-out').textContent=E.prog.value+'%'});E.colorc.addEventListener('input',function(){var r=$('#dlg input[name=color][value=custom]');if(r)r.checked=true});
}
function openGroup(id){
  var g=state.groups[grpIdx(id)],fresh=!id;if(fresh)g={id:uid('g'),name:'',color:state.groups.length%8};
  openDlg('<div class="dlg-h"><h2>'+(fresh?'مجموعة جديدة':'تعديل المجموعة')+'</h2><button type="button" class="btn icon ghost" data-act="close-dlg" aria-label="إغلاق">✕</button></div><div class="fields"><label class="f" style="grid-column:span 2"><span>الاسم</span><input name="name" value="'+esc(g.name)+'" required></label><label class="f"><span>اللون</span><select name="color">'+PHEX.map(function(c,i){return '<option value="'+i+'"'+(+g.color===i?' selected':'')+' style="color:'+c+'">■ لون '+(i+1)+'</option>'}).join('')+'</select></label></div>'+
  '<div class="dlg-f">'+(fresh?'<span></span>':'<div class="toolbar"><button type="button" class="btn danger" data-act="del-grp" data-v="'+g.id+'">حذف</button><button type="button" class="btn" data-act="mv-grp" data-v="'+g.id+'" data-d="-1">↑ لأعلى</button><button type="button" class="btn" data-act="mv-grp" data-v="'+g.id+'" data-d="1">↓ لأسفل</button></div>')+'<div class="toolbar"><button type="button" class="btn" data-act="close-dlg">إلغاء</button><button class="btn primary" value="ok">حفظ</button></div></div>',
  function(f){mutate(function(){var x=fresh?g:state.groups[grpIdx(g.id)];x.name=f.elements['name'].value.trim()||'مجموعة';x.color=+f.elements.color.value;if(fresh)state.groups.push(x)})});
}
document.addEventListener('submit',function(e){if(e.target.closest('#dlg')){e.preventDefault();var d=dlg(),fn=d._save;var f=e.target;if(!f.checkValidity()){f.reportValidity();return}d._cancel=null;closeDlg();if(fn)fn(f)}},true);
document.addEventListener('close',function(e){if(e.target&&e.target.id==='dlg'&&e.target._cancel){var c=e.target._cancel;e.target._cancel=null;c()}},true);

/* ================= work plan ================= */
function planTable(c,cols,rows,foot){
  return '<div class="tw"><table class="t"><thead><tr>'+cols.map(function(x){return '<th'+(x[2]?' class="n"':'')+'>'+x[0]+'</th>'}).join('')+'<th></th></tr></thead><tbody>'+rows.map(function(r){return '<tr>'+cols.map(function(x){var f=x[1];return '<td'+(x[2]?' class="n"':'')+'>'+(typeof f==='function'?f(r):x[2]?inp(c,r,f,'number'):x[3]?txa(c,r,f):inp(c,r,f))+'</td>'}).join('')+'<td>'+rowActs(c,r,true)+'</td></tr>'}).join('')+'</tbody>'+(foot||'')+'</table></div>';
}
function rateDur(r){var b=boqById(r.boq),q=b?num(b.qty):0,d=num(r.crews)*num(r.daily);return d?Math.ceil(q/d):0}
function renderPlan(p){
  var secs=state.sections.map(function(s,i){return '<div class="sec'+(s.rep?'':' off')+'"><div class="sec-h"><input class="in" '+B('sections',s.id,'title')+' value="'+esc(s.title)+'" style="flex:1"><label class="chk" title="يظهر في التقرير"><input type="checkbox" '+B('sections',s.id,'rep')+(s.rep?' checked':'')+'>في التقرير</label><button class="btn icon ghost" data-act="mv" data-c="sections" data-id="'+s.id+'" data-d="-1" aria-label="لأعلى"'+(i?'':' disabled')+'>↑</button><button class="btn icon ghost" data-act="mv" data-c="sections" data-id="'+s.id+'" data-d="1" aria-label="لأسفل"'+(i<state.sections.length-1?'':' disabled')+'>↓</button><button class="btn icon ghost danger" data-act="del" data-c="sections" data-id="'+s.id+'" aria-label="حذف">✕</button></div><div class="sec-b"><textarea '+B('sections',s.id,'body')+'>'+esc(s.body)+'</textarea></div></div>'}).join('');
  var tc=state.team.reduce(function(s,r){return s+num(r.count)},0),ec=state.equip.reduce(function(s,r){return s+num(r.count)},0);
  var rd=0;state.rates.forEach(function(r){rd+=rateDur(r)});
  p.innerHTML='<div class="grid2" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)">'+
  '<div class="panel"><div class="card-h"><h2>خطة العمل وأسلوب التنفيذ</h2><button class="btn" data-act="add-sec">+ قسم جديد</button></div>'+secs+'</div>'+
  '<div class="panel">'+
   '<div class="card"><div class="card-h"><h3>معدلات الإنتاج وتوزيع الفرق</h3><button class="btn sm" data-act="add-row" data-c="rates">+ صف</button></div>'+
    planTable('rates',[[TM('itemCol'),function(r){return boqSel('rates',r,'boq')}],['المجموعات','crews',1],['أفراد/مجموعة','per',1],['المستهدف اليومي/مجموعة','daily',1],['الإجمالي اليومي',function(r){return qn(num(r.crews)*num(r.daily))},1],['الكمية',function(r){var b=boqById(r.boq);return b?qn(num(b.qty)):'—'},1],['المدة (يوم)',function(r){return '<b>'+rateDur(r)+'</b>'},1]],state.rates,'<tfoot><tr><td colspan="6">إجمالي أيام العمل الفعلية</td><td class="n">'+rd+'</td><td></td></tr></tfoot>')+
    '<p class="hint">المدة = الكمية ÷ (عدد المجموعات × المستهدف اليومي). يمكنك تطبيقها على مهام '+TM('verbAl')+' في الجدول الزمني وترتيب التنفيذ.</p><div class="toolbar"><button class="btn sm" data-act="apply-rates">تطبيق المدد على الجدول</button><button class="btn sm" data-act="rechain" data-v="1">ترتيب: من الأصغر للأكبر</button><button class="btn sm" data-act="rechain" data-v="-1">ترتيب: من الأكبر للأصغر</button></div></div>'+
   '<div class="card"><div class="card-h"><h3>فريق العمل</h3><button class="btn sm" data-act="add-row" data-c="team">+ وظيفة</button></div>'+planTable('team',[['الوظيفة','role'],['سنوات الخبرة','exp',1],['العدد','count',1]],state.team,'<tfoot><tr><td colspan="2">الإجمالي</td><td class="n">'+qn(tc)+'</td><td></td></tr></tfoot>')+'</div>'+
   '<div class="card"><div class="card-h"><h3>المعدات والأدوات</h3><button class="btn sm" data-act="add-row" data-c="equip">+ معدة</button></div>'+planTable('equip',[['المعدة','name'],['العدد','count',1],['ملاحظات','notes']],state.equip,'<tfoot><tr><td>الإجمالي</td><td class="n">'+qn(ec)+'</td><td colspan="2"></td></tr></tfoot>')+'</div>'+
  '</div></div>'+
  '<div class="card"><div class="card-h"><h3>سجل المخاطر وخطط التخفيف</h3><button class="btn sm" data-act="add-row" data-c="risks">+ خطر</button></div>'+planTable('risks',[['الخطر',function(r){return txa('risks',r,'risk')}],['الاحتمالية',function(r){return sel('risks',r,'level',['منخفضة','متوسطة','عالية'])}],['الوصف',function(r){return txa('risks',r,'desc')}],['إجراءات التخفيف',function(r){return txa('risks',r,'mit')}]],state.risks)+'</div>'+
  '<div class="card"><div class="card-h"><h3>شروط مجال العمل</h3><button class="btn sm" data-act="add-row" data-c="conditions">+ شرط</button></div>'+planTable('conditions',[['#',function(r){return state.conditions.indexOf(r)+1},1],['الشرط',function(r){return txa('conditions',r,'text')}]],state.conditions)+'</div>';
}
function rechain(dir){
  mutate(function(){
    var ins=state.tasks.filter(function(t){return t.link&&t.link!=='supply'&&boqById(t.link)});if(ins.length<2)return;
    var set={};ins.forEach(function(t){set[t.id]=1});
    var first=ins.filter(function(t){return !t.preds.some(function(p){return set[p.id]})})[0]||ins[0];
    var head=first.preds.filter(function(p){return !set[p.id]});
    var sorted=ins.slice().sort(function(a,b){return dir*(num(boqById(a.link).dia)-num(boqById(b.link).dia))});
    sorted.forEach(function(t,i){t.preds=i?[{id:sorted[i-1].id,type:'FS',lag:0}].concat(t.preds.filter(function(p){return !set[p.id]&&!head.some(function(h){return h.id===p.id})})):head.concat(t.preds.filter(function(p){return !set[p.id]&&!head.some(function(h){return h.id===p.id})}))});
    var last=sorted[sorted.length-1];
    state.tasks.forEach(function(t){if(set[t.id])return;var had=t.preds.some(function(p){return set[p.id]});if(had){t.preds=t.preds.filter(function(p){return !set[p.id]});t.preds.push({id:last.id,type:'FS',lag:0})}});
    var others=state.tasks.filter(function(t){return !set[t.id]}),pos=state.tasks.indexOf(ins[0]);
    var before=state.tasks.slice(0,pos).filter(function(t){return !set[t.id]}),after=others.filter(function(t){return before.indexOf(t)<0});
    state.tasks=before.concat(sorted,after);
  });
  toast(dir>0?'تم ترتيب '+TM('verbAl')+' من الأصغر للأكبر':'تم ترتيب '+TM('verbAl')+' من الأكبر للأصغر');
}

/* ================= settings ================= */
function fld(c,f,label,type,extra){var o=coll(c);return '<label class="f'+(extra&&extra.wide?' wide':'')+'"><span>'+label+'</span>'+(type==='area'?'<textarea '+B(c,'',f)+' rows="2">'+esc(o[f]||'')+'</textarea>':'<input type="'+(type||'text')+'" '+B(c,'',f)+(type==='number'?' data-t="num" step="any"':'')+' value="'+esc(o[f]==null?'':o[f])+'">')+'</label>'}
function renderSettings(p){
  var m=state.meta;
  p.innerHTML='<div class="card"><h2>بيانات المشروع</h2><div class="fields">'+fld('meta','name','اسم المشروع','text',{wide:1})+fld('meta','short','الاسم المختصر (لترويسة التقرير)')+fld('meta','client','الجهة المالكة')+fld('meta','po','رقم أمر الشراء / العقد')+fld('meta','location','الموقع')+fld('meta','contractor','المقاول')+fld('meta','preparer','معد التقرير / مدير المشروع')+fld('meta','engineer','المهندس المشرف / المقيم')+'</div></div>'+
  '<div class="card"><h2>نوع المشروع والمسميات</h2><p class="hint">تحدد الكلمات المستخدمة في البرنامج والتقارير: سجل التنفيذ، ووحدة القياس، والفعل.</p><div class="fields"><label class="f"><span>نوع المشروع</span><select '+B('meta','','kind')+'><option value="valves"'+(m.kind!=='works'?' selected':'')+'>توريد وتركيب محابس</option><option value="works"'+(m.kind==='works'?' selected':'')+'>أعمال عامة / محطات / مقاولات</option></select></label>'+
  ['log','unit','verb'].map(function(k){var lb={log:'اسم سجل التنفيذ',unit:'الوحدة (مفرد)',verb:'الفعل'}[k],base=TERMS[m.kind==='works'?'works':'valves'][k];return '<label class="f"><span>'+lb+'</span><input '+B('meta','','terms.'+k)+' value="'+esc((m.terms||{})[k]||'')+'" placeholder="'+esc(base)+'"></label>'}).join('')+'</div></div>'+
  '<div class="card"><h2>المدة والقيمة</h2><div class="fields">'+fld('meta','start','تاريخ بدء العقد','date')+fld('meta','end','تاريخ الانتهاء التعاقدي','date')+'<div class="f"><span>المدة الأصلية</span><b class="num" style="padding:6px 0">'+(cEnd()-cStart()+1)+' يوماً تقويمياً</b></div>'+fld('meta','value','قيمة العقد قبل الضريبة (إن لم تُدخل أسعار الوحدات)','number')+fld('meta','vat','ضريبة القيمة المضافة %','number')+fld('meta','currency','العملة')+fld('meta','supplyPct','نسبة احتساب الكميات الموردة غير المنفذة من قيمة البند %','number')+'</div>'+
  '<div class="f"><span>أيام العطلة الأسبوعية (لا يُحسب فيها عمل في الجدول)</span><div class="toolbar">'+DOWS.map(function(d,i){return '<label class="chk"><input type="checkbox" data-wk="'+i+'"'+(m.weekend.indexOf(i)>=0?' checked':'')+'>'+d+'</label>'}).join('')+'</div></div></div>'+
  '<div class="card"><h2>الشعار</h2><div class="toolbar">'+(logoSrc()?'<img src="'+logoSrc()+'" alt="" style="height:60px;background:#fff;border-radius:6px;padding:2px">':'')+'<label class="btn">تغيير الشعار<input type="file" accept="image/*" data-act-logo hidden></label>'+(m.logo?'<button class="btn" data-act="logo-reset">استعادة الشعار الافتراضي</button>':'')+'</div></div>'+
  storageCard()+'<div class="card"><h2>الحفظ والنقل</h2><p class="hint">التعديلات تُحفظ تلقائياً في هذا المتصفح. لنسخة دائمة أو لنقلها لجهاز آخر: «حفظ نسخة HTML محدّثة» يحمّل ملف الصفحة كاملاً بكل بياناتك (افتحه بدل القديم)، و«تصدير ملف المشروع» يحمّل ملف بيانات JSON يمكن فتحه لاحقاً.</p><div class="toolbar"><button class="btn primary" data-act="save-html">حفظ نسخة HTML محدّثة</button><button class="btn" data-act="export-json">تصدير ملف المشروع (JSON)</button><label class="btn">فتح ملف مشروع (JSON أو Excel)<input type="file" accept=".json,.xlsx,application/json" data-act-import hidden></label><button class="btn" data-act="csv" data-v="installs">CSV '+TM('log')+'</button><button class="btn" data-act="csv" data-v="supplies">CSV التوريدات</button><button class="btn" data-act="csv" data-v="expenses">CSV المصاريف</button><span class="grow"></span><button class="btn danger" data-act="reset">استعادة الخطة الافتراضية</button></div></div>'+
  '<div class="card"><h2>المظهر</h2><div class="seg">'+[['','تلقائي'],['light','فاتح'],['dark','داكن']].map(function(x){return '<button data-act="theme" data-v="'+x[0]+'" aria-pressed="'+((document.documentElement.getAttribute('data-theme')||'')===x[0])+'">'+x[1]+'</button>'}).join('')+'</div></div>'+
  '<div class="card"><h2>عن البرنامج</h2><dl class="facts"><dt>البرنامج</dt><dd>متابعة المشاريع</dd><dt>تصميم وبرمجة</dt><dd>م. ياسر محمد عبدالجابر</dd><dt>الإصدار</dt><dd class="num" id="app-ver">'+(DESK?'…':'نسخة المتصفح')+'</dd><dt>حقوق الطبع</dt><dd>© '+Math.max(2026,new Date().getFullYear())+' م. ياسر محمد عبدالجابر. جميع الحقوق محفوظة. لا يجوز نسخ البرنامج أو توزيعه أو تعديله دون إذن كتابي من المؤلف.</dd></dl></div>';
  if(DESK&&HOST.info)HOST.info().then(function(i){var a=$('#db-path');if(a)a.textContent=i.dbPath;var b=$('#app-ver');if(b)b.textContent=i.version})
}
document.addEventListener('change',function(e){
  var t=e.target;
  if(t.hasAttribute('data-wk')){var i=+t.getAttribute('data-wk');mutate(function(){var w=state.meta.weekend.filter(function(x){return x!==i});if(t.checked)w.push(i);w.sort();if(w.length>=7)w=[5];state.meta.weekend=w});return}
  if(t.hasAttribute('data-act-logo')&&t.files[0]){var fr=new FileReader();fr.onload=function(){shrink(fr.result,600,function(u){mutate(function(){state.meta.logo=u})})};fr.readAsDataURL(t.files[0]);return}
  if(t.hasAttribute('data-act-import')&&t.files[0]){var r2=new FileReader();r2.onload=function(){try{var o=asProject(JSON.parse(r2.result));if(!o)throw 0;ask('سيتم استبدال بيانات المشروع الحالية بالملف المختار. متابعة؟','استبدال البيانات').then(function(ok){if(!ok)return;snap();state=normalize(o);saveDraft();sched();renderAll();toast('تم فتح ملف المشروع')})}catch(err){toast('الملف غير صالح')}};var f0=t.files[0];if(/\.xlsx$/i.test(f0.name)){f0.arrayBuffer().then(readXlsxState).then(function(o){if(!o){toast('ملف Excel لا يحتوي على بيانات المشروع (استخدم نسخة Excel الكاملة)');return}ask('سيتم استبدال بيانات المشروع الحالية ببيانات ملف Excel. متابعة؟','استبدال البيانات').then(function(ok){if(!ok)return;snap();state=normalize(o);saveDraft();sched();renderAll();toast('تم فتح البيانات من ملف Excel')})}).catch(function(){toast('تعذّر قراءة ملف Excel')})}else r2.readAsText(f0);t.value=''}
});
function shrink(src,w,cb){var im=new Image();im.onload=function(){var s=Math.min(1,w/im.width),c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);var x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);cb(c.toDataURL('image/jpeg',.85))};im.onerror=function(){cb(src)};im.src=src}

/* ================= report pages ================= */
var RSECS=[['cover','بيانات المشروع والتقرير'],['summary','ملخص الموقف'],['boq','حصر الأعمال (الكميات)'],['monthly','ملخص التنفيذ الشهري'],['schedule','الجدول الزمني (جدول)'],['gantt','المخطط الزمني (Gantt)'],['events','أوامر الإيقاف وإضافة المدد'],['installs','سجل الأعمال المنفذة'],['supplies','سجل التوريدات'],['expenses','المصاريف'],['plan','خطة العمل (الأقسام المختارة)'],['rates','معدلات الإنتاج'],['team','فريق العمل'],['equip','المعدات'],['risks','سجل المخاطر'],['conditions','شروط مجال العمل'],['notes','ملاحظات'],['sign','التوقيعات']];
function repRange(){var R=state.report,a=R.from?dnum(R.from):-Infinity,b=R.to?dnum(R.to):todayNum();if(isNaN(a))a=-Infinity;if(isNaN(b))b=todayNum();return {a:a,b:b}}
function inR(r,g){var d=dnum(r.date);return !isNaN(d)&&d>=g.a&&d<=g.b}
function buildPages(host){
  var R=state.report,S=R.secs,m=state.meta,g=repRange(),asOf=g.b,c=esc(m.currency),pages=[],body;
  var lg=logoSrc(),foot=R.footer&&ASSETS.footer&&!m.logo;
  function page(){
    var p=el('div','rp');
    p.innerHTML='<div class="rp-h"><div class="tt"><b>'+esc(R.title||'تقرير')+(R.no?' رقم '+esc(R.no):'')+'</b><span>'+esc(m.short||m.name)+'</span><span>حتى تاريخ '+fs(asOf)+'</span></div>'+(lg?'<img src="'+lg+'" alt="">':'')+'</div><div class="rp-b"></div><div class="rp-f"><div class="pg"><span>'+esc(m.contractor)+'</span><span class="pn"></span></div>'+(foot?'<img src="'+ASSETS.footer+'" alt="">':'')+'</div>';
    host.appendChild(p);pages.push(p);body=$('.rp-b',p);return body;
  }
  function over(){return body.scrollHeight>body.clientHeight+1}
  function flow(node){body.appendChild(node);if(over()&&body.children.length>1){body.removeChild(node);page();body.appendChild(node)}}
  function section(){if(R.breaks&&body.children.length)page()}
  function h2(t){return el('h2',null,esc(t))}
  function block(title,html){var d=el('div');d.style.cssText='display:flex;flex-direction:column;gap:6px';d.innerHTML=(title?'<h2>'+esc(title)+'</h2>':'')+html;return d}
  function table(title,head,rows,foot){
    if(!rows.length&&!foot)return;
    section();
    var mk=function(t){var w=el('div');w.style.cssText='display:flex;flex-direction:column;gap:6px';w.innerHTML=(t?'<h2>'+esc(t)+'</h2>':'')+'<table><thead><tr>'+head.map(function(h){return '<th>'+h+'</th>'}).join('')+'</tr></thead><tbody></tbody></table>';return w};
    var w=mk(title),tb=$('tbody',w);flow(w);
    var all=rows.slice();if(foot)all.push({foot:foot});
    all.forEach(function(r){
      var tr=el('tr',r.foot?'tot':null,r.foot||r);tb.appendChild(tr);
      if(over()){tb.removeChild(tr);if(!tb.children.length){body.removeChild(w);page();flow(w);tb.appendChild(tr);return}page();w=mk(title?title+' (تابع)':'');tb=$('tbody',w);body.appendChild(w);tb.appendChild(tr)}
    });
  }
  function paras(title,text){
    section();var ps=String(text||'').split('\n').filter(function(s){return s.trim()});
    var first=el('div');first.style.cssText='display:flex;flex-direction:column;gap:3px';first.innerHTML='<h2>'+esc(title)+'</h2>'+(ps.length?'<p>'+esc(ps[0])+'</p>':'');flow(first);
    ps.slice(1).forEach(function(s){var q=el('p',null,esc(s));flow(q)});
  }
  page();
  var o=overall(asOf),v=valueStats(asOf);
  if(S.cover){
    flow(block('','<div class="cover"><div class="ti">'+esc(R.title||'تقرير')+'</div><div class="pj">'+esc(m.name)+'</div><div>'+(R.from?'عن الفترة من '+fs(g.a)+' إلى '+fs(g.b):'حتى تاريخ '+fl(asOf))+(R.no?' · تقرير رقم '+esc(R.no):'')+'</div></div>'+
    '<div class="info">'+[['الجهة المالكة',m.client],['رقم أمر الشراء',m.po],['الموقع',m.location],['المقاول',m.contractor],['تاريخ البدء',fs(cStart())],['تاريخ الانتهاء الأصلي',fs(cEnd())],['تاريخ الانتهاء المعدّل',fs(revEnd())],['تاريخ التقرير',fs(todayNum())]].concat(m.engineer?[['المهندس المشرف',m.engineer]]:[]).concat(m.preparer?[['مدير المشروع',m.preparer]]:[]).map(function(x){return '<div><span>'+x[0]+':</span><b>'+esc(x[1]||'—')+'</b></div>'}).join('')+'</div>'));
  }
  if(S.summary){
    section();
    var cs=cStart(),re=revEnd(),dur=re-cs+1,elp=clamp(asOf-cs+1,0,dur);
    var pIn=state.installs.filter(function(r){return inR(r,g)}).reduce(function(s,r){return s+num(r.qty)},0);
    var exps=state.expenses.filter(function(r){return !r.hide&&inR(r,g)});
    var k=[['نسبة '+TM('verbAl')+' الفعلية',pct(o.act)+'%','المخطط '+pct(o.plan)+'%'],[''+TM('log')+'',qn(o.inst),'من '+qn(o.q)+' '+TM('unit')+''],['المركب خلال الفترة',qn(pIn),R.from?fs(g.a)+' – '+fs(g.b):'حتى '+fs(g.b)],[''+TM('items')+' الموردة',qn(o.sup),pct(o.sp)+'% من الكمية'],
      ['المدة المنقضية',elp+' يوم','من '+dur+' يوماً ('+pct(elp/dur)+'%)'],['المتبقي من المدة',(re-asOf>=0?(re-asOf)+' يوم':'متجاوزة'),'حتى '+fs(re)],['الإيقاف / التمديد','+'+addDays()+' يوم','إيقاف '+stopDays()+' · تمديد '+extDays()],(S.expenses?['المصاريف',money(expTotal(exps)),c+(R.from?' خلال الفترة':'')]:(v.tot&&R.prices?['قيمة المنفذ',money(v.ex),c]:['المهام المتأخرة',String(state.tasks.filter(function(t){return !t.ms&&statusOf(t)==='late'}).length),'مهمة']))];
    var gap=o.act-o.plan;
    var txt='بلغت نسبة '+TM('verbAl')+' الفعلية '+pct(o.act)+'% مقابل '+pct(o.plan)+'% مخطط حتى تاريخ '+fs(asOf)+'، حيث تم '+TM('verb')+' '+qn(o.inst)+' '+TM('unit2')+' من أصل '+qn(o.q)+'، وتوريد '+qn(o.sup)+' '+TM('unit2')+'. '+(o.q?(gap>=-0.005?'الأعمال مطابقة للجدول الزمني أو متقدمة عليه.':'الأعمال متأخرة عن الجدول الزمني بنسبة '+pct(-gap)+'%.'):'')+(addDays()?' أضيف للمدة التعاقدية '+addDays()+' يوماً بسبب أوامر الإيقاف/التمديد، ليصبح تاريخ الانتهاء المعدّل '+fl(re)+'.':'');
    flow(block('ملخص الموقف','<div class="kp">'+k.map(function(x){return '<div><span>'+x[0]+'</span><b>'+x[1]+'</b><small>'+esc(x[2])+'</small></div>'}).join('')+'</div><p class="note">'+esc(txt)+'</p>'));
  }
  if(S.boq){
    var tq=0,ts=0,tp=0,ti=0,tv=0,te=0,pr=R.prices&&v.hasRates;
    var rows=state.boq.filter(function(b){return !b.hide}).map(function(b){var q=num(b.qty),s=suppliedOf(b.id,asOf),i=installedOf(b.id,asOf),pi=state.installs.filter(function(r){return r.boq===b.id&&inR(r,g)}).reduce(function(x,r){return x+num(r.qty)},0),r=rateOf(b);tq+=q;ts+=s;ti+=i;tp+=pi;tv+=q*r;te+=Math.min(i,q)*r;
      return '<td>'+esc(b.no)+'</td><td>'+esc(b.dia?b.dia+' بوصة':'—')+'</td><td>'+esc(b.unit)+'</td><td>'+qn(q)+'</td><td>'+qn(s)+'</td>'+(R.from?'<td>'+qn(pi)+'</td>':'')+'<td>'+qn(i)+'</td><td>'+qn(Math.max(0,q-i))+'</td><td><div class="rb"><i style="width:'+pct(q?Math.min(1,i/q):0)+'%"></i></div>'+pct(q?i/q:0)+'%</td>'+(pr?'<td>'+money(r)+'</td><td>'+money(Math.min(i,q)*r)+'</td>':'')});
    table('حصر الأعمال – الموقف حتى '+fs(asOf),['البند',TM('diaCol'),'الوحدة','الكمية التعاقدية','الموَرَّد'].concat(R.from?['مركب خلال الفترة']:[]).concat(['المركب (تراكمي)','المتبقي','نسبة الإنجاز']).concat(pr?['سعر الوحدة','قيمة المنفذ']:[]),rows,'<td colspan="3">الإجمالي</td><td>'+qn(tq)+'</td><td>'+qn(ts)+'</td>'+(R.from?'<td>'+qn(tp)+'</td>':'')+'<td>'+qn(ti)+'</td><td>'+qn(Math.max(0,tq-ti))+'</td><td>'+pct(tq?ti/tq:0)+'%</td>'+(pr?'<td></td><td>'+money(te)+'</td>':''));
    if(pr)flow(block('','<p class="note">قيمة العقد قبل الضريبة: <b>'+money(tv)+' '+c+'</b> · قيمة الأعمال المنفذة: <b>'+money(v.ex)+' '+c+'</b> ('+pct(tv?v.ex/tv:0)+'%)'+(num(m.vat)?' · شامل الضريبة: '+money(v.ex*(1+v.vat))+' '+c:'')+'</p>'));
  }
  if(S.monthly){
    var ms={},bl=state.boq.filter(function(b){return !b.hide});
    state.installs.forEach(function(r){if(!inR(r,g))return;var d=new Date(dnum(r.date)*DAY),k2=d.getUTCFullYear()*100+d.getUTCMonth();ms[k2]=ms[k2]||{};ms[k2][r.boq]=(ms[k2][r.boq]||0)+num(r.qty)});
    var keys=Object.keys(ms).sort(),cum=0,colT={};
    var mrows=keys.map(function(k2){var y=Math.floor(k2/100),mo=k2%100,t=0;var cells=bl.map(function(b){var x=ms[k2][b.id]||0;t+=x;colT[b.id]=(colT[b.id]||0)+x;return '<td>'+(x?qn(x):'–')+'</td>'}).join('');cum+=t;return '<td class="tx">'+fMon.format(new Date(Date.UTC(y,mo,1)))+'</td>'+cells+'<td><b>'+qn(t)+'</b></td><td>'+qn(cum)+'</td>'});
    if(mrows.length)table('ملخص '+TM('verbAl')+' الشهري',['الشهر'].concat(bl.map(function(b){return esc(b.dia?b.dia+'"':b.no)})).concat(['الإجمالي','التراكمي']),mrows,'<td>الإجمالي</td>'+bl.map(function(b){return '<td>'+qn(colT[b.id]||0)+'</td>'}).join('')+'<td>'+qn(cum)+'</td><td></td>');
  }
  if(S.schedule){
    var srows=state.tasks.map(function(t){var st=statusOf(t),a=actualOf(t),pr2=progOf(t,asOf);return '<td>'+esc(t.code)+'</td><td class="tx">'+esc(t.name)+'</td><td>'+(t.ms?'معلم':t.dur)+'</td><td>'+(t.bs?fs(dnum(t.bs)):'—')+'</td><td>'+(t.bf?fs(dnum(t.bf)):'—')+'</td><td>'+fs(tS(t))+'</td><td>'+fs(tF(t))+'</td><td>'+(isNaN(a.s)?'—':fs(a.s))+'</td><td>'+(isNaN(a.f)?'—':fs(a.f))+'</td><td>'+pct(pr2)+'%</td><td class="'+(st==='done'?'ok':st==='late'?'bad':st==='active'?'wr':'')+'">'+STL[st]+'</td>'});
    table('الجدول الزمني',['الرمز','المهمة','المدة','بداية الأساس','نهاية الأساس','البداية المخططة','النهاية المخططة','البداية الفعلية','النهاية الفعلية','الإنجاز','الحالة'],srows);
  }
  if(S.gantt){
    section();
    var lo=cStart(),hi=Math.max(projEnd(),revEnd());state.tasks.forEach(function(t){if(t.bf)hi=Math.max(hi,dnum(t.bf))});lo-=3;hi+=5;
    var span=hi-lo+1,P=function(d){return pct((d-lo)/span)};
    var hd='';for(var d=lo;d<=hi;d++){var dt=new Date(d*DAY);if(dt.getUTCDate()===1){var mo2=dt.getUTCMonth();if(span<500||mo2%2===0)hd+='<span style="right:'+P(d+14)+'%">'+fMonS.format(dt)+(mo2===0?' '+String(dt.getUTCFullYear()).slice(2):'')+'</span>'}}
    var stp=state.events.filter(function(e){return e.type!=='ext'&&e.from}).map(function(e){var a=dnum(e.from),b=e.to?dnum(e.to):Math.max(a,asOf);return '<s style="right:'+P(a)+'%;width:'+pct((b-a+1)/span)+'%"></s>'}).join('')+(asOf>=lo&&asOf<=hi?'<em style="right:'+P(asOf)+'%"></em>':'');
    var mkH=function(t){var w=el('div');w.style.cssText='display:flex;flex-direction:column';w.innerHTML=(t?'<h2 style="margin-bottom:6px">'+esc(t)+'</h2>':'')+'<div class="gr hd"><span class="gn">المهمة</span><div class="gt">'+hd+'</div></div>';return w};
    var gw=mkH('المخطط الزمني'),grow=function(t){var s=tS(t),f=tF(t),r=el('div','gr'),pr3=progOf(t,asOf),col=taskHex(t);
      var nm=String(t.name||'');if(nm.length>46)nm=nm.slice(0,45).trim()+'…';
      r.innerHTML='<span class="gn"><span style="color:#5A6B73">'+esc(t.code)+'</span> '+esc(nm)+'</span><div class="gt">'+stp+(t.ms?'<i style="right:calc('+P(s)+'% - 5px);width:10px;height:10px;transform:rotate(45deg);background:'+(t.color||'#0F2129')+';top:4px"></i>':'<i style="right:'+P(s)+'%;width:'+pct((f-s+1)/span)+'%;background:'+col+'55"><b style="width:'+pct(pr3)+'%;background:'+col+'"></b></i>')+(t.bs&&t.bf&&!t.ms?'<u style="right:'+P(dnum(t.bs))+'%;width:'+pct((dnum(t.bf)-dnum(t.bs)+1)/span)+'%"></u>':'')+'<small style="right:calc('+P(t.ms?s+1:f+1)+'% + 3px)">'+pct(pr3)+'%</small></div>';return r};
    flow(gw);
    state.tasks.forEach(function(t){var r=grow(t);gw.appendChild(r);if(over()){gw.removeChild(r);page();gw=mkH('المخطط الزمني (تابع)');body.appendChild(gw);gw.appendChild(r)}});
    flow(block('','<p style="font-size:9.5px;color:#5A6B73">العمود الملون: المدة المخططة (الجزء الداكن نسبة الإنجاز) · الخط الرمادي: خط الأساس · المظلل الأحمر: فترات الإيقاف · الخط الأحمر: تاريخ التقرير.</p>'));
  }
  if(S.events){
    var ev=state.events.filter(function(e){return !e.hide});
    table('أوامر الإيقاف وإضافة المدد',['النوع','رقم الأمر','تاريخ الإصدار','من','حتى','الأيام','يضاف للمدة','السبب'],ev.map(function(e){var x=e.type==='ext';return '<td>'+EVT[e.type]+'</td><td>'+esc(e.ref||'—')+'</td><td>'+fsi(e.date)+'</td><td>'+(x?'—':fsi(e.from))+'</td><td>'+(x?'—':e.to?fsi(e.to):'<span class="bad">سارٍ</span>')+'</td><td>'+evDays(e)+'</td><td>'+(evAdds(e)?'نعم':'لا')+'</td><td class="tx">'+esc(e.reason||'')+'</td>'}),ev.length?'<td colspan="5">إجمالي المضاف للمدة – تاريخ الانتهاء المعدّل '+fs(revEnd())+'</td><td>'+addDays()+'</td><td colspan="2"></td>':null);
  }
  if(S.installs){
    var il=state.installs.filter(function(r){return !r.hide&&inR(r,g)&&boqById(r.boq)}).sort(function(a,b){return dnum(a.date)-dnum(b.date)}),it=0;
    table('سجل '+TM('log')+''+(R.from?' خلال الفترة':''),['#','التاريخ',TM('itemCol'),'العدد','الموقع','الرقم التسلسلي','اختبار الضغط','انقطاع (س)','ملاحظات'],il.map(function(r,i){it+=num(r.qty);return '<td>'+(i+1)+'</td><td>'+fsi(r.date)+'</td><td>'+esc(boqShort(r.boq))+'</td><td>'+qn(num(r.qty))+'</td><td class="tx">'+esc(r.loc||'')+'</td><td>'+esc(r.serial||'')+'</td><td class="'+(r.test==='ناجح'?'ok':r.test==='غير ناجح'?'bad':'')+'">'+esc(r.test||'')+'</td><td>'+(r.shut===''||r.shut==null?'':qn(num(r.shut)))+'</td><td class="tx">'+esc(r.notes||'')+'</td>'}),il.length?'<td colspan="3">الإجمالي</td><td>'+qn(it)+'</td><td colspan="5"></td>':null);
  }
  if(S.supplies){
    var sl=state.supplies.filter(function(r){return !r.hide&&inR(r,g)&&boqById(r.boq)}).sort(function(a,b){return dnum(a.date)-dnum(b.date)}),st2=0;
    table('سجل التوريدات'+(R.from?' خلال الفترة':''),['#','التاريخ',TM('itemCol'),'العدد','المورد','رقم السند','ملاحظات'],sl.map(function(r,i){st2+=num(r.qty);return '<td>'+(i+1)+'</td><td>'+fsi(r.date)+'</td><td>'+esc(boqShort(r.boq))+'</td><td>'+qn(num(r.qty))+'</td><td class="tx">'+esc(r.supplier||'')+'</td><td>'+esc(r.ref||'')+'</td><td class="tx">'+esc(r.notes||'')+'</td>'}),sl.length?'<td colspan="3">الإجمالي</td><td>'+qn(st2)+'</td><td colspan="3"></td>':null);
  }
  if(S.expenses){
    var el2=state.expenses.filter(function(r){return !r.hide&&inR(r,g)}).sort(function(a,b){return dnum(a.date)-dnum(b.date)}),bc={},et=expTotal(el2);
    el2.forEach(function(r){bc[r.cat||'أخرى']=(bc[r.cat||'أخرى']||0)+expTot(r)});
    var ck=Object.keys(bc).sort(function(a,b){return bc[b]-bc[a]});
    table('المصاريف حسب التصنيف'+(R.from?' خلال الفترة':''),['التصنيف','المبلغ ('+c+')','النسبة'],ck.map(function(k){return '<td class="tx">'+esc(k)+'</td><td>'+money(bc[k])+'</td><td><div class="rb"><i style="width:'+pct(et?bc[k]/et:0)+'%"></i></div>'+pct(et?bc[k]/et:0)+'%</td>'}),ck.length?'<td>الإجمالي</td><td>'+money(et)+'</td><td></td>':null);
    var en=el2.reduce(function(s,r){return s+expNet(r)},0),ev=el2.reduce(function(s,r){return s+expVat(r)},0);
    table('تفاصيل المصاريف',['#','التاريخ','التصنيف','البيان','الكمية','سعر الوحدة','قبل الضريبة','الضريبة','الإجمالي','المورد','الفاتورة'],el2.map(function(r,i){return '<td>'+(i+1)+'</td><td>'+fsi(r.date)+'</td><td>'+esc(r.cat||'')+'</td><td class="tx">'+esc(r.desc||'')+'</td><td>'+(num(r.qty)?qn(num(r.qty)):'')+'</td><td>'+(num(r.price)?money(num(r.price)):'')+'</td><td>'+money(expNet(r))+'</td><td>'+(expVat(r)?money(expVat(r)):'–')+'</td><td><b>'+money(expTot(r))+'</b></td><td class="tx">'+esc(r.vendor||'')+'</td><td>'+esc(r.ref||'')+'</td>'}),el2.length?'<td colspan="6">الإجمالي</td><td>'+money(en)+'</td><td>'+money(ev)+'</td><td>'+money(et)+'</td><td colspan="2"></td>':null);
  }
  if(S.plan)state.sections.filter(function(s){return s.rep}).forEach(function(s){paras(s.title,s.body)});
  if(S.rates){var rt=0;table('معدلات الإنتاج وتوزيع الفرق',[TM('itemCol'),'المجموعات','أفراد/مجموعة','المستهدف اليومي/مجموعة','الإجمالي اليومي','الكمية','المدة (يوم)'],state.rates.map(function(r){var b=boqById(r.boq);rt+=rateDur(r);return '<td>'+esc(boqName(r.boq))+'</td><td>'+qn(num(r.crews))+'</td><td>'+qn(num(r.per))+'</td><td>'+qn(num(r.daily))+'</td><td>'+qn(num(r.crews)*num(r.daily))+'</td><td>'+(b?qn(num(b.qty)):'')+'</td><td>'+rateDur(r)+'</td>'}),'<td colspan="6">إجمالي أيام العمل الفعلية</td><td>'+rt+'</td>')}
  if(S.team)table('فريق العمل',['#','الوظيفة','سنوات الخبرة','العدد'],state.team.map(function(r,i){return '<td>'+(i+1)+'</td><td class="tx">'+esc(r.role)+'</td><td>'+esc(r.exp)+'</td><td>'+esc(r.count)+'</td>'}),'<td colspan="3">الإجمالي</td><td>'+qn(state.team.reduce(function(s,r){return s+num(r.count)},0))+'</td>');
  if(S.equip)table('المعدات والأدوات',['#','المعدة','العدد','ملاحظات'],state.equip.map(function(r,i){return '<td>'+(i+1)+'</td><td class="tx">'+esc(r.name)+'</td><td>'+esc(r.count)+'</td><td class="tx">'+esc(r.notes||'')+'</td>'}));
  if(S.risks)table('سجل المخاطر وخطط التخفيف',['#','الخطر','الاحتمالية','إجراءات التخفيف'],state.risks.map(function(r,i){return '<td>'+(i+1)+'</td><td class="tx"><b>'+esc(r.risk)+'</b><br>'+esc(r.desc||'')+'</td><td>'+esc(r.level||'')+'</td><td class="tx">'+esc(r.mit||'')+'</td>'}));
  if(S.conditions)table('شروط مجال العمل',['#','الشرط'],state.conditions.map(function(r,i){return '<td>'+(i+1)+'</td><td class="tx">'+esc(r.text)+'</td>'}));
  if(S.notes&&String(R.notes||'').trim())paras('ملاحظات',R.notes);
  if(S.sign){var sg=R.sign.filter(function(x){return x.t||x.n});if(sg.length)flow(block('','<div class="sig" style="grid-template-columns:repeat('+sg.length+',1fr)">'+sg.map(function(x){return '<div><b>'+esc(x.t)+'</b><span>'+(esc(x.n)||'الاسم: ....................')+'</span><span>التوقيع: ....................</span></div>'}).join('')+'</div>'))}
  pages.forEach(function(p,i){$('.pn',p).textContent='صفحة '+(i+1)+' من '+pages.length});
  return pages;
}
function renderReport(p){
  var R=state.report;
  p.innerHTML='<div class="rep"><div class="rep-cfg"><div class="card"><h2>إعداد التقرير</h2><div class="fields" style="grid-template-columns:1fr 1fr">'+
  '<label class="f wide"><span>عنوان التقرير</span><input '+B('report','','title')+' value="'+esc(R.title)+'"></label><label class="f"><span>رقم التقرير</span><input '+B('report','','no')+' value="'+esc(R.no)+'"></label><span></span>'+
  '<label class="f"><span>من تاريخ (اختياري)</span><input type="date" '+B('report','','from')+' value="'+esc(R.from)+'"></label><label class="f"><span>حتى تاريخ</span><input type="date" '+B('report','','to')+' value="'+esc(R.to)+'" placeholder="اليوم"></label></div>'+
  '<p class="hint">بدون «من تاريخ» يكون التقرير تراكمياً حتى التاريخ المحدد (اليوم إذا تُرك فارغاً).</p>'+
  '<div class="toolbar">'+(canPrint()?'<button class="btn primary" data-act="print">طباعة / حفظ PDF</button><button class="btn" data-act="pdf">تحميل PDF مباشرة</button>':'<button class="btn primary" data-act="pdf">تحميل PDF</button>')+'<button class="btn" data-act="xlsx">تحميل Excel منسق</button></div><p class="hint">ملف Excel يتبع نفس الإعدادات: الفترة، والأقسام المختارة (كل قسم في شيت)، وإخفاء الأسعار والسجلات المخفية.</p><span class="prog" id="pdf-prog"></span></div>'+
  '<div class="card"><h3>الأقسام الظاهرة في التقرير</h3><div class="secs">'+RSECS.map(function(s){return '<label><input type="checkbox" '+B('report','','secs.'+s[0])+(R.secs[s[0]]?' checked':'')+'>'+(s[0]==='installs'?'سجل '+esc(TM('log')):s[0]==='monthly'?'ملخص '+esc(TM('verbAl'))+' الشهري':s[1])+'</label>'}).join('')+'</div>'+
  '<div class="toolbar"><button class="btn sm" data-act="secs-all" data-v="1">تحديد الكل</button><button class="btn sm" data-act="secs-all" data-v="0">إلغاء الكل</button></div>'+
  '<label class="chk"><input type="checkbox" '+B('report','','prices')+(R.prices?' checked':'')+'> إظهار الأسعار والقيم</label><label class="chk"><input type="checkbox" '+B('report','','footer')+(R.footer?' checked':'')+'> تذييل الشركة أسفل الصفحات</label><label class="chk"><input type="checkbox" '+B('report','','breaks')+(R.breaks?' checked':'')+'> كل قسم يبدأ في صفحة جديدة</label>'+
  '<p class="hint">لإخفاء سجل معين (تنفيذ، توريد، مصروف، أمر إيقاف) اضغط 👁 بجانبه في تبويبه. ولإخفاء قسم من خطة العمل ألغِ «في التقرير» بجانبه.</p></div>'+
  '<div class="card"><h3>ملاحظات وتوقيعات</h3><label class="f"><span>ملاحظات تظهر في التقرير</span><textarea '+B('report','','notes')+' rows="4">'+esc(R.notes)+'</textarea></label>'+
  R.sign.map(function(s,i){return '<div class="fields" style="grid-template-columns:1fr 1fr"><label class="f"><span>الصفة '+(i+1)+'</span><input '+B('report','','sign.'+i+'.t')+' value="'+esc(s.t)+'"></label><label class="f"><span>الاسم</span><input '+B('report','','sign.'+i+'.n')+' value="'+esc(s.n)+'"></label></div>'}).join('')+'</div>'+
  '</div><div class="preview" id="preview"><span class="prog">جارٍ تجهيز المعاينة…</span></div></div>';
  schedulePreview(60);
}
var pvT;function schedulePreview(ms){clearTimeout(pvT);pvT=setTimeout(renderPreview,ms==null?250:ms)}
function fontsReady(){return document.fonts&&document.fonts.ready?document.fonts.ready.catch(function(){}):Promise.resolve()}
function renderPreview(){
  var box=$('#preview');if(!box||ui.tab!=='report')return;
  fontsReady().then(function(){
    box=$('#preview');if(!box)return;
    var host=el('div','rp-host');host.style.visibility='hidden';host.style.zIndex='-1';document.body.appendChild(host);
    var pages=buildPages(host),sc=Math.min(1,((box.clientWidth||820)-28)/794),frag=document.createDocumentFragment();
    pages.forEach(function(pg){var w=el('div','pv');w.style.width=(794*sc)+'px';w.style.height=(1123*sc)+'px';pg.style.transform='scale('+sc+')';w.appendChild(pg);frag.appendChild(w)});
    box.innerHTML='<span class="prog">'+pages.length+' صفحة</span>';box.appendChild(frag);host.remove();
  });
}
window.addEventListener('resize',function(){if(ui.tab==='report')schedulePreview()});
function doPrint(){
  fontsReady().then(function(){
    var root=$('#print-root');root.innerHTML='';root.style.display='block';root.style.position='fixed';root.style.visibility='hidden';
    buildPages(root);root.removeAttribute('style');
    window.addEventListener('afterprint',function(){root.innerHTML=''},{once:true});
    setTimeout(function(){window.print()},120);
  });
}
function loadScript(src){return new Promise(function(res,rej){var s=document.createElement('script');s.src=src;s.onload=res;s.onerror=function(){rej(new Error('load'))};document.head.appendChild(s)})}
function libs(){var p=[];if(!window.html2canvas)p.push(loadScript(CDN+'html2canvas/1.4.1/html2canvas.min.js'));if(!(window.jspdf&&window.jspdf.jsPDF))p.push(loadScript(CDN+'jspdf/2.5.1/jspdf.umd.min.js'));return Promise.all(p)}
var busy=false;
function exportPdf(){
  if(busy)return;busy=true;var pg=$('#pdf-prog');if(pg)pg.textContent='جارٍ تجهيز ملف PDF…';
  if(HOST&&HOST.pdf){
    fontsReady().then(function(){
      var root=$('#print-root');root.innerHTML='';root.style.display='block';root.style.position='fixed';root.style.visibility='hidden';
      buildPages(root);root.removeAttribute('style');
      return HOST.pdf(fname('pdf'));
    }).then(function(ok){if(ok)toast('تم حفظ ملف PDF')}).catch(function(){toast('تعذّر حفظ ملف PDF')}).then(function(){$('#print-root').innerHTML='';busy=false;if(pg)pg.textContent=''});
    return;
  }
  libs().then(fontsReady).then(function(){
    var host=el('div','rp-host');host.style.zIndex='-1';document.body.appendChild(host);
    var pages=buildPages(host),doc=new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true}),i=0;
    function next(){
      if(i>=pages.length){host.remove();var blob=doc.output('blob');offerFile(fname('pdf'),blob);busy=false;if(pg)pg.textContent='';return}
      if(pg)pg.textContent='صفحة '+(i+1)+' من '+pages.length+'…';
      return window.html2canvas(pages[i],{scale:2,backgroundColor:'#ffffff',logging:false,useCORS:true,scrollX:0,scrollY:-window.scrollY,windowWidth:1200}).then(function(cv){
        if(i)doc.addPage();doc.addImage(cv.toDataURL('image/jpeg',.92),'JPEG',0,0,210,297);i++;return next();
      });
    }
    return next();
  }).catch(function(){busy=false;if(pg)pg.textContent='';$$('.rp-host').forEach(function(h){h.remove()});toast('تعذّر التحميل المباشر (يحتاج اتصال إنترنت أول مرة). استخدم «طباعة / حفظ PDF» واختر الحفظ كـ PDF.')});
}

/* ================= files ================= */
function fname(ext){var n=(state.report.title||'تقرير')+' - '+(state.meta.short||state.meta.name)+' - '+todayIso();if(ext==='html')n=(state.meta.short||state.meta.name);if(ext==='json')n='ملف مشروع - '+(state.meta.short||state.meta.name)+' - '+todayIso();return n.replace(/[\\/:*?"<>|\n]+/g,' ').replace(/\s+/g,'-').slice(0,140)+'.'+ext}
function offerFile(name,data){
  if(HOST){
    if(!DL){toast('تحميل الملفات غير متاح في هذا العرض.');return}
    DL.save({filename:name,data:data}).then(function(r){if(r&&r.status==='saved')toast('تم تجهيز الملف: '+name)}).catch(function(e){var c=e&&e.code;if(c==='declined')return;toast(c==='unavailable'?'تحميل الملفات غير متاح في هذا العرض.':'تعذّر تجهيز الملف.')});
    return;
  }
  var bl=data instanceof Blob?data:new Blob([data],{type:'application/octet-stream'}),u=URL.createObjectURL(bl),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},5000);toast('تم تجهيز الملف: '+name)}
function buildDoc(next){
  var parts=['<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>'+esc(next.meta.short||next.meta.name)+'</title>'];
  var fonts=$('#fonts');if(fonts)parts.push(fonts.outerHTML);
  parts.push('<style id="app-css">'+$('#app-css').textContent+'</style></head><body><div id="app"></div><div id="print-root"></div><dialog id="dlg"></dialog>');
  parts.push('<script type="application/json" id="app-data">'+JSON.stringify(next).replace(/</g,'\\u003c')+'<\/script>');
  ['assets','lib-h2c','lib-jspdf','lib-xlsx'].forEach(function(id){var e=document.getElementById(id);if(e)parts.push('<script'+(id==='assets'?' type="application/json"':'')+' id="'+id+'">'+e.textContent+'<\/script>')});
  parts.push('<script id="app-js">'+$('#app-js').textContent+'<\/script></body></html>');
  return parts.join('');
}
function saveHtml(){var next=clone(state);next.rev=(state.rev||1)+1;next.meta.updated=new Date().toISOString();offerFile(fname('html'),buildDoc(next));state.rev=next.rev;dirty=false;saveDraft();renderAll()}
function exportCsv(c){
  var q=function(v){v=String(v==null?'':v);return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v},rows;
  if(c==='installs')rows=[['التاريخ',TM('itemCol'),'العدد','الموقع','الرقم التسلسلي','اختبار الضغط','انقطاع المياه (ساعة)','الفريق','ملاحظات']].concat(filt('installs',state.installs).map(function(r){return [r.date,boqName(r.boq),r.qty,r.loc,r.serial,r.test,r.shut,r.team,r.notes]}));
  else if(c==='supplies')rows=[['التاريخ',TM('itemCol'),'العدد','المورد','رقم السند','ملاحظات']].concat(filt('supplies',state.supplies).map(function(r){return [r.date,boqName(r.boq),r.qty,r.supplier,r.ref,r.notes]}));
  else if(c==='expenses')rows=[['التاريخ','التصنيف','البيان','الكمية','سعر الوحدة','المبلغ قبل الضريبة','الضريبة %','قيمة الضريبة','الإجمالي','المورد','الفاتورة']].concat(filt('expenses',state.expenses).map(function(r){return [r.date,r.cat,r.desc,r.qty,r.price,expNet(r),num(r.vat),expVat(r),expTot(r),r.vendor,r.ref]}));
  else if(c==='boq')rows=[['البند',TM('diaCol'),'الوصف','الوحدة','الكمية','سعر الوحدة','الإجمالي','الموَرَّد','المركب','المتبقي','الإنجاز %']].concat(state.boq.map(function(b){var qq=num(b.qty),i=installedOf(b.id);return [b.no,b.dia,b.desc,b.unit,qq,b.rate,qq*num(b.rate)||'',suppliedOf(b.id),i,Math.max(0,qq-i),pct(qq?i/qq:0)]}));
  else rows=[['الرمز','المهمة','المدة','البداية','النهاية','بداية الأساس','نهاية الأساس','الإنجاز %','الحالة']].concat(state.tasks.map(function(t){return [t.code,t.name,t.ms?0:t.dur,iso(tS(t)),iso(tF(t)),t.bs||'',t.bf||'',pct(progOf(t)),STL[statusOf(t)]]}));
  offerFile(fname('csv').replace('.csv','-'+c+'.csv'),'\ufeff'+rows.map(function(r){return r.map(q).join(',')}).join('\r\n'));
}

/* ================= actions ================= */
document.addEventListener('click',function(e){
  var b=e.target.closest('[data-act]');if(!b)return;var a=b.getAttribute('data-act'),v=b.getAttribute('data-v'),c=b.getAttribute('data-c'),id=b.getAttribute('data-id');
  if(b.tagName==='INPUT'||b.tagName==='TEXTAREA')return;
  switch(a){
    case 'tab':ui.tab=v;saveUi();closeDlg();renderAll();window.scrollTo(0,0);break;
    case 'undo':undo();break;case 'redo':redo();break;
    case 'save-html':saveHtml();break;
    case 'export-json':offerFile(fname('json'),JSON.stringify(state,null,1));break;
        case 'zoom':ui.zoom=v;ui.gscroll=null;saveUi();renderAll();break;
    case 'collapse':ui.collapsed[v]=!ui.collapsed[v];saveUi();renderAll();break;
    case 'edit-task':openTask(v);break;case 'add-task':openTask(null);break;
    case 'edit-grp':openGroup(v);break;case 'add-grp':openGroup(null);break;
    case 'close-dlg':closeDlg();break;
    case 'add-pred':$('#preds').insertAdjacentHTML('beforeend',predRow({id:'',type:'FS',lag:0},v));break;
    case 'rm-pred':b.closest('.pred').remove();break;
    case 'del-task':ask('حذف هذه المهمة؟','حذف',true).then(function(ok){if(ok)mutate(function(){state.tasks=state.tasks.filter(function(t){return t.id!==v});state.tasks.forEach(function(t){t.preds=t.preds.filter(function(p){return p.id!==v})})})});break;
    case 'del-grp':var n=state.tasks.filter(function(t){return t.group===v}).length;if(state.groups.length<2){toast('يجب أن تبقى مجموعة واحدة على الأقل');break}ask(n?'حذف المجموعة؟ سيتم نقل '+n+' مهمة إلى مجموعة أخرى.':'حذف المجموعة؟','حذف',true).then(function(ok){if(ok)mutate(function(){state.groups=state.groups.filter(function(g){return g.id!==v});var to=state.groups[0].id;state.tasks.forEach(function(t){if(t.group===v)t.group=to})})});break;
    case 'mv-grp':closeDlg();mutate(function(){var i=grpIdx(v),j=i+(+b.getAttribute('data-d'));if(j<0||j>=state.groups.length)return;var t=state.groups[i];state.groups[i]=state.groups[j];state.groups[j]=t});break;
    case 'baseline':ask('حفظ التواريخ الحالية للجدول كخط أساس للمقارنة؟ سيُستبدل خط الأساس الحالي.','حفظ خط الأساس').then(function(ok){if(ok)mutate(function(){state.tasks.forEach(function(t){t.bs=iso(tS(t));t.bf=iso(tF(t))})})});break;
    case 'hide':mutate(function(){var r=rowOf(c,id);if(r)r.hide=!r.hide});break;
    case 'del':if(!rowOf(c,id))break;ask(c==='boq'&&state.installs.concat(state.supplies).some(function(x){return x.boq===id})?'هذا البند له سجلات '+TM('verb')+' أو توريد. حذفه؟':'حذف هذا السجل؟','حذف',true).then(function(ok){if(!ok)return;mutate(function(){state[c]=state[c].filter(function(x){return x.id!==id})});toast('تم الحذف (يمكنك التراجع)')});break;
    case 'mv':mutate(function(){var arr=state[c],i=arr.indexOf(rowOf(c,id)),j=i+(+b.getAttribute('data-d'));if(j<0||j>=arr.length)return;var t=arr[i];arr[i]=arr[j];arr[j]=t});break;
    case 'add-boq':mutate(function(){var n2=state.boq.length+1;state.boq.push({id:uid('b'),no:String(n2),dia:'',unit:'عمل',qty:0,rate:'',desc:''})});break;
    case 'add-row':mutate(function(){var o={id:uid(c.charAt(0))};if(c==='rates')o.boq=(state.boq[0]||{}).id;if(c==='risks')o.level='متوسطة';state[c].push(o)});break;
    case 'add-sec':mutate(function(){state.sections.push({id:uid('s'),title:'قسم جديد',body:'',rep:true})});break;
    case 'add-ev':mutate(function(){var o={id:uid('v'),type:v,ref:'',date:todayIso(),from:v==='ext'?'':todayIso(),to:'',days:v==='ext'?30:'',reason:'',adds:v!=='hol'};state.events.push(o)});break;
    case 'apply-rates':mutate(function(){var k=0;state.rates.forEach(function(r){var d=rateDur(r);if(!d)return;state.tasks.forEach(function(t){if(t.link===r.boq){t.dur=d;k++}})});toast(k?'تم تحديث مدد '+k+' مهمة':'لا توجد مهام مرتبطة')});break;
    case 'rechain':rechain(+v);break;
    case 'clear-f':ui.f[c]={};saveUi();renderAll();break;
    case 'csv':exportCsv(v);break;
    case 'secs-all':mutate(function(){RSECS.forEach(function(s){state.report.secs[s[0]]=v==='1'})});break;
    case 'desk-backup':HOST.backupNow().then(function(f){toast('تم حفظ نسخة احتياطية: '+f)}).catch(function(){toast('تعذّر عمل النسخة الاحتياطية')});break;
    case 'desk-folder':HOST.openData();break;
    case 'tl-go':tlGo(+v);if($('#dlg').open&&$('#dlg .tl-list'))tlList();break;
    case 'tl-list':tlList();break;
    case 'home':if(HOST&&HOST.home){cacheLocal();dbSettle().then(function(){HOST.home()})}break;
    case 'print':doPrint();break;case 'pdf':exportPdf();break;
    case 'xlsx':exportXlsx(false);break;case 'xlsx-full':exportXlsx(true);break;
    case 'fdb-create':fdbCreate();break;case 'fdb-open':fdbOpen();break;case 'fdb-resume':fdbResume();break;case 'fdb-save':fdbWrite();break;case 'fdb-detach':ask('فصل ملف Excel؟ ستتوقف الكتابة فيه، والتعديلات تُحفظ في المتصفح فقط.','فصل الملف').then(function(ok){if(ok)fdbDetach()});break;
    case 'theme':if(v)document.documentElement.setAttribute('data-theme',v);else document.documentElement.removeAttribute('data-theme');ls(function(){localStorage.setItem(UIKEY+'-theme',v)});renderAll();break;
    case 'logo-reset':mutate(function(){state.meta.logo=''});break;
    case 'reset':ask('استعادة الخطة الافتراضية؟ سيتم حذف كل السجلات والتعديلات (يمكنك التراجع مباشرة بعدها).','استعادة',true).then(function(ok){if(!ok)return;snap();state=normalize(DEFAULT_PROJECT());initBaseline();saveDraft();sched();renderAll();toast('تمت الاستعادة')});break;
  }
});
document.addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&!e.altKey&&(e.key==='z'||e.key==='Z')){var tg=e.target.tagName;if(tg==='INPUT'||tg==='TEXTAREA')return;e.preventDefault();e.shiftKey?redo():undo()}});
window.addEventListener('beforeunload',function(){cacheLocal();if(DB.timer){clearTimeout(DB.timer);DB.timer=0;dbFlush()}});

/* ================= render ================= */
var PANELS={dash:renderDash,boq:renderBoq,gantt:renderGantt,installs:renderInstalls,supplies:renderSupplies,expenses:renderExpenses,events:renderEvents,plan:renderPlan,report:renderReport,settings:renderSettings};
function renderAll(){
  var ae=document.activeElement,key=ae&&(ae.getAttribute('data-b')||ae.getAttribute('data-f')),ss=ae&&ae.selectionStart,se=ae&&ae.selectionEnd;
  var y=window.scrollY;
  renderHeader();renderBanners();renderTimeline();renderTabs();
  var p=$('#panel');p.innerHTML='';(PANELS[ui.tab]||renderDash)(p);
  if(key){var n=$('[data-b="'+key+'"],[data-f="'+key+'"]');if(n){n.focus({preventScroll:true});try{if(ss!=null&&n.setSelectionRange&&/text|search|textarea/.test(n.type))n.setSelectionRange(ss,se)}catch(err){}}}
  window.scrollTo(0,y);
}
var CREDIT='تصميم وبرمجة: م. ياسر محمد عبدالجابر · © '+Math.max(2026,new Date().getFullYear())+' جميع الحقوق محفوظة';
function initBaseline(){sched();state.tasks.forEach(function(t){if(!t.bs){t.bs=iso(tS(t));t.bf=iso(tF(t))}})}
/*@@MODULES@@*/
(function boot(){
  var th=ls(function(){return localStorage.getItem(UIKEY+'-theme')});if(th)document.documentElement.setAttribute('data-theme',th);
  $('#app').innerHTML='<header class="top" id="hdr"></header><div id="banners" style="display:flex;flex-direction:column;gap:8px"></div><div id="tl" class="tlbar"></div><nav class="tabs" id="tabs" role="tablist"></nav><main class="panel" id="panel"></main><footer class="credit">'+CREDIT+'</footer>';
  if(!state.tasks.some(function(t){return t.bs}))initBaseline();
  tlLoadLocal();
  sched();renderAll();
  if(HOST){HOST.use('downloads').then(function(d){DL=d;renderAll()});dbInit()}
  fdbBoot();
})();
})();
