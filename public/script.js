const defaultState={project:{title:"حدائق الملك عبدالله",phase:"مرحلة ما قبل الإطلاق",openingDate:"2026-09-27"},tracks:[{id:"أ",slug:"track-a",name:"التخطيط والتنسيق",ar:"Planning & Coordination",sub:"الحوكمة · الجدول الزمني · المخرجات · الاعتمادات · التصاريح · المخاطر · التغيير",status:"ضمن المسار",progress:83,tasks:18,done:15,active:3,risk:0,lead:"مدير مسار التخطيط والتنسيق",focus:"التنسيق والمتابعة مع أصحاب المصلحة",accent:"#7E6BFF"},{id:"ب",slug:"track-b",name:"التواصل والتسويق",ar:"Communication & Marketing",sub:"الخطة الإعلامية · التغطية · التوثيق · الرسائل الإعلامية · المركز الإعلامي · المحتوى",status:"ضمن المسار",progress:58,tasks:24,done:14,active:7,risk:2,lead:"مدير مسار التواصل والتسويق",focus:"إعداد التقارير والعروض المرتبطة بالمسار والتنسيق الإعلامي",accent:"#A98BFF"},{id:"ج",slug:"track-c",name:"الفعاليات والأنشطة المصاحبة",ar:"Events & Supporting Activities",sub:"الضيافة · الإنتاج التقني · العروض الفنية · إدارة الحضور · VIP · البروتوكول",status:"تحت المتابعة",progress:41,tasks:21,done:9,active:8,risk:2,lead:"مدير مسار الفعاليات والأنشطة المصاحبة",focus:"ضبط تجربة الفعالية والأنشطة المصاحبة والبروتوكول",accent:"#D9B86C"},{id:"د",slug:"track-d",name:"تجهيز وتفعيل الحديقة",ar:"Garden Setup & Activation",sub:"الحديقة · المسارات · النقل · السلامة والطوارئ · الاستدامة · البيئة · الجاهزية · التشغيل الميداني",status:"معرض للخطر",progress:47,tasks:24,done:8,active:5,risk:3,lead:"مدير مسار تجهيز وتفعيل الحديقة",focus:"جاهزية الحديقة والتشغيل الميداني وتفعيل الموقع",accent:"#6454C8"}],items:[{track:"أ",type:"tasks",title:"تثبيت الجدول الزمني وخطة الاعتمادات",owner:"PMC",status:"مكتملة",due:"2026-08-20"},{track:"أ",type:"milestones",title:"اعتماد سجل المخرجات والمخاطر",owner:"PMC",status:"مكتملة",due:"2026-08-22"},{track:"ب",type:"tasks",title:"إعداد خطة التواصل والتغطية الإعلامية",owner:"التواصل والتسويق",status:"قيد التنفيذ",due:"2026-08-29"},{track:"ب",type:"risks",title:"تأخر اعتماد المحتوى الإعلامي",owner:"التواصل والتسويق",status:"تحت المتابعة",due:"2026-08-29"},{track:"ج",type:"tasks",title:"تجهيز خطة الضيافة والبروتوكول و VIP",owner:"الفعاليات",status:"قيد التنفيذ",due:"2026-09-10"},{track:"ج",type:"milestones",title:"اعتماد برنامج الأنشطة المصاحبة",owner:"الفعاليات",status:"تحت المتابعة",due:"2026-09-18"},{track:"د",type:"tasks",title:"جاهزية مسارات الحديقة والتشغيل الميداني",owner:"التشغيل الميداني",status:"معرضة للخطر",due:"2026-09-24"},{track:"د",type:"risks",title:"اختبار السلامة والطوارئ والاستدامة",owner:"السلامة",status:"معرضة للخطر",due:"2026-09-12"}],feed:[],dailyLogs:[],decisions:[],snapshots:[]};
let state=JSON.parse(localStorage.getItem("kagV6BulkImport")||"null")||structuredClone(defaultState);
function escH(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];});}
const feedTemplates=[["تحديث PMO","تم تحديث النظرة العامة للمسارات الأربعة","cyan"],["تحديث مسار","تم تحديث جاهزية مسار تجهيز وتفعيل الحديقة","amber"],["تحديث تصريح","تم اعتماد تصريح الدفاع المدني","green"],["تصعيد مخاطرة","اختبار الكهرباء الاحتياطية يحتاج متابعة عاجلة","red"],["تحديث إعلامي","تم رفع خطة التواصل والتسويق للمراجعة","cyan"],["معلم رئيسي","تم اعتماد خط الأساس للحوكمة","green"]];
function save(){localStorage.setItem("kagV6BulkImport",JSON.stringify(state))}function now(){return new Date().toLocaleTimeString("ar-SA",{hour:"2-digit",minute:"2-digit"})}
function normalizeTrack(v){v=(v||"").trim();const map={A:"أ",B:"ب",C:"ج",D:"د",E:"هـ","ه":"هـ","هـ":"هـ","ا":"أ","أ":"أ","ب":"ب","ج":"ج","د":"د"};return map[v.toUpperCase?.()||v]||map[v]||v}
function normalizeType(v){v=(v||"").trim().toLowerCase();if(["task","tasks","مهمة","مهام"].includes(v))return"tasks";if(["risk","risks","مخاطرة","مخاطر"].includes(v))return"risks";if(["permit","permits","approval","approvals","تصريح","تصاريح","اعتماد","اعتمادات"].includes(v))return"permits";if(["milestone","milestones","معلم","معلم رئيسي","معالم"].includes(v))return"milestones";return v||"tasks"}
function colorByStatus(s){if(["مكتملة","معتمدة","ضمن المسار","Completed","Cleared"].includes(s))return"green";if(["تحت المتابعة","قيد التنفيذ","Watch","In Progress"].includes(s))return"amber";if(["معرضة للخطر","معرض للخطر","مرفوضة","At Risk"].includes(s))return"red";return"cyan"}
function daysToOpen(){const d=new Date(state.project.openingDate),n=new Date();return Math.max(0,Math.ceil((d-n)/(1000*60*60*24)))}
function kpis(){const total=state.tracks.reduce((s,t)=>s+Number(t.tasks||0),0);const done=state.tracks.reduce((s,t)=>s+Number(t.done||0),0);const active=state.tracks.reduce((s,t)=>s+Number(t.active||0),0);const risk=state.tracks.reduce((s,t)=>s+Number(t.risk||0),0)+state.items.filter(i=>i.type==="risks"&&i.status!=="مغلقة").length;return{total,done,active,risk,overall:total?Math.round(done/total*100):0,days:daysToOpen()}}
function addFeed(item){const p=item||feedTemplates[Math.floor(Math.random()*feedTemplates.length)];state.feed.unshift({time:now(),title:p[0],msg:p[1],level:p[2]});state.feed=state.feed.slice(0,25);save();renderFeed()}
function renderFeed(){liveFeed.innerHTML=state.feed.slice(0,10).map(f=>`<div class="feed-item"><div class="feed-time">${escH(f.time)}</div><div><strong class="${f.level}">${escH(f.title)}</strong><span>${escH(f.msg)}</span></div></div>`).join("")}
function renderForms(){const opts=state.tracks.map(t=>`<option value="${t.id}">${t.id} · ${t.name}</option>`).join("");trackSelect.innerHTML=opts;itemTrack.innerHTML=opts;if(typeof dailyTrack!=="undefined") dailyTrack.innerHTML=opts;if(typeof decisionTrack!=="undefined") decisionTrack.innerHTML=opts}

// ===== V18 DIWAN + PLANNED VS ACTUAL + CLICKABLE DETAILS =====
function plannedForTrack(t){
  if(t && typeof t.planned === "number") return t.planned;
  const base = { "أ":88, "ب":66, "ج":55, "د":60, "هـ":58 };
  return base[t.id] || Math.min(100, Number(t.progress||0) + 10);
}
function projectPlanned(){
  if(!state.tracks.length) return 0;
  return Math.round(state.tracks.reduce((s,t)=>s+plannedForTrack(t),0)/state.tracks.length);
}
function projectActual(){
  if(!state.tracks.length) return 0;
  return Math.round(state.tracks.reduce((s,t)=>s+Number(t.progress||0),0)/state.tracks.length);
}
function paHtml(planned, actual){
  const variance = actual - planned;
  return `<div class="planned-actual-box">
    <div class="pa-row"><span>المخطط</span><div class="pa-bar planned"><i style="width:${Math.max(0,Math.min(100,planned))}%"></i></div><b>${planned}%</b></div>
    <div class="pa-row"><span>الفعلي</span><div class="pa-bar actual"><i style="width:${Math.max(0,Math.min(100,actual))}%"></i></div><b>${actual}%</b></div>
    <div class="pa-row"><span>الفرق</span><div class="pa-bar"><i style="width:${Math.max(0,Math.min(100,Math.abs(variance)))}%;background:${variance>=0?'#43ee8d':'#ff5e6b'}"></i></div><b class="${variance>=0?'green':'red'}">${variance>0?'+':''}${variance}%</b></div>
  </div>`;
}
function showDetails(type, trackId=null){
  const pageId = "detail-view";
  let title = "التفاصيل";
  let subtitle = "عرض تفصيلي للعناصر";
  let items = [];

  if(type === "risks"){
    title = "تفاصيل المخاطر";
    subtitle = trackId ? "مخاطر المسار المحدد" : "جميع المخاطر المفتوحة على مستوى المشروع";
    items = state.items.filter(i=>i.type==="risks" && (!trackId || i.track===trackId));
  }else if(type === "tasks"){
    title = "تفاصيل المهام";
    subtitle = trackId ? "مهام المسار المحدد" : "جميع المهام على مستوى المشروع";
    items = state.items.filter(i=>i.type==="tasks" && (!trackId || i.track===trackId));
  }else if(type === "permits"){
    title = "تفاصيل التصاريح والاعتمادات";
    subtitle = trackId ? "تصاريح واعتمادات المسار المحدد" : "جميع التصاريح والاعتمادات";
    items = state.items.filter(i=>i.type==="permits" && (!trackId || i.track===trackId));
  }else if(type === "milestones"){
    title = "تفاصيل المعالم الرئيسية";
    subtitle = trackId ? "معالم المسار المحدد" : "جميع المعالم الرئيسية";
    items = state.items.filter(i=>i.type==="milestones" && (!trackId || i.track===trackId));
  }else if(type === "track"){
    const t = state.tracks.find(x=>x.id===trackId);
    title = `تفاصيل مسار ${t?.name || trackId}`;
    subtitle = "كل عناصر المسار";
    items = state.items.filter(i=>i.track===trackId);
  }

  // لوحة التفاصيل: تُنشأ ديناميكيًا إذا لم تكن موجودة في الصفحة (حماية كاملة).
  var modal = ensureDetailModal();
  if(!modal){ return; } // حماية: إذا تعذّر الإنشاء لا ننهار
  if(modal.title) modal.title.textContent = title;
  if(modal.subtitle) modal.subtitle.textContent = subtitle;
  if(modal.count) modal.count.textContent = `${items.length} عنصر`;
  if(modal.list) modal.list.innerHTML = items.length ? items.map(i=>`
    <div class="detail-item-card" style="background:rgba(255,255,255,.04);border:1px solid rgba(201,168,76,.25);border-radius:12px;padding:12px 14px;margin-bottom:10px">
      <h4 style="margin:0 0 6px;color:#E8C96A">${escH(i.title)}</h4>
      <p style="margin:2px 0"><b>المسار:</b> ${escH(i.track)}</p>
      <p style="margin:2px 0"><b>النوع:</b> ${escH(i.type)}</p>
      <p style="margin:2px 0"><b>المسؤول:</b> ${escH(i.owner) || "-"}</p>
      <p style="margin:2px 0"><b>الحالة:</b> <span class="${colorByStatus(i.status)}">${escH(i.status) || "-"}</span></p>
      <p style="margin:2px 0"><b>الاستحقاق:</b> ${escH(i.due) || "-"}</p>
    </div>
  `).join("") : `<div class="hint">لا توجد عناصر مطابقة.</div>`;
  modal.overlay.style.display = "flex";
}
// ينشئ نافذة التفاصيل مرة واحدة ويعيد مراجع عناصرها (أو يستخدم عناصر HTML إن وُجدت)
function ensureDetailModal(){
  try{
    var existing = document.getElementById("detailModal");
    if(existing){
      return { overlay:existing,
        title:document.getElementById("detailModalTitle"),
        subtitle:document.getElementById("detailModalSubtitle"),
        count:document.getElementById("detailModalCount"),
        list:document.getElementById("detailModalList") };
    }
    var overlay = document.createElement("div");
    overlay.id = "detailModal";
    overlay.setAttribute("dir","rtl");
    overlay.style.cssText = "display:none;position:fixed;inset:0;z-index:9999;background:rgba(5,12,24,.72);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:20px";
    overlay.innerHTML = `
      <div style="width:min(680px,94vw);max-height:86vh;overflow:auto;background:#0D1B2A;border:1px solid rgba(201,168,76,.4);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.5);padding:22px;font-family:inherit;color:#EAF0F7">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:1px solid rgba(201,168,76,.25);padding-bottom:12px;margin-bottom:14px">
          <div>
            <h2 id="detailModalTitle" style="margin:0;color:#C9A84C;font-size:20px">التفاصيل</h2>
            <p id="detailModalSubtitle" style="margin:4px 0 0;color:#9FB0C3;font-size:13px"></p>
          </div>
          <div style="text-align:left;white-space:nowrap">
            <span id="detailModalCount" style="display:block;color:#E8C96A;font-weight:bold;margin-bottom:8px"></span>
            <button id="detailModalClose" style="cursor:pointer;background:#C9A84C;color:#0D1B2A;border:none;border-radius:8px;padding:6px 14px;font-weight:bold;font-family:inherit">إغلاق</button>
          </div>
        </div>
        <div id="detailModalList"></div>
      </div>`;
    document.body.appendChild(overlay);
    var close = ()=>{ overlay.style.display="none"; };
    overlay.querySelector("#detailModalClose").onclick = close;
    overlay.onclick = (e)=>{ if(e.target===overlay) close(); };
    document.addEventListener("keydown", (e)=>{ if(e.key==="Escape") close(); });
    return { overlay,
      title:overlay.querySelector("#detailModalTitle"),
      subtitle:overlay.querySelector("#detailModalSubtitle"),
      count:overlay.querySelector("#detailModalCount"),
      list:overlay.querySelector("#detailModalList") };
  }catch(e){ return null; }
}
function bindDetailView(){
  if(typeof backToOverview !== "undefined"){
    backToOverview.onclick = ()=>activatePage("overview");
  }
}
function trackCard(t){
  const planned = plannedForTrack(t);
  return `<article class="track-card glass clickable-card" onclick="showDetails('track','${t.id}')" style="--accent:${t.accent};--value:${t.progress}">
    <div class="track-head">
      <div class="track-title"><div class="badge">${t.id}</div><div><h3>${t.name}</h3><h4>${t.ar}</h4></div></div>
      <div class="status clickable-status" onclick="event.stopPropagation();showDetails('risks','${t.id}')">${t.status}</div>
    </div>
    <div class="track-body">
      <div class="ring"><b>${t.progress}%</b></div>
      <div class="mini-grid">
        <div class="mini clickable-kpi" onclick="event.stopPropagation();showDetails('tasks','${t.id}')"><b>${t.tasks}</b><small>المهام</small></div>
        <div class="mini clickable-kpi" onclick="event.stopPropagation();showDetails('tasks','${t.id}')"><b style="color:#43ee8d">${t.done}</b><small>منجزة</small></div>
        <div class="mini clickable-kpi" onclick="event.stopPropagation();showDetails('tasks','${t.id}')"><b style="color:#ffc247">${t.active}</b><small>نشطة</small></div>
        <div class="mini clickable-kpi" onclick="event.stopPropagation();showDetails('risks','${t.id}')"><b style="color:#ff5e6b">${t.risk}</b><small>خطر</small></div>
      </div>
    </div>
    ${paHtml(planned, Number(t.progress||0))}
    <div class="spark"></div>
    <div class="track-foot"><span>المسؤول: <b>${t.lead}</b></span><span><b>${t.focus}</b></span></div>
  </article>`;
}
function renderOverview(){
  const planned = projectPlanned();
  const actual = projectActual();
  const variance = actual - planned;
  tracksSummary.innerHTML = `
    <div class="glass panel project-pa-card">
      <div class="panel-title"><b></b><h3>Planned vs Actual — مستوى المشروع</h3></div>
      <div class="project-pa-grid">
        <div class="project-pa-metric"><b>${planned}%</b><span>المخطط</span></div>
        <div class="project-pa-metric"><b>${actual}%</b><span>الفعلي</span></div>
        <div class="project-pa-metric"><b class="${variance>=0?'green':'red'}">${variance>0?'+':''}${variance}%</b><span>الفرق</span></div>
      </div>
      ${paHtml(planned, actual)}
    </div>
    ${state.tracks.map(trackCard).join("")}`;
  const risks=state.items.filter(i=>i.type==="risks");
  riskSnapshot.innerHTML=risks.length?risks.map(r=>`<div class="risk-row clickable-status" onclick="showDetails('risks','${r.track}')"><span>${escH(r.title)}</span><strong class="${colorByStatus(r.status)}">${escH(r.status)}</strong></div>`).join(""):`<p>لا توجد مخاطر مسجلة.</p>`;
}
function renderTrackPages(){
  state.tracks.forEach(t=>{
    const el=document.getElementById(t.slug);
    if(!el) return;
    const items=type=>state.items.filter(i=>i.track===t.id&&i.type===type);
    const table=(title,type,rows)=>`<div class="glass panel">
      <div class="panel-title"><b></b><h3 class="clickable-status" onclick="showDetails('${type}','${t.id}')">${title}</h3></div>
      <div class="data-table"><div class="data-row head"><span>العنوان</span><span>المسؤول</span><span>الحالة</span><span>الاستحقاق</span></div>
      ${rows.length?rows.map(i=>`<div class="data-row clickable-card" onclick="showDetails('${type}','${t.id}')"><span>${escH(i.title)}</span><span>${escH(i.owner)}</span><strong class="${colorByStatus(i.status)}">${escH(i.status)}</strong><span>${escH(i.due)||"-"}</span></div>`).join(""):`<div class="data-row"><span>لا توجد عناصر بعد</span><span>-</span><span>-</span><span>-</span></div>`}</div></div>`;
    const planned = plannedForTrack(t);
    el.innerHTML=`<div class="track-dashboard" style="--accent:${t.accent}">
      <div class="track-hero glass"><div class="track-hero-inner"><div><h2>${t.id} · ${t.name}</h2><p>${t.ar} · ${t.sub}</p></div><div class="ring"><b>${t.progress}%</b></div></div>
      <div class="track-kpis">
        <div class="track-kpi clickable-kpi" onclick="showDetails('tasks','${t.id}')"><b>${t.tasks}</b><small>إجمالي المهام</small></div>
        <div class="track-kpi clickable-kpi" onclick="showDetails('tasks','${t.id}')"><b>${t.done}</b><small>المهام المنجزة</small></div>
        <div class="track-kpi clickable-kpi" onclick="showDetails('tasks','${t.id}')"><b>${t.active}</b><small>المهام النشطة</small></div>
        <div class="track-kpi clickable-kpi" onclick="showDetails('risks','${t.id}')"><b>${t.risk}</b><small>المهام المعرضة للخطر</small></div>
      </div>${paHtml(planned, Number(t.progress||0))}</div>
      ${table("المهام","tasks",items("tasks"))}
      ${table("المخاطر","risks",items("risks"))}
      ${table("التصاريح والاعتمادات","permits",items("permits"))}
      ${table("المعالم الرئيسية","milestones",items("milestones"))}
    </div>`;
  });
}


// ===== V20 FIXED EXECUTIVE INTELLIGENCE =====
function v20Clamp(value, min=0, max=100){
  const n = Number(value);
  if(isNaN(n)) return 0;
  return Math.max(min, Math.min(max, Math.round(n)));
}
function v20TodayISO(){
  return new Date().toISOString().slice(0,10);
}
function v20ProjectActual(){
  if(!state.tracks || !state.tracks.length) return 0;
  return v20Clamp(state.tracks.reduce((sum,t)=>sum+Number(t.progress||0),0)/state.tracks.length);
}
function v20PlannedTrack(t){
  const planned = {"أ":88,"ب":66,"ج":55,"د":60,"هـ":58};
  return planned[t.id] || v20Clamp(Number(t.progress||0)+10);
}
function v20ProjectPlanned(){
  if(!state.tracks || !state.tracks.length) return 0;
  return v20Clamp(state.tracks.reduce((sum,t)=>sum+v20PlannedTrack(t),0)/state.tracks.length);
}
function v20Items(type){
  return (state.items||[]).filter(i=>i.type===type);
}
function v20OpenDecisions(){
  return (state.decisions||[]).filter(d=>d.status!=="معتمد");
}
function v20OverdueItems(){
  const today = new Date(); today.setHours(0,0,0,0);
  return (state.items||[]).filter(i=>{
    if(!i.due) return false;
    const d = new Date(i.due);
    return !isNaN(d) && d < today && !["مكتملة","معتمدة","Completed","Cleared"].includes(i.status);
  });
}
function v20DueTodayItems(){
  const today = v20TodayISO();
  return (state.items||[]).filter(i=>i.due===today);
}
function v20ApprovalsRate(){
  const permits = v20Items("permits");
  if(!permits.length) return 100;
  const cleared = permits.filter(i=>["معتمدة","مكتملة","Cleared","Completed"].includes(i.status)).length;
  return v20Clamp((cleared/permits.length)*100);
}
function v20RiskIndex(){
  const risks = v20Items("risks");
  if(!risks.length) return 0;
  const critical = risks.filter(i=>["معرضة للخطر","معرض للخطر","متأخر","At Risk"].includes(i.status)).length;
  const noOwner = risks.filter(i=>!i.owner).length;
  const noDue = risks.filter(i=>!i.due).length;
  return v20Clamp((critical*22)+(risks.length*6)+(noOwner*8)+(noDue*6));
}
function v20UpdateCompliance(){
  state.dailyLogs = state.dailyLogs || [];
  if(!state.dailyLogs.length || !state.tracks.length) return 0;
  const today = new Date().toLocaleDateString("ar-SA");
  const updated = new Set(state.dailyLogs.filter(l=>l.date===today).map(l=>l.track));
  return v20Clamp((updated.size/state.tracks.length)*100);
}
function v20TrackHealth(t){
  const variance = Number(t.progress||0) - v20PlannedTrack(t);
  const risks = v20Items("risks").filter(i=>i.track===t.id).length;
  const decisions = v20OpenDecisions().filter(d=>d.track===t.id).length;
  return v20Clamp(100 + variance - (risks*8) - (decisions*6) - (Number(t.risk||0)*4));
}
function v20HealthLabel(score){
  if(score >= 80) return ["مطمئن","green","#43ee8d"];
  if(score >= 60) return ["تحت المتابعة","amber","#ffc247"];
  if(score >= 40) return ["يحتاج تدخل","red","#ff5e6b"];
  return ["حرج","red","#ff5e6b"];
}
function v20ProjectHealth(){
  const actual = v20ProjectActual();
  const planned = v20ProjectPlanned();
  const variancePenalty = Math.max(0, planned-actual) * 1.1;
  const riskPenalty = Math.min(35, v20RiskIndex()*0.28);
  const decisionPenalty = Math.min(18, v20OpenDecisions().length*3);
  const overduePenalty = Math.min(18, v20OverdueItems().length*4);
  const approvalBonus = v20ApprovalsRate()*0.06;
  return v20Clamp(100 - variancePenalty - riskPenalty - decisionPenalty - overduePenalty + approvalBonus);
}
function v20OpeningReadiness(){
  const weights = {"د":0.30,"ج":0.22,"هـ":0.18,"ب":0.15,"أ":0.15};
  let total = 0, score = 0;
  (state.tracks||[]).forEach(t=>{
    const w = weights[t.id] || 0.1;
    total += w;
    score += Number(t.progress||0)*w;
  });
  return total ? v20Clamp(score/total) : 0;
}
function v20MostCriticalTrack(){
  const ranked = (state.tracks||[]).map(t=>({track:t, health:v20TrackHealth(t)}));
  ranked.sort((a,b)=>a.health-b.health);
  return ranked[0];
}
function v20SetRing(el, score, color){
  if(!el) return;
  el.style.setProperty("--ring-score", score);
  el.style.setProperty("--ring-color", color);
}
function v20RenderIntelligence(){
  if(typeof projectHealthScore === "undefined") return;
  const health = v20ProjectHealth();
  const [hLabel,hClass,hColor] = v20HealthLabel(health);
  const readiness = v20OpeningReadiness();
  const [rLabel,rClass,rColor] = v20HealthLabel(readiness);
  const planned = v20ProjectPlanned();
  const actual = v20ProjectActual();
  const variance = actual-planned;

  projectHealthScore.textContent = health;
  projectHealthLabel.textContent = hLabel;
  projectHealthText.textContent = `المخطط ${planned}%، الفعلي ${actual}%، الانحراف ${variance>0?"+":""}${variance}%، المخاطر ${v20Items("risks").length}، القرارات المفتوحة ${v20OpenDecisions().length}.`;
  v20SetRing(projectHealthRing, health, hColor);

  readinessScore.textContent = readiness;
  readinessLabel.textContent = rLabel;
  v20SetRing(readinessRing, readiness, rColor);

  const approvals = v20ApprovalsRate();
  const riskIndex = v20RiskIndex();
  const compliance = v20UpdateCompliance();
  const overdue = v20OverdueItems().length;

  const cards = [
    {v:`${variance>0?"+":""}${variance}%`,t:"انحراف الخطة",s:"Planned vs Actual",c:variance<0?"red":"green",action:"showDetails('track')"},
    {v:v20OpenDecisions().length,t:"قرارات عالقة",s:"Pending Decisions",c:v20OpenDecisions().length>3?"red":"amber",action:"activatePage('decisions')"},
    {v:`${approvals}%`,t:"إغلاق الاعتمادات",s:"Approvals Clearance",c:approvals<60?"red":approvals<85?"amber":"green",action:"showDetails('permits')"},
    {v:riskIndex,t:"مؤشر المخاطر",s:"Critical Risk Index",c:riskIndex>60?"red":riskIndex>30?"amber":"green",action:"showDetails('risks')"},
    {v:`${compliance}%`,t:"التزام التحديثات",s:"Update Compliance",c:compliance<50?"red":compliance<80?"amber":"green",action:"activatePage('daily-update')"},
    {v:overdue,t:"عناصر متأخرة",s:"Overdue Items",c:overdue>0?"red":"green",action:"showDetails('tasks')"}
  ];
  intelKpiGrid.innerHTML = cards.map(card=>`<article class="glass intel-kpi-card ${card.c}" onclick="${card.action}">
    <h3>${card.v}</h3><p>${card.t}</p><small>${card.s}</small>
  </article>`).join("");

  const critical = v20MostCriticalTrack();
  if(critical){
    const [label, cls] = v20HealthLabel(critical.health);
    criticalTrackBox.innerHTML = `<div class="intel-list-card" onclick="showDetails('track','${critical.track.id}')">
      <h4>${critical.track.id} · ${critical.track.name}</h4>
      <p><b>صحة المسار:</b> ${critical.health}%</p>
      <p><b>الإنجاز:</b> ${critical.track.progress}%</p>
      <p><b>المخاطر:</b> ${v20Items("risks").filter(i=>i.track===critical.track.id).length}</p>
      <span class="health-chip ${cls}">${label}</span>
    </div>`;
  } else {
    criticalTrackBox.innerHTML = `<div class="hint">لا توجد بيانات كافية.</div>`;
  }

  const required = v20DueTodayItems().concat(v20OverdueItems()).slice(0,8);
  requiredTodayBox.innerHTML = required.length ? required.map(i=>`<div class="intel-list-card" onclick="showDetails('${i.type}','${i.track}')">
    <h4>${i.title}</h4><p>المسار ${i.track} · ${i.status || "-"} · ${i.due || "-"}</p>
  </div>`).join("") : `<div class="hint">لا توجد عناصر مستحقة اليوم أو متأخرة.</div>`;

  const alerts = [];
  if(variance < -10) alerts.push(["انحراف عن الخطة",`الفعلي أقل من المخطط بـ ${Math.abs(variance)}%.`,"red"]);
  if(v20OpenDecisions().length > 0) alerts.push(["قرارات مفتوحة",`يوجد ${v20OpenDecisions().length} قرار يحتاج متابعة.`,"amber"]);
  if(riskIndex > 50) alerts.push(["مخاطر مرتفعة",`مؤشر المخاطر وصل إلى ${riskIndex}.`,"red"]);
  if(approvals < 80) alerts.push(["الاعتمادات تحتاج متابعة",`نسبة إغلاق الاعتمادات ${approvals}%.`,"amber"]);
  if(compliance < 60) alerts.push(["تحديثات ناقصة",`التزام التحديثات ${compliance}%.`,"amber"]);
  smartAlertsBox.innerHTML = alerts.length ? alerts.map(a=>`<div class="intel-list-card ${a[2]}"><h4>${a[0]}</h4><p>${a[1]}</p></div>`).join("") : `<div class="hint">لا توجد تنبيهات حرجة حاليًا.</div>`;
}
function v20BindIntelligence(){
  if(typeof refreshIntelligence !== "undefined"){
    refreshIntelligence.onclick = ()=>{
      v20RenderIntelligence();
      addFeed(["المؤشرات الذكية","تم تحديث المؤشرات التنفيذية","green"]);
    };
  }
}



// ===== V22 OPENING READINESS + LIVE COUNTDOWN =====
function v22OpeningDate(){
  try{
    if(state && state.project && state.project.openingDate) return new Date(state.project.openingDate + "T00:00:00");
  }catch(e){}
  return new Date("2026-09-27T00:00:00");
}
function v22OpeningReadiness(){
  if(typeof v20OpeningReadiness === "function") return v20OpeningReadiness();
  if(typeof openingReadinessScoreCalc === "function") return openingReadinessScoreCalc();
  if(!state.tracks || !state.tracks.length) return 0;
  const weights = {"د":0.30,"ج":0.22,"هـ":0.18,"ب":0.15,"أ":0.15};
  let score=0,total=0;
  state.tracks.forEach(t=>{
    const w = weights[t.id] || 0.10;
    score += Number(t.progress||0)*w;
    total += w;
  });
  return total ? Math.round(score/total) : 0;
}
function v22UpdateLiveCountdown(){
  if(typeof countSeconds === "undefined") return;
  const target = v22OpeningDate();
  const now = new Date();

  let diffMs = target - now;
  if(diffMs < 0) diffMs = 0;

  const totalSeconds = Math.floor(diffMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  // حساب تقريبي فخم للعرض التنفيذي:
  // الشهر = 30 يوم، الأسبوع = 7 أيام، ثم الأيام المتبقية
  const totalDays = Math.floor(diffMs / (1000*60*60*24));
  const months = Math.floor(totalDays / 30);
  const daysAfterMonths = totalDays % 30;
  const weeks = Math.floor(daysAfterMonths / 7);
  const days = daysAfterMonths % 7;

  // الدقائق المتبقية داخل الساعة الحالية
  const minutes = totalMinutes % 60;

  if(typeof countMonths !== "undefined") countMonths.textContent = String(months);
  if(typeof countWeeks !== "undefined") countWeeks.textContent = String(weeks);
  if(typeof countDays !== "undefined") countDays.textContent = String(days);
  if(typeof countMinutes !== "undefined") countMinutes.textContent = String(minutes).padStart(2,"0");
  if(typeof countSeconds !== "undefined") countSeconds.textContent = String(seconds).padStart(2,"0");

  if(typeof countdownTargetText !== "undefined"){
    countdownTargetText.textContent = `حتى موعد الافتتاح: ${target.toLocaleDateString("ar-SA")}`;
  }
}

// ===== V21 HOME PAGE ORGANIZATION =====
function v21SafeProjectActual(){
  if(typeof v20ProjectActual === "function") return v20ProjectActual();
  if(typeof projectActual === "function") return projectActual();
  if(!state.tracks || !state.tracks.length) return 0;
  return Math.round(state.tracks.reduce((s,t)=>s+Number(t.progress||0),0)/state.tracks.length);
}
function v21SafeProjectPlanned(){
  if(typeof v20ProjectPlanned === "function") return v20ProjectPlanned();
  if(typeof projectPlanned === "function") return projectPlanned();
  return Math.min(100, v21SafeProjectActual()+10);
}
function v21DaysToOpen(){
  if(typeof daysToOpen === "function") return daysToOpen();
  return "--";
}
function v21HomeStatusLabel(score){
  if(score>=80) return ["مطمئن","المشروع ضمن نطاق صحي ومناسب للمتابعة التنفيذية."];
  if(score>=60) return ["تحت المتابعة","المشروع مستقر نسبيًا مع وجود عناصر تحتاج متابعة يومية."];
  if(score>=40) return ["يحتاج تدخل","يوجد انحراف أو مخاطر تتطلب تدخلًا إداريًا سريعًا."];
  return ["حرج","الحالة تحتاج تصعيدًا فوريًا ومتابعة لصيقة."];
}
function v21RenderHomeSummary(){
  if(typeof homeOverallNumber === "undefined") return;
  const actual = v21SafeProjectActual();
  const planned = v21SafeProjectPlanned();
  const variance = actual - planned;
  const health = typeof v20ProjectHealth === "function" ? v20ProjectHealth() : actual;
  const status = v21HomeStatusLabel(health);

  homeOverallNumber.textContent = actual + "%";
  homeStatusLabel.textContent = status[0];
  homeStatusText.textContent = status[1] + ` المخطط ${planned}%، الفعلي ${actual}%، الفرق ${variance>0?"+":""}${variance}%.`;
  v22UpdateLiveCountdown();

  homePlannedActualBox.innerHTML = `<div class="home-pa-bars">
    <div class="home-pa-line"><span>المخطط</span><div class="home-pa-track planned"><i style="width:${Math.max(0,Math.min(100,planned))}%"></i></div><b>${planned}%</b></div>
    <div class="home-pa-line"><span>الفعلي</span><div class="home-pa-track actual"><i style="width:${Math.max(0,Math.min(100,actual))}%"></i></div><b>${actual}%</b></div>
    <div class="home-pa-line"><span>الفرق</span><div class="home-pa-track variance"><i style="width:${Math.max(0,Math.min(100,Math.abs(variance)))}%;background:${variance>=0?'#43ee8d':'#ff5e6b'}"></i></div><b class="${variance>=0?'green':'red'}">${variance>0?'+':''}${variance}%</b></div>
  </div>`;
}


function renderKpis(){
  const k = kpis();
  const readiness = v22OpeningReadiness();
  overviewKpis.innerHTML=[
    ["cyan",k.total,"إجمالي المهام","tasks"],
    ["green",k.done,"المهام المنجزة","tasks"],
    ["amber",k.active,"مهام نشطة","tasks"],
    ["red",k.risk,"مخاطر مفتوحة","risks"],
    ["sand",k.overall+"%","الإنجاز العام","track"],
    ["cyan",readiness+"%","جاهزية الافتتاح","milestones"]
  ].map(x=>`<article class="kpi glass ${x[0]} clickable-kpi" onclick="showDetails('${x[3]}')"><h3>${x[1]}</h3><small>${x[2]}</small></article>`).join("");
}


// ===== V23 ROYAL COURT TRACK HOME FIX =====
function ensureRoyalCourtTrack(){
  // تمت إزالة مسار "الديوان الملكي" (هـ): نُنظّف أي أثر له من البيانات والواجهة حتى لو كانت نسخة المتصفح قديمة.
  if(Array.isArray(state.tracks)) state.tracks = state.tracks.filter(t=>t.id!=="هـ" && t.name!=="الديوان الملكي");
  if(Array.isArray(state.items)) state.items = state.items.filter(i=>i.track!=="هـ");
  var btn = document.querySelector('.nav-btn[data-page="track-e"]'); if(btn) btn.remove();
  var pg = document.getElementById("track-e"); if(pg) pg.remove();
  var tab = document.querySelector('.timeline-track-tab[data-track-filter="هـ"]'); if(tab) tab.remove();
}

/* ============ مركز القرارات الاستباقي ============ */
function v30DaysUntil(due){
  if(!due) return null;
  const d = new Date(due); if(isNaN(d.getTime())) return null;
  const today = new Date(); today.setHours(0,0,0,0); d.setHours(0,0,0,0);
  return Math.ceil((d - today) / 86400000);
}
function v30Alerts(){
  const DONE = ["مكتملة","معتمدة","Completed","Cleared","مغلقة"];
  const RISK = ["معرضة للخطر","معرض للخطر","At Risk","متأخر"];
  const alerts = [];
  (state.items||[]).forEach(function(i){
    if(i.type === "risks") return;
    if(DONE.includes(i.status)) return;
    const du = v30DaysUntil(i.due);
    if(du === null) return;
    if(du < 0) alerts.push({sev:3,cat:"موعد",track:i.track,title:i.title,msg:"تجاوز موعده بـ "+Math.abs(du)+" يوم ولم يكتمل · "+(i.owner||"")});
    else if(du <= 3) alerts.push({sev:3,cat:"موعد",track:i.track,title:i.title,msg:"يستحق خلال "+du+" يوم ولم يكتمل · "+(i.owner||"")});
    else if(du <= 10) alerts.push({sev:2,cat:"موعد",track:i.track,title:i.title,msg:"يستحق خلال "+du+" يوم · "+(i.owner||"")});
  });
  (state.items||[]).forEach(function(i){
    const riskItem = i.type === "risks";
    const riskStatus = RISK.includes(i.status);
    if((riskItem || riskStatus) && !DONE.includes(i.status)){
      alerts.push({sev: riskStatus?3:2, cat:"مخاطرة", track:i.track, title:i.title, msg:(i.status||"")+" · "+(i.owner||"")});
    }
  });
  (state.tracks||[]).forEach(function(t){
    const planned = plannedForTrack(t);
    const actual = Number(t.progress||0);
    const v = actual - planned;
    if(v <= -10) alerts.push({sev:3,cat:"تأخر مسار",track:t.id,title:t.name,msg:"الفعلي "+actual+"% مقابل المخطط "+planned+"% (انحراف "+v+"%)"});
    else if(v <= -5) alerts.push({sev:2,cat:"تأخر مسار",track:t.id,title:t.name,msg:"الفعلي "+actual+"% مقابل المخطط "+planned+"% (انحراف "+v+"%)"});
  });
  const seen={}, uniq=[];
  alerts.forEach(function(a){ const k=a.cat+"|"+a.track+"|"+a.title; if(!seen[k]){seen[k]=1;uniq.push(a);} });
  uniq.sort(function(a,b){ return b.sev - a.sev; });
  return uniq;
}
function ensureDecisionCenter(){
  let dc = document.getElementById("decisionCenter");
  if(dc) return dc;
  const grid = document.getElementById("tracksSummary");
  if(!grid || !grid.parentNode) return null;
  dc = document.createElement("section");
  dc.id = "decisionCenter";
  dc.className = "glass panel";
  dc.style.cssText = "margin:0 0 18px;padding:16px 18px;border:1px solid rgba(201,168,76,.35);border-radius:16px";
  grid.parentNode.insertBefore(dc, grid);
  return dc;
}
function v30RenderDecisionCenter(){
  const dc = ensureDecisionCenter(); if(!dc) return;
  const alerts = v30Alerts();
  const red = alerts.filter(function(a){return a.sev===3;}).length;
  const amber = alerts.filter(function(a){return a.sev===2;}).length;
  if(!alerts.length){
    dc.innerHTML = '<div class="panel-title"><b></b><h3 style="margin:0">مركز القرارات الاستباقي</h3></div>'+
      '<p style="color:#43ee8d;margin:8px 2px">لا توجد تنبيهات حرجة حاليًا — كل المؤشرات ضمن النطاق ✓</p>';
    return;
  }
  const rows = alerts.map(function(a){
    const color = a.sev===3 ? "#ff5e6b" : "#E8C96A";
    const tag = a.sev===3 ? "حرج" : "راقب";
    const dtype = a.cat==="مخاطرة" ? "risks" : "milestones";
    return '<div onclick="showDetails(\''+dtype+'\',\''+a.track+'\')" style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;margin:6px 0;border-radius:10px;background:rgba(255,255,255,.05);border-right:4px solid '+color+';cursor:pointer">'+
      '<span style="background:'+color+';color:#0D1B2A;font-weight:bold;font-size:11px;padding:3px 9px;border-radius:20px;white-space:nowrap">'+tag+'</span>'+
      '<div style="flex:1"><b style="color:#EAF0F7">['+escH(a.cat)+' · مسار '+escH(a.track)+'] '+escH(a.title)+'</b>'+
      '<div style="color:#9FB0C3;font-size:13px;margin-top:3px">'+escH(a.msg)+'</div></div></div>';
  }).join("");
  dc.innerHTML = '<div class="panel-title" style="display:flex;justify-content:space-between;align-items:center;gap:10px">'+
    '<h3 style="margin:0">🚨 يتطلب انتباهك الآن</h3>'+
    '<span style="font-size:13px;white-space:nowrap"><b style="color:#ff5e6b">'+red+' حرج</b> · <b style="color:#E8C96A">'+amber+' راقب</b></span></div>'+
    '<div style="margin-top:8px">'+rows+'</div>';
}
function renderAll(){ensureRoyalCourtTrack();applyUiSettings();renderKpis();renderOverview();v30RenderDecisionCenter();renderTrackPages();renderForms();renderFeed();fillUiForms();renderOps();applyBroadcast();v20RenderIntelligence();v21RenderHomeSummary();v27UpdateAllCountdowns();v28RenderHomeAction();renderTimeline()}

function normalizeHeader(h){
  return String(h||"").trim().toLowerCase()
    .replace(/\s+/g,"")
    .replace("المسار","track")
    .replace("نوعالعنصر","type")
    .replace("النوع","type")
    .replace("العنوان","title")
    .replace("المهمة","title")
    .replace("النشاط","title")
    .replace("الوصف","title")
    .replace("المسؤول","owner")
    .replace("المالك","owner")
    .replace("الحالة","status")
    .replace("تاريخالاستحقاق","due")
    .replace("الاستحقاق","due")
    .replace("التاريخ","due");
}
function recalcTrackCountersFromItems(){
  state.tracks.forEach(t=>{
    const trackItems = (state.items || []).filter(i=>i.track === t.id);
    const taskItems = trackItems.filter(i=>i.type === "tasks");
    const riskItems = trackItems.filter(i=>i.type === "risks" && i.status !== "مغلقة");

    t.tasks = taskItems.length;
    t.done = taskItems.filter(i=>["مكتملة","معتمدة","Completed","Cleared"].includes(i.status)).length;
    t.active = taskItems.filter(i=>["قيد التنفيذ","تحت المتابعة","In Progress","Watch"].includes(i.status)).length;
    t.risk = riskItems.length + taskItems.filter(i=>["معرضة للخطر","معرض للخطر","At Risk","متأخر"].includes(i.status)).length;

    const total = Number(t.tasks || 0);
    const done = Number(t.done || 0);
    if(total > 0){
      t.progress = Math.round((done / total) * 100);
      t.status = t.progress >= 70 ? "ضمن المسار" : t.progress >= 45 ? "تحت المتابعة" : "معرض للخطر";
    }
  });
}

function smartImportRows(rows){
  if(!rows.length) return 0;
  state.items = state.items || [];

  const rawHeader = rows[0].map(normalizeHeader);
  const hasHeader = rawHeader.some(h=>["track","type","title","owner","status","due"].includes(h));
  let map = {track:0,type:1,title:2,owner:3,status:4,due:5};

  if(hasHeader){
    ["track","type","title","owner","status","due"].forEach(k=>{
      const idx = rawHeader.findIndex(h=>h===k || h.includes(k));
      if(idx>=0) map[k]=idx;
    });
    rows = rows.slice(1);
  }

  const importedItems = [];
  rows.forEach(r=>{
    const item = {
      track: normalizeTrack(r[map.track]),
      type: normalizeType(r[map.type]),
      title: r[map.title] || "",
      owner: r[map.owner] || "",
      status: r[map.status] || "قيد التنفيذ",
      due: r[map.due] || ""
    };
    if(!["أ","ب","ج","د"].includes(item.track) || !item.title) return;
    importedItems.push(item);
  });

  if(!importedItems.length){
    if(typeof importSummary !== "undefined") importSummary.innerHTML = "لم يتم العثور على عناصر صالحة للاستيراد.";
    return 0;
  }

  // استبدال ذكي:
  // نحذف العناصر القديمة لنفس المسار ونفس النوع المستورد فقط، ثم نضيف الجديد.
  // مثال: استيراد مهام مسار أ يحذف مهام مسار أ القديمة فقط، ولا يمس المخاطر أو التصاريح.
  const replaceKeys = new Set(importedItems.map(i=>`${i.track}::${i.type}`));
  const beforeCount = state.items.length;

  state.items = state.items.filter(oldItem => !replaceKeys.has(`${oldItem.track}::${oldItem.type}`));
  const removedCount = beforeCount - state.items.length;

  state.items.push(...importedItems);
  recalcTrackCountersFromItems();

  save();
  renderAll();

  addFeed(["استيراد بالاستبدال",`تم استبدال ${removedCount} عنصر قديم وإضافة ${importedItems.length} عنصر جديد`,"green"]);
  if(typeof importSummary !== "undefined"){
    importSummary.innerHTML = `تم الاستيراد بنظام <b>الاستبدال الذكي</b>: تم حذف <b>${removedCount}</b> عنصر قديم وإضافة <b>${importedItems.length}</b> عنصر جديد.`;
  }
  return importedItems.length;
}


function parseDelimited(text){let rows=[];let delimiter=text.includes("\t")?"\t":",";text.trim().split(/\r?\n/).forEach(line=>{if(!line.trim())return;let arr=[];let current="",quote=false;for(let i=0;i<line.length;i++){let ch=line[i];if(ch==='"'){quote=!quote;continue}if(ch===delimiter&&!quote){arr.push(current.trim());current="";}else current+=ch}arr.push(current.trim());rows.push(arr)});return rows}
function importRows(rows){ return smartImportRows(rows); }
document.querySelectorAll(".nav-btn").forEach(btn=>{
  btn.onclick=()=>{
    if(btn.dataset.protected === "true" && !isAdminUnlocked()){
      requestAdminAccess(btn.dataset.page);
      return;
    }
    activatePage(btn.dataset.page, btn);
  };
})
// تمت إزالة الاستيراد المحلي (لصق/CSV) — البيانات تُسحب الآن من Google Sheet عبر الخادم.
trackSelect.onchange=()=>{const t=state.tracks.find(x=>x.id===trackSelect.value);progressInput.value=t.progress;tasksInput.value=t.tasks;doneInput.value=t.done;activeInput.value=t.active;riskInput.value=t.risk;leadInput.value=t.lead;focusInput.value=t.focus}
trackForm.onsubmit=e=>{e.preventDefault();const t=state.tracks.find(x=>x.id===trackSelect.value);t.progress=+progressInput.value||0;t.tasks=+tasksInput.value||0;t.done=+doneInput.value||0;t.active=+activeInput.value||0;t.risk=+riskInput.value||0;t.lead=leadInput.value;t.focus=focusInput.value;t.status=t.progress>=70?"ضمن المسار":t.progress>=45?"تحت المتابعة":"معرض للخطر";addFeed(["تحديث مسار",`تم تحديث لوحة مسار ${t.name}`,colorByStatus(t.status)]);save();renderAll()}
itemForm.onsubmit=async e=>{
  e.preventDefault();
  const payload={track:itemTrack.value,type:itemType.value,title:itemTitle.value,owner:itemOwner.value,status:itemStatus.value,due:itemDue.value};
  if(!payload.title.trim()){ return; }
  // إذا كان الخادم متاحًا وبصلاحية أدمن: احفظ على الخادم (مشترك ودائم)
  let savedRemote=false;
  if(typeof backendAvailable==="function" && backendAvailable()){
    try{
      const res=await fetch("/api/items",{method:"POST",credentials:"include",
        headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      if(res.ok){
        savedRemote=true;
        addFeed(["إضافة عنصر",`تمت إضافة ${payload.title} إلى المسار ${payload.track} (محفوظ ومشترك)`,colorByStatus(payload.status)]);
        if(typeof backendSyncNow==="function") await backendSyncNow();
        if(typeof renderManualItems==="function") renderManualItems();
        if(typeof renderAuditLog==="function") renderAuditLog();
        itemForm.reset();
      }else if(res.status===401||res.status===403){
        addFeed(["إضافة عنصر","الحفظ المشترك يتطلب دخول أدمن — حُفظ محليًا فقط","amber"]);
      }
    }catch(err){ /* نتراجع للحفظ المحلي */ }
  }
  // تراجع محلي (عرض فقط) إذا تعذّر الحفظ على الخادم
  if(!savedRemote){
    state.items.push(payload);
    if(typeof recalcTrackCountersFromItems==="function")recalcTrackCountersFromItems();
    addFeed(["إضافة عنصر",`تمت إضافة ${payload.title} إلى المسار ${payload.track}`,colorByStatus(payload.status)]);
    itemForm.reset();save();renderAll();
  }
}
simulate.onclick=()=>{const t=state.tracks[Math.floor(Math.random()*state.tracks.length)];t.done=Math.min(t.tasks,t.done+1);t.active=Math.max(0,t.active-1);t.progress=t.tasks?Math.round(t.done/t.tasks*100):t.progress;addFeed(["تحديث حي",`تغيرت نسبة إنجاز مسار ${t.name} إلى ${t.progress}%`,colorByStatus(t.status)]);save();renderAll()}
if(typeof exportJson!=="undefined"&&exportJson){exportJson.onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="kag-command-center-data.json";a.click()}}

// ===== لوحة مصدر البيانات (Google Sheet) =====
function renderDataSourcePanel(){
  var bulk=document.getElementById("bulk");
  if(!bulk || !bulk.classList.contains("active")) return; // الصفحة للأدمن فقط
  fetch("/api/config",{cache:"no-store",credentials:"include"}).then(r=>r.ok?r.json():null).then(c=>{
    if(!c) return;
    const set=(id,val,cls)=>{const el=document.getElementById(id);if(!el)return;el.textContent=val;if(cls){el.className=cls;}};
    const sync=c.sync||{};
    set("ds_mode", c.sheetConfigured?(sync.ok?"متصل ومزامن مع Google Sheet":"مُهيّأ لكن تعذّر السحب"):"بيانات تجريبية (لم يُضبط الجدول)", null,
        c.sheetConfigured&&sync.ok?"green":(c.sheetConfigured?"red":"amber"));
    set("ds_source", sync.source==="google-sheet"?"Google Sheet":"بيانات تجريبية محلية");
    set("ds_sheet", c.sheetName||"--");
    set("ds_lastsync", sync.at?new Date(sync.at).toLocaleString("ar-SA"):"--");
    set("ds_rows", (sync.rows!=null?sync.rows:"--"));
    set("ds_version", c.version!=null?c.version:"--");
    set("ds_error", sync.error?sync.error:"لا يوجد", sync.error?"red":"green");
    const link=document.getElementById("ds_openSheet");
    if(link){ if(c.sheetViewUrl){link.href=c.sheetViewUrl;link.style.display="inline-flex";} else {link.style.display="none";} }
  }).catch(()=>{});
}
if(typeof forceSyncBtn!=="undefined"&&forceSyncBtn){
  forceSyncBtn.onclick=()=>{
    forceSyncBtn.disabled=true; forceSyncBtn.textContent="جارٍ المزامنة...";
    fetch("/api/refresh",{method:"POST",credentials:"include"}).then(r=>r.json()).then(()=>{
      if(typeof backendSyncNow==="function") backendSyncNow();
      renderDataSourcePanel();
    }).catch(()=>{}).finally(()=>{ setTimeout(()=>{forceSyncBtn.disabled=false;forceSyncBtn.textContent="إعادة المزامنة الآن";},1200); });
  };
}
setInterval(renderDataSourcePanel, 5000);
renderDataSourcePanel();

// ===== العناصر المُدخلة يدويًا (عرض + حذف) =====
function renderManualItems(){
  var box=document.getElementById("manualItemsList");
  var page=document.getElementById("bulk");
  if(!box || !page || !page.classList.contains("active")) return;
  fetch("/api/items",{cache:"no-store",credentials:"include"}).then(r=>r.ok?r.json():null).then(d=>{
    if(!d||!Array.isArray(d.items)){ box.innerHTML='<div class="data-row"><span>—</span></div>'; return; }
    if(!d.items.length){ box.innerHTML='<div class="data-row"><span>لا توجد عناصر مُدخلة يدويًا بعد</span></div>'; return; }
    box.innerHTML='<div class="data-row head"><span>العنوان</span><span>المسار</span><span>الحالة</span><span></span></div>'+
      d.items.map(function(it){
        return '<div class="data-row"><span>'+escH(it.title)+'</span><span>'+escH(it.track)+'</span>'+
          '<strong class="'+colorByStatus(it.status)+'">'+escH(it.status)+'</strong>'+
          '<span><button class="control danger" data-del-item="'+escH(it.id)+'">حذف</button></span></div>';
      }).join("");
    box.querySelectorAll("[data-del-item]").forEach(function(btn){
      btn.onclick=function(){
        var id=btn.getAttribute("data-del-item");
        btn.disabled=true; btn.textContent="...";
        fetch("/api/items/delete",{method:"POST",credentials:"include",
          headers:{"Content-Type":"application/json"},body:JSON.stringify({id:id})})
          .then(r=>r.json()).then(function(){
            if(typeof backendSyncNow==="function") backendSyncNow();
            renderManualItems(); renderAuditLog();
          }).catch(function(){ btn.disabled=false; btn.textContent="حذف"; });
      };
    });
  }).catch(()=>{});
}

// ===== سجل التدقيق =====
function renderAuditLog(){
  var box=document.getElementById("auditLogList");
  var page=document.getElementById("bulk");
  if(!box || !page || !page.classList.contains("active")) return;
  fetch("/api/audit",{cache:"no-store",credentials:"include"}).then(r=>r.ok?r.json():null).then(d=>{
    if(!d||!Array.isArray(d.audit)){ box.innerHTML='<div class="data-row"><span>سجل التدقيق متاح للأدمن فقط</span></div>'; return; }
    if(!d.audit.length){ box.innerHTML='<div class="data-row"><span>لا توجد مدخلات بعد</span></div>'; return; }
    box.innerHTML='<div class="data-row head"><span>الوقت</span><span>الإجراء</span><span>التفاصيل</span></div>'+
      d.audit.slice(0,40).map(function(a){
        var t; try{ t=new Date(a.at).toLocaleString("ar-SA"); }catch(e){ t=a.at; }
        return '<div class="data-row"><span>'+escH(t)+'</span><span>'+escH(a.action)+'</span><span>'+escH(a.detail||"—")+'</span></div>';
      }).join("");
  }).catch(()=>{});
}
setInterval(function(){ renderManualItems(); renderAuditLog(); }, 6000);
renderManualItems(); renderAuditLog();






// ===== V17 MOBILE MENU FIX =====
function bindMobileMenuV17(){
  const toggle = document.getElementById("mobileMenuToggle");
  const nav = document.getElementById("mainNav");
  const backdrop = document.getElementById("mobileNavBackdrop");
  const topBtn = document.getElementById("mobileTopBtn");

  function closeMenu(){
    if(nav) nav.classList.remove("mobile-open");
    if(backdrop) backdrop.classList.remove("active");
    if(toggle) toggle.textContent = "☰";
  }
  function openMenu(){
    if(nav) nav.classList.add("mobile-open");
    if(backdrop) backdrop.classList.add("active");
    if(toggle) toggle.textContent = "×";
  }

  if(toggle && nav){
    toggle.onclick = ()=>{
      nav.classList.contains("mobile-open") ? closeMenu() : openMenu();
    };
  }
  if(backdrop) backdrop.onclick = closeMenu;
  document.querySelectorAll(".nav-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      if(window.innerWidth <= 900) setTimeout(closeMenu, 120);
    });
  });
  if(topBtn) topBtn.onclick = ()=>window.scrollTo({top:0, behavior:"smooth"});
}

// ===== MOBILE UX MODULE =====
function bindMobileUX(){
  const toggle = document.getElementById("mobileMenuToggle");
  const nav = document.getElementById("mainNav");
  const topBtn = document.getElementById("mobileTopBtn");

  if(toggle && nav){
    toggle.onclick = ()=>{
      nav.classList.toggle("mobile-open");
      toggle.textContent = nav.classList.contains("mobile-open") ? "× إغلاق القائمة" : "☰ القائمة";
    };

    document.querySelectorAll(".nav-btn").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        if(window.innerWidth <= 900){
          nav.classList.remove("mobile-open");
          toggle.textContent = "☰ القائمة";
        }
      });
    });
  }

  if(topBtn){
    topBtn.onclick = ()=>window.scrollTo({top:0, behavior:"smooth"});
  }
}



// ===== V28 HOME ACTION CARD =====
function v28GetTopAction(){
  const overdue = (typeof v20OverdueItems === "function") ? v20OverdueItems() : [];
  const risks = (state.items||[]).filter(i=>i.type==="risks" && ["معرضة للخطر","معرض للخطر","متأخر","At Risk","تحت المتابعة"].includes(i.status));
  const decisions = (state.decisions||[]).filter(d=>d.status && d.status !== "معتمد");
  const permits = (state.items||[]).filter(i=>i.type==="permits" && !["معتمدة","مكتملة","Cleared","Completed"].includes(i.status));

  if(overdue.length){
    return {title:"عنصر متأخر يحتاج إغلاق", text:overdue[0].title + " · المسار " + overdue[0].track, chip:"متأخر", color:"red", action:`showDetails('${overdue[0].type}','${overdue[0].track}')`};
  }
  if(risks.length){
    return {title:"مخاطرة تحتاج متابعة", text:risks[0].title + " · المسار " + risks[0].track, chip:"مخاطر", color:"red", action:`showDetails('risks','${risks[0].track}')`};
  }
  if(decisions.length){
    return {title:"قرار مطلوب", text:decisions[0].title || "قرار مفتوح يحتاج متابعة", chip:"قرار", color:"amber", action:"activatePage('decisions')"};
  }
  if(permits.length){
    return {title:"اعتماد تحت المتابعة", text:permits[0].title + " · " + (permits[0].status || "-"), chip:"اعتماد", color:"amber", action:`showDetails('permits','${permits[0].track}')`};
  }
  return {title:"الوضع مستقر", text:"لا توجد عناصر عاجلة حاليًا. استمر في تحديث البيانات اليومية.", chip:"مستقر", color:"green", action:"activatePage('intelligence')"};
}
function v28RenderHomeAction(){
  if(typeof homeActionTitle === "undefined") return;
  const a = v28GetTopAction();
  homeActionTitle.textContent = a.title;
  homeActionText.textContent = a.text;
  homeActionChip.textContent = a.chip;
  homeActionChip.className = "home-action-chip " + a.color;
  const card = document.getElementById("homeActionCard");
  if(card){
    card.onclick = ()=>{ try{ eval(a.action); }catch(e){ activatePage("intelligence"); } };
    card.style.borderTopColor = a.color === "red" ? "var(--premium-red,#FF5C70)" : a.color === "green" ? "var(--premium-green,#28D98A)" : "var(--premium-amber,#F0B94B)";
  }
}

// ===== V27 COUNTDOWN SETTINGS MODULE =====
const defaultCountdownSettings = {
  date: (state && state.project && state.project.openingDate) ? state.project.openingDate : "2026-09-27",
  time: "00:00",
  label: "حتى موعد الافتتاح الرسمي"
};
let countdownSettings = JSON.parse(localStorage.getItem("kagV27CountdownSettings") || "null") || structuredClone(defaultCountdownSettings);

function saveCountdownSettings(){
  localStorage.setItem("kagV27CountdownSettings", JSON.stringify(countdownSettings));
  if(state && state.project) {
    state.project.openingDate = countdownSettings.date;
    save();
  }
}
function v27OpeningTarget(){
  const date = countdownSettings.date || defaultCountdownSettings.date;
  const time = countdownSettings.time || "00:00";
  return new Date(`${date}T${time}:00`);
}
function v27GetCountdownParts(){
  const target = v27OpeningTarget();
  const now = new Date();
  let diff = target.getTime() - now.getTime();
  if(diff < 0) diff = 0;

  const totalSeconds = Math.floor(diff / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const totalDays = Math.floor(diff / (1000*60*60*24));

  const months = Math.floor(totalDays / 30);
  const afterMonths = totalDays % 30;
  const weeks = Math.floor(afterMonths / 7);
  const days = afterMonths % 7;
  const minutes = totalMinutes % 60;

  return {months, weeks, days, minutes, seconds, target};
}
function setCountdownText(prefix, parts){
  const map = {
    Months: parts.months,
    Weeks: parts.weeks,
    Days: parts.days,
    Minutes: String(parts.minutes).padStart(2,"0"),
    Seconds: String(parts.seconds).padStart(2,"0")
  };
  Object.entries(map).forEach(([key,val])=>{
    const el = document.getElementById(prefix + key);
    if(el) el.textContent = val;
  });
}
function v27UpdateAllCountdowns(){
  const parts = v27GetCountdownParts();

  setCountdownText("count", parts);
  setCountdownText("headerCount", parts);
  setCountdownText("settingsCount", parts);

  const label = countdownSettings.label || defaultCountdownSettings.label;
  const targetText = document.getElementById("countdownTargetText");
  if(targetText) targetText.textContent = `${label}: ${parts.target.toLocaleDateString("ar-SA")} ${String(parts.target.getHours()).padStart(2,"0")}:${String(parts.target.getMinutes()).padStart(2,"0")}`;

  const headerLabel = document.querySelector(".header-countdown-label");
  if(headerLabel) headerLabel.textContent = label;

  const hint = document.getElementById("countdownSettingsHint");
  if(hint) hint.textContent = `التاريخ الحالي للعداد: ${parts.target.toLocaleDateString("ar-SA")} — ${String(parts.target.getHours()).padStart(2,"0")}:${String(parts.target.getMinutes()).padStart(2,"0")}`;
}
function fillCountdownSettingsForm(){
  if(typeof openingDateSetting === "undefined") return;
  openingDateSetting.value = countdownSettings.date || defaultCountdownSettings.date;
  openingTimeSetting.value = countdownSettings.time || "00:00";
  countdownLabelSetting.value = countdownSettings.label || defaultCountdownSettings.label;
}
function bindCountdownSettings(){
  fillCountdownSettingsForm();

  if(typeof countdownSettingsForm !== "undefined"){
    countdownSettingsForm.onsubmit = e=>{
      e.preventDefault();
      countdownSettings.date = openingDateSetting.value || defaultCountdownSettings.date;
      countdownSettings.time = openingTimeSetting.value || "00:00";
      countdownSettings.label = countdownLabelSetting.value || defaultCountdownSettings.label;
      saveCountdownSettings();
      fillCountdownSettingsForm();
      v27UpdateAllCountdowns();
      renderAll();
      addFeed(["إعدادات العداد","تم تحديث تاريخ ووقت الافتتاح","green"]);
    };
  }

  if(typeof resetCountdownSettings !== "undefined"){
    resetCountdownSettings.onclick = ()=>{
      localStorage.removeItem("kagV27CountdownSettings");
      countdownSettings = structuredClone(defaultCountdownSettings);
      saveCountdownSettings();
      fillCountdownSettingsForm();
      v27UpdateAllCountdowns();
      renderAll();
      addFeed(["إعدادات العداد","تمت إعادة ضبط العداد","amber"]);
    };
  }
}

// override all previous countdown target/update functions safely
window.v27UpdateAllCountdowns = v27UpdateAllCountdowns;
window.v26UpdateLuxuryCountdown = v27UpdateAllCountdowns;
window.v22UpdateLiveCountdown = v27UpdateAllCountdowns;
v22OpeningDate = function(){ return v27OpeningTarget(); };


// ===== V40 TIMELINE MODULE =====
let activeTimelineFilter = "all";
let activeTimelineTrack = "all";

function tlDateOnly(d){
  const x = new Date(d);
  x.setHours(0,0,0,0);
  return x;
}
function tlToday(){
  const x = new Date();
  x.setHours(0,0,0,0);
  return x;
}
function tlDaysDiff(dateStr){
  if(!dateStr) return null;
  const d = tlDateOnly(dateStr);
  if(isNaN(d)) return null;
  return Math.round((d - tlToday()) / (1000*60*60*24));
}
function tlTrackInfo(id){
  return (state.tracks || []).find(t => t.id === id) || {name:id, accent:"#A98BFF"};
}
function timelineItems(){
  return (state.items || []).filter(i => i.due).map(i => {
    const diff = tlDaysDiff(i.due);
    const t = tlTrackInfo(i.track);
    return {...i, diff, trackName:t.name, color:t.accent || "#A98BFF"};
  }).sort((a,b) => (a.diff ?? 9999) - (b.diff ?? 9999));
}
function filterTimeline(items){
  return items.filter(i => {
    if(activeTimelineTrack !== "all" && i.track !== activeTimelineTrack) return false;

    if(activeTimelineFilter === "all") return true;
    if(activeTimelineFilter === "overdue") return i.diff !== null && i.diff < 0;
    if(activeTimelineFilter === "today") return i.diff === 0;
    if(activeTimelineFilter === "week") return i.diff !== null && i.diff >= 0 && i.diff <= 7;
    if(activeTimelineFilter === "month") return i.diff !== null && i.diff >= 0 && i.diff <= 30;
    if(activeTimelineFilter === "risks") return i.type === "risks";
    if(activeTimelineFilter === "permits") return i.type === "permits";
    if(activeTimelineFilter === "milestones") return i.type === "milestones";
    return true;
  });
}
function tlDueText(diff){
  if(diff === null) return "بدون تاريخ";
  if(diff < 0) return `متأخر ${Math.abs(diff)} يوم`;
  if(diff === 0) return "مستحق اليوم";
  return `متبقي ${diff} يوم`;
}
function tlStatusClass(item){
  if(item.diff !== null && item.diff < 0 && !["مكتملة","معتمدة","Cleared","Completed"].includes(item.status)) return "red";
  return colorByStatus(item.status);
}
function currentTimelineTitle(){
  if(activeTimelineTrack === "all") return "الجدول الزمني الموحد";
  const t = tlTrackInfo(activeTimelineTrack);
  return `الجدول الزمني لمسار ${activeTimelineTrack} · ${t.name}`;
}
function renderTimeline(){
  if(typeof timelineKpis === "undefined") return;
  const all = timelineItems().filter(i => activeTimelineTrack === "all" || i.track === activeTimelineTrack);
  const overdue = all.filter(i => i.diff !== null && i.diff < 0 && !["مكتملة","معتمدة","Cleared","Completed"].includes(i.status));
  const today = all.filter(i => i.diff === 0);
  const week = all.filter(i => i.diff !== null && i.diff >= 0 && i.diff <= 7);
  const milestones = all.filter(i => i.type === "milestones" && i.diff !== null && i.diff >= 0);
  const pressure = Math.min(100, overdue.length*18 + week.length*7 + today.length*10);

  if(typeof timelineTitle !== "undefined") timelineTitle.textContent = currentTimelineTitle();

  timelineKpis.innerHTML = [
    [all.length,"إجمالي العناصر"],
    [overdue.length,"متأخر"],
    [today.length,"مستحق اليوم"],
    [week.length,"خلال 7 أيام"],
    [milestones.length,"معالم قادمة"]
  ].map(k=>`<article class="timeline-kpi glass"><h3>${k[0]}</h3><p>${k[1]}</p></article>`).join("");

  const shown = filterTimeline(timelineItems());
  timelineList.innerHTML = shown.length ? shown.map(i => `
    <div class="timeline-item" style="--tl-color:${i.color}" onclick="showDetails('${i.type}','${i.track}')">
      <div class="timeline-date">${i.due}<br><small>${tlDueText(i.diff)}</small></div>
      <div>
        <h4>${i.title}</h4>
        <p>${i.track} · ${i.trackName} · ${i.owner || "-"}</p>
      </div>
      <span class="timeline-status ${tlStatusClass(i)}">${i.status || "-"}</span>
    </div>
  `).join("") : `<div class="hint">لا توجد عناصر مطابقة لهذا الفلتر.</div>`;

  const pressureLabel = pressure >= 70 ? "ضغط زمني عالي" : pressure >= 40 ? "ضغط زمني متوسط" : "ضغط زمني منخفض";
  timePressureBox.innerHTML = `<div class="pressure-score">${pressure}</div><div class="pressure-label">${pressureLabel}</div><div class="hint">يُحسب من العناصر المتأخرة والمستحقة اليوم وخلال 7 أيام.</div>`;

  const up = milestones.slice(0,5);
  upcomingMilestonesBox.innerHTML = up.length ? up.map(i => `
    <div class="milestone-mini" onclick="showDetails('milestones','${i.track}')">
      <h4>${i.title}</h4>
      <p>${i.trackName} · ${i.due} · ${tlDueText(i.diff)}</p>
    </div>
  `).join("") : `<div class="hint">لا توجد معالم قادمة.</div>`;
}
function bindTimeline(){
  document.querySelectorAll(".timeline-filter").forEach(btn=>{
    btn.onclick = ()=>{
      document.querySelectorAll(".timeline-filter").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      activeTimelineFilter = btn.dataset.filter || "all";
      renderTimeline();
    };
  });

  document.querySelectorAll(".timeline-track-tab").forEach(btn=>{
    btn.onclick = ()=>{
      document.querySelectorAll(".timeline-track-tab").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      activeTimelineTrack = btn.dataset.trackFilter || "all";
      renderTimeline();
    };
  });

  if(typeof refreshTimeline !== "undefined"){
    refreshTimeline.onclick = ()=>{
      renderTimeline();
      addFeed(["الجدول الزمني","تم تحديث الجدول الزمني","green"]);
    };
  }
}

// ===== ADMIN LOCK MODULE =====
// ملاحظة أمنية: لم تعد كلمة المرور مخزّنة في الواجهة إطلاقًا.
// يتم التحقق من بيانات الأدمن عبر الخادم فقط (/api/login).
let pendingProtectedPage = null;

function isAdminUnlocked(){
  return sessionStorage.getItem("kagAdminUnlocked") === "true";
}
function setAdminUnlocked(value){
  if(value) sessionStorage.setItem("kagAdminUnlocked", "true");
  else sessionStorage.removeItem("kagAdminUnlocked");
  document.body.classList.toggle("admin-unlocked", isAdminUnlocked());
}
function activatePage(pageId, btn){
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  const page = document.getElementById(pageId);
  if(page) page.classList.add("active");
  const targetBtn = btn || document.querySelector(`.nav-btn[data-page="${pageId}"]`);
  if(targetBtn) targetBtn.classList.add("active");
}
function requestAdminAccess(pageId){
  pendingProtectedPage = pageId;
  const modal = document.getElementById("adminLockModal");
  const err = document.getElementById("loginError");
  if(err) err.textContent = "";
  if(modal) modal.classList.add("active");
  setTimeout(()=>document.getElementById("adminUsername")?.focus(), 80);
}
function bindAdminLock(){
  setAdminUnlocked(isAdminUnlocked());
  // إذا كانت جلسة الخادم بدور admin، افتح الأقسام المحمية مباشرة
  try{
    if(location.protocol.indexOf("http")===0){
      fetch("/api/admin-check",{credentials:"include"}).then(function(r){return r.json();})
        .then(function(d){ if(d&&d.isAdmin) setAdminUnlocked(true); }).catch(function(){});
    }
  }catch(e){}

  const bar = document.createElement("div");
  bar.className = "admin-session-bar";
  bar.innerHTML = 'وضع الأدمن مفعل <button id="adminLogoutBtn">خروج</button>';
  document.body.appendChild(bar);

  document.getElementById("adminLogoutBtn").onclick = ()=>{
    try{
      if(location.protocol.startsWith("http")){
        fetch("/api/logout", {method:"POST", credentials:"include"}).catch(()=>{});
      }
    }catch(e){}
    setAdminUnlocked(false);
    activatePage("overview");
    addFeed(["حماية الأدمن","تم تسجيل خروج الأدمن","amber"]);
  };

  if(typeof adminLoginForm !== "undefined"){
    adminLoginForm.onsubmit = e=>{
      e.preventDefault();
      const u = adminUsername.value.trim();
      const p = adminPassword.value;
      loginError.textContent = "جارٍ التحقق...";
      // التحقق من الخادم فقط — لا توجد كلمة مرور في الواجهة.
      if(!location.protocol.startsWith("http")){
        loginError.textContent = "يجب تشغيل الموقع عبر الخادم (server.js) لتفعيل تسجيل الدخول.";
        return;
      }
      fetch("/api/admin-login", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        credentials:"include",
        body:JSON.stringify({username:u,password:p})
      }).then(r=>r.json()).then(data=>{
        if(data && data.ok){
          setAdminUnlocked(true);
          adminLockModal.classList.remove("active");
          adminUsername.value = "";
          adminPassword.value = "";
          loginError.textContent = "";
          if(typeof backendSyncNow==="function") backendSyncNow();
          addFeed(["حماية الأدمن","تم تسجيل دخول الأدمن بنجاح","green"]);
          activatePage(pendingProtectedPage || "broadcast-settings");
          pendingProtectedPage = null;
        }else{
          loginError.textContent = "اسم المستخدم أو كلمة المرور غير صحيحة.";
        }
      }).catch(()=>{ loginError.textContent = "تعذّر الاتصال بالخادم."; });
    };
  }

  if(typeof cancelAdminLogin !== "undefined"){
    cancelAdminLogin.onclick = ()=>{
      adminLockModal.classList.remove("active");
      pendingProtectedPage = null;
    };
  }
}

// ===== LIVE BROADCAST MODULE =====
const defaultBroadcastSettings = {
  title: "العربية — البث المباشر",
  url: "https://live.alarabiya.net/alarabiapublish/alarabiya.smil/playlist.m3u8",
  mode: "normal"
};
let broadcastSettings = JSON.parse(localStorage.getItem("kagV13BroadcastSettings") || "null") || structuredClone(defaultBroadcastSettings);

function saveBroadcastSettings(){
  localStorage.setItem("kagV13BroadcastSettings", JSON.stringify(broadcastSettings));
}
function toEmbedUrl(url){
  if(!url) return "";
  let u = String(url).trim();

  // YouTube watch links
  const ytWatch = u.match(/[?&]v=([^&]+)/);
  if(u.includes("youtube.com/watch") && ytWatch) return "https://www.youtube.com/embed/" + ytWatch[1] + "?autoplay=1&mute=1&rel=0";

  // YouTube short links
  const ytShort = u.match(/youtu\.be\/([^?&]+)/);
  if(ytShort) return "https://www.youtube.com/embed/" + ytShort[1] + "?autoplay=1&mute=1&rel=0";

  // YouTube live
  if(u.includes("youtube.com/live/")){
    const id = u.split("youtube.com/live/")[1].split(/[?&]/)[0];
    return "https://www.youtube.com/embed/" + id + "?autoplay=1&mute=1&rel=0";
  }

  // Vimeo
  const vimeo = u.match(/vimeo\.com\/(\d+)/);
  if(vimeo && !u.includes("player.vimeo.com")) return "https://player.vimeo.com/video/" + vimeo[1] + "?autoplay=1&muted=1";

  return u;
}
function ensureMiniBroadcast(){
  if(document.getElementById("broadcastMini")) return;
  const mini = document.createElement("div");
  mini.id = "broadcastMini";
  mini.className = "broadcast-mini";
  mini.innerHTML = '<iframe id="broadcastMiniFrame" title="البث الحي المصغر" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>';
  document.body.appendChild(mini);
}
// نوع الرابط: بث مباشر (HLS/فيديو) أم إطار (يوتيوب/Vimeo/صفحة)
function streamKind(url){
  const u = String(url||"").trim().toLowerCase();
  if(!u) return "empty";
  if(/\.m3u8(\?|#|$)/.test(u) || /\.mp4(\?|#|$)/.test(u) || /\.webm(\?|#|$)/.test(u)) return "media";
  return "iframe";
}
// تحميل مكتبة hls.js عند الحاجة (للمتصفحات غير Safari)
function loadHlsJs(cb){
  if(window.Hls){ cb(); return; }
  let s = document.getElementById("hlsjsLib");
  if(s){ s.addEventListener("load", cb); s.addEventListener("error", cb); return; }
  s = document.createElement("script");
  s.id = "hlsjsLib";
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.17/hls.min.js";
  s.onload = cb; s.onerror = cb;
  document.head.appendChild(s);
}
// تشغيل رابط HLS داخل عنصر <video>
function playMedia(video, url){
  if(!video) return;
  try{ if(video._hls){ video._hls.destroy(); video._hls=null; } }catch(e){}
  // Safari يدعم HLS أصلًا
  if(video.canPlayType("application/vnd.apple.mpegurl")){
    video.src = url;
    video.play && video.play().catch(function(){});
    return;
  }
  // باقي المتصفحات: عبر hls.js
  loadHlsJs(function(){
    try{
      if(window.Hls && window.Hls.isSupported()){
        const hls = new window.Hls({ lowLatencyMode:true });
        hls.loadSource(url); hls.attachMedia(video); video._hls = hls;
        video.play && video.play().catch(function(){});
      } else {
        video.src = url; // محاولة أخيرة
      }
    }catch(e){ video.src = url; }
  });
}
function stopMedia(video){
  if(!video) return;
  try{ if(video._hls){ video._hls.destroy(); video._hls=null; } }catch(e){}
  try{ video.pause(); }catch(e){}
  video.removeAttribute("src"); try{ video.load(); }catch(e){}
}
// إنشاء عنصر الفيديو بجانب الإطار (مرة واحدة)
function ensureBroadcastVideo(){
  let v = document.getElementById("broadcastVideo");
  if(v) return v;
  const frame = document.getElementById("broadcastFrame");
  if(!frame) return null;
  v = document.createElement("video");
  v.id = "broadcastVideo";
  v.controls = true; v.autoplay = true; v.muted = true;
  v.setAttribute("playsinline",""); v.setAttribute("webkit-playsinline","");
  v.style.cssText = "width:100%;height:100%;display:none;background:#000;border:0;border-radius:inherit";
  frame.parentNode.insertBefore(v, frame.nextSibling);
  return v;
}
function applyBroadcast(){
  ensureMiniBroadcast();
  const url = (broadcastSettings.url||"").trim();
  const kind = streamKind(url);
  const embed = kind === "iframe" ? toEmbedUrl(url) : "";
  const frame = document.getElementById("broadcastFrame");
  const video = ensureBroadcastVideo();
  const miniFrame = document.getElementById("broadcastMiniFrame");
  const empty = document.getElementById("broadcastEmpty");
  const status = document.getElementById("broadcastStatusCard");
  const displayTitle = document.getElementById("broadcastDisplayTitle");
  const bg = broadcastSettings.mode === "background";
  if(displayTitle) displayTitle.textContent = broadcastSettings.title || "البث الحي";

  if(typeof broadcastTitleInput !== "undefined"){
    broadcastTitleInput.value = broadcastSettings.title || "";
    broadcastUrlInput.value = broadcastSettings.url || "";
    broadcastModeInput.value = broadcastSettings.mode || "normal";
  }

  // لا يوجد رابط
  if(kind === "empty"){
    if(frame){ frame.style.display="none"; frame.src=""; }
    stopMedia(video); if(video) video.style.display="none";
    if(miniFrame){ miniFrame.src=""; }
    if(empty) empty.style.display = "grid";
    document.body.classList.remove("broadcast-background");
    if(status) status.innerHTML = "<b>الحالة:</b> لا يوجد رابط بث مضاف بعد.";
    return;
  }

  document.body.classList.toggle("broadcast-background", bg);
  if(empty) empty.style.display = bg ? "grid" : "none";

  if(kind === "media"){
    // بث مباشر (HLS) عبر مشغّل الفيديو
    if(frame){ frame.style.display="none"; frame.src=""; }
    if(miniFrame){ miniFrame.src=""; }
    if(video){
      video.style.display = bg ? "none" : "block";
      playMedia(video, url);
    }
  } else {
    // يوتيوب / Vimeo / صفحة عبر الإطار
    stopMedia(video); if(video) video.style.display="none";
    if(frame){
      frame.src = embed;
      frame.style.display = bg ? "none" : "block";
    }
    if(miniFrame) miniFrame.src = embed;
  }

  if(status){
    status.innerHTML = `
      <b>العنوان:</b> ${escH(broadcastSettings.title || "البث الحي")}<br>
      <b>النوع:</b> ${kind === "media" ? "بث مباشر (HLS)" : "إطار (YouTube/Vimeo)"}<br>
      <b>الوضع:</b> ${bg ? "تشغيل في الخلفية" : "تشغيل داخل الصفحة"}<br>
      <b>الرابط:</b> <span style="direction:ltr;display:inline-block;max-width:100%;overflow-wrap:anywhere">${escH(broadcastSettings.url)}</span><br>
      <a href="${escH(url)}" target="_blank" rel="noopener" style="color:#C9A84C">↗ فتح البث في نافذة مستقلة</a>
    `;
  }
}
function bindBroadcast(){
  if(typeof broadcastForm === "undefined") return;
  broadcastForm.onsubmit = e=>{
    e.preventDefault();
    broadcastSettings.title = broadcastTitleInput.value || "البث الحي";
    broadcastSettings.url = broadcastUrlInput.value || "";
    broadcastSettings.mode = broadcastModeInput.value || "normal";
    saveBroadcastSettings();
    applyBroadcast();
    addFeed(["البث الحي",`تم تحديث رابط البث: ${broadcastSettings.title}`,"cyan"]);
  };

  if(typeof openBroadcastExternal !== "undefined"){
    openBroadcastExternal.onclick = ()=>{
      if(broadcastSettings.url) window.open(broadcastSettings.url, "_blank");
      else alert("لم يتم إدخال رابط بث بعد.");
    };
  }

  if(typeof testBroadcastBtn !== "undefined"){
    testBroadcastBtn.onclick = ()=>{
      if(broadcastSettings.url) window.open(broadcastSettings.url, "_blank");
      else alert("لم يتم إدخال رابط بث بعد.");
    };
  }

  if(typeof clearBroadcastBtn !== "undefined"){
    clearBroadcastBtn.onclick = ()=>{
      broadcastSettings = structuredClone(defaultBroadcastSettings);
      saveBroadcastSettings();
      applyBroadcast();
      addFeed(["البث الحي","تم مسح إعدادات البث","amber"]);
    };
  }
}

// ===== SMART OPERATIONS MODULE =====
function ensureOpsArrays(){
  state.dailyLogs = state.dailyLogs || [];
  state.decisions = state.decisions || [];
  state.snapshots = state.snapshots || [];
}
function renderDailyLogs(){
  ensureOpsArrays();
  if(typeof dailyLogList === "undefined") return;
  dailyLogList.innerHTML = state.dailyLogs.length ? state.dailyLogs.map(l=>`
    <div class="log-card">
      <h4>${l.trackName} · ${l.date}</h4>
      <p><b>المنجز:</b> ${l.done || "-"}</p>
      <p><b>المتأخر:</b> ${l.delayed || "-"}</p>
      <p><b>المخاطر:</b> ${l.risks || "-"}</p>
      <p><b>القرار المطلوب:</b> ${l.decision || "-"}</p>
    </div>
  `).join("") : `<div class="hint">لا توجد تحديثات يومية بعد.</div>`;
}
function renderDecisions(){
  ensureOpsArrays();
  if(typeof decisionList === "undefined") return;
  const card = d=>`
    <div class="decision-card">
      <h4>${d.title}</h4>
      <p><b>المسار:</b> ${d.trackName}</p>
      <p><b>الأثر:</b> ${d.impact || "-"}</p>
      <p><b>المسؤول:</b> ${d.owner || "-"}</p>
      <p><b>مطلوب قبل:</b> ${d.due || "-"}</p>
      <p><b>الحالة:</b> <span class="${colorByStatus(d.status)}">${d.status}</span></p>
    </div>`;
  decisionList.innerHTML = state.decisions.length ? state.decisions.map(card).join("") : `<div class="hint">لا توجد قرارات مطلوبة بعد.</div>`;
}
function renderExecutiveMode(){
  ensureOpsArrays();
  if(typeof execScore === "undefined") return;
  const k = kpis();
  execScore.textContent = k.overall + "%";
  const highRisks = state.items.filter(i=>i.type==="risks").slice(0,5);
  const openDecisions = state.decisions.filter(d=>d.status!=="معتمد").slice(0,5);

  let statusTitle = "الحالة العامة مطمئنة";
  let statusText = "المؤشرات العامة ضمن نطاق المتابعة الطبيعي.";
  if(k.risk >= 8 || k.overall < 45){ statusTitle = "الحالة تحتاج تدخل"; statusText = "يوجد مستوى مخاطر أو انخفاض إنجاز يتطلب تدخلًا إداريًا."; }
  else if(k.risk >= 4 || k.overall < 65){ statusTitle = "الحالة تحت المتابعة"; statusText = "المشروع مستقر نسبيًا مع وجود عناصر تحتاج متابعة يومية."; }
  execStatusTitle.textContent = statusTitle;
  execStatusText.textContent = statusText;

  execTracks.innerHTML = state.tracks.map(t=>`
    <div class="exec-row"><span>${t.id} · ${t.name}</span><strong class="${colorByStatus(t.status)}">${t.progress}% · ${t.status}</strong></div>
  `).join("");

  execRisks.innerHTML = highRisks.length ? highRisks.map(r=>`
    <div class="exec-row"><span>${r.title}</span><strong class="${colorByStatus(r.status)}">${r.status}</strong></div>
  `).join("") : `<div class="hint">لا توجد مخاطر مفتوحة.</div>`;

  execDecisions.innerHTML = openDecisions.length ? openDecisions.map(d=>`
    <div class="exec-row"><span>${d.title}</span><strong class="${colorByStatus(d.status)}">${d.status}</strong></div>
  `).join("") : `<div class="hint">لا توجد قرارات مفتوحة.</div>`;
}
function generateDailyReport(){
  ensureOpsArrays();
  const k = kpis();
  const today = new Date().toLocaleDateString("ar-SA");
  const risks = state.items.filter(i=>i.type==="risks").slice(0,6);
  const decisions = state.decisions.filter(d=>d.status!=="معتمد").slice(0,6);
  const latestLogs = state.dailyLogs.slice(0,4);

  return `التقرير اليومي لمشروع حدائق الملك عبدالله
التاريخ: ${today}

أولًا: الملخص التنفيذي
- نسبة الإنجاز العامة: ${k.overall}%
- إجمالي المهام: ${k.total}
- المهام المنجزة: ${k.done}
- المهام النشطة: ${k.active}
- المخاطر المفتوحة: ${k.risk}
- المتبقي على الافتتاح: ${k.days} يوم

ثانيًا: حالة المسارات
${state.tracks.map(t=>`- ${t.id} · ${t.name}: ${t.progress}% — ${t.status} — المسؤول: ${t.lead}`).join("\n")}

ثالثًا: أبرز التحديثات اليومية
${latestLogs.length ? latestLogs.map(l=>`- ${l.trackName}: المنجز (${l.done || "-"})، المتأخر (${l.delayed || "-"})، القرار المطلوب (${l.decision || "-"})`).join("\n") : "- لا توجد تحديثات يومية مسجلة حتى الآن."}

رابعًا: أهم المخاطر
${risks.length ? risks.map(r=>`- ${r.title} — المسار ${r.track} — الحالة: ${r.status}`).join("\n") : "- لا توجد مخاطر مسجلة."}

خامسًا: القرارات المطلوبة
${decisions.length ? decisions.map(d=>`- ${d.title} — ${d.trackName} — المسؤول: ${d.owner || "-"} — مطلوب قبل: ${d.due || "-"}`).join("\n") : "- لا توجد قرارات مفتوحة."}

سادسًا: التوصية العامة
الاستمرار في تحديث مؤشرات المسارات يوميًا، وتصعيد أي قرار مؤثر قبل تحوله إلى تأخير تشغيلي.`;
}
function renderReport(){
  if(typeof dailyReportText === "undefined") return;
  dailyReportText.value = generateDailyReport();
}
function renderSnapshots(){
  ensureOpsArrays();
  if(typeof snapshotList === "undefined") return;
  snapshotList.innerHTML = state.snapshots.length ? state.snapshots.map(s=>`
    <div class="snapshot-card">
      <h4>${s.date}</h4>
      <p>الإنجاز العام: ${s.overall}% · المهام: ${s.total} · المنجز: ${s.done} · المخاطر: ${s.risk}</p>
    </div>
  `).join("") : `<div class="hint">لا توجد لقطات محفوظة بعد.</div>`;
}
function renderOps(){
  ensureOpsArrays();
  renderDailyLogs();
  renderDecisions();
  renderExecutiveMode();
  renderReport();
  renderSnapshots();
}
function bindOps(){
  ensureOpsArrays();

  if(typeof dailyUpdateForm !== "undefined"){
    dailyUpdateForm.onsubmit = e=>{
      e.preventDefault();
      const track = state.tracks.find(t=>t.id===dailyTrack.value);
      const log = {
        date: new Date().toLocaleDateString("ar-SA"),
        track: dailyTrack.value,
        trackName: track?.name || dailyTrack.value,
        done: dailyDone.value,
        delayed: dailyDelayed.value,
        risks: dailyRisks.value,
        decision: dailyDecision.value,
        severity: dailySeverity.value
      };
      state.dailyLogs.unshift(log);
      if(log.risks) state.items.push({track:log.track,type:"risks",title:log.risks,owner:"تحديث يومي",status: dailySeverity.value==="red" ? "معرضة للخطر" : "تحت المتابعة", due:""});
      if(log.decision) state.decisions.unshift({track:log.track,trackName:log.trackName,title:log.decision,impact:log.delayed || log.risks || "-",owner:"الأمانة / PMC",due:"",status:"مفتوح"});
      addFeed(["تحديث يومي",`تم تسجيل تحديث يومي لمسار ${log.trackName}`,log.severity]);
      dailyUpdateForm.reset();
      save(); renderAll();
    };
  }

  if(typeof decisionForm !== "undefined"){
    decisionForm.onsubmit = e=>{
      e.preventDefault();
      const track = state.tracks.find(t=>t.id===decisionTrack.value);
      state.decisions.unshift({
        track: decisionTrack.value,
        trackName: track?.name || decisionTrack.value,
        title: decisionTitle.value,
        impact: decisionImpact.value,
        owner: decisionOwner.value,
        due: decisionDue.value,
        status: decisionStatus.value
      });
      addFeed(["قرار مطلوب",`تمت إضافة قرار مطلوب: ${decisionTitle.value}`,colorByStatus(decisionStatus.value)]);
      decisionForm.reset();
      save(); renderAll();
    };
  }

  if(typeof refreshReport !== "undefined") refreshReport.onclick = renderReport;
  if(typeof copyReport !== "undefined") copyReport.onclick = async ()=>{
    renderReport();
    await navigator.clipboard.writeText(dailyReportText.value);
    addFeed(["التقرير اليومي","تم نسخ التقرير اليومي","green"]);
  };
  if(typeof saveSnapshot !== "undefined") saveSnapshot.onclick = ()=>{
    const k = kpis();
    state.snapshots.unshift({date:new Date().toLocaleString("ar-SA"),...k});
    save(); renderAll(); addFeed(["Snapshot","تم حفظ نسخة من حالة اليوم","green"]);
  };
}

// ===== UI SETTINGS MODULE =====
const defaultUiSettings = {
  title: "حدائق الملك عبدالله",
  subtitle: "صفحة عامة تنفيذية + لوحة مستقلة للمسارات الأربعة المعتمدة + استيراد جماعي من Excel/CSV",
  systemName: "مركز القيادة المباشر",
  logoText: "KA",
  theme: { cyan:"#A98BFF", sand:"#D9CCFF", bg:"#0B1020" },
  visibility: { feed:true, risks:true, sparks:true, english:true },
  logos: { amanah:"assets/riyadh-amanah-official.png", mayadeen:"assets/mayadeen-official.png" }
};
let uiSettings = JSON.parse(localStorage.getItem("kagV8UiSettings") || "null") || structuredClone(defaultUiSettings);

function saveUiSettings(){
  localStorage.setItem("kagV8UiSettings", JSON.stringify(uiSettings));
}
function applyUiSettings(){
  const root = document.documentElement;
  root.style.setProperty("--cyan", uiSettings.theme.cyan || defaultUiSettings.theme.cyan);
  root.style.setProperty("--sand", uiSettings.theme.sand || defaultUiSettings.theme.sand);
  root.style.setProperty("--bg", uiSettings.theme.bg || defaultUiSettings.theme.bg);

  const titleEl = document.getElementById("mainTitleText");
  const subtitleEl = document.getElementById("mainSubtitleText");
  const systemEl = document.getElementById("systemNameText");
  const logoEl = document.getElementById("logoText");
  if(titleEl) titleEl.textContent = uiSettings.title || defaultUiSettings.title;
  if(subtitleEl && subtitleEl.tagName && subtitleEl.tagName.toLowerCase() === "p") subtitleEl.textContent = uiSettings.subtitle || defaultUiSettings.subtitle;
  if(systemEl) systemEl.textContent = uiSettings.systemName || defaultUiSettings.systemName;
  if(logoEl) logoEl.textContent = uiSettings.logoText || defaultUiSettings.logoText;

  const amanahLogo = document.getElementById("amanahLogoImg");
  const mayadeenLogo = document.getElementById("mayadeenLogoImg");
  if(amanahLogo) amanahLogo.src = (uiSettings.logos && uiSettings.logos.amanah) || defaultUiSettings.logos.amanah;
  if(mayadeenLogo) mayadeenLogo.src = (uiSettings.logos && uiSettings.logos.mayadeen) || defaultUiSettings.logos.mayadeen;

  document.body.classList.toggle("hide-feed", !uiSettings.visibility.feed);
  document.body.classList.toggle("hide-risks", !uiSettings.visibility.risks);
  document.body.classList.toggle("hide-sparks", !uiSettings.visibility.sparks);
  document.body.classList.toggle("hide-english", !uiSettings.visibility.english);

  state.tracks.forEach(t=>{
    if(t.id==="أ") t.accent = uiSettings.trackA || t.accent;
    if(t.id==="ب") t.accent = uiSettings.trackB || t.accent;
    if(t.id==="ج") t.accent = uiSettings.trackC || t.accent;
    if(t.id==="د") t.accent = uiSettings.trackD || t.accent;
  });
}
function fillUiForms(){
  if(!document.getElementById("uiTitle")) return;
  uiTitle.value = uiSettings.title || defaultUiSettings.title;
  uiSubtitle.value = uiSettings.subtitle || defaultUiSettings.subtitle;
  uiSystemName.value = uiSettings.systemName || defaultUiSettings.systemName;
  uiLogoText.value = uiSettings.logoText || defaultUiSettings.logoText;

  colorA.value = uiSettings.trackA || (state.tracks.find(t=>t.id==="أ")?.accent || "#7E6BFF");
  colorB.value = uiSettings.trackB || (state.tracks.find(t=>t.id==="ب")?.accent || "#A98BFF");
  colorC.value = uiSettings.trackC || (state.tracks.find(t=>t.id==="ج")?.accent || "#D9B86C");
  colorD.value = uiSettings.trackD || (state.tracks.find(t=>t.id==="د")?.accent || "#6454C8");

  themeCyan.value = uiSettings.theme.cyan || defaultUiSettings.theme.cyan;
  themeSand.value = uiSettings.theme.sand || defaultUiSettings.theme.sand;
  themeBg.value = uiSettings.theme.bg || defaultUiSettings.theme.bg;

  showFeed.checked = !!uiSettings.visibility.feed;
  showRiskSnapshot.checked = !!uiSettings.visibility.risks;
  showSparks.checked = !!uiSettings.visibility.sparks;
  showEnglish.checked = !!uiSettings.visibility.english;
}
function bindUiSettings(){
  if(!document.getElementById("uiProjectForm")) return;

  uiProjectForm.onsubmit = e=>{
    e.preventDefault();
    uiSettings.title = uiTitle.value || defaultUiSettings.title;
    uiSettings.subtitle = uiSubtitle.value || defaultUiSettings.subtitle;
    uiSettings.systemName = uiSystemName.value || defaultUiSettings.systemName;
    uiSettings.logoText = uiLogoText.value || defaultUiSettings.logoText;
    saveUiSettings(); applyUiSettings(); addFeed(["إعدادات الواجهة","تم تحديث هوية المشروع","green"]);
  };

  uiTrackColorsForm.onsubmit = e=>{
    e.preventDefault();
    uiSettings.trackA = colorA.value;
    uiSettings.trackB = colorB.value;
    uiSettings.trackC = colorC.value;
    uiSettings.trackD = colorD.value;
    saveUiSettings(); applyUiSettings(); save(); renderAll(); fillUiForms();
    addFeed(["إعدادات الواجهة","تم تحديث ألوان المسارات","green"]);
  };

  uiThemeForm.onsubmit = e=>{
    e.preventDefault();
    uiSettings.theme = { cyan:themeCyan.value, sand:themeSand.value, bg:themeBg.value };
    saveUiSettings(); applyUiSettings(); addFeed(["إعدادات الواجهة","تم تحديث ألوان الواجهة العامة","green"]);
  };

  uiVisibilityForm.onsubmit = e=>{
    e.preventDefault();
    uiSettings.visibility = {
      feed: showFeed.checked,
      risks: showRiskSnapshot.checked,
      sparks: showSparks.checked,
      english: showEnglish.checked
    };
    saveUiSettings(); applyUiSettings(); addFeed(["إعدادات الواجهة","تم تحديث إعدادات الإظهار والإخفاء","green"]);
  };


  async function fileToDataUrl(input){
    return new Promise((resolve,reject)=>{
      const file = input.files && input.files[0];
      if(!file){ resolve(null); return; }
      const reader = new FileReader();
      reader.onload = ()=>resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  if(typeof uiLogoForm !== "undefined"){
    uiLogoForm.onsubmit = async e=>{
      e.preventDefault();
      uiSettings.logos = uiSettings.logos || {};
      const amanah = await fileToDataUrl(amanahLogoUpload);
      const mayadeen = await fileToDataUrl(mayadeenLogoUpload);
      if(amanah) uiSettings.logos.amanah = amanah;
      if(mayadeen) uiSettings.logos.mayadeen = mayadeen;
      saveUiSettings();
      applyUiSettings();
      addFeed(["هوية الجهات","تم تحديث شعارات أمانة الرياض وميادين","green"]);
    };
  }

  exportUiSettings.onclick = ()=>{
    const blob = new Blob([JSON.stringify(uiSettings,null,2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kag-ui-settings.json";
    a.click();
  };

  importUiSettings.onchange = e=>{
    const file = e.target.files[0]; if(!file) return;
    const r = new FileReader();
    r.onload = ()=>{
      try{
        uiSettings = JSON.parse(r.result);
        saveUiSettings(); applyUiSettings(); fillUiForms(); renderAll();
        addFeed(["إعدادات الواجهة","تم استيراد إعدادات الواجهة بنجاح","green"]);
      }catch(err){ alert("ملف إعدادات غير صالح"); }
    };
    r.readAsText(file);
  };

  resetUiSettings.onclick = ()=>{
    localStorage.removeItem("kagV8UiSettings");
    uiSettings = structuredClone(defaultUiSettings);
    saveUiSettings(); applyUiSettings(); fillUiForms(); renderAll();
    addFeed(["إعدادات الواجهة","تمت إعادة ضبط إعدادات الواجهة","amber"]);
  };
}

function tick(){var clock=document.getElementById("clock");if(clock){clock.textContent=new Date().toLocaleString("ar-SA");}}
bindMobileUX();bindMobileMenuV17();bindDetailView();v20BindIntelligence();bindTimeline();bindAdminLock();bindBroadcast();bindOps();bindUiSettings();applyUiSettings();renderAll();trackSelect.onchange();tick();setInterval(tick,1000);setInterval(v22UpdateLiveCountdown,1000);v22UpdateLiveCountdown();



// ===== V26 HARD FIX: Luxury Countdown Independent Runner =====
(function(){
  function getOpeningTarget(){
    try{
      const saved = JSON.parse(localStorage.getItem("kagV27CountdownSettings") || "null");
      if(saved && saved.date){
        return new Date(String(saved.date) + "T" + String(saved.time || "00:00") + ":00");
      }
      if(window.state && state.project && state.project.openingDate){
        return new Date(String(state.project.openingDate) + "T00:00:00");
      }
    }catch(e){}
    return new Date("2026-09-27T00:00:00");
  }

  function setText(id, value){
    var el = document.getElementById(id);
    if(el) el.textContent = value;
  }

  function updateLuxuryCountdown(){
    var secondsEl = document.getElementById("countSeconds");
    if(!secondsEl) return;

    var target = getOpeningTarget();
    var now = new Date();
    var diff = target.getTime() - now.getTime();
    if(diff < 0) diff = 0;

    var totalSeconds = Math.floor(diff / 1000);
    var totalMinutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;

    var totalDays = Math.floor(diff / (1000 * 60 * 60 * 24));
    var months = Math.floor(totalDays / 30);
    var daysAfterMonths = totalDays % 30;
    var weeks = Math.floor(daysAfterMonths / 7);
    var days = daysAfterMonths % 7;
    var minutes = totalMinutes % 60;

    ["count","headerCount","settingsCount"].forEach(function(prefix){
      setText(prefix + "Months", String(months));
      setText(prefix + "Weeks", String(weeks));
      setText(prefix + "Days", String(days));
      setText(prefix + "Minutes", String(minutes).padStart(2, "0"));
      setText(prefix + "Seconds", String(seconds).padStart(2, "0"));
    });

    var targetText = document.getElementById("countdownTargetText");
    if(targetText){
      targetText.textContent = "حتى موعد الافتتاح: " + target.toLocaleDateString("ar-SA");
    }
  }

  // expose for other existing functions if they call it
  window.v26UpdateLuxuryCountdown = updateLuxuryCountdown;
  window.v22UpdateLiveCountdown = updateLuxuryCountdown;

  function start(){
    updateLuxuryCountdown();
    if(window.__kagCountdownTimer) clearInterval(window.__kagCountdownTimer);
    window.__kagCountdownTimer = setInterval(updateLuxuryCountdown, 1000);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", start);
  }else{
    start();
  }
})();

setInterval(function(){ if(typeof v28RenderHomeAction==='function') v28RenderHomeAction(); }, 3000);


// ===== V38 RESTORE FULL HOME SAFETY =====
setTimeout(function(){
  try{
    const overview = document.getElementById("overview");
    const overviewBtn = document.querySelector('.nav-btn[data-page="overview"]');
    if(overview){
      document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
      overview.classList.add("active");
    }
    if(overviewBtn){
      document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
      overviewBtn.classList.add("active");
    }
    if(typeof renderAll === "function") renderAll();
  }catch(e){ console.error("V38 home restore error", e); }
}, 150);








// ===== V53 DATA SCOPE NOTE =====
// تنبيه تقني: localStorage محلي لكل متصفح.
// أي تعديل من الأدمن لن يظهر لجميع المستخدمين تلقائيًا إلا عند ربط الموقع بمصدر بيانات مشترك
// مثل Firebase / Supabase / Google Sheet API / Backend.
// هذه النسخة تصلح مشكلة تراكم المهام عبر الاستبدال الذكي، لكنها لا تجعل HTML static يتحول إلى قاعدة بيانات مشتركة.


// ===== V54 SHARED BACKEND SYNC MODULE =====
// This module keeps the dashboard state shared across users when served through server.js.
// If opened as file://, it automatically falls back to localStorage only.
(function(){
  const BACKEND_POLL_MS = 3000;
  let remoteVersion = Number(localStorage.getItem("kagRemoteVersion") || "0");
  let isApplyingRemote = false;
  let lastSaveAt = 0;

  function backendAvailable(){
    return location.protocol === "http:" || location.protocol === "https:";
  }

  function setSyncStatus(text, mode, updated){
    const strip = document.getElementById("backendSyncStrip");
    const s = document.getElementById("backendSyncStatus");
    const u = document.getElementById("backendSyncUpdated");
    if(strip){
      strip.classList.remove("online","local","error");
      if(mode) strip.classList.add(mode);
    }
    if(s) s.textContent = text;
    if(u) u.textContent = updated || "--";
  }

  function formatUpdated(ts){
    if(!ts) return "--";
    try{
      return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
        timeZone:"Asia/Riyadh",
        year:"numeric", month:"short", day:"numeric",
        hour:"2-digit", minute:"2-digit", second:"2-digit"
      }).format(new Date(ts));
    }catch(e){
      return new Date(ts).toLocaleString();
    }
  }

  async function fetchRemoteState(){
    if(!backendAvailable()){
      setSyncStatus("وضع الاتصال: محلي فقط", "local", "ملف HTML");
      return null;
    }
    const res = await fetch("/api/state", {cache:"no-store", credentials:"include"});
    if(!res.ok) throw new Error("GET /api/state " + res.status);
    return await res.json();
  }

  async function applyRemoteIfNewer(force=false){
    try{
      const data = await fetchRemoteState();
      if(!data || !data.state){
        setSyncStatus("وضع الاتصال: متصل — لا توجد بيانات مشتركة بعد", "online", "--");
        return false;
      }
      const v = Number(data.version || 0);
      if(force || v > remoteVersion){
        isApplyingRemote = true;
        state = data.state;
        remoteVersion = v;
        localStorage.setItem("kagRemoteVersion", String(remoteVersion));
        localStorage.setItem("kagV6BulkImport", JSON.stringify(state));
        if(typeof renderAll === "function") renderAll();
        isApplyingRemote = false;
      }
      setSyncStatus("وضع الاتصال: متصل ومزامن", "online", formatUpdated(data.updatedAt));
      return true;
    }catch(e){
      setSyncStatus("وضع الاتصال: غير متصل بالخادم", "error", "يعمل محليًا");
      return false;
    }
  }

  async function pushRemoteState(){
    if(!backendAvailable() || isApplyingRemote) return false;
    // throttle repeated saves
    const nowMs = Date.now();
    if(nowMs - lastSaveAt < 250) return false;
    lastSaveAt = nowMs;

    try{
      const res = await fetch("/api/state", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        credentials:"include",
        body:JSON.stringify({state})
      });
      if(res.status === 401 || res.status === 403){
        setSyncStatus("وضع الاتصال: متصل — الحفظ يحتاج دخول أدمن", "local", "غير محفوظ مشتركًا");
        return false;
      }
      if(!res.ok) throw new Error("POST /api/state " + res.status);
      const data = await res.json();
      remoteVersion = Number(data.version || remoteVersion);
      localStorage.setItem("kagRemoteVersion", String(remoteVersion));
      setSyncStatus("وضع الاتصال: متصل ومزامن", "online", formatUpdated(data.updatedAt));
      return true;
    }catch(e){
      setSyncStatus("وضع الاتصال: تعذر حفظ البيانات المشتركة", "error", "محلي فقط");
      return false;
    }
  }

  // البيانات تُسحب من Google Sheet عبر الخادم وهي للقراءة فقط داخل اللوحة،
  // لذلك لم تعد هناك حاجة لإرسال الحالة إلى الخادم. save() تبقى محلية فقط (localStorage).

  window.backendSyncNow = function(){
    return applyRemoteIfNewer(true);
  };

  function startBackendSync(){
    if(!backendAvailable()){
      setSyncStatus("وضع الاتصال: محلي فقط", "local", "ملف HTML");
      return;
    }
    applyRemoteIfNewer(true);
    setInterval(function(){
      applyRemoteIfNewer(false);
    }, BACKEND_POLL_MS);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", startBackendSync);
  }else{
    startBackendSync();
  }
})();

// ============================================================
// تصدير التقارير PPTX
// ============================================================
(function(){
  function bindReportExport(){
    const btns = document.querySelectorAll("[data-report-type]");
    const statusEl = document.getElementById("reportExportStatus");
    if(!btns.length) return;

    btns.forEach(function(btn){
      btn.addEventListener("click", async function(){
        const type = btn.dataset.reportType;
        const label = btn.textContent.trim();

        // تعطيل الأزرار أثناء التوليد
        btns.forEach(b => b.disabled = true);
        if(statusEl){ statusEl.style.display="block"; statusEl.textContent = "⏳ جارٍ توليد التقرير..."; }

        try{
          const res = await fetch("/api/report", {
            method:"POST",
            headers:{"Content-Type":"application/json"},
            credentials:"include",
            body:JSON.stringify({ type })
          });

          if(!res.ok){
            const err = await res.json().catch(()=>({error:"خطأ غير معروف"}));
            throw new Error(err.error || res.status);
          }

          // تنزيل الملف
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          const dateStr = new Date().toISOString().slice(0,10);
          a.href = url;
          a.download = `KAGA-Report-${type}-${dateStr}.pptx`;
          document.body.appendChild(a);
          a.click();
          setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 2000);

          if(statusEl){ statusEl.textContent = "✅ تم توليد التقرير بنجاح — جارٍ التنزيل"; }
          addFeed(["التقارير", `تم تصدير: ${label}`, "green"]);

        }catch(e){
          if(statusEl){ statusEl.textContent = "❌ فشل التوليد: " + e.message; }
          addFeed(["التقارير", "فشل تصدير التقرير: " + e.message, "red"]);
        }finally{
          btns.forEach(b => b.disabled = false);
          setTimeout(()=>{ if(statusEl) statusEl.style.display="none"; }, 5000);
        }
      });
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bindReportExport);
  }else{
    bindReportExport();
  }
})();
