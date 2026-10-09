/* ================= weekly report, work photos, saved reports archive ================= */
var RKIND={general:'تقرير عام',weekly:'تقرير أسبوعي',plan:'خطة العمل'};
var PHW=1024,PHH=768,PHMAX=235000;

/* ---- local browser copy: big strings live in IndexedDB, the rest in localStorage ---- */
var HSEEN={};
function lightState(){
  if(!state.photos.length&&!state.archive.length)return state;
  var s=Object.assign({},state);
  s.photos=state.photos.map(function(p){var q=Object.assign({},p);if(q.src){if(!HSEEN['p'+p.id]){HSEEN['p'+p.id]=1;idbSet('h:p:'+p.id,q.src)}q.src=''}return q});
  s.archive=state.archive.map(function(a){var q=Object.assign({},a);if(q.z){if(!HSEEN['a'+a.id]){HSEEN['a'+a.id]=1;idbSet('h:a:'+a.id,q.z)}q.z=''}return q});
  return s;
}
function heavyLoad(){
  if(DESK)return;
  var miss=state.photos.filter(function(p){return !p.src}).map(function(p){return idbGet('h:p:'+p.id).then(function(v){if(v){p.src=v;HSEEN['p'+p.id]=1}})})
    .concat(state.archive.filter(function(a){return !a.z}).map(function(a){return idbGet('h:a:'+a.id).then(function(v){if(v){a.z=v;HSEEN['a'+a.id]=1}})}));
  if(miss.length)Promise.all(miss).then(function(){renderSoon()});
}

/* ---- compression for saved report pages ---- */
function b64(u8){var s='',i=0;for(;i<u8.length;i+=32768)s+=String.fromCharCode.apply(null,u8.subarray(i,i+32768));return btoa(s)}
function unb64(t){var s=atob(t),u=new Uint8Array(s.length);for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u}
function gz(str){
  if(typeof CompressionStream!=='function')return Promise.resolve('t:'+str);
  return new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer().then(function(b){return 'g:'+b64(new Uint8Array(b))}).catch(function(){return 't:'+str});
}
function gunz(z){
  z=String(z||'');if(z.slice(0,2)!=='g:')return Promise.resolve(z.slice(2));
  return new Response(new Blob([unb64(z.slice(2))]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
function hashStr(s){var h=5381;for(var i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return (h>>>0).toString(36)+s.length.toString(36)}

/* ---- photos: every image is cropped to the same 4:3 frame and size ---- */
function fitPhoto(file){
  return new Promise(function(res,rej){
    var u=URL.createObjectURL(file),im=new Image();
    im.onload=function(){
      var cv=document.createElement('canvas');cv.width=PHW;cv.height=PHH;var x=cv.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,PHW,PHH);
      var iw=im.naturalWidth,ih=im.naturalHeight,sc=Math.max(PHW/iw,PHH/ih),sw=PHW/sc,sh=PHH/sc;
      x.drawImage(im,(iw-sw)/2,(ih-sh)/2,sw,sh,0,0,PHW,PHH);URL.revokeObjectURL(u);
      var q=.74,d=cv.toDataURL('image/jpeg',q);while(d.length>PHMAX&&q>.35){q-=.08;d=cv.toDataURL('image/jpeg',q)}
      res(d);
    };
    im.onerror=function(){URL.revokeObjectURL(u);rej(new Error('img'))};
    im.src=u;
  });
}
function addPhotos(files,a,b){
  files=Array.prototype.filter.call(files||[],function(f){return /^image\//.test(f.type)||/\.(jpe?g|png|webp|heic|bmp|gif)$/i.test(f.name)});
  if(!files.length){toast('اختر صوراً');return}
  var t=todayNum(),def=Math.min(t,b),k=0,bad=0;toast('جارٍ تجهيز '+files.length+' صورة…');
  files.reduce(function(c,f){return c.then(function(){return fitPhoto(f).then(function(src){
    var lm=f.lastModified?Math.floor(f.lastModified/DAY-new Date().getTimezoneOffset()/1440):NaN,d=!isNaN(lm)&&lm>=a&&lm<=b?lm:def;
    mutate(function(){state.photos.push({id:uid('p'),date:iso(d),cap:'',src:src,rep:true})},{quiet:true});k++;
  }).catch(function(){bad++})})},Promise.resolve()).then(function(){renderAll();toast('تمت إضافة '+k+' صورة'+(bad?' – تعذّر قراءة '+bad:''))});
}
function photoUse(id){return state.archive.filter(function(r){return (r.ph||[]).indexOf(id)>=0}).length}
function flowPhotos(ctx,list,cols,title){
  if(!list.length)return;ctx.section();cols=Math.max(2,Math.min(3,+cols||2));
  for(var i=0;i<list.length;i+=cols){
    var row=el('div','ph-row');row.style.gridTemplateColumns='repeat('+cols+',minmax(0,1fr))';
    row.innerHTML=list.slice(i,i+cols).map(function(p){return '<figure><img data-ph="'+p.id+'" src="'+p.src+'" alt=""><figcaption><b>'+esc(p.cap||'')+'</b><span>'+fsi(p.date)+'</span></figcaption></figure>'}).join('');
    if(!i){var w=el('div');w.style.cssText='display:flex;flex-direction:column;gap:6px';w.innerHTML='<h2>'+esc(title)+'</h2>';w.appendChild(row);ctx.flow(w)}else ctx.flow(row);
  }
}

/* ---- weeks ---- */
function weekStartDay(){var v=parseInt(state.meta.weekStart,10);return isNaN(v)?6:v}
function weekOf(n){var s=weekStartDay();return n-((dow(n)-s+7)%7)}
function curWeek(){var a=ui.wkStart?dnum(ui.wkStart):NaN;if(isNaN(a))a=weekOf(todayNum());return {a:a,b:a+6}}
function weekNo(a){var s=weekOf(cStart());return Math.max(1,Math.floor((a-s)/7)+1)}
function weekRec(a){var id='k'+iso(a);for(var i=0;i<state.weeks.length;i++)if(state.weeks[i].id===id)return state.weeks[i];return null}
function weekVal(a,f){var r=weekRec(a);if(f==='no')return r&&r.no!==''&&r.no!=null?r.no:weekNo(a);if(f==='by')return r&&r.by!=null?r.by:(state.meta.preparer||'');if(f==='cols')return r&&r.cols?r.cols:2;return r?r[f]||'':''}
function setWeek(a,f,v){mutate(function(){var r=weekRec(a);if(!r){r={id:'k'+iso(a),start:iso(a)};state.weeks.push(r)}r[f]=v})}
function sumIn(list,a,b,fn){return list.reduce(function(s,r){var d=dnum(r.date);return s+(!isNaN(d)&&d>=a&&d<=b?fn(r):0)},0)}
var U=function(x){return state.meta.kind==='works'?(x.unit||TM('unit')):TM('unit')};
function weekAuto(a,b,what){
  var L=[];
  if(what==='done'){
    state.boq.forEach(function(x){var q=sumIn(state.installs.filter(function(r){return r.boq===x.id}),a,b,function(r){return num(r.qty)});if(!q)return;var cum=installedOf(x.id,b),tq=num(x.qty);
      L.push('• '+TM('verb')+' '+qn(q)+' '+U(x)+' – '+boqName(x.id)+' (التراكمي '+qn(cum)+' من '+qn(tq)+(tq?' – '+pct(cum/tq)+'%':'')+')')});
    state.boq.forEach(function(x){var q=sumIn(state.supplies.filter(function(r){return r.boq===x.id}),a,b,function(r){return num(r.qty)});if(q)L.push('• توريد '+qn(q)+' '+U(x)+' – '+boqName(x.id))});
    state.tasks.forEach(function(t){var f=tF(t);if(f>=a&&f<=b&&progOf(t,b)>=1)L.push('• اكتمال: '+t.name)});
    if(!L.length)L.push('• لا توجد أعمال مسجلة خلال الأسبوع.');
  }else{
    var na=b+1,nb=b+7;
    state.tasks.forEach(function(t){var s=tS(t),f=tF(t);if(s<=nb&&f>=na&&progOf(t)<1)L.push('• '+t.name+' ('+fs(Math.max(s,na))+' – '+fs(Math.min(f,nb))+')')});
    if(!L.length)L.push('• استكمال الأعمال الجارية حسب الجدول الزمني.');
  }
  return L.join('\n');
}
function weekJob(a){
  var b=a+6,n=weekVal(a,'no'),R={kind:'weekly',title:'التقرير الأسبوعي',no:n,from:iso(a),to:iso(b),by:weekVal(a,'by'),pcols:weekVal(a,'cols'),prices:false,footer:state.report.footer,breaks:false,secs:{},sign:state.report.sign,week:a};
  return {kind:'weekly',R:R,name:('التقرير الأسبوعي رقم '+n+' - '+(state.meta.short||state.meta.name)+' - '+iso(a)).replace(/[\\/:*?"<>|\n]+/g,' ').replace(/\s+/g,'-').slice(0,140)+'.pdf',prog:'#wk-prog'};
}
function planJob(){
  var R={kind:'plan',title:'خطة العمل وأسلوب التنفيذ',no:'',from:'',to:'',by:state.meta.preparer||'',prices:false,footer:state.report.footer,breaks:true,notes:'',sign:state.report.sign,
    secs:{cover:true,plan:true,schedule:true,gantt:true,rates:true,team:true,equip:true,risks:true,conditions:true,sign:true}};
  return {kind:'plan',R:R,name:('خطة العمل - '+(state.meta.short||state.meta.name)+' - '+todayIso()).replace(/[\\/:*?"<>|\n]+/g,' ').replace(/\s+/g,'-').slice(0,140)+'.pdf'};
}
/* weekly report body, drawn by the shared page engine */
function weeklyBody(ctx){
  var R=ctx.R,a=dnum(R.from),b=dnum(R.to),m=state.meta,o=overall(b),wk=weekRec(a)||{},c=esc(m.currency);
  var inW=function(r){var d=dnum(r.date);return !isNaN(d)&&d>=a&&d<=b};
  var wi=state.installs.filter(inW).reduce(function(s,r){return s+num(r.qty)},0),ws=state.supplies.filter(inW).reduce(function(s,r){return s+num(r.qty)},0);
  var we=expTotal(state.expenses.filter(function(r){return !r.hide&&inW(r)}));
  var md=0,mh=0;state.workers.forEach(function(w){var s=labStats(w.id,a,b);md+=s.p+s.m;mh+=s.hours});
  var stopD=0;state.events.forEach(function(e){if(e.type==='ext'||!e.from)return;var x=Math.max(a,dnum(e.from)),y=Math.min(b,e.to?dnum(e.to):b);if(y>=x)stopD+=y-x+1});
  ctx.flow(ctx.block('','<div class="cover"><div class="ti">التقرير الأسبوعي رقم '+esc(R.no)+'</div><div class="pj">'+esc(m.name)+'</div><div>عن الفترة من '+DOWS[dow(a)]+' '+fs(a)+' إلى '+DOWS[dow(b)]+' '+fs(b)+'</div></div>'+
    '<div class="info">'+[['الجهة المالكة',m.client],['رقم أمر الشراء',m.po],['الموقع',m.location],['المقاول',m.contractor],['تاريخ الانتهاء المعدّل',fs(revEnd())],['معد التقرير',R.by],['تاريخ الإصدار',fs(todayNum())],['المهندس المشرف',m.engineer]].map(function(x){return '<div><span>'+x[0]+':</span><b>'+esc(x[1]||'—')+'</b></div>'}).join('')+'</div>'));
  var gap=o.act-o.plan,k=[['نسبة '+TM('verbAl')+' التراكمية',pct(o.act)+'%','المخطط '+pct(o.plan)+'%'],[TM('verbAl')+' هذا الأسبوع',qn(wi),TM('unit')],['التراكمي',qn(o.inst),'من '+qn(o.q)],['التوريد هذا الأسبوع',qn(ws),TM('unit')],
    ['أيام عمل العمالة',qn(md),qn(mh)+' ساعة'],['مصاريف الأسبوع',money(we),c],['أيام إيقاف',String(stopD),'خلال الأسبوع'],['موقف الجدول',o.q?(gap>=-0.005?'مطابق':'متأخر'):'—',o.q&&gap<-0.005?pct(-gap)+'%':'']];
  ctx.flow(ctx.block('ملخص الأسبوع','<div class="kp">'+k.map(function(x){return '<div><span>'+x[0]+'</span><b>'+x[1]+'</b><small>'+esc(x[2])+'</small></div>'}).join('')+'</div>'));
  var tq=0,tw=0,tc=0,rows=state.boq.filter(function(x){return !x.hide}).map(function(x){var q=num(x.qty),w=sumIn(state.installs.filter(function(r){return r.boq===x.id}),a,b,function(r){return num(r.qty)}),cu=installedOf(x.id,b);tq+=q;tw+=w;tc+=cu;
    return '<td>'+esc(x.no)+'</td><td class="tx">'+esc(boqName(x.id))+'</td><td>'+qn(q)+'</td><td>'+(w?'<b>'+qn(w)+'</b>':'–')+'</td><td>'+qn(Math.max(0,cu-w))+'</td><td>'+qn(cu)+'</td><td><div class="rb"><i style="width:'+pct(q?Math.min(1,cu/q):0)+'%"></i></div>'+pct(q?cu/q:0)+'%</td>'});
  ctx.table(TM('verbAl')+' خلال الأسبوع',['البند',TM('itemCol'),'الكمية التعاقدية','هذا الأسبوع','حتى الأسبوع السابق','التراكمي','نسبة الإنجاز'],rows,rows.length?'<td colspan="2">الإجمالي</td><td>'+qn(tq)+'</td><td>'+qn(tw)+'</td><td>'+qn(Math.max(0,tc-tw))+'</td><td>'+qn(tc)+'</td><td>'+pct(tq?tc/tq:0)+'%</td>':null);
  [['done','الأعمال المنفذة خلال الأسبوع'],['next','الأعمال المخططة للأسبوع القادم'],['issues','المعوقات والملاحظات'],['safety','السلامة والجودة']].forEach(function(x){var t=String(wk[x[0]]||(x[0]==='done'||x[0]==='next'?weekAuto(a,b,x[0]):'')).trim();if(t)ctx.paras(x[1],t)});
  var act=state.tasks.filter(function(t){return !t.ms&&tS(t)<=b&&tF(t)>=a});
  ctx.table('المهام الجارية خلال الأسبوع',['الرمز','المهمة','البداية','النهاية','الإنجاز','الحالة'],act.map(function(t){var st=statusOf(t);return '<td>'+esc(t.code)+'</td><td class="tx">'+esc(t.name)+'</td><td>'+fs(tS(t))+'</td><td>'+fs(tF(t))+'</td><td>'+pct(progOf(t,b))+'%</td><td class="'+(st==='done'?'ok':st==='late'?'bad':st==='active'?'wr':'')+'">'+STL[st]+'</td>'}));
  var lw=state.workers.map(function(w){return [w,labStats(w.id,a,b)]}).filter(function(x){return x[1].days});
  ctx.table('العمالة خلال الأسبوع',['#','العامل','الوظيفة','حضور','مأمورية','غياب','إجازة/مرضي','الساعات','إضافي'],lw.map(function(x,i){var s=x[1];return '<td>'+(i+1)+'</td><td class="tx">'+esc(x[0].name||'')+'</td><td class="tx">'+esc(x[0].job||'')+'</td><td>'+s.p+'</td><td>'+s.m+'</td><td>'+s.a+'</td><td>'+(s.l+s.k)+'</td><td>'+qn(s.hours)+'</td><td>'+qn(s.ot)+'</td>'}),lw.length?'<td colspan="3">الإجمالي</td><td colspan="2">'+qn(md)+' يوم عمل</td><td colspan="2"></td><td>'+qn(mh)+'</td><td></td>':null);
  var ev=state.events.filter(function(e){if(e.hide)return false;if(e.type==='ext'){var d=dnum(e.date);return d>=a&&d<=b}var x=dnum(e.from),y=e.to?dnum(e.to):b;return x<=b&&y>=a});
  ctx.table('أوامر الإيقاف والمدد خلال الأسبوع',['النوع','رقم الأمر','من','حتى','الأيام','السبب'],ev.map(function(e){var x=e.type==='ext';return '<td>'+EVT[e.type]+'</td><td>'+esc(e.ref||'—')+'</td><td>'+(x?fsi(e.date):fsi(e.from))+'</td><td>'+(x?'—':e.to?fsi(e.to):'<span class="bad">سارٍ</span>')+'</td><td>'+evDays(e)+'</td><td class="tx">'+esc(e.reason||'')+'</td>'}));
  flowPhotos(ctx,state.photos.filter(function(p){return p.rep!==false&&p.src&&inW(p)}).sort(function(x,y){return dnum(x.date)-dnum(y.date)}),R.pcols,'صور الأعمال خلال الأسبوع');
  var sg=(R.sign||[]).filter(function(x){return x.t||x.n});if(sg.length)ctx.flow(ctx.block('','<div class="sig" style="grid-template-columns:repeat('+sg.length+',1fr)">'+sg.map(function(x){return '<div><b>'+esc(x.t)+'</b><span>'+(esc(x.n)||'الاسم: ....................')+'</span><span>التوقيع: ....................</span></div>'}).join('')+'</div>'));
}
function previewInto(box,job){
  fontsReady().then(function(){
    if(!box||!box.isConnected)return;
    var host=el('div','rp-host');host.style.visibility='hidden';host.style.zIndex='-1';document.body.appendChild(host);
    var pages=jobPages(job,host),sc=Math.min(1,((box.clientWidth||820)-28)/794),frag=document.createDocumentFragment();
    pages.forEach(function(pg){var w=el('div','pv');w.style.width=(794*sc)+'px';w.style.height=(1123*sc)+'px';pg.style.transform='scale('+sc+')';w.appendChild(pg);frag.appendChild(w)});
    box.innerHTML='<span class="prog">'+pages.length+' صفحة</span>';box.appendChild(frag);host.remove();
  });
}
var wkT;
function renderWeekly(p){
  var w=curWeek(),a=w.a,b=w.b,r=weekRec(a)||{},inW=function(x){var d=dnum(x.date);return !isNaN(d)&&d>=a&&d<=b};
  var ph=state.photos.filter(inW).sort(function(x,y){return dnum(x.date)-dnum(y.date)});
  var ta=function(f,label,auto,rows){return '<label class="f wide"><span>'+label+(auto?' <button type="button" class="btn sm" data-act="wk-auto" data-v="'+f+'">توليد تلقائي من السجلات</button>':'')+'</span><textarea class="in" data-wk="'+f+'" rows="'+(rows||5)+'" placeholder="'+(auto?'اتركه فارغاً ليُكتب تلقائياً من السجلات':'')+'">'+esc(r[f]||'')+'</textarea></label>'};
  var cards=ph.map(function(x){return '<div class="phc'+(x.rep===false?' off':'')+'"><img src="'+(x.src||'')+'" alt="" loading="lazy"><div class="phf"><input class="cell" '+B('photos',x.id,'cap')+' value="'+esc(x.cap||'')+'" placeholder="وصف الصورة"><div class="phb"><input class="cell" type="date" '+B('photos',x.id,'date')+' value="'+esc(x.date||'')+'"><label class="chk"><input type="checkbox" '+B('photos',x.id,'rep')+(x.rep!==false?' checked':'')+'>في التقرير</label><button class="btn icon ghost danger" data-act="del-photo" data-id="'+x.id+'" title="حذف الصورة" aria-label="حذف الصورة">✕</button></div></div></div>'}).join('');
  p.innerHTML='<div class="rep"><div class="rep-cfg">'+
  '<div class="card"><h2>التقرير الأسبوعي</h2><div class="toolbar"><button class="btn sm icon" data-act="wk-go" data-v="-7" title="الأسبوع السابق" aria-label="الأسبوع السابق">→</button><input class="in" type="date" id="wk-date" style="width:auto" value="'+iso(a)+'" aria-label="بداية الأسبوع"><button class="btn sm icon" data-act="wk-go" data-v="7" title="الأسبوع التالي" aria-label="الأسبوع التالي">←</button><button class="btn sm" data-act="wk-go" data-v="0">الأسبوع الحالي</button></div>'+
   '<p class="hint">من '+DOWS[dow(a)]+' '+fs(a)+' إلى '+DOWS[dow(b)]+' '+fs(b)+'</p>'+
   '<div class="fields" style="grid-template-columns:1fr 1fr"><label class="f"><span>رقم التقرير</span><input class="in" data-wk="no" value="'+esc(weekVal(a,'no'))+'"></label><label class="f"><span>معد التقرير</span><input class="in" data-wk="by" value="'+esc(weekVal(a,'by'))+'"></label>'+
   '<label class="f"><span>بداية الأسبوع</span>'+sel('meta',state.meta,'weekStart',[['6','السبت'],['0','الأحد'],['1','الاثنين']].map(function(x){return x}))+'</label><label class="f"><span>الصور في الصف</span><select class="in" data-wk="cols"><option value="2"'+(+weekVal(a,'cols')===2?' selected':'')+'>صورتان (كبيرة)</option><option value="3"'+(+weekVal(a,'cols')===3?' selected':'')+'>3 صور</option></select></label></div>'+
   '<div class="toolbar">'+(canPrint()?'<button class="btn primary" data-act="wk-print">طباعة / حفظ PDF</button><button class="btn" data-act="wk-pdf">تحميل PDF مباشرة</button>':'<button class="btn primary" data-act="wk-pdf">تحميل PDF</button>')+'<button class="btn" data-act="arch-save" data-v="weekly">حفظ في الأرشيف</button></div><span class="prog" id="wk-prog"></span>'+
   '<p class="hint">الأرقام والجداول (المنفذ، التوريد، العمالة، المهام، الإيقاف) تُحسب تلقائياً لأيام الأسبوع. كل طباعة أو تحميل يُحفظ في «أرشيف التقارير».</p></div>'+
  '<div class="card"><h3>نص التقرير</h3>'+ta('done','الأعمال المنفذة خلال الأسبوع',1,6)+ta('next','الأعمال المخططة للأسبوع القادم',1,5)+ta('issues','المعوقات والملاحظات',0,3)+ta('safety','السلامة والجودة',0,3)+'</div>'+
  '<div class="card"><div class="card-h"><h3>صور الأعمال ('+ph.length+')</h3><label class="btn primary sm">+ إضافة صور<input type="file" accept="image/*" multiple data-ph-up hidden></label></div>'+
   '<div class="drop" data-ph-drop>اسحب الصور هنا أو اضغط «إضافة صور». كل صورة تُقص وتُضبط تلقائياً بمقاس موحد 4:3 لتناسب التقرير.</div>'+
   (cards?'<div class="phg">'+cards+'</div>':'<p class="hint">لا توجد صور بتاريخ هذا الأسبوع.</p>')+'</div>'+
  '</div><div class="preview" id="wk-preview"><span class="prog">جارٍ تجهيز المعاينة…</span></div></div>';
  clearTimeout(wkT);wkT=setTimeout(function(){previewInto($('#wk-preview'),weekJob(a))},120);
}

/* ---- saved reports archive ---- */
var archBusy={};
function archiveAdd(job,pages,manual){
  if(!job||job.html!=null||!pages||!pages.length)return;
  var ph={},parts=pages.map(function(pg){var c=pg.cloneNode(true);c.removeAttribute('style');$$('img[data-k],img[data-ph]',c).forEach(function(i){if(i.getAttribute('data-ph'))ph[i.getAttribute('data-ph')]=1;i.setAttribute('src','')});return c.outerHTML});
  var html=parts.join('\n'),h=hashStr(html),R=job.R||{},dup=state.archive.filter(function(x){return x.h===h})[0];
  if(dup){if(manual)toast('هذا التقرير محفوظ بالفعل في الأرشيف: '+dup.name);return}
  if(archBusy[h])return;archBusy[h]=1;
  var now=new Date(),day=DOWS[now.getDay()],dt=pad(now.getDate())+'/'+pad(now.getMonth()+1)+'/'+now.getFullYear(),tm=pad(now.getHours())+':'+pad(now.getMinutes());
  var title=job.kind==='weekly'?'التقرير الأسبوعي رقم '+R.no:job.kind==='plan'?'خطة العمل':(R.title||'تقرير')+(R.no?' رقم '+R.no:'');
  var by=R.by!=null&&R.by!==''?R.by:(state.meta.preparer||'');
  var g=repRange(R),period=job.kind==='plan'?'—':(R.from?fs(g.a)+' – '+fs(g.b):'حتى '+fs(g.b));
  gz(html).then(function(z){
    delete archBusy[h];
    if(z.length>250000)toast('التقرير كبير جداً على قاعدة البيانات المشتركة؛ حُفظ في هذا الجهاز وقد لا يُرفع.');
    mutate(function(){state.archive.unshift({id:uid('r'),kind:job.kind,name:title+' – '+day+' '+dt+' الساعة '+tm,at:now.toISOString(),day:day,date:dt,time:tm,by:by,period:period,pages:parts.length,size:z.length,h:h,ph:Object.keys(ph),z:z})},{quiet:ui.tab!=='archive'});
    toast('تم حفظ التقرير في الأرشيف');
  }).catch(function(){delete archBusy[h]});
}
function archiveSaveNow(kind){
  var job=kind==='weekly'?weekJob(curWeek().a):kind==='plan'?planJob():curJob();
  fontsReady().then(function(){var host=el('div','rp-host');host.style.visibility='hidden';host.style.zIndex='-1';document.body.appendChild(host);var pg=jobPages(job,host);archiveAdd(job,pg,true);host.remove()});
}
function pagesFromHtml(host,html){
  host.innerHTML=html;
  $$('img[data-k]',host).forEach(function(i){var k=i.getAttribute('data-k'),s=k==='logo'?logoSrc():ASSETS.footer||'';if(s)i.src=s;else i.remove()});
  $$('img[data-ph]',host).forEach(function(i){var p=state.photos.filter(function(x){return x.id===i.getAttribute('data-ph')})[0];if(p&&p.src)i.src=p.src;else{var d=el('div','ph-miss','الصورة محذوفة');i.replaceWith(d)}});
  return $$('.rp',host);
}
function archJob(r){return gunz(r.z).then(function(html){return {kind:r.kind,html:html,name:String(r.name||'تقرير').replace(/[\\/:*?"<>|\n]+/g,' ').replace(/\s+/g,'-').slice(0,140)+'.pdf',prog:'#arch-prog'}})}
function renderArchive(p){
  var f=(ui.f.archive||{}).k||'',q=String((ui.f.archive||{}).q||'').trim();
  var list=state.archive.filter(function(r){return (!f||r.kind===f)&&(!q||(r.name+' '+(r.by||'')).indexOf(q)>=0)}).sort(function(x,y){return String(y.at).localeCompare(String(x.at))});
  var rows=list.map(function(r){return '<tr><td style="min-width:260px">'+inp('archive',r,'name','text')+'</td><td><span class="pill '+(r.kind==='weekly'?'a':r.kind==='plan'?'n':'ok')+'">'+(RKIND[r.kind]||r.kind)+'</span></td><td>'+esc(r.day||'')+'</td><td class="num">'+esc(r.date||'')+'</td><td class="num">'+esc(r.time||'')+'</td><td style="min-width:130px">'+inp('archive',r,'by','text')+'</td><td class="num" style="white-space:nowrap">'+esc(r.period||'')+'</td><td class="n">'+(r.pages||'')+'</td><td class="n num">'+(r.size?Math.max(1,Math.round(r.size/1024))+' ك.ب':'')+'</td>'+
    '<td><div class="rowact">'+(r.z?'<button class="btn sm" data-act="arch-view" data-id="'+r.id+'">معاينة</button>'+(canPrint()?'<button class="btn sm" data-act="arch-print" data-id="'+r.id+'">طباعة</button>':'')+'<button class="btn sm primary" data-act="arch-pdf" data-id="'+r.id+'">PDF</button>':'<span class="muted">جارٍ التحميل…</span>')+'<button class="btn icon ghost danger" data-act="arch-del" data-id="'+r.id+'" title="حذف" aria-label="حذف">✕</button></div></td></tr>'}).join('');
  p.innerHTML='<div class="card"><div class="card-h"><h2>أرشيف التقارير</h2><span class="pill a">'+state.archive.length+' تقرير</span></div>'+
   '<div class="toolbar"><div class="seg" role="group" aria-label="نوع التقرير">'+[['','الكل'],['general',RKIND.general],['weekly',RKIND.weekly],['plan',RKIND.plan]].map(function(x){return '<button data-act="arch-k" data-v="'+x[0]+'" aria-pressed="'+(f===x[0])+'">'+x[1]+'</button>'}).join('')+'</div>'+
   '<label class="f grow"><span>بحث</span><input class="in" type="search" data-f="archive|q" value="'+esc(q)+'" placeholder="اسم التقرير أو معده"></label><span class="grow"></span><button class="btn sm" data-act="arch-save" data-v="general">حفظ التقرير العام الحالي</button><button class="btn sm" data-act="arch-save" data-v="weekly">حفظ تقرير الأسبوع الحالي</button><button class="btn sm" data-act="arch-save" data-v="plan">حفظ خطة العمل</button></div><span class="prog" id="arch-prog"></span>'+
   (rows?'<div class="tw"><table class="t"><thead><tr><th>اسم التقرير</th><th>النوع</th><th>اليوم</th><th>التاريخ</th><th>الساعة</th><th>معد التقرير</th><th>الفترة</th><th class="n">الصفحات</th><th class="n">الحجم</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty">لا توجد تقارير محفوظة بعد. أي تقرير تطبعه أو تحمّله من «التقرير / PDF» أو «التقرير الأسبوعي» أو «خطة العمل» يُحفظ هنا تلقائياً.</div>')+
   '<p class="hint">التقرير المحفوظ يبقى كما كان وقت إصداره (الأرقام والنصوص والصور) حتى لو تغيرت البيانات بعد ذلك، ويمكن تحميله أو طباعته في أي وقت. يمكنك تعديل اسم التقرير ومعده من الجدول.</p></div>';
}
function archView(r){
  archJob(r).then(function(job){
    openDlg('<div class="dlg-h"><h2>'+esc(r.name)+'</h2><button type="button" class="btn icon ghost" data-act="close-dlg" aria-label="إغلاق">✕</button></div><div class="preview arch-pv" id="arch-pv"></div><div class="dlg-f"><span class="muted">'+esc((RKIND[r.kind]||'')+' · '+(r.by?'إعداد '+r.by+' · ':'')+(r.day||'')+' '+(r.date||'')+' '+(r.time||''))+'</span><div class="toolbar">'+(canPrint()?'<button type="button" class="btn" data-act="arch-print" data-id="'+r.id+'">طباعة</button>':'')+'<button type="button" class="btn primary" data-act="arch-pdf" data-id="'+r.id+'">تحميل PDF</button></div></div>',null);
    var d=dlg();d.classList.add('wide');d.addEventListener('close',function(){d.classList.remove('wide')},{once:true});
    previewInto($('#arch-pv'),job);
  }).catch(function(){toast('تعذّر فتح التقرير المحفوظ')});
}
document.addEventListener('change',function(e){
  var t=e.target;
  if(t.id==='wk-date'){if(t.value){ui.wkStart=iso(weekOf(dnum(t.value)));renderAll()}return}
  if(t.hasAttribute&&t.hasAttribute('data-ph-up')){var w=curWeek();addPhotos(t.files,w.a,w.b);t.value='';return}
  var f=t.getAttribute&&t.getAttribute('data-wk');if(f){setWeek(curWeek().a,f,f==='cols'?+t.value:t.value)}
});
document.addEventListener('dragover',function(e){var z=e.target.closest&&e.target.closest('[data-ph-drop]');if(z){e.preventDefault();z.classList.add('on')}});
document.addEventListener('dragleave',function(e){var z=e.target.closest&&e.target.closest('[data-ph-drop]');if(z)z.classList.remove('on')});
document.addEventListener('drop',function(e){var z=e.target.closest&&e.target.closest('[data-ph-drop]');if(!z)return;e.preventDefault();z.classList.remove('on');var w=curWeek();addPhotos(e.dataTransfer.files,w.a,w.b)});
document.addEventListener('click',function(e){
  var b=e.target.closest&&e.target.closest('[data-act]');if(!b)return;var a=b.getAttribute('data-act'),v=b.getAttribute('data-v'),id=b.getAttribute('data-id');
  var rec=function(){return state.archive.filter(function(x){return x.id===id})[0]};
  if(a==='wk-go'){ui.wkStart=+v===0?'':iso(curWeek().a+(+v));renderAll()}
  else if(a==='wk-auto'){var w=curWeek(),cur=weekVal(w.a,v),txt=weekAuto(w.a,w.b,v);(cur?ask('استبدال النص الحالي بالنص المولّد من السجلات؟','استبدال'):Promise.resolve(true)).then(function(ok){if(ok)setWeek(w.a,v,txt)})}
  else if(a==='wk-print')doPrint(weekJob(curWeek().a));
  else if(a==='wk-pdf')exportPdf(weekJob(curWeek().a));
  else if(a==='plan-print')doPrint(planJob());
  else if(a==='plan-pdf')exportPdf(planJob());
  else if(a==='arch-save')archiveSaveNow(v);
  else if(a==='arch-k'){ui.f.archive=ui.f.archive||{};ui.f.archive.k=v;saveUi();renderAll()}
  else if(a==='arch-view'){var r=rec();if(r)archView(r)}
  else if(a==='arch-print'){var r2=rec();if(r2)archJob(r2).then(doPrint)}
  else if(a==='arch-pdf'){var r3=rec();if(r3)archJob(r3).then(exportPdf)}
  else if(a==='arch-del'){var r4=rec();if(!r4)return;ask('حذف «'+r4.name+'» من الأرشيف نهائياً؟ لا يمكن التراجع عن هذا الحذف.','حذف',true).then(function(ok){if(ok){mutate(function(){state.archive=state.archive.filter(function(x){return x.id!==id})});idbSet('h:a:'+id,null)}})}
  else if(a==='del-photo'){var n=photoUse(id);ask('حذف هذه الصورة نهائياً؟'+(n?'\nالصورة مستخدمة في '+n+' تقرير محفوظ في الأرشيف وستختفي منه.':''),'حذف',true).then(function(ok){if(ok){mutate(function(){state.photos=state.photos.filter(function(x){return x.id!==id})});idbSet('h:p:'+id,null)}})}
});
