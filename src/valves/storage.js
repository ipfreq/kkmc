/* ================= confirm dialog (the artifact viewer blocks window.confirm) ================= */
function ask(msg,okTxt,danger){
  return new Promise(function(res){
    openDlg('<div class="dlg-h"><h2>تأكيد</h2><button type="button" class="btn icon ghost" data-act="close-dlg" aria-label="إغلاق">✕</button></div><p style="margin:0;line-height:1.8">'+esc(msg)+'</p><div class="dlg-f"><span></span><div class="toolbar"><button type="button" class="btn" data-act="close-dlg">إلغاء</button><button class="btn '+(danger?'danger':'primary')+'" value="ok">'+esc(okTxt||'متابعة')+'</button></div></div>',function(){res(true)});
    dlg()._cancel=function(){res(false)};
  });
}

/* ================= host runtime (only present when the page is opened as a published page) ================= */
var HOST=(window.PLAN_HOST&&typeof window.PLAN_HOST.use==='function')?window.PLAN_HOST:null;
var DL=null;
function canPrint(){return !HOST||!!HOST.print}

/* ================= shared database (published page) ================= */
var DBCOLS=['boq','groups','tasks','events','installs','supplies','expenses','sections','team','equip','rates','risks','conditions'];
var DB={api:null,on:false,last:{},timer:0,busy:false,again:false,ro:false,status:HOST?'loading':'off',at:0,err:''};
function canon(o){if(Array.isArray(o))return '['+o.map(canon).join(',')+']';if(o&&typeof o==='object'){return '{'+Object.keys(o).filter(function(k){return o[k]!==undefined}).sort().map(function(k){return JSON.stringify(k)+':'+canon(o[k])}).join(',')+'}'}return JSON.stringify(o===undefined?null:o)}
var IDOK=/^[A-Za-z0-9_\-.~:@+]{1,120}$/;
function projDocs(){var m=clone(state.meta);delete m.updated;return {'project/meta':m,'project/report':clone(state.report),'project/settings':{expCats:state.expCats.slice(),v:state.v||1}}}
function dbDocs(){
  var out=projDocs();
  DBCOLS.forEach(function(c){state[c].forEach(function(r,i){if(!IDOK.test(r.id||''))r.id=uid(c.charAt(0));var b=clone(r);b._o=i;out[c+'/'+r.id]=b})});
  return out;
}
function localDoc(p){
  var pd=projDocs();if(p in pd)return pd[p];
  var s=p.split('/'),c=s[0],a=state[c];if(!Array.isArray(a))return null;
  for(var i=0;i<a.length;i++)if(a[i].id===s[1]){var b=clone(a[i]);b._o=i;return b}
  return null;
}
function applyRemote(p,data){
  var s=p.split('/'),c=s[0],id=s[1];
  if(c==='project'){
    if(!data)return;
    if(id==='meta'){var keep=state.meta.updated;state.meta=Object.assign({},state.meta,data);state.meta.updated=keep}
    else if(id==='report'){state.report=Object.assign({},state.report,data)}
    else if(id==='settings'){if(Array.isArray(data.expCats))state.expCats=data.expCats.slice()}
    return;
  }
  var a=state[c];if(!Array.isArray(a))return;
  var ix=-1;for(var i=0;i<a.length;i++)if(a[i].id===id){ix=i;break}
  if(!data){if(ix>=0)a.splice(ix,1);return}
  var row=clone(data);delete row._o;row.id=id;
  if(ix>=0)a[ix]=row;else a.push(row);
}
function resort(c){
  var a=state[c];if(!Array.isArray(a))return;
  var pos={};a.forEach(function(r,i){var j=DB.last[c+'/'+r.id];var o=i;if(j){try{var d=JSON.parse(j);if(typeof d._o==='number')o=d._o}catch(e){}}pos[r.id]=o});
  a.sort(function(x,y){return pos[x.id]-pos[y.id]});
}
function dbInit(){
  if(!HOST)return;
  HOST.use('db').then(function(db){
    if(!db){DB.status='off';renderStatus();return}
    DB.api=db;
    var cols=['project'].concat(DBCOLS);
    return Promise.all(cols.map(function(c){return db.collection(c).get()})).then(function(snaps){
      var any=snaps.some(function(s){return !s.empty});
      if(any){
        var next=clone(state);
        DBCOLS.forEach(function(c){next[c]=[]});
        snaps.forEach(function(s,k){var c=cols[k];s.docs.forEach(function(d){DB.last[c+'/'+d.id]=canon(d.data())})});
        var cur=state;state=next;
        Object.keys(DB.last).forEach(function(p){applyRemote(p,JSON.parse(DB.last[p]))});
        DBCOLS.forEach(resort);
        if(!snaps[0].docs.length)state.meta=cur.meta;
        state=normalize(state);
        hist=[];fut=[];
        if(!state.tasks.some(function(t){return t.bs})){initBaseline();any=false}
      }else if(HOST.blank){
        var d0=todayNum();
        state.meta=Object.assign(state.meta,{client:'',po:'',location:'',engineer:'',value:'',start:iso(d0),end:iso(d0+179)});
        ['boq','installs','supplies','expenses','events','sections','team','equip','rates','risks','conditions'].forEach(function(k){state[k]=[]});
        state.tasks=state.tasks.filter(function(t){return t.ms}).map(function(t){t.preds=[];t.nb=t.code==='A1000'?iso(d0):'';t.bs='';t.bf='';return t});
        initBaseline();
      }
      if(!any&&HOST.newName){state.meta.name=HOST.newName;state.meta.short=HOST.newName}
      DB.on=true;DB.status='ok';
      cacheLocal();sched();renderAll();
      cols.forEach(function(c){db.collection(c).onSnapshot(function(s){onRemote(c,s)},function(e){if(e&&e.code==='revoked'){DB.on=false;DB.status='off';renderStatus()}})});
      if(!any)dbQueue();
      if(HOST.takeImport)HOST.takeImport().then(function(f){if(!f)return;var p=/\.xlsx$/i.test(f.name)?readXlsxState(f.bytes.buffer||f.bytes):Promise.resolve().then(function(){var o=JSON.parse(new TextDecoder().decode(f.bytes));return o&&o.state?o.state:o});return p.then(function(o){if(!o||!o.meta||!o.boq){toast('الملف لا يحتوي على بيانات مشروع صالحة');return}state=normalize(o);hist=[];fut=[];saveDraft();sched();renderAll();toast('تم استيراد المشروع من الملف')})}).catch(function(){toast('تعذّر قراءة الملف')});
    });
  }).catch(function(){DB.status='error';DB.err='تعذّر الاتصال بقاعدة البيانات. التعديلات محفوظة في هذا المتصفح.';renderStatus()});
}
function onRemote(c,snap){
  var changed=false,touched={};
  snap.docChanges().forEach(function(ch){
    var p=c+'/'+ch.doc.id,local=localDoc(p),lj=local?canon(local):null;
    if(ch.type==='removed'){
      if(DB.last[p]!=null&&lj===DB.last[p]){applyRemote(p,null);delete DB.last[p];changed=true;touched[c]=1}
      return;
    }
    var j=canon(ch.doc.data());
    if(j===DB.last[p])return;
    var pendingLocal=(lj!==(DB.last[p]==null?null:DB.last[p]));
    if(pendingLocal&&lj!==j)return;
    DB.last[p]=j;if(lj!==j){applyRemote(p,ch.doc.data());changed=true;touched[c]=1}
  });
  if(changed){Object.keys(touched).forEach(resort);cacheLocal();sched();renderSoon()}
}
function dbQueue(){if(!DB.on||DB.ro)return;clearTimeout(DB.timer);DB.status='pending';renderStatus();DB.timer=setTimeout(function(){DB.timer=0;dbFlush()},DESK?150:600)}
function dbSettle(){if(!DB.on)return Promise.resolve();if(DB.timer){clearTimeout(DB.timer);DB.timer=0;dbFlush()}return new Promise(function(res){var n=0;(function wait(){if((!DB.busy&&!DB.timer&&!DB.again)||n++>100)res();else setTimeout(wait,50)})()})}
function dbFlush(){
  if(DB.busy){DB.again=true;return}
  var want=dbDocs(),ops=[];
  Object.keys(want).forEach(function(p){var j=canon(want[p]);if(DB.last[p]!==j)ops.push({p:p,b:want[p],j:j})});
  Object.keys(DB.last).forEach(function(p){if(!(p in want))ops.push({p:p,del:true})});
  if(!ops.length){DB.status='ok';renderStatus();return}
  DB.busy=true;DB.status='saving';renderStatus();
  var i=0,fail=null;
  function one(o,retry){
    var ref=DB.api.doc(o.p);
    return (o.del?ref.delete():ref.set(o.b)).then(function(){if(o.del)delete DB.last[o.p];else DB.last[o.p]=o.j})
      .catch(function(e){var c=e&&e.code;if(c==='unavailable'&&!retry)return new Promise(function(r){setTimeout(r,800+Math.random()*900)}).then(function(){return one(o,true)});if(!fail)fail=c||'unavailable'});
  }
  function worker(){if(fail||i>=ops.length)return Promise.resolve();var o=ops[i++];return one(o).then(worker)}
  Promise.all([worker(),worker(),worker(),worker()]).then(function(){
    DB.busy=false;
    if(fail){
      if(fail==='invalid_argument'||fail==='not_granted'||fail==='revoked'){DB.ro=true;DB.status='ro';toast('لا تملك صلاحية تعديل قاعدة البيانات. تعديلاتك محفوظة في هذا المتصفح فقط.')}
      else if(fail==='quota_exceeded'){DB.status='error';DB.err='امتلأت سعة قاعدة البيانات. احذف سجلات قديمة أو صدّر نسخة Excel.';toast(DB.err)}
      else if(fail==='resource_exhausted'){DB.status='pending';setTimeout(dbQueue,4000)}
      else {DB.status='error';DB.err='تعذّر الحفظ في قاعدة البيانات. سيُعاد المحاولة مع التعديل التالي.';}
      renderStatus();return;
    }
    DB.at=Date.now();
    if(DB.again){DB.again=false;dbFlush()}else{DB.status='ok';renderStatus()}
  });
}

/* ================= linked Excel file as a database (local copy, Chrome / Edge) ================= */
var FDB={handle:null,name:'',status:'off',at:0,timer:0,busy:false,again:false,err:''};
function fdbSupported(){return !HOST&&typeof window.showSaveFilePicker==='function'}
function idb(){return new Promise(function(res,rej){try{var r=indexedDB.open('kkmc-valves',1);r.onupgradeneeded=function(){r.result.createObjectStore('kv')};r.onsuccess=function(){res(r.result)};r.onerror=function(){rej(r.error)}}catch(e){rej(e)}})}
function idbSet(k,v){return idb().then(function(d){return new Promise(function(res){var t=d.transaction('kv','readwrite');if(v==null)t.objectStore('kv').delete(k);else t.objectStore('kv').put(v,k);t.oncomplete=function(){res()};t.onerror=function(){res()}})}).catch(function(){})}
function idbGet(k){return idb().then(function(d){return new Promise(function(res){var t=d.transaction('kv','readonly'),q=t.objectStore('kv').get(k);q.onsuccess=function(){res(q.result)};q.onerror=function(){res(null)}})}).catch(function(){return null})}
var XLTYPES=[{description:'ملف Excel',accept:{'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':['.xlsx']}}];
function fdbAttach(h,write){FDB.handle=h;FDB.name=h.name;FDB.status='ok';idbSet('fdb',h);renderAll();if(write)fdbWrite()}
function fdbCreate(){
  window.showSaveFilePicker({suggestedName:dbFileName(),types:XLTYPES}).then(function(h){fdbAttach(h,true);toast('تم ربط الملف. كل تعديل سيُحفظ فيه تلقائياً.')}).catch(function(e){if(e&&e.name!=='AbortError')toast('تعذّر إنشاء الملف')});
}
function fdbOpen(){
  window.showOpenFilePicker({types:XLTYPES,multiple:false}).then(function(hs){var h=hs[0];return h.getFile().then(function(f){return f.arrayBuffer()}).then(readXlsxState).then(function(o){
    if(!o){toast('هذا الملف لا يحتوي على بيانات المشروع. استخدم «إنشاء ملف Excel» لملف جديد.');return}
    ask('سيتم تحميل بيانات المشروع من الملف «'+h.name+'» وربطه للحفظ التلقائي. متابعة؟','فتح الملف').then(function(ok){if(!ok)return;snap();state=normalize(o);cacheLocal();sched();fdbAttach(h,false);toast('تم فتح قاعدة البيانات من الملف')});
  })}).catch(function(e){if(e&&e.name!=='AbortError')toast('تعذّر فتح الملف')});
}
function fdbResume(){
  var h=FDB.handle;if(!h)return;
  h.requestPermission({mode:'readwrite'}).then(function(p){
    if(p!=='granted'){toast('لم يتم السماح بالوصول للملف');return}
    return h.getFile().then(function(f){return f.arrayBuffer()}).then(readXlsxState).then(function(o){
      FDB.status='ok';
      var fu=o&&o.meta&&o.meta.updated||'',lu=state.meta.updated||'';
      if(o&&fu>lu){snap();state=normalize(o);cacheLocal();sched();toast('تم تحميل أحدث نسخة من الملف')}
      else if(fu!==lu)fdbWrite();
      renderAll();
    });
  }).catch(function(){FDB.status='error';FDB.err='تعذّر الوصول للملف. ربما نُقل أو حُذف.';renderStatus()});
}
function fdbDetach(){FDB.handle=null;FDB.name='';FDB.status='off';idbSet('fdb',null);renderAll();toast('تم فصل الملف. التعديلات تُحفظ في المتصفح فقط.')}
function fdbQueue(){if(!FDB.handle||FDB.status==='perm')return;clearTimeout(FDB.timer);FDB.status='pending';renderStatus();FDB.timer=setTimeout(fdbWrite,1200)}
function fdbWrite(){
  var h=FDB.handle;if(!h)return;
  if(FDB.busy){FDB.again=true;return}
  FDB.busy=true;FDB.status='saving';renderStatus();
  (h.queryPermission?h.queryPermission({mode:'readwrite'}):Promise.resolve('granted')).then(function(p){
    if(p!=='granted'){FDB.status='perm';throw {perm:1}}
    return xlLib().then(function(){return buildWorkbook(true).xlsx.writeBuffer()});
  }).then(function(buf){return h.createWritable().then(function(w){return w.write(buf).then(function(){return w.close()})})})
  .then(function(){FDB.busy=false;FDB.at=Date.now();FDB.status='ok';if(FDB.again){FDB.again=false;fdbWrite()}else renderStatus()})
  .catch(function(e){FDB.busy=false;if(e&&e.perm){renderAll();return}FDB.status='error';FDB.err='تعذّر الحفظ في الملف. إذا كان مفتوحاً في Excel أغلقه ثم اضغط «حفظ الآن».';renderStatus()});
}
function fdbBoot(){if(!fdbSupported())return;idbGet('fdb').then(function(h){if(!h)return;FDB.handle=h;FDB.name=h.name;FDB.status='perm';renderAll()})}

/* ================= change hook + status ================= */
function cacheLocal(){if(DESK)return;ls(function(){localStorage.setItem(KEY,JSON.stringify({rev:state.rev,at:Date.now(),state:state}))})}
function afterChange(){if(DB.on)dbQueue();if(FDB.handle)fdbQueue()}
function hm(t){var d=new Date(t);return pad(d.getHours())+':'+pad(d.getMinutes())}
function storageChip(){
  if(HOST&&(DB.on||DB.status==='loading'||DB.status==='error'||DB.status==='ro')){
    var m={loading:['warn','جارٍ تحميل قاعدة البيانات…'],ok:['ok','محفوظ في قاعدة البيانات'+(DB.at?' · '+hm(DB.at):'')],pending:['warn','جارٍ الحفظ…'],saving:['warn','جارٍ الحفظ في قاعدة البيانات…'],error:['bad','لم يُحفظ في قاعدة البيانات'],ro:['warn','عرض فقط · التعديلات في هذا المتصفح']}[DB.status]||['warn','—'];
    return '<span class="chip '+m[0]+'" title="'+esc(DB.err||'')+'">'+m[1]+'</span>';
  }
  if(FDB.handle){
    var f={ok:['ok','محفوظ في '+FDB.name+(FDB.at?' · '+hm(FDB.at):'')],pending:['warn','جارٍ الحفظ في '+FDB.name+'…'],saving:['warn','جارٍ الحفظ في '+FDB.name+'…'],perm:['warn','اضغط «متابعة الحفظ في الملف»'],error:['bad','لم يُحفظ في '+FDB.name]}[FDB.status]||['warn',FDB.name];
    return '<span class="chip '+f[0]+'" title="'+esc(FDB.err||'')+'">'+esc(f[1])+'</span>'+(FDB.status==='perm'?'<button class="btn sm primary" data-act="fdb-resume">متابعة الحفظ في الملف</button>':FDB.status==='error'?'<button class="btn sm" data-act="fdb-save">حفظ الآن</button>':'');
  }
  return dirty?'<span class="chip warn" title="محفوظة في هذا المتصفح فقط">محفوظ في هذا المتصفح</span>':'<span class="chip ok">محفوظ</span>';
}
function renderStatus(){var s=$('#store-status');if(s)s.innerHTML=storageChip()}
function storageCard(){
  if(DESK){
    return '<div class="card"><h2>قاعدة البيانات</h2><p class="hint">بيانات كل المشاريع محفوظة في ملف قاعدة بيانات واحد على جهازك، وكل تعديل يُحفظ فيه فوراً. يُعمل نسخة احتياطية تلقائية كل يوم.</p><dl class="facts"><dt>الحالة</dt><dd>'+storageChip()+'</dd><dt>مكان الملف</dt><dd class="num" id="db-path" style="direction:ltr;text-align:right">…</dd></dl><div class="toolbar"><button class="btn" data-act="desk-backup">نسخة احتياطية الآن</button><button class="btn" data-act="desk-folder">فتح مجلد البيانات</button><button class="btn" data-act="xlsx-full">تحميل نسخة Excel كاملة</button></div></div>';
  }
  if(HOST){
    var st=DB.on?(DB.ro?'متصلة (عرض فقط لهذا الحساب)':'متصلة – كل تعديل يُحفظ فوراً ويظهر على أي جهاز تفتح منه الصفحة'):DB.status==='loading'?'جارٍ الاتصال…':'غير متاحة في هذا العرض – التعديلات تُحفظ في هذا المتصفح';
    return '<div class="card"><h2>قاعدة البيانات</h2><p class="hint">بيانات المشروع محفوظة في قاعدة بيانات الصفحة، في جداول مثل شيت Excel: البنود، المهام، المحابس المركبة، التوريدات، المصاريف، الإيقاف والمدد، وأقسام خطة العمل.</p><dl class="facts"><dt>الحالة</dt><dd>'+esc(st)+'</dd>'+(DB.at?'<dt>آخر حفظ</dt><dd>'+hm(DB.at)+'</dd>':'')+'</dl><div class="toolbar"><button class="btn primary" data-act="xlsx-full">تحميل نسخة Excel كاملة من قاعدة البيانات</button></div></div>';
  }
  if(fdbSupported()){
    return '<div class="card"><h2>قاعدة البيانات (ملف Excel)</h2><p class="hint">اربط ملف Excel على جهازك ليكون قاعدة بيانات المشروع: كل تعديل يُكتب فيه تلقائياً بكل الجداول المنسقة، ويمكنك فتحه لاحقاً من هنا لاسترجاع كل البيانات. لا تعدّل الملف من Excel نفسه؛ عدّل من البرنامج.</p>'+
    (FDB.handle?'<dl class="facts"><dt>الملف المرتبط</dt><dd>'+esc(FDB.name)+'</dd><dt>الحالة</dt><dd>'+storageChip()+'</dd></dl><div class="toolbar"><button class="btn" data-act="fdb-save">حفظ الآن</button><button class="btn" data-act="fdb-open">فتح ملف آخر</button><button class="btn danger" data-act="fdb-detach">فصل الملف</button></div>'
    :'<div class="toolbar"><button class="btn primary" data-act="fdb-create">إنشاء ملف Excel كقاعدة بيانات</button><button class="btn" data-act="fdb-open">فتح ملف قاعدة بيانات Excel</button></div>')+'</div>';
  }
  return '<div class="card"><h2>قاعدة البيانات (ملف Excel)</h2><p class="hint">الحفظ التلقائي في ملف Excel يعمل في Chrome وEdge على الكمبيوتر. في هذا المتصفح تُحفظ التعديلات تلقائياً في المتصفح، ويمكنك تحميل نسخة Excel كاملة ثم فتحها لاحقاً من «فتح ملف مشروع».</p><div class="toolbar"><button class="btn primary" data-act="xlsx-full">تحميل نسخة Excel كاملة</button></div></div>';
}

/* ================= Excel workbook ================= */
var XC={acc:'FF0A6C88',soft:'FFDCEDF2',zebra:'FFF5F8F9',tot:'FFE4EEF1',line:'FFC9D4D9',ink:'FF0F2129',mut:'FF5A6B73',ok:'FF2C7A4D',bad:'FFBF3F2B',warn:'FFA86E12',stop:'FFF6D9D3',white:'FFFFFFFF'};
var XFONT='Arial';
function xlLib(){if(window.ExcelJS)return Promise.resolve();return loadScript(CDN+'exceljs/4.4.0/exceljs.min.js')}
function xD(n){return n==null||isNaN(n)?null:new Date(n*DAY)}
function xDs(s){return s?xD(dnum(s)):null}
function xhf(s){return String(s||'').replace(/&/g,'&&')}
function noVal(b){var n=Number(b.no);return b.no!==''&&isFinite(n)?n:String(b.no||'')}
function hex(h){return 'FF'+h.replace('#','').toUpperCase()}
function mix(h,a){var c=h.replace('#','');var r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16);var f=function(x){return Math.round(255-(255-x)*a).toString(16).padStart(2,'0')};return ('FF'+f(r)+f(g)+f(b)).toUpperCase()}
var THIN={style:'thin',color:{argb:XC.line}};
var BORDER={top:THIN,bottom:THIN,left:THIN,right:THIN};
function fill(c){return {type:'pattern',pattern:'solid',fgColor:{argb:c}}}
function xSheet(W,name,title,cols,o){
  o=o||{};
  var m=state.meta,ws=W.addWorksheet(name,{
    views:[o.noFreeze?{rightToLeft:true,showGridLines:false}:{rightToLeft:true,state:'frozen',ySplit:o.hr||4,xSplit:o.xSplit||0,showGridLines:false}],
    pageSetup:{paperSize:9,orientation:o.land?'landscape':'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0,horizontalCentered:true,margins:{left:0.35,right:0.35,top:0.6,bottom:0.6,header:0.25,footer:0.25},printTitlesRow:o.noFreeze?undefined:((o.hr||4)+':'+(o.hr||4))},
    headerFooter:{oddHeader:'&R&9&"Arial,Bold"'+xhf(title)+'&L&8'+xhf(m.short||m.name),oddFooter:'&R&8'+xhf(m.contractor)+'&L&8صفحة &P من &N'}
  });
  ws.columns=cols.map(function(c){return {width:c.w||12}});
  var n=cols.length;
  ws.mergeCells(1,1,1,n);ws.mergeCells(2,1,2,n);
  var t=ws.getCell(1,1);t.value=title;t.font={name:XFONT,size:15,bold:true,color:{argb:XC.acc}};t.alignment={horizontal:'right',vertical:'middle',readingOrder:'rtl'};ws.getRow(1).height=26;
  var s=ws.getCell(2,1);s.value=(m.name||'')+(m.po?'  ·  أمر الشراء '+m.po:'')+'  ·  '+(o.sub||'');s.font={name:XFONT,size:9.5,color:{argb:XC.mut}};s.alignment={horizontal:'right',vertical:'middle',readingOrder:'rtl'};
  if(!o.noHead)xHead(ws,o.hr||4,cols);
  return ws;
}
function xHead(ws,r,cols,startCol){
  startCol=startCol||1;var row=ws.getRow(r);row.height=32;
  cols.forEach(function(c,i){var cell=row.getCell(startCol+i);cell.value=c.h;cell.font={name:XFONT,size:10,bold:true,color:{argb:XC.white}};cell.fill=fill(XC.acc);cell.alignment={horizontal:'center',vertical:'middle',wrapText:true,readingOrder:'rtl'};cell.border={top:{style:'thin',color:{argb:XC.acc}},bottom:{style:'thin',color:{argb:XC.acc}},left:{style:'thin',color:{argb:'FF2E8AA3'}},right:{style:'thin',color:{argb:'FF2E8AA3'}}}});
}
function xRow(ws,r,cols,vals,i,startCol,o){
  startCol=startCol||1;o=o||{};var row=ws.getRow(r),lines=1;
  cols.forEach(function(c,k){
    var cell=row.getCell(startCol+k),v=vals[k];cell.value=(v===''||v===undefined)?null:v;
    cell.font={name:XFONT,size:10,color:{argb:XC.ink},bold:!!o.bold};
    cell.border=BORDER;
    cell.alignment={horizontal:c.al||(c.wrap?'right':'center'),vertical:'middle',wrapText:!!c.wrap,readingOrder:'rtl'};
    if(c.fmt)cell.numFmt=c.fmt;
    if(o.fill)cell.fill=fill(o.fill);else if(i%2)cell.fill=fill(XC.zebra);
    if(c.wrap&&typeof v==='string'){var per=Math.max(8,Math.floor((c.w||12)*1.05));var L=v.split('\n').reduce(function(s,x){return s+Math.max(1,Math.ceil(x.length/per))},0);lines=Math.max(lines,L)}
  });
  row.height=Math.max(19,Math.min(400,lines*15+5));
  return row;
}
function xTot(ws,r,cols,vals,startCol){return xRow(ws,r,cols,vals,0,startCol,{bold:true,fill:XC.tot})}
function F(f,res){return {formula:f,result:res==null?undefined:res}}
function colL(n){var s='';while(n>0){var m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=Math.floor((n-1)/26)}return s}
function band(ws,r,n,txt){ws.mergeCells(r,1,r,n);var c=ws.getCell(r,1);c.value=txt;c.font={name:XFONT,size:11.5,bold:true,color:{argb:XC.acc}};c.fill=fill(XC.soft);c.alignment={horizontal:'right',vertical:'middle',readingOrder:'rtl',indent:1};ws.getRow(r).height=22}
function buildWorkbook(full){
  var W=new window.ExcelJS.Workbook(),m=state.meta,R=state.report,c$=m.currency||'';
  W.creator=m.contractor||'';W.created=new Date();W.calcProperties.fullCalcOnLoad=true;
  var S=full?{}:R.secs,on=function(k){return full||!!S[k]};
  var g=full?{a:-Infinity,b:todayNum()}:repRange(),asOf=g.b,inP=function(r){return full||inR(r,g)},vis=function(r){return full||!r.hide};
  var prices=full||R.prices,sub=full?'نسخة قاعدة البيانات الكاملة · '+fs(todayNum()):(R.from?'الفترة من '+fs(g.a)+' إلى '+fs(g.b):'حتى تاريخ '+fs(asOf));
  var o=overall(asOf),v=valueStats(asOf),M='#,##0.00',Q='#,##0.##',P='0.0%',D='dd/mm/yyyy';
  var boqs=state.boq.filter(vis);
  var SH={inst:'المحابس المركبة',sup:'التوريدات',exp:'المصاريف'};
  /* summary */
  var ws=xSheet(W,'الملخص',(R.title||'تقرير موقف الأعمال')+(R.no?' رقم '+R.no:''),[{w:26},{w:30},{w:26},{w:30}],{noFreeze:true,noHead:true,sub:sub});
  var lg=logoSrc();if(lg){try{var id=W.addImage({base64:lg,extension:/^data:image\/png/.test(lg)?'png':'jpeg'});ws.getRow(3).height=8;ws.addImage(id,{tl:{col:3.15,row:0.1},ext:{width:150,height:64}});ws.getRow(1).height=30;ws.getRow(2).height=26}catch(e){}}
  var r=4,pair=function(a,b,c,d,fmt){var row=ws.getRow(r);[[1,a],[2,b],[3,c],[4,d]].forEach(function(x,k){var cell=row.getCell(x[0]);cell.value=x[1]==null?null:x[1];cell.border=BORDER;cell.alignment={horizontal:'right',vertical:'middle',wrapText:true,readingOrder:'rtl'};var lab=k%2===0;cell.font={name:XFONT,size:10,bold:!lab,color:{argb:lab?XC.mut:XC.ink}};if(lab)cell.fill=fill(XC.zebra);if(!lab&&fmt&&fmt[k>>1])cell.numFmt=fmt[k>>1]});row.height=21;r++};
  band(ws,r++,4,'بيانات المشروع');
  pair('اسم المشروع',m.name,'رقم أمر الشراء',m.po);ws.getRow(r-1).height=34;
  pair('الجهة المالكة',m.client,'الموقع',m.location);ws.getRow(r-1).height=34;
  pair('المقاول',m.contractor,'المهندس المشرف',m.engineer||'—');
  pair('تاريخ البدء',xD(cStart()),'تاريخ الانتهاء الأصلي',xD(cEnd()),[D,D]);
  pair('أيام الإيقاف / إضافة المدد',stopDays()+' / '+extDays()+' يوم','تاريخ الانتهاء المعدّل',xD(revEnd()),[null,D]);
  r++;band(ws,r++,4,'مؤشرات الأداء حتى '+fs(asOf));
  pair('الكمية التعاقدية (محبس)',o.q,'المحابس الموردة',o.sup,[Q,Q]);
  pair('المحابس المركبة',o.inst,'المتبقي للتركيب',Math.max(0,o.q-o.inst),[Q,Q]);
  pair('نسبة التركيب الفعلية',o.act,'نسبة التركيب المخططة',o.plan,[P,P]);
  pair('نسبة التوريد',o.sp,'الفرق عن المخطط',o.act-o.plan,[P,P]);
  var cs=cStart(),re=revEnd(),dur=re-cs+1,el_=clamp(asOf-cs+1,0,dur);
  pair('المدة المنقضية (يوم)',el_,'المدة المعدّلة (يوم)',dur,[Q,Q]);
  pair('نسبة المدة المنقضية',dur?el_/dur:0,'المتبقي من المدة (يوم)',re-asOf,[P,Q]);
  if(prices&&v.tot)pair('قيمة العقد قبل الضريبة ('+c$+')',v.tot,'قيمة الأعمال المنفذة ('+c$+')',v.ex,[M,M]);
  if(on('expenses')){var ex=state.expenses.filter(function(x){return vis(x)&&inP(x)});pair('إجمالي المصاريف ('+c$+')',expTotal(ex),'عدد بنود المصاريف',ex.length,[M,Q])}
  if(!full&&R.secs.notes&&String(R.notes||'').trim()){r++;band(ws,r++,4,'ملاحظات');ws.mergeCells(r,1,r,4);var nc=ws.getCell(r,1);nc.value=R.notes;nc.alignment={wrapText:true,vertical:'top',horizontal:'right',readingOrder:'rtl'};nc.font={name:XFONT,size:10};ws.getRow(r).height=Math.min(300,18*(String(R.notes).split('\n').length+1));r++}
  if(!full&&R.secs.sign){var sg=R.sign.filter(function(x){return x.t||x.n});if(sg.length){r+=2;sg.slice(0,4).forEach(function(x,k){var cl=ws.getCell(r,k+1);cl.value=x.t;cl.font={name:XFONT,size:10,bold:true};cl.alignment={horizontal:'center'};var nm=ws.getCell(r+1,k+1);nm.value=x.n||'الاسم: ................';nm.alignment={horizontal:'center'};nm.font={name:XFONT,size:10};var si=ws.getCell(r+2,k+1);si.value='التوقيع: ................';si.alignment={horizontal:'center'};si.font={name:XFONT,size:10,color:{argb:XC.mut}}});ws.getRow(r+2).height=30}}
  /* BOQ */
  if(on('boq')){
    var bc=[{h:'البند',w:7},{h:'القطر (بوصة)',w:9},{h:'الوصف',w:56,wrap:1},{h:'الوحدة',w:8},{h:'الكمية التعاقدية',w:11,fmt:Q},{h:'الموَرَّد',w:11,fmt:Q},{h:'المركب',w:11,fmt:Q},{h:'المتبقي',w:11,fmt:Q},{h:'نسبة الإنجاز',w:11,fmt:P}].concat(prices?[{h:'سعر الوحدة ('+c$+')',w:13,fmt:M},{h:'الإجمالي ('+c$+')',w:15,fmt:M},{h:'قيمة المنفذ ('+c$+')',w:15,fmt:M}]:[]);
    ws=xSheet(W,'حصر الأعمال','حصر الأعمال – جدول الكميات',bc,{land:1,sub:'الموقف حتى '+fs(asOf)});
    var r0=5;
    boqs.forEach(function(b,i){var rr=r0+i,q=num(b.qty),s=suppliedOf(b.id,asOf),ins=installedOf(b.id,asOf),rt=num(b.rate);
      var sF=full?F("SUMIFS('"+SH.sup+"'!E:E,'"+SH.sup+"'!C:C,A"+rr+")",s):s,iF=full?F("SUMIFS('"+SH.inst+"'!E:E,'"+SH.inst+"'!C:C,A"+rr+")",ins):ins;
      xRow(ws,rr,bc,[noVal(b),b.dia===''?null:num(b.dia),b.desc,b.unit,q,sF,iF,F('MAX(0,E'+rr+'-G'+rr+')',Math.max(0,q-ins)),F('IF(E'+rr+'>0,G'+rr+'/E'+rr+',0)',q?ins/q:0)].concat(prices?[rt||null,F('E'+rr+'*J'+rr,q*rt),F('MIN(G'+rr+',E'+rr+')*J'+rr,Math.min(ins,q)*rt)]:[]),i)});
    var rl=r0+boqs.length-1,rt_=rl+1,sum=function(L){return F('SUM('+L+r0+':'+L+rl+')')};
    xTot(ws,rt_,bc,['الإجمالي','','','',sum('E'),sum('F'),sum('G'),sum('H'),F('IF(E'+rt_+'>0,G'+rt_+'/E'+rt_+',0)')].concat(prices?['',sum('K'),sum('L')]:[]));
    ws.mergeCells(rt_,1,rt_,4);
    if(prices){var vr=rt_+2;[['ضريبة القيمة المضافة '+num(m.vat)+'%',F('K'+rt_+'*'+(num(m.vat)/100))],['الإجمالي شامل الضريبة',F('K'+rt_+'+K'+(vr))]].forEach(function(x,k){var row=vr+k;ws.mergeCells(row,8,row,10);var a=ws.getCell(row,8);a.value=x[0];a.font={name:XFONT,size:10,bold:true};a.alignment={horizontal:'right',readingOrder:'rtl'};a.border=BORDER;a.fill=fill(XC.tot);var b=ws.getCell(row,11);b.value=x[1];b.numFmt=M;b.font={name:XFONT,size:10,bold:true};b.border=BORDER;b.fill=fill(XC.tot)})}
    ws.autoFilter={from:{row:4,column:1},to:{row:rl,column:bc.length}};
  }
  /* schedule */
  if(on('schedule')){
    var tc=[{h:'الرمز',w:9},{h:'المهمة',w:42,wrap:1},{h:'المجموعة',w:24,wrap:1},{h:'المدة (يوم عمل)',w:10},{h:'بداية الأساس',w:12,fmt:D},{h:'نهاية الأساس',w:12,fmt:D},{h:'البداية المخططة',w:12,fmt:D},{h:'النهاية المخططة',w:12,fmt:D},{h:'البداية الفعلية',w:12,fmt:D},{h:'النهاية الفعلية',w:12,fmt:D},{h:'الإنجاز',w:9,fmt:P},{h:'الحالة',w:10}];
    ws=xSheet(W,'الجدول الزمني','الجدول الزمني',tc,{land:1,sub:'العطلة الأسبوعية: '+state.meta.weekend.map(function(x){return DOWS[x]}).join('، ')});
    state.tasks.forEach(function(t,i){var a=actualOf(t),st=statusOf(t),rw=xRow(ws,5+i,tc,[t.code,t.name,(state.groups[grpIdx(t.group)]||{}).name,t.ms?'معلم':t.dur,xDs(t.bs),xDs(t.bf),xD(tS(t)),xD(tF(t)),xD(a.s),xD(a.f),progOf(t,asOf),STL[st]],i);rw.getCell(12).font={name:XFONT,size:10,bold:true,color:{argb:st==='done'?XC.ok:st==='late'?XC.bad:st==='active'?XC.warn:XC.mut}}});
    ws.autoFilter={from:{row:4,column:1},to:{row:4+state.tasks.length,column:tc.length}};
  }
  /* gantt */
  if(on('gantt')){
    var lo=cStart(),hi=Math.max(projEnd(),revEnd());state.tasks.forEach(function(t){if(t.bf)hi=Math.max(hi,dnum(t.bf))});
    lo=lo-((dow(lo)+1)%7);var weeks=Math.ceil((hi-lo+1)/7)+1,gc=[{h:'الرمز',w:8},{h:'المهمة',w:34},{h:'البداية',w:11,fmt:D},{h:'النهاية',w:11,fmt:D},{h:'الإنجاز',w:8,fmt:P}];
    for(var k=0;k<weeks;k++)gc.push({h:String(new Date((lo+k*7)*DAY).getUTCDate()),w:3.2});
    ws=xSheet(W,'المخطط الزمني','المخطط الزمني (Gantt) – أسبوعي',gc,{land:1,xSplit:5,sub:'كل عمود = أسبوع يبدأ السبت · الملون: المدة المخططة (الداكن نسبة الإنجاز) · الوردي: إيقاف'});
    var mr=ws.getRow(3);mr.height=18;var k0=0;
    while(k0<weeks){var d0_=new Date((lo+k0*7)*DAY),mo=d0_.getUTCMonth(),k1=k0;while(k1+1<weeks&&new Date((lo+(k1+1)*7)*DAY).getUTCMonth()===mo)k1++;
      if(k1>k0)ws.mergeCells(3,6+k0,3,6+k1);var mc=ws.getCell(3,6+k0);mc.value=fMonS.format(d0_)+' '+String(d0_.getUTCFullYear()).slice(2);mc.font={name:XFONT,size:9,bold:true,color:{argb:XC.ink}};mc.alignment={horizontal:'center',vertical:'middle'};mc.fill=fill(mo%2?XC.zebra:XC.soft);mc.border=BORDER;k0=k1+1}
    var hr4=ws.getRow(4);for(k=0;k<weeks;k++){var hc=hr4.getCell(6+k);hc.font={name:XFONT,size:8,bold:true,color:{argb:XC.white}};hc.alignment={horizontal:'center',vertical:'middle',textRotation:0};var ws0=lo+k*7;if(asOf>=ws0&&asOf<ws0+7)hc.fill=fill(XC.bad)}
    var stopW={};state.events.forEach(function(e){if(e.type==='ext'||!e.from)return;var a=dnum(e.from),b=e.to?dnum(e.to):Math.max(a,asOf);for(var d=a;d<=b;d++)stopW[Math.floor((d-lo)/7)]=1});
    state.tasks.forEach(function(t,i){
      var rr=5+i,s=tS(t),f=tF(t),pr=progOf(t,asOf),col=grpHex(t.group),vals=[t.code,t.name,xD(s),xD(f),pr];for(var k=0;k<weeks;k++)vals.push(null);
      var row=xRow(ws,rr,gc,vals,0);row.height=20;row.getCell(2).alignment={horizontal:'right',vertical:'middle',readingOrder:'rtl'};
      var ks=Math.floor((s-lo)/7),kf=Math.floor((f-lo)/7),kp=t.ms?ks:ks+Math.floor((kf-ks+1)*pr)-1;
      for(k=0;k<weeks;k++){var cl=row.getCell(6+k);cl.border={left:{style:'hair',color:{argb:XC.line}},right:{style:'hair',color:{argb:XC.line}},bottom:THIN,top:THIN};
        if(t.ms&&k===ks){cl.value='◆';cl.font={name:XFONT,size:11,bold:true,color:{argb:pr>=1?XC.ok:XC.ink}};cl.alignment={horizontal:'center',vertical:'middle'}}
        else if(!t.ms&&k>=ks&&k<=kf)cl.fill=fill(k<=kp?hex(col):mix(col,0.35));
        else if(stopW[k])cl.fill=fill(XC.stop);
      }
    });
  }
  /* monthly */
  if(on('monthly')){
    var ms={};state.installs.forEach(function(x){if(!inP(x)||!boqById(x.boq))return;var d=new Date(dnum(x.date)*DAY),kk=d.getUTCFullYear()*100+d.getUTCMonth();ms[kk]=ms[kk]||{};ms[kk][x.boq]=(ms[kk][x.boq]||0)+num(x.qty)});
    var keys=Object.keys(ms).sort();
    if(keys.length){
      var mc2=[{h:'الشهر',w:16}].concat(boqs.map(function(b){return {h:b.dia?b.dia+'"':'بند '+b.no,w:8,fmt:Q}})).concat([{h:'الإجمالي',w:11,fmt:Q},{h:'التراكمي',w:11,fmt:Q}]);
      ws=xSheet(W,'التركيب الشهري','ملخص التركيب الشهري حسب القطر',mc2,{land:1,sub:sub});
      var nb=boqs.length,lc=colL(1+nb);
      keys.forEach(function(kk,i){var y=Math.floor(kk/100),mo=kk%100,rr=5+i;xRow(ws,rr,mc2,[fMon.format(new Date(Date.UTC(y,mo,1)))].concat(boqs.map(function(b){return ms[kk][b.id]||null})).concat([F('SUM(B'+rr+':'+lc+rr+')'),F(i?colL(2+nb+1)+(rr-1)+'+'+colL(2+nb)+rr:colL(2+nb)+rr)]),i)});
      var tr=5+keys.length;xTot(ws,tr,mc2,['الإجمالي'].concat(boqs.map(function(b,k){var L=colL(2+k);return F('SUM('+L+'5:'+L+(tr-1)+')')})).concat([F('SUM('+colL(2+nb)+'5:'+colL(2+nb)+(tr-1)+')'),'']));
    }
  }
  /* events */
  if(on('events')){
    var ev=state.events.filter(vis),ec=[{h:'النوع',w:16},{h:'رقم الأمر / الخطاب',w:16},{h:'تاريخ الإصدار',w:13,fmt:D},{h:'من',w:13,fmt:D},{h:'حتى (الاستئناف)',w:14,fmt:D},{h:'الأيام',w:9},{h:'يضاف للمدة',w:10},{h:'السبب / الملاحظات',w:44,wrap:1}];
    ws=xSheet(W,'الإيقاف والمدد','أوامر الإيقاف وإضافة المدد',ec,{land:1,sub:'تاريخ الانتهاء المعدّل: '+fs(revEnd())});
    ev.forEach(function(e,i){var x=e.type==='ext';xRow(ws,5+i,ec,[EVT[e.type],e.ref,xDs(e.date),x?null:xDs(e.from),x?null:(e.to?xDs(e.to):'سارٍ'),evDays(e),evAdds(e)?'نعم':'لا',e.reason||''],i)});
    var er=5+ev.length+1;[['المدة الأصلية (يوم)',cEnd()-cStart()+1],['إجمالي المضاف للمدة (يوم)',addDays()],['تاريخ الانتهاء المعدّل',xD(revEnd())]].forEach(function(x,k){ws.mergeCells(er+k,1,er+k,4);var a=ws.getCell(er+k,1);a.value=x[0];a.font={name:XFONT,size:10,bold:true};a.fill=fill(XC.tot);a.border=BORDER;a.alignment={horizontal:'right',readingOrder:'rtl'};var b=ws.getCell(er+k,5);b.value=x[1];b.font={name:XFONT,size:10,bold:true};b.border=BORDER;b.fill=fill(XC.tot);b.alignment={horizontal:'center'};if(k===2)b.numFmt=D});
  }
  /* logs */
  function logSheet(key,list,sheet,title,cols,map,qtyCol){
    list=list.filter(function(x){return vis(x)&&inP(x)}).sort(function(a,b){return (dnum(a.date)||0)-(dnum(b.date)||0)});
    ws=xSheet(W,sheet,title,cols,{land:1,sub:sub});
    list.forEach(function(x,i){var rw=xRow(ws,5+i,cols,map(x,i),i);if(key==='inst'){var tcl=rw.getCell(8);if(x.test==='ناجح')tcl.font={name:XFONT,size:10,bold:true,color:{argb:XC.ok}};else if(x.test==='غير ناجح')tcl.font={name:XFONT,size:10,bold:true,color:{argb:XC.bad}}}});
    var tr=5+list.length,L=colL(qtyCol),tv=['الإجمالي ('+list.length+')'];for(var k=1;k<cols.length;k++)tv.push(k===qtyCol-1?F('SUBTOTAL(109,'+L+'5:'+L+Math.max(5,tr-1)+')'):'');
    xTot(ws,tr,cols,tv);
    if(list.length)ws.autoFilter={from:{row:4,column:1},to:{row:tr-1,column:cols.length}};
  }
  var dia=function(id){var b=boqById(id);return b?(b.dia===''?null:num(b.dia)):null},bno=function(id){var b=boqById(id);return b?noVal(b):null};
  if(on('installs'))logSheet('inst',state.installs,SH.inst,'سجل المحابس المركبة',[{h:'#',w:6},{h:'التاريخ',w:12,fmt:D},{h:'رقم البند',w:8},{h:'القطر (بوصة)',w:9},{h:'العدد',w:8,fmt:Q},{h:'الموقع (الحي / الشارع)',w:28,wrap:1},{h:'الرقم التسلسلي',w:16},{h:'اختبار الضغط',w:12},{h:'انقطاع المياه (ساعة)',w:11,fmt:Q},{h:'الفريق',w:14},{h:'ملاحظات',w:30,wrap:1}],function(x,i){return [i+1,xDs(x.date),bno(x.boq),dia(x.boq),num(x.qty),x.loc||'',x.serial||'',x.test||'',x.shut===''||x.shut==null?null:num(x.shut),x.team||'',x.notes||'']},5);
  if(on('supplies'))logSheet('sup',state.supplies,SH.sup,'سجل التوريدات',[{h:'#',w:6},{h:'التاريخ',w:12,fmt:D},{h:'رقم البند',w:8},{h:'القطر (بوصة)',w:9},{h:'العدد',w:9,fmt:Q},{h:'المورد',w:26,wrap:1},{h:'رقم السند / الفاتورة',w:18},{h:'ملاحظات',w:36,wrap:1}],function(x,i){return [i+1,xDs(x.date),bno(x.boq),dia(x.boq),num(x.qty),x.supplier||'',x.ref||'',x.notes||'']},5);
  if(on('expenses')){
    logSheet('exp',state.expenses,SH.exp,'المصاريف',[{h:'#',w:6},{h:'التاريخ',w:12,fmt:D},{h:'التصنيف',w:22,wrap:1},{h:'البيان',w:38,wrap:1},{h:'الكمية',w:9,fmt:Q},{h:'سعر الوحدة',w:11,fmt:M},{h:'المبلغ ('+c$+')',w:14,fmt:M},{h:'المورد / الجهة',w:20,wrap:1},{h:'رقم الفاتورة',w:14}],function(x,i){return [i+1,xDs(x.date),x.cat||'أخرى',x.desc||'',num(x.qty)||null,num(x.price)||null,num(x.amount),x.vendor||'',x.ref||'']},7);
    var cats=[];state.expenses.filter(function(x){return vis(x)&&inP(x)}).forEach(function(x){var k=x.cat||'أخرى';if(cats.indexOf(k)<0)cats.push(k)});
    var cc=[{h:'التصنيف',w:30,wrap:1},{h:'المبلغ ('+c$+')',w:16,fmt:M},{h:'النسبة',w:10,fmt:P},{h:'عدد البنود',w:10}];
    ws=xSheet(W,'ملخص المصاريف','المصاريف حسب التصنيف',cc,{sub:sub});
    var n2=cats.length,tr2=5+n2;
    cats.forEach(function(k,i){var rr=5+i;xRow(ws,rr,cc,[k,F("SUMIF('"+SH.exp+"'!C:C,A"+rr+",'"+SH.exp+"'!G:G)"),F('IF($B$'+tr2+'>0,B'+rr+'/$B$'+tr2+',0)'),F("COUNTIF('"+SH.exp+"'!C:C,A"+rr+")")],i)});
    xTot(ws,tr2,cc,['الإجمالي',F('SUM(B5:B'+Math.max(5,tr2-1)+')'),'',F('SUM(D5:D'+Math.max(5,tr2-1)+')')]);
  }
  /* work plan */
  if(on('plan')){
    var pc=[{h:'القسم',w:30,wrap:1},{h:'المحتوى',w:100,wrap:1}];
    ws=xSheet(W,'خطة العمل','خطة العمل وأسلوب التنفيذ',pc,{});
    state.sections.filter(function(s){return full||s.rep}).forEach(function(s,i){var rw=xRow(ws,5+i,pc,[s.title,s.body],i);rw.getCell(1).font={name:XFONT,size:10.5,bold:true,color:{argb:XC.acc}};rw.getCell(1).alignment={horizontal:'right',vertical:'top',wrapText:true,readingOrder:'rtl'};rw.getCell(2).alignment={horizontal:'right',vertical:'top',wrapText:true,readingOrder:'rtl'}});
  }
  if(on('team')||on('equip')||on('rates')){
    ws=xSheet(W,'الموارد','الموارد: فريق العمل والمعدات ومعدلات الإنتاج',[{w:30},{w:13},{w:13},{w:15},{w:13},{w:11},{w:11}],{noFreeze:true,noHead:true});
    r=4;
    var sub2=function(title,cols,rows,tot){band(ws,r++,cols.length,title);xHead(ws,r++,cols);var a=r;(typeof rows==='function'?rows(a):rows).forEach(function(x,i){xRow(ws,r++,cols,x,i)});if(tot)xTot(ws,r++,cols,tot(a,r-1));r++};
    if(on('team'))sub2('فريق العمل',[{h:'الوظيفة',w:30,wrap:1},{h:'سنوات الخبرة'},{h:'العدد'}],state.team.map(function(x){return [x.role||'',num(x.exp)||null,num(x.count)]}),function(a,b){return ['الإجمالي','',F('SUM(C'+a+':C'+b+')')]});
    if(on('equip'))sub2('المعدات والأدوات',[{h:'المعدة',w:30,wrap:1},{h:'العدد'},{h:'ملاحظات',w:13,wrap:1}],state.equip.map(function(x){return [x.name||'',num(x.count),x.notes||'']}),function(a,b){return ['الإجمالي',F('SUM(B'+a+':B'+b+')'),'']});
    if(on('rates'))sub2('معدلات الإنتاج وتوزيع الفرق',[{h:'القطر',w:30},{h:'عدد المجموعات'},{h:'أفراد / مجموعة'},{h:'المستهدف اليومي / مجموعة'},{h:'الإجمالي اليومي'},{h:'الكمية'},{h:'المدة (يوم)'}],function(a){return state.rates.map(function(x,i){var b=boqById(x.boq),q=b?num(b.qty):0,rr=a+i;return [boqName(x.boq),num(x.crews),num(x.per),num(x.daily),F('B'+rr+'*D'+rr,num(x.crews)*num(x.daily)),q,F('IF(E'+rr+'>0,ROUNDUP(F'+rr+'/E'+rr+',0),0)',rateDur(x))]})},function(a,b){return ['إجمالي أيام العمل','','','','','',F('SUM(G'+a+':G'+b+')')]});
  }
  if(on('risks')||on('conditions')){
    ws=xSheet(W,'المخاطر والشروط','سجل المخاطر وشروط مجال العمل',[{w:6},{w:34},{w:12},{w:42},{w:48}],{noFreeze:true,noHead:true});r=4;
    if(on('risks')){var rc=[{h:'#',w:6},{h:'الخطر',w:34,wrap:1},{h:'الاحتمالية',w:12},{h:'الوصف',w:42,wrap:1},{h:'إجراءات التخفيف',w:48,wrap:1}];band(ws,r++,5,'سجل المخاطر وخطط التخفيف');xHead(ws,r++,rc);state.risks.forEach(function(x,i){xRow(ws,r++,rc,[i+1,x.risk||'',x.level||'',x.desc||'',x.mit||''],i)});r++}
    if(on('conditions')){band(ws,r++,5,'شروط مجال العمل');state.conditions.forEach(function(x,i){ws.mergeCells(r,2,r,5);xRow(ws,r,[{w:6},{w:136,wrap:1}],[i+1,x.text||''],i);r++})}
  }
  /* raw data for reopening the file */
  if(full){
    var dws=W.addWorksheet('_data',{state:'veryHidden'}),js=JSON.stringify(state);
    for(var p=0,rr2=1;p<js.length;p+=30000,rr2++)dws.getCell(rr2,1).value=js.slice(p,p+30000);
  }
  return W;
}
function readXlsxState(buf){
  return xlLib().then(function(){var W=new window.ExcelJS.Workbook();return W.xlsx.load(buf).then(function(){
    var ws=W.getWorksheet('_data');if(!ws)return null;var s='';ws.eachRow(function(row){var v=row.getCell(1).value;if(v!=null)s+=String(v)});
    try{var o=JSON.parse(s);return o&&o.meta&&o.boq?o:null}catch(e){return null}
  })});
}
function dbFileName(){return ('قاعدة بيانات - '+(state.meta.short||state.meta.name)).replace(/[\\/:*?"<>|\n]+/g,' ').replace(/\s+/g,'-').slice(0,120)+'.xlsx'}
function exportXlsx(full){
  toast('جارٍ تجهيز ملف Excel…');
  xlLib().then(function(){return buildWorkbook(full).xlsx.writeBuffer()}).then(function(buf){
    offerFile(full?dbFileName():fname('xlsx'),new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  }).catch(function(){toast('تعذّر تجهيز ملف Excel (يحتاج اتصال إنترنت أول مرة في النسخة غير المحلية).')});
}
