/* ================= labor: workers, daily attendance, performance ================= */
var WST={active:'نشط',mission:'في مأمورية',left:'ترك العمل'};
var AST=[['p','حاضر'],['a','غائب'],['l','إجازة'],['k','مرضي'],['m','مأمورية']];
var ASTL={p:'حاضر',a:'غائب',l:'إجازة',k:'مرضي',m:'مأمورية'};
var WAGE={day:'يومية',hour:'بالساعة',month:'شهري'};
var EVK=[['q','جودة العمل'],['d','الالتزام والانضباط'],['s','السلامة'],['t','التعاون وروح الفريق']];
function shiftCfg(){var m=state.meta,d=function(v,x){return v===''||v==null||isNaN(parseFloat(v))?x:num(v)};return {inn:m.shiftIn||'07:00',out:m.shiftOut||'16:00',brk:d(m.breakH,1),day:d(m.dayH,8)||8,grace:d(m.grace,15),ot:d(m.otRate,1.5)}}
function tmin(t){var x=/^(\d{1,2}):(\d{2})/.exec(t||'');return x?(+x[1])*60+(+x[2]):NaN}
function workerById(id){for(var i=0;i<state.workers.length;i++)if(state.workers[i].id===id)return state.workers[i];return null}
function attDay(date,create){
  for(var i=0;i<state.attend.length;i++)if(state.attend[i].date===date)return state.attend[i];
  if(!create)return null;var d={id:'a'+date,date:date,rows:{}};state.attend.push(d);return d;
}
function attOf(wid,date){var d=attDay(date);return d&&d.rows?d.rows[wid]:null}
function attHours(x){
  if(!x||(x.s!=='p'&&x.s!=='m'))return 0;
  var sh=shiftCfg(),a=tmin(x.inn),b=tmin(x.out);
  if(isNaN(a)||isNaN(b))return x.s==='m'?sh.day:0;
  if(b<a)b+=1440;var h=(b-a)/60;if(h>=5)h-=sh.brk;
  return Math.max(0,Math.round(h*100)/100);
}
function attLate(x){if(!x||x.s!=='p')return 0;var sh=shiftCfg(),a=tmin(x.inn),s=tmin(sh.inn);return !isNaN(a)&&!isNaN(s)&&a>s+sh.grace?a-s:0}
function hourRate(w){var sh=shiftCfg(),g=num(w.wage);return w.wtype==='hour'?g:w.wtype==='month'?g/30/sh.day:g/sh.day}
function dayCost(w,x){
  if(!w||!x||!num(w.wage))return 0;var sh=shiftCfg(),h=attHours(x),ot=Math.max(0,h-sh.day),hr=hourRate(w);
  var base=w.wtype==='hour'?Math.min(h,sh.day)*hr:w.wtype==='month'?(x.s==='a'?0:num(w.wage)/30):(x.s==='p'||x.s==='m'?num(w.wage):0);
  return base+ot*hr*sh.ot;
}
function labRange(){
  var f=ui.f.labor||{},t=todayNum(),d=new Date(t*DAY),m0=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)/DAY;
  var a=f.from?dnum(f.from):m0,b=f.to?dnum(f.to):t;return {a:isNaN(a)?m0:a,b:isNaN(b)?t:b};
}
/* executed quantity credited to a worker: install records whose team names him, shared equally among the named workers */
function crewShare(wid,a,b){
  var w=workerById(wid);if(!w||!String(w.name||'').trim())return 0;var nm=String(w.name).trim();
  return state.installs.reduce(function(s,r){var d=dnum(r.date);if(isNaN(d)||d<a||d>b||!r.team)return s;var t=String(r.team);if(t.indexOf(nm)<0)return s;
    var n=state.workers.filter(function(x){return String(x.name||'').trim()&&t.indexOf(String(x.name).trim())>=0}).length||1;return s+num(r.qty)/n},0);
}
function labStats(wid,a,b){
  var w=workerById(wid),st={p:0,a:0,l:0,k:0,m:0,late:0,lateMin:0,hours:0,ot:0,cost:0,days:0,qty:0},sh=shiftCfg();
  state.attend.forEach(function(d){var n=dnum(d.date);if(isNaN(n)||n<a||n>b)return;var x=d.rows&&d.rows[wid];if(!x||!ASTL[x.s])return;
    st[x.s]++;st.days++;var h=attHours(x);st.hours+=h;st.ot+=Math.max(0,h-sh.day);var lt=attLate(x);if(lt){st.late++;st.lateMin+=lt}st.cost+=dayCost(w,x)});
  st.qty=crewShare(wid,a,b);
  var worked=st.p+st.m,den=worked+st.a;
  st.att=den?worked/den:null;st.punct=st.p?1-st.late/st.p:null;st.fill=worked?Math.min(1,st.hours/(worked*sh.day)):null;
  var ev=(w&&w.ev)||{},rs=EVK.map(function(k){return num(ev[k[0]])}).filter(function(v){return v>0});
  st.man=rs.length?rs.reduce(function(s,v){return s+v},0)/rs.length/5:null;
  var parts=[[st.att,.35],[st.punct,.15],[st.fill,.15],[st.man,.35]].filter(function(x){return x[0]!=null}),wt=parts.reduce(function(s,x){return s+x[1]},0);
  st.score=wt?parts.reduce(function(s,x){return s+x[0]*x[1]},0)/wt:null;
  return st;
}
function grade(s){if(s==null)return ['—','n'];return s>=.9?['ممتاز','ok']:s>=.8?['جيد جداً','ok']:s>=.65?['جيد','a']:s>=.5?['مقبول','warn']:['ضعيف','bad']}
function laborToday(){
  var t=todayIso(),d=attDay(t),on=state.workers.filter(function(w){return w.status!=='left'});
  var c={all:on.length,p:0,m:0,a:0};
  on.forEach(function(w){var x=d&&d.rows[w.id];if(x&&x.s==='p')c.p++;else if((x&&x.s==='m')||(!x&&w.status==='mission'))c.m++;else if(x&&x.s==='a')c.a++});
  return c;
}
function attWorkers(date){
  var n=dnum(date),d=attDay(date);
  return state.workers.filter(function(w){if(d&&d.rows[w.id])return true;if(w.status==='left')return false;var s=dnum(w.start);return isNaN(s)||s<=n});
}
function setAtt(date,wid,f,v){
  mutate(function(){
    var d=attDay(date,true),x=d.rows[wid],sh=shiftCfg(),w=workerById(wid);
    if(f==='s'&&!v){delete d.rows[wid]}
    else{
      if(!x){x=d.rows[wid]={s:f==='s'?v:'p'}}
      x[f]=v;
      if(f==='s'&&v==='p'&&!x.inn&&!x.out){x.inn=sh.inn;x.out=sh.out}
      if(f==='s'&&v==='m'&&!x.note&&w&&w.mnote)x.note=w.mnote;
      if((f==='inn'||f==='out')&&x.s!=='p'&&x.s!=='m')x.s='p';
      if(f==='s'&&v!=='p'&&v!=='m'){delete x.inn;delete x.out}
    }
    if(!Object.keys(d.rows).length)state.attend=state.attend.filter(function(y){return y!==d});
  });
}
function fillDay(date,mode){
  var prev=null;if(mode==='copy'){var n=dnum(date);state.attend.forEach(function(d){var k=dnum(d.date);if(k<n&&(!prev||k>dnum(prev.date)))prev=d});if(!prev){toast('لا يوجد يوم سابق مسجل');return}}
  var k=0;
  mutate(function(){
    var d=attDay(date,true),sh=shiftCfg();
    attWorkers(date).forEach(function(w){if(d.rows[w.id]||w.status==='left')return;
      if(mode==='copy'){var px=prev.rows[w.id];if(!px)return;d.rows[w.id]=clone(px);k++;return}
      d.rows[w.id]=w.status==='mission'?{s:'m',note:w.mnote||''}:{s:'p',inn:sh.inn,out:sh.out};k++});
    if(!Object.keys(d.rows).length)state.attend=state.attend.filter(function(y){return y!==d});
  });
  toast(k?'تم تسجيل '+k+' عامل':'كل العمال مسجلون في هذا اليوم');
}
function stars(v){v=num(v);var s='';for(var i=1;i<=5;i++)s+=i<=v?'★':'☆';return v?'<span class="stars" title="'+v+' من 5">'+s+'</span>':'<span class="muted">—</span>'}
function renderLabor(p){
  var sh=shiftCfg(),date=ui.labDate||todayIso(),dn=dnum(date),day=attDay(date),c=esc(state.meta.currency);
  var g=labRange(),ws=state.workers,tod=laborToday();
  var stats={};ws.forEach(function(w){stats[w.id]=labStats(w.id,g.a,g.b)});
  var tH=0,tC=0,sc=[];ws.forEach(function(w){var s=stats[w.id];tH+=s.hours;tC+=s.cost;if(s.score!=null&&w.status!=='left')sc.push(s.score)});
  var avg=sc.length?sc.reduce(function(a,b){return a+b},0)/sc.length:null,gr=grade(avg);
  var kp='<div class="kpis">'+
    '<div class="kpi"><span class="k">العمالة على رأس العمل</span><span class="v">'+tod.all+'<small>عامل</small></span><span class="s">'+ws.filter(function(w){return w.status==='left'}).length+' ترك العمل</span></div>'+
    '<div class="kpi"><span class="k">الحضور اليوم</span><span class="v">'+tod.p+'<small>من '+tod.all+'</small></span><div class="bar"><i class="ac" style="width:'+pct(tod.all?tod.p/tod.all:0)+'%"></i></div><span class="s">مأمورية '+tod.m+' · غياب '+tod.a+'</span></div>'+
    '<div class="kpi"><span class="k">ساعات العمل للفترة</span><span class="v">'+qn(tH)+'<small>ساعة</small></span><span class="s">'+fs(g.a)+' – '+fs(g.b)+'</span></div>'+
    (tC?'<div class="kpi"><span class="k">تكلفة العمالة للفترة</span><span class="v">'+money(tC)+'<small>'+c+'</small></span><span class="s">شاملة الساعات الإضافية</span></div>':'')+
    '<div class="kpi"><span class="k">متوسط تقييم العمالة</span><span class="v">'+(avg==null?'—':pct(avg)+'<small>%</small>')+'</span><span class="s"><span class="pill '+gr[1]+'">'+gr[0]+'</span></span></div></div>';
  /* daily sheet */
  var list=attWorkers(date),wd=state.meta.weekend.indexOf(dow(dn))>=0;
  var arows=list.map(function(w,i){var x=day&&day.rows[w.id],h=attHours(x),lt=attLate(x),k=w.id;
    var sOpts='<option value="">— غير مسجل —</option>'+AST.map(function(o){return '<option value="'+o[0]+'"'+(x&&x.s===o[0]?' selected':'')+'>'+o[1]+'</option>'}).join('');
    return '<tr class="'+(x?'att-'+x.s:'att-none')+'"><td class="n">'+(i+1)+'</td><td style="white-space:normal;min-width:150px"><b>'+esc(w.name||'—')+'</b>'+(w.status==='mission'?' <span class="pill a">في مأمورية</span>':'')+(w.status==='left'?' <span class="pill n">ترك العمل</span>':'')+'</td><td>'+esc(w.job||'')+'</td>'+
      '<td><select class="cell" data-att="'+k+'|s">'+sOpts+'</select></td>'+
      '<td><input class="cell" type="time" data-att="'+k+'|inn" value="'+esc(x&&x.inn||'')+'"></td><td><input class="cell" type="time" data-att="'+k+'|out" value="'+esc(x&&x.out||'')+'"></td>'+
      '<td class="n num">'+(h?qn(h):'–')+'</td><td class="n num">'+(h>sh.day?qn(h-sh.day):'–')+'</td><td class="c">'+(lt?'<span class="pill warn">'+lt+' د</span>':'')+'</td>'+
      '<td style="min-width:170px"><input class="cell" data-att="'+k+'|note" value="'+esc(x&&x.note||'')+'" placeholder="'+(x&&x.s==='m'?'مكان المأمورية':'ملاحظة')+'"></td></tr>'}).join('');
  var cnt={};AST.forEach(function(o){cnt[o[0]]=0});list.forEach(function(w){var x=day&&day.rows[w.id];if(x&&cnt[x.s]!=null)cnt[x.s]++});
  var dayH=list.reduce(function(s,w){return s+attHours(day&&day.rows[w.id])},0);
  var att='<div class="card"><div class="card-h"><h2>كشف الحضور والانصراف</h2><span class="pill a">'+DOWS[dow(dn)]+' '+fs(dn)+'</span></div><div class="toolbar">'+
    '<button class="btn sm icon" data-act="lab-day" data-v="-1" title="اليوم السابق" aria-label="اليوم السابق">→</button><input class="in" type="date" id="lab-date" style="width:auto" value="'+esc(date)+'" aria-label="تاريخ الكشف"><button class="btn sm icon" data-act="lab-day" data-v="1" title="اليوم التالي" aria-label="اليوم التالي">←</button><button class="btn sm" data-act="lab-day" data-v="0">اليوم</button>'+
    '<span class="grow"></span><button class="btn sm primary" data-act="lab-fill" data-v="all">تسجيل حضور الجميع</button><button class="btn sm" data-act="lab-fill" data-v="copy">نسخ آخر يوم مسجل</button></div>'+
    '<p class="hint">'+DOWS[dow(dn)]+' '+fl(dn)+(wd?' · <b>عطلة أسبوعية</b>':'')+'. الدوام '+esc(sh.inn)+' – '+esc(sh.out)+'، ويُخصم '+qn(sh.brk)+' ساعة راحة من اليوم الكامل. اختر الحالة لكل عامل، أو سجّل حضور الجميع بالمواعيد الافتراضية ثم عدّل الاستثناءات.</p>'+
    (list.length?'<div class="tw"><table class="t"><thead><tr><th class="n">#</th><th>العامل</th><th>الوظيفة</th><th>الحالة</th><th>الحضور</th><th>الانصراف</th><th class="n">الساعات</th><th class="n">إضافي</th><th class="c">تأخير</th><th>ملاحظات / مكان المأمورية</th></tr></thead><tbody>'+arows+'</tbody>'+
    '<tfoot><tr><td colspan="3">حاضر '+cnt.p+' · مأمورية '+cnt.m+' · غائب '+cnt.a+' · إجازة '+cnt.l+' · مرضي '+cnt.k+'</td><td colspan="3"></td><td class="n">'+qn(dayH)+'</td><td colspan="3"></td></tr></tfoot></table></div>':'<div class="empty">أضف العمال من جدول «العمال» بالأسفل أولاً.</div>')+'</div>';
  /* workers */
  var wrows=ws.map(function(w){return '<tr class="'+(w.status==='left'?'off':'')+'"><td style="min-width:160px">'+inp('workers',w,'name','text')+'</td><td style="min-width:120px">'+inp('workers',w,'job','text',' list="job-list"')+'</td><td>'+inp('workers',w,'phone','text')+'</td><td>'+inp('workers',w,'nid','text')+'</td><td>'+inp('workers',w,'start','date')+'</td>'+
    '<td class="n">'+inp('workers',w,'wage','number',' placeholder="—"')+'</td><td>'+sel('workers',w,'wtype',[['day',WAGE.day],['hour',WAGE.hour],['month',WAGE.month]])+'</td><td>'+sel('workers',w,'status',[['active',WST.active],['mission',WST.mission],['left',WST.left]])+'</td>'+
    '<td style="min-width:180px">'+txa('workers',w,'mnote',' placeholder="'+(w.status==='mission'?'مكان المأمورية ومدتها':'ملاحظات')+'"')+'</td>'+
    '<td><div class="rowact"><button class="btn sm" data-act="lab-eval" data-id="'+w.id+'">تقييم</button><button class="btn icon ghost danger" data-act="del-worker" data-id="'+w.id+'" title="حذف العامل" aria-label="حذف العامل">✕</button></div></td></tr>'}).join('');
  var wcard='<div class="card"><div class="card-h"><h2>العمال</h2><span class="pill a">'+ws.length+' عامل</span></div>'+
    '<form class="addform" data-labadd="1"><label class="f w2"><span>اسم العامل</span><input name="name" required></label><label class="f"><span>الوظيفة</span><input name="job" list="job-list" placeholder="فني، سباك، عامل…"></label><label class="f"><span>الجوال</span><input name="phone"></label><label class="f"><span>الأجر</span><input type="number" name="wage" min="0" step="any"></label><label class="f"><span>نوع الأجر</span><select name="wtype"><option value="day">يومية</option><option value="hour">بالساعة</option><option value="month">شهري</option></select></label><button class="btn primary">+ إضافة عامل</button></form>'+
    (ws.length?'<div class="tw"><table class="t"><thead><tr><th>الاسم</th><th>الوظيفة</th><th>الجوال</th><th>رقم الهوية / الإقامة</th><th>تاريخ الالتحاق</th><th class="n">الأجر ('+c+')</th><th>نوع الأجر</th><th>الحالة</th><th>ملاحظات / المأمورية</th><th></th></tr></thead><tbody>'+wrows+'</tbody></table></div>':'<div class="empty">لا يوجد عمال مسجلون.</div>')+
    '<p class="hint">عند ترك العامل للعمل غيّر حالته إلى «ترك العمل» فيختفي من كشف الحضور ويبقى سجله وتقييمه. الحذف يمسح العامل وكل سجلات حضوره. اكتب اسم العامل في خانة «الفريق» في سجل '+esc(TM('log'))+' لتُحتسب له الكمية المنفذة في الإنتاجية.</p></div>';
  /* KPIs */
  var f=ui.f.labor||{};
  var krows=ws.map(function(w){var s=stats[w.id],gd=grade(s.score),ev=w.ev||{},rs=EVK.map(function(k){return num(ev[k[0]])}).filter(function(v){return v>0}),mv=rs.length?rs.reduce(function(a,b){return a+b},0)/rs.length:0;
    return '<tr class="'+(w.status==='left'?'off':'')+'"><td style="white-space:normal;min-width:140px"><b>'+esc(w.name||'—')+'</b><div class="muted" style="font-size:12px">'+esc(w.job||'')+'</div></td><td class="n">'+s.p+'</td><td class="n">'+s.a+'</td><td class="n">'+(s.l+s.k)+'</td><td class="n">'+s.m+'</td><td class="n">'+(s.late?s.late+' <small class="muted">('+s.lateMin+' د)</small>':'0')+'</td><td class="n">'+qn(s.hours)+'</td><td class="n">'+qn(s.ot)+'</td>'+
      '<td class="n">'+(s.att==null?'—':pct(s.att)+'%')+'</td><td class="n">'+(s.punct==null?'—':pct(s.punct)+'%')+'</td><td class="n">'+(s.qty?qn(s.qty):'—')+'</td>'+(tC?'<td class="n">'+money(s.cost)+'</td>':'')+'<td>'+stars(Math.round(mv))+'</td>'+
      '<td><div class="mini"><div class="bar"><i class="ac" style="width:'+(s.score==null?0:pct(s.score))+'%"></i></div><b>'+(s.score==null?'—':pct(s.score)+'%')+'</b></div></td><td><span class="pill '+gd[1]+'">'+gd[0]+'</span></td><td><button class="btn sm" data-act="lab-eval" data-id="'+w.id+'">تقييم</button></td></tr>'}).join('');
  var kcard='<div class="card"><div class="card-h"><h2>مؤشرات الأداء والتقييم</h2></div>'+
    '<div class="toolbar"><label class="f"><span>من تاريخ</span><input class="in" type="date" data-f="labor|from" value="'+esc(f.from||iso(g.a))+'"></label><label class="f"><span>إلى تاريخ</span><input class="in" type="date" data-f="labor|to" value="'+esc(f.to||iso(g.b))+'"></label><button class="btn sm" data-act="clear-f" data-c="labor">الشهر الحالي</button><span class="grow"></span>'+(tC?'<button class="btn sm" data-act="lab-post">ترحيل أجور الفترة للمصاريف</button>':'')+'</div>'+
    (ws.length?'<div class="tw"><table class="t"><thead><tr><th>العامل</th><th class="n">حضور</th><th class="n">غياب</th><th class="n">إجازة / مرضي</th><th class="n">مأمورية</th><th class="n">تأخير</th><th class="n">الساعات</th><th class="n">إضافي</th><th class="n">معدل الحضور</th><th class="n">الانضباط</th><th class="n">الإنتاجية ('+esc(TM('unit'))+')</th>'+(tC?'<th class="n">التكلفة ('+c+')</th>':'')+'<th>تقييم المشرف</th><th>الدرجة</th><th>التقدير</th><th></th></tr></thead><tbody>'+krows+'</tbody></table></div>':'<div class="empty">—</div>')+
    '<p class="hint">الدرجة = معدل الحضور 35% + الانضباط في المواعيد 15% + استيفاء ساعات الدوام 15% + تقييم المشرف 35%. معدل الحضور = (حضور + مأمورية) ÷ (حضور + مأمورية + غياب)، والإجازة والمرضي لا يُحسبان غياباً. الإنتاجية = الكمية المنفذة في سجل '+esc(TM('log'))+' التي يُذكر اسم العامل في فريقها (وتُقسم بالتساوي إذا ضم الفريق أكثر من عامل). التقدير: ممتاز 90% فأكثر، جيد جداً 80%، جيد 65%، مقبول 50%.</p></div>';
  var scard='<div class="card"><h2>إعدادات الدوام</h2><div class="fields">'+[['shiftIn','بداية الدوام','time',sh.inn],['shiftOut','نهاية الدوام','time',sh.out],['breakH','ساعات الراحة','number',sh.brk],['dayH','ساعات اليوم الكامل','number',sh.day],['grace','سماح التأخير (دقيقة)','number',sh.grace],['otRate','معامل الساعة الإضافية','number',sh.ot]].map(function(x){return '<label class="f"><span>'+x[1]+'</span><input type="'+x[2]+'" '+B('meta','',x[0])+(x[2]==='number'?' data-t="num" step="any" min="0"':'')+' value="'+esc(x[3])+'"></label>'}).join('')+'</div><p class="hint">تُخصم ساعات الراحة من أي يوم عمل مدته 5 ساعات فأكثر. الساعة الإضافية = أجر الساعة × المعامل. يُحتسب التأخير إذا كان الحضور بعد بداية الدوام بأكثر من مدة السماح.</p></div>';
  p.innerHTML=kp+att+kcard+wcard+scard+dl('job-list',ws.map(function(w){return w.job}).concat(state.team.map(function(t){return t.role})));
}
function evalWorker(id){
  var w=workerById(id);if(!w)return;var ev=w.ev||{},g=labRange(),s=labStats(id,g.a,g.b),gd=grade(s.score);
  openDlg('<div class="dlg-h"><h2>تقييم '+esc(w.name||'العامل')+'</h2><button type="button" class="btn icon ghost" data-act="close-dlg" aria-label="إغلاق">✕</button></div>'+
  '<dl class="facts"><dt>الفترة</dt><dd>'+fs(g.a)+' – '+fs(g.b)+'</dd><dt>الحضور</dt><dd>'+s.p+' يوم · مأمورية '+s.m+' · غياب '+s.a+' · إجازة/مرضي '+(s.l+s.k)+'</dd><dt>الساعات</dt><dd>'+qn(s.hours)+' ساعة (إضافي '+qn(s.ot)+')</dd><dt>مرات التأخير</dt><dd>'+s.late+'</dd><dt>الدرجة الحالية</dt><dd>'+(s.score==null?'—':pct(s.score)+'%')+' <span class="pill '+gd[1]+'">'+gd[0]+'</span></dd></dl>'+
  '<div class="fields">'+EVK.map(function(k){return '<label class="f"><span>'+k[1]+'</span><select name="'+k[0]+'"><option value="">— بدون —</option>'+[5,4,3,2,1].map(function(v){return '<option value="'+v+'"'+(num(ev[k[0]])===v?' selected':'')+'>'+'★★★★★'.slice(0,v)+' ('+v+')</option>'}).join('')+'</select></label>'}).join('')+
  '<label class="f wide"><span>ملاحظات المشرف</span><textarea name="note" rows="3">'+esc(w.evNote||'')+'</textarea></label></div>'+
  '<div class="dlg-f"><span></span><div class="toolbar"><button type="button" class="btn" data-act="close-dlg">إلغاء</button><button class="btn primary" value="ok">حفظ التقييم</button></div></div>',
  function(f){var E=f.elements;mutate(function(){var x=workerById(id);if(!x)return;x.ev={};EVK.forEach(function(k){if(E[k[0]].value)x.ev[k[0]]=+E[k[0]].value});x.evNote=E.note.value.trim()});toast('تم حفظ التقييم')});
}
function postWages(){
  var g=labRange(),tot=0;state.workers.forEach(function(w){tot+=labStats(w.id,g.a,g.b).cost});tot=Math.round(tot*100)/100;
  if(!tot){toast('لا توجد أجور محسوبة في الفترة');return}
  var desc='أجور العمالة من '+fs(g.a)+' إلى '+fs(g.b),dup=state.expenses.some(function(r){return r.desc===desc});
  ask((dup?'تم ترحيل أجور هذه الفترة من قبل. ترحيلها مرة أخرى؟\n':'')+'إضافة مصروف «'+desc+'» بمبلغ '+money(tot)+' '+state.meta.currency+'؟','ترحيل للمصاريف').then(function(ok){if(!ok)return;
    var cat=state.expCats.filter(function(c){return /عمال/.test(c)})[0]||'عمالة ويوميات';
    mutate(function(){if(state.expCats.indexOf(cat)<0)state.expCats.splice(Math.max(0,state.expCats.length-1),0,cat);state.expenses.push({id:uid('e'),date:iso(g.b),cat:cat,desc:desc,qty:'',price:'',amount:tot,vat:0,vendor:'',ref:''})});
    toast('تم ترحيل '+money(tot)+' '+state.meta.currency+' إلى المصاريف');
  });
}
document.addEventListener('change',function(e){
  var t=e.target;
  if(t.id==='lab-date'){if(t.value){ui.labDate=t.value;renderAll()}return}
  var k=t.getAttribute&&t.getAttribute('data-att');if(!k)return;var p=k.split('|');
  setAtt(ui.labDate||todayIso(),p[0],p[1],t.value);
});
document.addEventListener('submit',function(e){
  var f=e.target;if(!f.getAttribute||!f.getAttribute('data-labadd'))return;e.preventDefault();
  var E=f.elements,name=E.name.value.replace(/\s+/g,' ').trim();if(!name)return;
  mutate(function(){state.workers.push({id:uid('w'),name:name,job:E.job.value.trim(),phone:E.phone.value.trim(),nid:'',start:todayIso(),wage:E.wage.value===''?'':num(E.wage.value),wtype:E.wtype.value,status:'active',mnote:''})});
  toast('تمت إضافة '+name);
});
document.addEventListener('click',function(e){
  var b=e.target.closest&&e.target.closest('[data-act]');if(!b)return;var a=b.getAttribute('data-act'),v=b.getAttribute('data-v'),id=b.getAttribute('data-id');
  if(a==='lab-day'){var d=+v===0?todayNum():dnum(ui.labDate||todayIso())+(+v);ui.labDate=iso(d);renderAll()}
  else if(a==='lab-fill')fillDay(ui.labDate||todayIso(),v);
  else if(a==='lab-eval')evalWorker(id);
  else if(a==='lab-post')postWages();
  else if(a==='del-worker'){var w=workerById(id);if(!w)return;var n=state.attend.filter(function(d){return d.rows[id]}).length;
    ask('حذف «'+(w.name||'العامل')+'»'+(n?' و'+n+' يوم من سجل حضوره':'')+'؟\nإذا ترك العامل العمل فالأفضل تغيير حالته إلى «ترك العمل» للاحتفاظ بسجله.','حذف',true).then(function(ok){if(!ok)return;
      mutate(function(){state.workers=state.workers.filter(function(x){return x.id!==id});state.attend.forEach(function(d){delete d.rows[id]});state.attend=state.attend.filter(function(d){return Object.keys(d.rows).length})});toast('تم الحذف (يمكنك التراجع)')})}
});
