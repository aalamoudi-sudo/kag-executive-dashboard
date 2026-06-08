(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const fmt = new Intl.NumberFormat("ar-SA");
  const state = { payload: null, appState: null, sync: null, systemHealth: null, deploymentReadiness: null, goLiveControl: null, integrationTest: null, notifications: [], management: null, auditLog: [], me: null, lastLiveAt: null };

  const COLORS = { blue:"#2F8CFF", cyan:"#16D9FF", green:"#20E38A", amber:"#F6B73C", red:"#FF4D6D", purple:"#9B5CFF", ice:"#7EE7FF", teal:"#20D3B0", orange:"#FF8A3D" };
  const FALLBACK = {
    project:{title:"حدائق الملك عبدالله", phase:"مرحلة ما قبل الإطلاق", openingDate:"2026-09-27"},
    tracks:[
      {id:"أ",name:"التشغيل",progress:90,planned:88,status:"ضمن المسار",tasks:22,done:20,active:2,risk:1,lead:"مدير التشغيل",accent:COLORS.blue},
      {id:"ب",name:"السلامة",progress:85,planned:82,status:"ضمن المسار",tasks:18,done:15,active:3,risk:2,lead:"مدير السلامة",accent:COLORS.green},
      {id:"ج",name:"الموردين",progress:78,planned:80,status:"تحت المتابعة",tasks:20,done:15,active:4,risk:3,lead:"مدير الموردين",accent:COLORS.amber},
      {id:"د",name:"التصاريح",progress:72,planned:79,status:"تحت المتابعة",tasks:16,done:11,active:4,risk:3,lead:"مدير التصاريح",accent:COLORS.purple},
      {id:"هـ",name:"التجربة",progress:88,planned:84,status:"ضمن المسار",tasks:19,done:17,active:2,risk:1,lead:"مدير التجربة",accent:COLORS.teal},
      {id:"و",name:"الصيانة",progress:81,planned:80,status:"ضمن المسار",tasks:15,done:12,active:3,risk:1,lead:"مدير الصيانة",accent:COLORS.cyan}
    ],
    items:[]
  };
  FALLBACK.items = FALLBACK.tracks.flatMap(t => [
    {track:t.id,type:"tasks",title:`إغلاق حزمة جاهزية ${t.name}`,owner:t.lead,status:t.progress>82?"قيد التنفيذ":"تحت المتابعة",due:"2026-05-20"},
    {track:t.id,type:"risks",title:`مخاطر تأخير مرتبطة بمسار ${t.name}`,owner:t.lead,status:t.risk>2?"معرضة للخطر":"تحت المتابعة",due:"2026-05-18"},
    {track:t.id,type:"permits",title:`اعتماد مستندات ${t.name}`,owner:t.lead,status:t.progress>80?"معتمدة":"قيد التنفيذ",due:"2026-05-25"},
    {track:t.id,type:"milestones",title:`نقطة تحقق ${t.name}`,owner:t.lead,status:t.progress>85?"مكتملة":"قيد التنفيذ",due:"2026-05-30"}
  ]);

  const DEFAULT_NOTIFICATION_CHANNELS = ["inApp"];
  function trackManagers(){
    return getTracks().map(t => ({ id:t.id, name:t.lead || `مدير مسار ${t.name}`, track:t.name, label:`${t.name} — ${t.lead || "مدير المسار"}` }));
  }
  function notificationPriorityClass(v){ return v==="حرجة"?"critical":v==="عالية"?"high":v==="متوسطة"?"med":"low"; }
  function notificationStatusClass(v){ return v==="مرسل"?"sent":v==="مجدول"?"scheduled":v==="فشل"?"failed":"draft"; }
  function channelNames(channels){
    const names={inApp:"داخل النظام",email:"البريد الإلكتروني",whatsapp:"واتساب",webhook:"Webhook"};
    return (Array.isArray(channels)?channels:[channels]).map(c=>names[c]||c).join("، ");
  }

  function esc(s){ return String(s ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
  function clamp(n,min=0,max=100){ n=Number(n); return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):0; }
  function avg(arr){ return arr.length ? Math.round(arr.reduce((a,b)=>a+Number(b||0),0)/arr.length) : 0; }
  function getTracks(){ return (state.appState?.tracks?.length ? state.appState.tracks : FALLBACK.tracks).map((t,i)=>({accent:[COLORS.blue,COLORS.green,COLORS.amber,COLORS.purple,COLORS.teal,COLORS.cyan][i%6], planned:t.planned ?? 80, ...t})); }
  function getItems(){ return state.appState?.items?.length ? state.appState.items : FALLBACK.items; }
  function isRisk(item){ return /خطر|معرض|متأخر|حرج/i.test(String(item.status||"")) || item.type === "risks"; }
  function done(item){ return /مكتملة|معتمدة|Completed|Cleared/i.test(String(item.status||"")); }
  function active(item){ return /قيد|تحت|نشط|Progress|Watch/i.test(String(item.status||"")); }
  function appMetrics(){
    const tracks = getTracks(); const items=getItems();
    const progress = avg(tracks.map(t=>t.progress));
    const planned = avg(tracks.map(t=>t.planned));
    const riskItems = items.filter(isRisk); const critical = riskItems.filter(x=>/خطر|حرج|معرضة/i.test(x.status||"")).length;
    const decisions = Math.max(6, riskItems.length + items.filter(i=>active(i)).slice(0,8).length);
    const visitor = clamp(72 + Math.round(progress/5) - critical, 55, 98);
    const impact = clamp(Math.round(progress*.58 + visitor*.26 + Math.max(0,100-critical*8)*.16), 0, 100);
    const dataHealth = state.sync?.ok === false ? 76 : 100;
    return {progress,planned,variance:progress-planned,critical,medium:Math.max(3,riskItems.length-critical),decisions,visitor,impact,dataHealth,items:items.length, tracks:tracks.length};
  }
  function toast(msg){ const el=$("toast"); if(!el) return; el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2600); }
  function dateText(iso){ try{ return iso ? new Date(iso).toLocaleString("ar-SA", {hour:"2-digit",minute:"2-digit",day:"numeric",month:"short"}) : "اليوم 09:42 ص"; }catch{ return "اليوم"; } }

  async function loadState(){
    try{
      const res = await fetch("/api/state", {credentials:"include"});
      if(res.status === 401){ location.reload(); return; }
      if(!res.ok) throw new Error("state");
      state.payload = await res.json(); state.appState = state.payload.state || FALLBACK; state.sync = state.payload.sync || {}; await loadNotifications(false); await loadManagement(false); await loadOperationalSummary(false);
    }catch(e){ state.appState = FALLBACK; state.sync = {ok:true, rows:FALLBACK.items.length, source:"fallback"}; state.notifications = demoNotifications(); }
    renderAll();
  }
  async function loadSystemHealth(){
    const box = $("systemPage"); if(box) box.innerHTML = card("جارٍ الفحص", "يتم الآن فحص الاتصال ومحرك التقارير...");
    try{
      const res = await fetch("/api/system-health", {credentials:"include"});
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || "لا توجد صلاحية");
      state.systemHealth = data; renderSystemPage(); toast("تم تحديث حالة النظام");
    }catch(e){ if(box) box.innerHTML = card("يتطلب صلاحية أدمن", esc(e.message || "تعذر الفحص"), "full"); }
  }
  async function refreshNow(){
    try{
      const res = await fetch("/api/refresh", {method:"POST", credentials:"include"});
      if(!res.ok) throw new Error("قد تتطلب صلاحية أدمن");
      toast("تم طلب تحديث البيانات");
    }catch(e){ toast("تعذر التحديث: " + e.message); }
    await loadState();
  }


  function demoNotifications(){
    return [
      {id:"demo-1", title:"إغلاق تحديث السلامة", message:"يرجى تحديث حالة اختبار السلامة والطوارئ وإرفاق الدليل قبل نهاية اليوم.", recipients:["ب"], recipientLabels:["السلامة — مدير السلامة"], priority:"حرجة", actionType:"تحديث", dueAt:"2026-05-18T18:00", updateAt:"2026-05-18T15:00", status:"مرسل", createdAt:new Date().toISOString(), delivery:[{channel:"داخل النظام",ok:true}]},
      {id:"demo-2", title:"اعتماد خطة الموردين", message:"مطلوب تأكيد بدائل الموردين للمسارات الحرجة وتحديث الأثر المتوقع.", recipients:["ج"], recipientLabels:["الموردين — مدير الموردين"], priority:"عالية", actionType:"قرار", dueAt:"2026-05-20T12:00", updateAt:"2026-05-19T16:00", status:"مرسل", createdAt:new Date().toISOString(), delivery:[{channel:"داخل النظام",ok:true}]}
    ];
  }
  async function loadNotifications(render=true){
    try{
      const res = await fetch("/api/notifications", {credentials:"include"});
      if(!res.ok) throw new Error("تعذر قراءة الإشعارات");
      const data = await res.json();
      state.notifications = Array.isArray(data.notifications) ? data.notifications : [];
    }catch(e){ if(!state.notifications.length) state.notifications = demoNotifications(); }
    if(render) renderNotifications();
  }
  async function sendNotification(payload){
    const res = await fetch("/api/notifications", {method:"POST", credentials:"include", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload)});
    const data = await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error || "تعذر إرسال الإشعار");
    state.notifications = data.notifications || state.notifications;
    if(data.management) state.management = data.management;
    return data.notification;
  }


  function demoManagement(){
    const tracks = getTracks();
    const today = new Date();
    const addDays = (d)=>{ const x=new Date(today); x.setDate(x.getDate()+d); return x.toISOString().slice(0,10); };
    return {
      actions: tracks.flatMap((t,i)=>[
        {id:`A-${t.id}-1`, title:`إغلاق تحديث ${t.name}`, track:t.name, owner:t.lead||"مدير المسار", priority:i%3===0?"حرجة":i%3===1?"عالية":"متوسطة", due:addDays(i-1), status:i%4===0?"متأخر":i%4===1?"قيد العمل":"جديد", evidenceRequired:true},
        {id:`A-${t.id}-2`, title:`رفع دليل جاهزية ${t.name}`, track:t.name, owner:t.lead||"مدير المسار", priority:"متوسطة", due:addDays(i+2), status:i%2?"قيد العمل":"جديد", evidenceRequired:true}
      ]),
      approvals: tracks.map((t,i)=>({id:`AP-${t.id}`, title:`اعتماد حزمة ${t.name}`, type:i%2?"اعتماد خطة":"اعتماد مورد/تصريح", owner:t.lead||"مدير المسار", track:t.name, due:addDays(i+1), impact:i<2?"مرتفع":"متوسط", status:i%3===0?"متأخر":"قيد الاعتماد"})),
      changes: [
        {id:"CH-01", title:"تعديل نطاق جاهزية نقطة تشغيل", track:"التشغيل", time:"متوسط", cost:"منخفض", quality:"متوسط", risk:"مرتفع", status:"قيد الدراسة"},
        {id:"CH-02", title:"زيادة فرق النظافة في أوقات الذروة", track:"التجربة", time:"منخفض", cost:"متوسط", quality:"مرتفع", risk:"منخفض", status:"مقبول مشروط"},
        {id:"CH-03", title:"تغيير مورد دعم ميداني احتياطي", track:"الموردين", time:"متوسط", cost:"متوسط", quality:"متوسط", risk:"متوسط", status:"يحتاج اعتماد"}
      ],
      meetings: [
        {id:"M-01", title:"اجتماع تشغيل يومي", date:addDays(0), attendees:8, decisions:4, actions:6, status:"مخرجات مفتوحة"},
        {id:"M-02", title:"مراجعة السلامة والتصاريح", date:addDays(1), attendees:6, decisions:3, actions:5, status:"يتطلب متابعة"},
        {id:"M-03", title:"جلسة الموردين الحرجة", date:addDays(2), attendees:7, decisions:2, actions:4, status:"مجدول"}
      ],
      zones: ["البوابات", "المواقف", "الممرات", "مناطق الضيافة", "دورات المياه", "نقاط الإسعاف", "غرف التشغيل", "الساحات الخارجية"].map((z,i)=>({zone:z, operations:92-i*3, safety:88-i*2, cleaning:85+i%3*3, experience:90-i, open:i%4+1, status:i<2?"جاهزة":i<5?"جاهزة بشروط":"تحتاج متابعة"})),
      fieldEvidence: ["قبل/بعد تجهيز البوابة", "إغلاق ملاحظة سلامة", "اختبار إنارة المسار", "جاهزية نقطة إسعاف", "نظافة منطقة الضيافة", "تقدم أعمال المورد"].map((x,i)=>({id:`FE-${i+1}`, title:x, type:i%2?"صورة إغلاق":"صورة تقدم", track:tracks[i%tracks.length]?.name||"التشغيل", zone:["البوابات","الممرات","الضيافة","الإسعاف"][i%4], date:addDays(-i), status:i%3?"معتمد":"بانتظار مراجعة"}))
    };
  }
  async function loadManagement(render=true){
    try{
      const res = await fetch("/api/management-center", {credentials:"include"});
      if(!res.ok) throw new Error("تعذر قراءة مراكز الإدارة");
      const data = await res.json();
      state.management = data.management || demoManagement();
    }catch(e){ state.management = demoManagement(); }
    if(render) renderManagementPages();
  }
  function getManagement(){ return state.management || demoManagement(); }
  async function loadAuditLog(render=true){
    try{
      const res = await fetch("/api/audit-log", {credentials:"include"});
      if(!res.ok) throw new Error("يتطلب صلاحية أدمن");
      const data = await res.json();
      state.auditLog = Array.isArray(data.events) ? data.events : [];
    }catch(e){ state.auditLog = []; }
    if(render) renderAuditLog();
  }
  async function loadOperationalSummary(render=true){
    try{
      const res = await fetch("/api/operational-summary", {credentials:"include"});
      if(!res.ok) throw new Error("تعذر قراءة ملخص التشغيل");
      state.operationalSummary = await res.json();
    }catch(e){ state.operationalSummary = null; }
    if(render) renderOperationalSummary();
  }
  async function loadDataQuality(render=true){
    try{
      const res = await fetch("/api/data-quality", {credentials:"include"});
      if(!res.ok) throw new Error("تعذر قراءة جودة البيانات");
      state.dataQualityApi = await res.json();
    }catch(e){ state.dataQualityApi = null; }
    if(render) renderDataTrust();
  }
  async function actionUpdate(id, status){
    const closureNote = prompt("ملاحظة الإغلاق أو التحديث:", status === "مغلق" ? "تم الإغلاق مع إرفاق الدليل." : "تم تحديث الحالة.") || "";
    const evidenceUrl = status === "مغلق" ? (prompt("رابط الدليل اختياري:", "") || "") : "";
    const res = await fetch("/api/action-update", {method:"POST", credentials:"include", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id,status,closureNote,evidenceUrl})});
    const data = await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error || "تعذر تحديث المهمة");
    state.management = data.management || state.management; renderManagementPages(); toast("تم تحديث المهمة");
  }
  async function approvalUpdate(id, status){
    const note = prompt("ملاحظة الاعتماد:", status) || "";
    const res = await fetch("/api/approval-update", {method:"POST", credentials:"include", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id,status,note})});
    const data = await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error || "تعذر تحديث الاعتماد");
    state.management = data.management || state.management; renderManagementPages(); toast("تم تحديث الاعتماد");
  }
  async function pollLiveNotifications(){
    try{
      const since = encodeURIComponent(state.lastLiveAt || new Date(Date.now()-30000).toISOString());
      const res = await fetch(`/api/live-notifications?since=${since}`, {credentials:"include"});
      const data = await res.json();
      if(data.ok){
        state.lastLiveAt = data.at;
        if(Array.isArray(data.notifications) && data.notifications.length){
          await loadNotifications(false);
          toast(`وصل ${data.notifications.length} إشعار جديد`);
          renderNotifications();
        }
      }
    }catch(e){}
  }
  function dateDiffDays(d){ if(!d) return 0; const t=new Date(String(d).slice(0,10)+"T12:00:00").getTime(); return Math.floor((t-Date.now())/86400000); }
  function urgencyClass(v){ return v==="حرجة"||v==="متأخر"?"high":v==="عالية"||v==="قيد الاعتماد"?"med":"low"; }

  async function loadDeploymentReadiness(){
    const box = $("deploymentPage");
    if(box) box.innerHTML = card("فحص جاهزية النشر", "يتم الآن تشغيل الفحص...", "full");
    try{
      const res = await fetch("/api/deployment-readiness", {credentials:"include"});
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || "تعذر فحص الجاهزية");
      state.deploymentReadiness = data;
      renderDeploymentReadiness();
      toast("تم تحديث جاهزية النشر");
    }catch(e){
      if(box) box.innerHTML = card("يتطلب صلاحية أدمن", esc(e.message || "تعذر فحص الجاهزية"), "full");
    }
  }

  async function testIntegrations(){
    try{
      toast("يتم اختبار قنوات التكامل...");
      const res = await fetch("/api/integrations-test", {method:"POST", credentials:"include", headers:{"Content-Type":"application/json"}, body:JSON.stringify({dryRun:true})});
      const data = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error || "تعذر اختبار التكاملات");
      state.integrationTest = data;
      if(state.deploymentReadiness) state.deploymentReadiness.integrationTest = data;
      renderDeploymentReadiness();
      toast(`اكتمل اختبار التكاملات: ${data.summary || "تم"}`);
    }catch(e){ toast(e.message || "تعذر اختبار التكاملات"); }
  }

  async function loadGoLiveControl(){
    const box = $("goLivePage");
    if(box) box.innerHTML = card("مركز الإطلاق التشغيلي", "يتم تحميل خطة الإطلاق...", "full");
    try{
      const res = await fetch("/api/go-live-control", {credentials:"include"});
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || "تعذر تحميل خطة الإطلاق");
      state.goLiveControl = data;
      renderGoLiveControl();
      toast("تم تحديث مركز الإطلاق التشغيلي");
    }catch(e){ if(box) box.innerHTML = card("مركز الإطلاق التشغيلي", esc(e.message || "تعذر التحميل"), "full"); }
  }

  function renderGoLiveControl(){
    const el = $("goLivePage"); if(!el) return;
    const d = state.goLiveControl;
    if(!d){ el.innerHTML = card("مركز الإطلاق التشغيلي", "افتح الصفحة لتحديث خطة الإطلاق والفحوصات النهائية.", "full"); return; }
    const gates=d.gates||[], week=d.weekPlan||[], handover=d.handover||[], risks=d.acceptanceRisks||[];
    el.innerHTML = `${card("درجة الإطلاق", `${d.score}%`, "")}${card("الحكم", esc(d.grade||"--"), "")}${card("بوابات مغلقة", `${gates.filter(g=>g.ok).length} / ${gates.length}`, "")}${card("إجراءات قبل العرض", (d.actions||[]).length, "")}
    <article class="deep-card full"><h3>بوابات الإطلاق التشغيلي</h3><table class="data-table"><thead><tr><th>البوابة</th><th>الحالة</th><th>المعيار</th><th>المالك</th></tr></thead><tbody>${gates.map(g=>`<tr><td>${esc(g.name)}</td><td><b class="pill ${g.ok?'low':'high'}">${g.ok?'مكتملة':'مطلوبة'}</b></td><td>${esc(g.criteria)}</td><td>${esc(g.owner)}</td></tr>`).join("")}</tbody></table></article>
    <article class="deep-card full"><h3>خطة تشغيل أول أسبوع</h3><table class="data-table"><thead><tr><th>اليوم</th><th>المخرجات</th><th>الاجتماع</th><th>القياس</th></tr></thead><tbody>${week.map(w=>`<tr><td>${esc(w.day)}</td><td>${esc(w.output)}</td><td>${esc(w.meeting)}</td><td>${esc(w.measure)}</td></tr>`).join("")}</tbody></table></article>
    <article class="deep-card"><h3>قائمة التسليم للفريق</h3>${handover.map(h=>`<div class="sys-row"><span>${esc(h.item)}</span><b>${esc(h.status)}</b></div>`).join("")}</article>
    <article class="deep-card"><h3>مخاطر القبول قبل العرض</h3>${risks.map(r=>`<div class="assistant-note"><b>${esc(r.risk)}</b><p>${esc(r.treatment)}</p></div>`).join("")}</article>
    <article class="deep-card full"><h3>الإجراءات القادمة</h3><div class="assistant-list">${(d.actions||[]).map((a,i)=>`<div class="assistant-note"><b>${i+1}. ${esc(a.title)}</b><p>${esc(a.detail)}</p></div>`).join("")}</div></article>`;
  }

  function renderManagementPages(){ renderActionCenter(); renderEscalationLog(); renderApprovalsCenter(); renderChangeControl(); renderEvidenceTracker(); renderDataTrust(); renderAssistant(); renderMeetings(); renderZoneReadiness(); renderFieldGallery(); renderOperationalSummary(); }

  function activatePage(id){
    document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active", p.id===id));
    document.querySelectorAll(".side-nav button").forEach(b=>b.classList.toggle("active", b.dataset.page===id));
    if(id === "system-health") loadSystemHealth();
    if(id === "deployment-readiness") loadDeploymentReadiness();
    if(id === "go-live-control") loadGoLiveControl();
    if(id === "audit-log") loadAuditLog(true);
    if(id === "operational-summary") loadOperationalSummary(true);
    if(id === "notification-center") { renderNotificationRecipients(); loadNotifications(true); }
    if(["operational-summary","action-center","escalation-log","approvals-center","change-control","evidence-tracker","data-trust","operational-assistant","meeting-intelligence","zone-readiness","field-gallery"].includes(id)) renderManagementPages();
    document.body.classList.remove("nav-open"); $("mobileMenuBtn")?.setAttribute("aria-expanded","false");
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function bind(){
    document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>activatePage(b.dataset.page)));
    document.body.addEventListener("click", e=>{ const go=e.target.closest("[data-go]"); if(go) activatePage(go.dataset.go); });
    $("mobileMenuBtn")?.addEventListener("click",()=>{ const open=!document.body.classList.contains("nav-open"); document.body.classList.toggle("nav-open", open); $("mobileMenuBtn")?.setAttribute("aria-expanded", String(open)); });
    $("mobileNavOverlay")?.addEventListener("click",()=>{ document.body.classList.remove("nav-open"); $("mobileMenuBtn")?.setAttribute("aria-expanded","false"); });
    window.addEventListener("resize",()=>{ if(window.innerWidth>900){ document.body.classList.remove("nav-open"); $("mobileMenuBtn")?.setAttribute("aria-expanded","false"); } });
    $("refreshBtn")?.addEventListener("click", refreshNow);
    $("notifyForm")?.addEventListener("submit", onNotifySubmit);
    $("notifyMode")?.addEventListener("change", renderNotificationRecipients);
    let deferredInstall=null;
    window.addEventListener("beforeinstallprompt", e=>{ e.preventDefault(); deferredInstall=e; $("installAppBtn")?.classList.add("install-ready"); });
    $("installAppBtn")?.addEventListener("click", async()=>{ if(deferredInstall){ deferredInstall.prompt(); deferredInstall=null; } else toast("يمكن إضافة المنصة إلى الشاشة الرئيسية من خيارات المتصفح"); });

    // ============================================================
    // handler واحد موحّد — يتعامل مع كل نقرات الجسم
    // ============================================================
    async function doGenerateReport(rtype, rname, btnEl){
      if(btnEl){ btnEl.disabled=true; btnEl.textContent="⏳ جارٍ التجهيز..."; }
      const dateStr = new Date().toISOString().slice(0,10);
      const safeName = (rname||rtype).replace(/\s+/g,"-");
      try{
        const res = await fetch("/api/report",{
          method:"POST", credentials:"include",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({type: rtype})
        });
        if(!res.ok){
          let errMsg="تعذر توليد التقرير";
          try{ const j=await res.json(); errMsg=j.error||errMsg; }catch(_){}
          throw new Error(errMsg);
        }
        const contentType = res.headers.get("content-type")||"";
        const blob = await res.blob();
        const ext  = contentType.includes("pdf") ? "pdf" : "pptx";
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href=url; a.download=`KAGA-${safeName}-${dateStr}.${ext}`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast(`✅ ${rname||rtype} — جارٍ التنزيل`);
      }catch(err){
        // fallback: CSV من بيانات الداش بورد مباشرة
        try{
          const items  = getItems();
          const tracks = getTracks();
          const today  = new Date().toISOString().slice(0,10);
          let rows = ["المسار,النوع,العنوان,المسؤول,الحالة,الموعد,التقدم%"];
          // فلترة حسب نوع التقرير
          const filtered = rtype==="evidence"
            ? items.filter(i=>["مكتملة","مكتمل","معتمدة","معتمد"].includes(i.status))
            : rtype==="approvals"
            ? items.filter(i=>!["مكتملة","مكتمل","معتمدة","معتمد"].includes(i.status))
            : rtype==="executive"
            ? tracks.map(t=>({track:t.id,type:"مسار",title:t.name,owner:"—",status:t.status,due:"—",progress:t.progress}))
            : items; // daily_ops / comprehensive = الكل
          (filtered.length ? filtered : items).forEach(i=>{
            const esc = v=>`"${String(v||"").replace(/"/g,'""')}"`;
            rows.push([esc(i.track||i.id||""),esc(i.type||""),esc(i.title||i.name||""),esc(i.owner||"—"),esc(i.status||""),esc(i.due||""),esc(i.progress||"")].join(","));
          });
          const bom  = "\uFEFF";
          const blob2= new Blob([bom+rows.join("\n")],{type:"text/csv;charset=utf-8"});
          const url2 = URL.createObjectURL(blob2);
          const a2   = document.createElement("a");
          a2.href=url2; a2.download=`KAGA-${safeName}-${dateStr}.csv`;
          document.body.appendChild(a2); a2.click(); document.body.removeChild(a2);
          URL.revokeObjectURL(url2);
          toast(`⚠️ PPTX غير متاح — تم تنزيل CSV بديل (${rows.length-1} سطر)`);
        }catch(csvErr){ toast(`❌ ${err.message}`); }
      }finally{
        if(btnEl){ btnEl.disabled=false; btnEl.textContent="تجهيز"; }
      }
    }

    document.body.addEventListener("click", async e=>{
      // مهام / اعتمادات
      const action=e.target.closest("[data-action-update]");
      if(action){ try{ await actionUpdate(action.dataset.id, action.dataset.status); }catch(er){ toast(er.message); } return; }
      const approval=e.target.closest("[data-approval-update]");
      if(approval){ try{ await approvalUpdate(approval.dataset.id, approval.dataset.status); }catch(er){ toast(er.message); } return; }
      const it=e.target.closest("[data-integration-test]");
      if(it){ await testIntegrations(); return; }

      // أزرار التقارير الفردية
      const tileBtn=e.target.closest(".btn-report-tile");
      if(tileBtn){ await doGenerateReport(tileBtn.dataset.rtype, tileBtn.dataset.rname, tileBtn); return; }

      // زر التقرير الشامل
      const compBtn=e.target.closest(".btn-make-report");
      if(compBtn){ await doGenerateReport("comprehensive","تقرير-شامل",compBtn); return; }
    });
  }

  function renderAll(){
    renderTop(); renderStrategic(); renderDecisions(); renderNotifications(); renderAuditLog(); renderManagementPages(); renderRisk(); renderVisitor(); renderTracks(); renderEvidence(); renderScenarios(); renderDaily(); renderReports(); renderDataLab(); renderSystemMini(); renderDeploymentReadiness(); renderGoLiveControl();
  }
  function renderTop(){
    const m=appMetrics();
    $("lastUpdated").textContent = dateText(state.payload?.updatedAt || state.sync?.at);
    $("dataHealth").textContent = `${m.dataHealth}%`;
    $("activeAlerts").textContent = fmt.format(m.critical);
    $("syncSources").textContent = `${m.tracks} / ${m.tracks}`;
    $("bellCount").textContent = m.critical;
    $("topKpis").innerHTML = [
      ["مؤشر الأثر",m.impact,"مرتفع",COLORS.blue], ["جاهزية المسارات",m.progress+"%",`${m.variance>=0?"+":""}${m.variance}% عن المخطط`,COLORS.green],
      ["القرارات المفتوحة",m.decisions,"تحتاج مالك وموعد",COLORS.amber], ["المخاطر الحرجة",m.critical,"تتطلب إجراء فوري",COLORS.red],
      ["مستوى تجربة الزائر",(m.visitor/20).toFixed(1)+" / 5","قراءة مركبة",COLORS.cyan], ["سلامة البيانات",m.dataHealth+"%",state.sync?.ok===false?"تحقق مطلوب":"ممتاز",COLORS.green]
    ].map(k=>`<article class="kpi-card glass" style="--accent:${k[3]}"><h3>${k[0]}</h3><strong>${k[1]}</strong><span>${k[2]}</span><div class="sparkline"></div></article>`).join("");
  }
  function renderStrategic(){
    const m=appMetrics();
    $("impactScore").textContent=m.impact; $("impactTrend").textContent = `${m.variance>=0?"+":""}${m.variance}% عن المخطط`;
    const series=[54,61,68,66,74,82,80,77,84,73,79,m.impact];
    $("impactBars").innerHTML = series.map((v,i)=>`<div class="bar" data-label="أسبوع ${12-i}" style="height:${v}%"></div>`).join("");
    $("decisionPreview").innerHTML = decisionRows(5);
    drawRadar("riskRadarSvg", [82,62,76,70,88], COLORS.red);
    $("criticalRiskBadge").textContent = `${m.critical} مخاطر حرجة`; $("mediumRiskBadge").textContent = `${m.medium} مخاطر متوسطة`;
    renderVisitorQuality("visitorQuality");
    const visitorPercent=m.visitor; const d=$("visitorDonut"); if(d){ d.style.setProperty("--p", visitorPercent+"%"); d.querySelector("b").textContent = visitorPercent+"%"; }
    renderTrackBars("trackBars"); renderSystemMini();
    $("evidenceCount").textContent = fmt.format(Math.max(32, getItems().length*4)); $("scenarioCount").textContent = 7; $("reportsCount").textContent = 24; $("itemsCount").textContent = fmt.format(getItems().length);
  }
  function decisionSeed(){
    const items=getItems(); const risks=items.filter(isRisk).slice(0,7); const base = risks.length?risks:items.slice(0,7);
    return base.map((i,idx)=>({
      action: idx%2?`معالجة ${i.title}`:`اعتماد إجراء ${i.title}`,
      owner:i.owner||"مالك المسار", urgent: isRisk(i)?"عالية":(idx%3?"متوسطة":"منخفضة"), due:i.due||"2026-05-25", impact:isRisk(i)?"مرتفع":(idx%2?"متوسط":"منخفض"), track:i.track||"-"
    }));
  }
  function priorityClass(v){ return v==="عالية"?"high":v==="متوسطة"?"med":"low"; }
  function decisionRows(n=99){ return decisionSeed().slice(0,n).map(d=>`<div class="smart-row"><span>${esc(d.action)}</span><span>${esc(d.owner)}</span><b class="pill ${priorityClass(d.urgent)}">${d.urgent}</b><span>${esc(d.due)}</span></div>`).join(""); }
  function renderDecisions(){
    const rows=decisionSeed();
    $("decisionPage").innerHTML = `${card("مؤشر ضغط القرارات", `${rows.filter(r=>r.urgent==='عالية').length} قرارات عالية الأولوية`, "")}${card("متوسط أثر التأخير", "مرتفع على المسارات الحرجة", "")}${card("التوصية", "تثبيت اجتماع قرار يومي لمدة 20 دقيقة حتى إغلاق العناصر الحمراء", "")}
    <article class="deep-card full"><h3>سجل القرارات والإجراءات</h3><table class="data-table"><thead><tr><th>الإجراء المقترح</th><th>المسار</th><th>المالك</th><th>الأولوية</th><th>تاريخ الاستحقاق</th><th>الأثر المتوقع</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.action)}</td><td>${esc(r.track)}</td><td>${esc(r.owner)}</td><td><b class="pill ${priorityClass(r.urgent)}">${r.urgent}</b></td><td>${esc(r.due)}</td><td>${esc(r.impact)}</td></tr>`).join("")}</tbody></table></article>`;
  }


  function renderNotificationRecipients(){
    const sel = $("notifyRecipients"); if(!sel) return;
    const mode = $("notifyMode")?.value || "individual";
    const managers = trackManagers();
    sel.innerHTML = managers.map(m => `<option value="${esc(m.id)}">${esc(m.label)}</option>`).join("");
    sel.disabled = mode === "all";
    sel.size = mode === "group" ? Math.min(6, managers.length) : 1;
    Array.from(sel.options).forEach((opt,i)=>{ opt.selected = mode === "all" || (mode === "individual" && i===0); });
  }
  function readSelectedRecipients(){
    const mode = $("notifyMode")?.value || "individual";
    const managers = trackManagers();
    if(mode === "all") return managers.map(m=>m.id);
    const selected = Array.from($("notifyRecipients")?.selectedOptions || []).map(o=>o.value);
    return mode === "individual" ? selected.slice(0,1) : selected;
  }
  function readNotificationChannels(){
    const checked = Array.from(document.querySelectorAll('input[name="notifyChannel"]:checked')).map(x=>x.value);
    return Array.from(new Set(["inApp", ...checked]));
  }
  async function onNotifySubmit(ev){
    ev.preventDefault();
    const recipients = readSelectedRecipients();
    if(!recipients.length){ toast("اختر مستلمًا واحدًا على الأقل"); return; }
    const payload = {
      mode: $("notifyMode")?.value || "individual", recipients,
      title: $("notifyTitle")?.value.trim(), message: $("notifyMessage")?.value.trim(),
      priority: $("notifyPriority")?.value || "متوسطة", actionType: $("notifyActionType")?.value || "تحديث",
      dueAt: $("notifyDueAt")?.value || "", updateAt: $("notifyUpdateAt")?.value || "",
      channels: readNotificationChannels(),
      extraEmails: $("notifyExtraEmails")?.value || "",
      extraWhatsApp: $("notifyExtraWhatsApp")?.value || ""
    };
    if(!payload.title || !payload.message){ toast("العنوان ونص الإشعار مطلوبان"); return; }
    try{
      await sendNotification(payload);
      ev.target.reset(); renderNotificationRecipients(); renderNotifications();
      toast("تم إرسال الإشعار وتسجيله في مركز الإشعارات");
    }catch(e){ toast(e.message); }
  }
  function renderNotifications(){
    renderNotificationRecipients();
    const list = state.notifications || [];
    const metrics = $("notificationMetrics");
    if(metrics){
      const critical = list.filter(n=>n.priority==="حرجة").length;
      const high = list.filter(n=>n.priority==="عالية").length;
      const sent = list.filter(n=>n.status==="مرسل").length;
      const upcoming = list.filter(n=>n.dueAt && new Date(n.dueAt).getTime() > Date.now()).length;
      metrics.innerHTML = [
        ["إجمالي الإشعارات", list.length, "var(--cyan)"], ["حرجة", critical, "var(--red)"], ["عالية", high, "var(--amber)"], ["مرسلة", sent, "var(--green)"], ["لها موعد تسليم", upcoming, "var(--blue)"]
      ].map(m=>`<div><strong style="color:${m[2]}">${fmt.format(m[1])}</strong><span>${m[0]}</span></div>`).join("");
    }
    const box = $("notificationInbox");
    if(box){
      if(!list.length){ box.innerHTML = `<div class="empty-note">لا توجد إشعارات بعد. أنشئ إشعارًا جديدًا لمدير مسار أو مجموعة مسارات.</div>`; return; }
      box.innerHTML = list.slice().reverse().slice(0,30).map(n=>`
        <div class="notification-card ${notificationPriorityClass(n.priority)}">
          <div class="notification-card-head"><strong>${esc(n.title)}</strong><b class="pill ${notificationPriorityClass(n.priority)}">${esc(n.priority)}</b></div>
          <p>${esc(n.message)}</p>
          <div class="notification-meta">
            <span>المستلمون: ${esc((n.recipientLabels||n.recipients||[]).join("، "))}</span>
            <span>نوع الإجراء: ${esc(n.actionType||"تحديث")}</span>
            <span>التسليم: ${esc(n.dueAt?dateText(n.dueAt):"غير محدد")}</span>
            <span>التحديث: ${esc(n.updateAt?dateText(n.updateAt):"غير محدد")}</span>
            <span class="status ${notificationStatusClass(n.status)}">${esc(n.status||"مسجل")}</span>
          </div>
        </div>`).join("");
    }
  }
  function renderRisk(){
    const m=appMetrics();
    $("riskPage").innerHTML = `${card("Risk Pressure Index", `${clamp(m.critical*18+m.medium*4,0,100)} / 100`, "")}${card("Reputation Shield", m.critical>2?"يتطلب متابعة يومية":"ضمن السيطرة", "")}${card("أولوية التدخل", "السلامة · التصاريح · الموردين", "")}
    <article class="deep-card wide"><h3>خريطة المخاطر</h3><div id="riskBigRadar"></div></article><article class="deep-card"><h3>توصية إدارة المخاطر</h3><p class="muted">إغلاق المخاطر ذات الأثر على السلامة والسمعة قبل أي تحسينات تجميلية في المشروع، وربط كل مخاطرة بقرار قابل للتنفيذ.</p></article>`;
    const box=$("riskBigRadar"); if(box){ box.innerHTML='<svg class="radar" viewBox="0 0 220 190" id="riskBigRadarSvg"></svg>'; drawRadar("riskBigRadarSvg", [88,70,74,83,66], COLORS.red); }
  }
  function renderVisitor(){
    $("visitorPage").innerHTML = `${card("رضا الزائر المتوقع", `${appMetrics().visitor}%`, "")}${card("قابلية الوصول", "4.7 / 5", "")}${card("جودة الخدمات", "4.6 / 5", "")}
    <article class="deep-card full"><h3>تفصيل تجربة الزائر</h3><div id="visitorDeepQuality" class="quality-list"></div></article>`;
    renderVisitorQuality("visitorDeepQuality", true);
  }
  function renderTracks(){
    $("trackPage").innerHTML = getTracks().map(t=>`<article class="track-card" style="--accent:${t.accent}"><h3>${esc(t.name)}</h3><div class="big">${clamp(t.progress)}%</div><div class="linebar"><i style="--w:${clamp(t.progress)}%;--accent:${t.accent}"></i></div><div class="track-meta"><div><b>${t.tasks||0}</b><span>مهام</span></div><div><b>${t.risk||0}</b><span>مخاطر</span></div><div><b>${t.planned||80}%</b><span>مخطط</span></div><div><b>${esc(t.status||"-")}</b><span>الحالة</span></div></div><p class="muted">المالك: ${esc(t.lead||"مدير المسار")}</p></article>`).join("");
  }
  function renderEvidence(){
    const rows=getItems().slice(0,14).map((i,idx)=>`<tr><td>${esc(i.title)}</td><td>${esc(i.track)}</td><td>${idx%3===0?"محضر اعتماد":idx%3===1?"صورة ميدانية":"تقرير متابعة"}</td><td><b class="pill ${idx%4===0?'med':'low'}">${idx%4===0?'مطلوب':'مكتمل'}</b></td></tr>`).join("");
    $("evidencePage").innerHTML = `${card("نسبة الأدلة المكتملة", "82%", "")}${card("أدلة تحتاج استكمال", "9", "")}${card("قابلية التدقيق", "مرتفعة", "")}<article class="deep-card full"><h3>سجل الأدلة</h3><table class="data-table"><thead><tr><th>العنصر</th><th>المسار</th><th>نوع الدليل</th><th>الحالة</th></tr></thead><tbody>${rows}</tbody></table></article>`;
  }
  function renderScenarios(){
    const sc=["تأخر تصريح رئيسي","تعثر مورد حرج","ارتفاع كثافة الزوار","تأخر اختبار السلامة","انخفاض جاهزية النظافة","تعطل نظام تقني","تأخر اعتماد إعلامي"];
    $("scenarioPage").innerHTML = `${card("سيناريوهات نشطة", "7", "")}${card("أعلى أثر محتمل", "السلامة والسمعة", "")}${card("الإجراء المقترح", "تفعيل خطط بديلة قبل 72 ساعة", "")}<article class="deep-card full"><h3>مصفوفة السيناريوهات</h3><table class="data-table"><thead><tr><th>السيناريو</th><th>أثر الوقت</th><th>أثر السلامة</th><th>أثر السمعة</th><th>الإجراء</th></tr></thead><tbody>${sc.map((s,i)=>`<tr><td>${s}</td><td>${i<3?"مرتفع":"متوسط"}</td><td>${i===3?"حرج":"متوسط"}</td><td>${i<2?"مرتفع":"متوسط"}</td><td>تحديد مالك وخطة بديلة</td></tr>`).join("")}</tbody></table></article>`;
  }
  function renderDaily(){
    const rows=decisionSeed().slice(0,6);
    $("dailyPage").innerHTML = `${card("حكم اليوم", appMetrics().critical>2?"اليوم يحتاج إغلاق قرارات حرجة":"اليوم تحت السيطرة", "")}${card("عدد إجراءات اليوم", rows.length, "")}${card("أولوية اليوم", "المخاطر · التصاريح · الموردين", "")}<article class="deep-card full"><h3>إجراءات اليوم</h3><table class="data-table"><thead><tr><th>الإجراء</th><th>المالك</th><th>الأولوية</th><th>الموعد</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.action)}</td><td>${esc(r.owner)}</td><td><b class="pill ${priorityClass(r.urgent)}">${r.urgent}</b></td><td>${esc(r.due)}</td></tr>`).join("")}</tbody></table></article>`;
  }
  function renderReports(){
    const m=appMetrics(); const mg=getManagement();
    $("reportsPage").innerHTML = `${card("تقرير يومي", "PDF / PPTX", "")} ${card("تقرير أسبوعي", "تنفيذي", "")} ${card("تقرير مسار", "حسب المالك", "")}
    <article class="deep-card full"><h3>مركز التقارير</h3><p class="muted">التقارير تسحب المؤشرات، القرارات، المخاطر، المهام المتأخرة، الاعتمادات، الأدلة، والتوصيات التشغيلية.</p>
      <div class="report-grid">
        ${[
          ["تقرير غرفة العمليات اليومي",   `يتضمن ${mg.actions?.length||0} مهمة و${m.critical} مخاطر حرجة`,          "daily_ops"],
          ["تقرير اللجنة التنفيذية",        `جاهزية المسارات ${m.progress}% ومؤشر الأثر ${m.impact}`,            "executive"],
          ["تقرير الاعتمادات والتصعيد",    `${(mg.approvals||[]).filter(x=>x.status==='متأخر').length} اعتمادات متأخرة`, "approvals"],
          ["تقرير الأدلة الميدانية",        `${(mg.fieldEvidence||[]).length} دليل ميداني مصنف`,                   "evidence"]
        ].map(r=>`<div class="report-tile"><b>${r[0]}</b><span>${r[1]}</span><button class="customize btn-report-tile" data-rtype="${r[2]}" data-rname="${r[0]}">تجهيز</button></div>`).join("")}
      </div><button class="customize btn-make-report">توليد تقرير شامل</button></article>`;
    // لا يوجد addEventListener هنا — الربط يتم عبر event delegation في bind()
  }

  function renderOperationalSummary(){
    const el=$("operationalSummaryPage"); if(!el) return;
    const s = state.operationalSummary;
    if(!s){ el.innerHTML = `${card("ملخص التشغيل", "اضغط تحديث لقراءة الملخص من الخادم", "")}${card("دورة العمل", "إشعار ← مهمة ← متابعة ← تصعيد ← دليل ← اعتماد ← تقرير", "")}`; return; }
    el.innerHTML = `
      ${card("متوسط تقدم المسارات", `${s.avgProgress||0}%`, "")}
      ${card("جودة البيانات", `${s.dataQuality||0}%`, "")}
      ${card("المهام المفتوحة", `${s.openActions||0}`, "")}
      ${card("المهام المتأخرة", `${s.overdue||0}`, "")}
      ${card("المهام الحرجة", `${s.critical||0}`, "")}
      ${card("الاعتمادات المفتوحة", `${s.pendingApprovals||0}`, "")}
      <article class="deep-card full"><h3>التوصية التشغيلية</h3><p>${esc(s.recommendation||"لا توجد توصية")}</p></article>
      <article class="deep-card full"><h3>أهم الإجراءات القادمة</h3><table class="data-table"><thead><tr><th>المهمة</th><th>المسار</th><th>المالك</th><th>الأولوية</th><th>الموعد</th><th>الحالة</th></tr></thead><tbody>${(s.nextActions||[]).map(a=>`<tr><td>${esc(a.title)}</td><td>${esc(a.track)}</td><td>${esc(a.owner)}</td><td><b class="pill ${urgencyClass(a.priority)}">${esc(a.priority)}</b></td><td>${esc(a.due)}</td><td>${esc(a.status)}</td></tr>`).join("")}</tbody></table></article>`;
  }
  function renderActionCenter(){
    const el=$("actionCenterPage"); if(!el) return; const mg=getManagement();
    const tasks=[...(mg.actions||[])]; const late=tasks.filter(t=>dateDiffDays(t.due)<0 && t.status!=="مغلق").length; const critical=tasks.filter(t=>t.priority==="حرجة").length;
    el.innerHTML=`${card("إجمالي المهام والمتابعات", tasks.length, "")}${card("مهام متأخرة", late, "")}${card("حرجة", critical, "")}
    <article class="deep-card full"><h3>لوحة المهام القابلة للإغلاق</h3><table class="data-table"><thead><tr><th>المهمة</th><th>المسار</th><th>المالك</th><th>الأهمية</th><th>الموعد</th><th>الحالة</th><th>الدليل</th><th>إجراء</th></tr></thead><tbody>${tasks.map(t=>`<tr><td>${esc(t.title)}</td><td>${esc(t.track)}</td><td>${esc(t.owner)}</td><td><b class="pill ${urgencyClass(t.priority)}">${esc(t.priority)}</b></td><td>${esc(t.due)}</td><td>${esc(t.status)}</td><td>${t.evidenceUrl?`<a href="${esc(t.evidenceUrl)}" target="_blank" rel="noopener">رابط</a>`:(t.evidenceRequired?"مطلوب":"اختياري")}</td><td><button class="mini-action" data-action-update data-id="${esc(t.id)}" data-status="قيد العمل">تحديث</button><button class="mini-action ok" data-action-update data-id="${esc(t.id)}" data-status="مغلق">إغلاق</button></td></tr>`).join("")}</tbody></table></article>`;
  }
  function renderEscalationLog(){
    const el=$("escalationPage"); if(!el) return; const tasks=(getManagement().actions||[]).map(t=>({...t, days:Math.abs(Math.min(0,dateDiffDays(t.due)))}));
    const rows=tasks.filter(t=>dateDiffDays(t.due)<1).sort((a,b)=>b.days-a.days);
    el.innerHTML=`${card("تصعيد خلال 24 ساعة", rows.filter(x=>x.days>=1).length, "")}${card("تصعيد للإدارة", rows.filter(x=>x.days>=3).length, "")}${card("يتطلب متابعة السمعة", rows.filter(x=>x.days>=4).length, "")}
    <article class="deep-card full"><h3>سلم التصعيد</h3><table class="data-table"><thead><tr><th>العنصر</th><th>المالك</th><th>الأهمية</th><th>أيام التأخير</th><th>مستوى التصعيد</th><th>الإجراء</th></tr></thead><tbody>${rows.map(t=>{const lvl=t.days>=4?"إدارة السمعة":t.days>=3?"الإدارة العليا":t.days>=2?"مدير المشروع":"مدير المسار";return `<tr><td>${esc(t.title)}</td><td>${esc(t.owner)}</td><td><b class="pill ${urgencyClass(t.priority)}">${esc(t.priority)}</b></td><td>${t.days}</td><td>${lvl}</td><td>إشعار وتصعيد موثق</td></tr>`}).join("")}</tbody></table></article>`;
  }
  function renderApprovalsCenter(){
    const el=$("approvalsPage"); if(!el) return; const rows=getManagement().approvals||[]; const late=rows.filter(r=>r.status==="متأخر").length;
    el.innerHTML=`${card("اعتمادات مفتوحة", rows.length, "")}${card("متأخرة", late, "")}${card("أثر التأخير الأعلى", "السلامة والتشغيل", "")}
    <article class="deep-card full"><h3>سجل الاعتمادات</h3><table class="data-table"><thead><tr><th>الاعتماد</th><th>النوع</th><th>المسار</th><th>المالك</th><th>الموعد</th><th>الأثر</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.title)}</td><td>${esc(r.type)}</td><td>${esc(r.track)}</td><td>${esc(r.owner)}</td><td>${esc(r.due)}</td><td>${esc(r.impact)}</td><td><b class="pill ${urgencyClass(r.status)}">${esc(r.status)}</b></td><td><button class="mini-action" data-approval-update data-id="${esc(r.id)}" data-status="قيد الاعتماد">تحديث</button><button class="mini-action ok" data-approval-update data-id="${esc(r.id)}" data-status="معتمد">اعتماد</button></td></tr>`).join("")}</tbody></table></article>`;
  }
  function renderChangeControl(){
    const el=$("changePage"); if(!el) return; const rows=getManagement().changes||[];
    el.innerHTML=`${card("طلبات تغيير", rows.length, "")}${card("تحتاج اعتماد", rows.filter(x=>/اعتماد|دراسة/.test(x.status)).length, "")}${card("أعلى أثر", "المخاطر والوقت", "")}
    <article class="deep-card full"><h3>مصفوفة أثر التغيير</h3><table class="data-table"><thead><tr><th>التغيير</th><th>المسار</th><th>الوقت</th><th>التكلفة</th><th>الجودة</th><th>المخاطر</th><th>الحالة</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.title)}</td><td>${esc(r.track)}</td><td>${esc(r.time)}</td><td>${esc(r.cost)}</td><td>${esc(r.quality)}</td><td>${esc(r.risk)}</td><td>${esc(r.status)}</td></tr>`).join("")}</tbody></table></article>`;
  }
  function renderEvidenceTracker(){
    const el=$("evidenceTrackerPage"); if(!el) return; const mg=getManagement(); const total=(mg.actions||[]).length+(mg.fieldEvidence||[]).length; const supported=(mg.fieldEvidence||[]).filter(x=>x.status==="معتمد").length + Math.round((mg.actions||[]).length*.62); const score=clamp(supported*100/Math.max(1,total));
    el.innerHTML=`${card("إغلاقات مدعومة بأدلة", score+"%", "")}${card("أدلة بانتظار مراجعة", (mg.fieldEvidence||[]).filter(x=>x.status!=="معتمد").length, "")}${card("قابلية التدقيق", score>80?"مرتفعة":"متوسطة", "")}
    <article class="deep-card full"><h3>الأدلة المطلوبة لكل إغلاق</h3><table class="data-table"><thead><tr><th>العنصر</th><th>نوع الدليل المطلوب</th><th>المسار</th><th>الحالة</th></tr></thead><tbody>${(mg.actions||[]).slice(0,12).map((a,i)=>`<tr><td>${esc(a.title)}</td><td>${i%3===0?"صورة + تقرير":i%3===1?"اعتماد رسمي":"محضر إغلاق"}</td><td>${esc(a.track)}</td><td>${i%4?"مطلوب":"مكتمل"}</td></tr>`).join("")}</tbody></table></article>`;
  }
  function dataTrustScore(){
    const items=getItems(); let penalties=0;
    penalties += items.filter(i=>!i.owner).length*4 + items.filter(i=>!i.due).length*4 + items.filter(i=>isRisk(i)&&!/قيد|تحت|معرض|خطر|مكتملة/.test(i.status||"")).length*3;
    penalties += (getManagement().actions||[]).filter(a=>a.evidenceRequired && a.status==="مغلق").length*2;
    return clamp(100-penalties,40,100);
  }
  function renderDataTrust(){
    const el=$("dataTrustPage"); if(!el) return; const items=getItems(); const score=dataTrustScore();
    const checks=[["مهام بدون مالك",items.filter(i=>!i.owner).length],["تواريخ ناقصة",items.filter(i=>!i.due).length],["مخاطر بدون إجراء",items.filter(i=>isRisk(i)&&!active(i)).length],["إغلاقات بدون دليل",Math.max(1,Math.round((getManagement().actions||[]).length*.12))]];
    el.innerHTML=`${card("ثقة البيانات", score+"%", "")}${card("حكم الاعتماد", score>85?"قابلة للاعتماد":"تحتاج تنظيف", "")}${card("آخر فحص", dateText(new Date().toISOString()), "")}
    <article class="deep-card full"><h3>فحص جودة البيانات</h3><table class="data-table"><thead><tr><th>الفحص</th><th>النتيجة</th><th>الحكم</th></tr></thead><tbody>${checks.map(c=>`<tr><td>${c[0]}</td><td>${c[1]}</td><td><b class="pill ${c[1]?"med":"low"}">${c[1]?"تحسين مطلوب":"سليم"}</b></td></tr>`).join("")}</tbody></table></article>`;
  }
  function renderAssistant(){
    const el=$("assistantPage"); if(!el) return; const m=appMetrics(); const mg=getManagement();
    const adv=[];
    if(m.critical>0) adv.push(["تصعيد فوري",`يوصى بتصعيد ${m.critical} مخاطر حرجة وربطها بمالك وموعد إغلاق خلال 24 ساعة.`]);
    if((mg.approvals||[]).some(a=>a.status==="متأخر")) adv.push(["اعتمادات متأخرة","يوصى بعقد جلسة اعتماد قصيرة لإغلاق الاعتمادات المتأخرة ذات الأثر على التشغيل والسلامة."]);
    if(dataTrustScore()<90) adv.push(["تنظيف بيانات","قبل أي عرض، نظّف الحقول الناقصة واربط الإغلاقات بالأدلة."]);
    adv.push(["توازن المسارات",`المسارات الأقل جاهزية تحتاج خطة دعم يومية حتى ترتفع فوق ${Math.max(85,m.progress)}%.`]);
    el.innerHTML=`${card("توصيات نشطة", adv.length, "")}${card("حكم المساعد", m.critical>2?"تدخل قيادي مطلوب":"تحت السيطرة", "")}${card("ثقة البيانات", dataTrustScore()+"%", "")}
    <article class="deep-card full"><h3>توصيات المساعد التشغيلي</h3><div class="assistant-list">${adv.map((a,i)=>`<div class="assistant-note"><b>${i+1}. ${a[0]}</b><p>${a[1]}</p></div>`).join("")}</div></article>`;
  }
  function renderMeetings(){
    const el=$("meetingsPage"); if(!el) return; const rows=getManagement().meetings||[];
    el.innerHTML=`${card("اجتماعات نشطة", rows.length, "")}${card("قرارات ناتجة", rows.reduce((a,b)=>a+b.decisions,0), "")}${card("مهام ناتجة", rows.reduce((a,b)=>a+b.actions,0), "")}
    <article class="deep-card full"><h3>سجل متابعة الاجتماعات</h3><table class="data-table"><thead><tr><th>الاجتماع</th><th>التاريخ</th><th>الحضور</th><th>القرارات</th><th>المهام</th><th>الحالة</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.title)}</td><td>${esc(r.date)}</td><td>${r.attendees}</td><td>${r.decisions}</td><td>${r.actions}</td><td>${esc(r.status)}</td></tr>`).join("")}</tbody></table></article>`;
  }
  function renderZoneReadiness(){
    const el=$("zonePage"); if(!el) return; const rows=getManagement().zones||[]; const avgZone=avg(rows.map(z=>avg([z.operations,z.safety,z.cleaning,z.experience])));
    el.innerHTML=`${card("جاهزية المواقع والمناطق", avgZone+"%", "")}${card("مناطق تحتاج متابعة", rows.filter(z=>z.status!=="جاهزة").length, "")}${card("ملاحظات مفتوحة", rows.reduce((a,b)=>a+b.open,0), "")}
    <article class="deep-card full"><h3>جاهزية حسب المنطقة</h3><table class="data-table"><thead><tr><th>المنطقة</th><th>التشغيل</th><th>السلامة</th><th>النظافة</th><th>التجربة</th><th>ملاحظات</th><th>الحالة</th></tr></thead><tbody>${rows.map(z=>`<tr><td>${esc(z.zone)}</td><td>${z.operations}%</td><td>${z.safety}%</td><td>${z.cleaning}%</td><td>${z.experience}%</td><td>${z.open}</td><td>${esc(z.status)}</td></tr>`).join("")}</tbody></table></article>`;
  }
  function renderFieldGallery(){
    const el=$("fieldGalleryPage"); if(!el) return; const rows=getManagement().fieldEvidence||[];
    el.innerHTML=`${card("أدلة ميدانية", rows.length, "")}${card("معتمدة", rows.filter(x=>x.status==="معتمد").length, "")}${card("بانتظار مراجعة", rows.filter(x=>x.status!=="معتمد").length, "")}
    <article class="deep-card full"><h3>معرض التوثيق الميداني</h3><div class="gallery-grid">${rows.map((r,i)=>`<div class="evidence-shot"><div class="shot-preview">${i%2?"بعد":"قبل"}</div><b>${esc(r.title)}</b><span>${esc(r.type)} · ${esc(r.track)} · ${esc(r.zone)}</span><em>${esc(r.date)} — ${esc(r.status)}</em></div>`).join("")}</div></article>`;
  }
  function renderAuditLog(){
    const el=$("auditPage"); if(!el) return; const rows=state.auditLog||[];
    el.innerHTML = `${card("أحداث مسجلة", rows.length, "")}${card("آخر عملية", rows[0]?.action || "لا يوجد", "")}${card("نطاق السجل", "آخر 300 حدث", "")}
    <article class="deep-card full"><h3>سجل التدقيق</h3><table class="data-table"><thead><tr><th>الوقت</th><th>الدور</th><th>الإجراء</th><th>الكيان</th><th>التفاصيل</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(dateText(r.at))}</td><td>${esc(r.role)}</td><td>${esc(r.action)}</td><td>${esc(r.entity)}</td><td>${esc(JSON.stringify(r.details||{}).slice(0,160))}</td></tr>`).join("") || `<tr><td colspan="5">لا توجد أحداث أو يتطلب السجل صلاحية أدمن.</td></tr>`}</tbody></table></article>`;
  }

  function renderDeploymentReadiness(){
    const el=$("deploymentPage"); if(!el) return;
    const d=state.deploymentReadiness;
    if(!d){ el.innerHTML = `${card("فحص الجاهزية", "افتح الصفحة بصلاحية أدمن لتشغيل الفحص", "full")}`; return; }
    const checks=d.checks||[];
    const failed=checks.filter(c=>!c.ok);
    const passed=checks.filter(c=>c.ok);
    const env=d.environment||{};
    const integration=d.integrationTest;
    el.innerHTML = `${card("درجة الجاهزية", `${d.score}%`, "")}${card("الحكم", esc(d.grade||"--"), "")}${card("الفحوصات الناجحة", `${passed.length} / ${checks.length}`, "")}${card("الملاحظات المفتوحة", failed.length, "")}
    <article class="deep-card full"><h3>إجراءات سريعة قبل النشر</h3><div class="action-buttons"><a class="btn-link" href="/api/backup" target="_blank">تنزيل نسخة احتياطية</a><a class="btn-link" href="/api/export/actions.csv" target="_blank">تصدير المهام CSV</a><a class="btn-link" href="/api/export/approvals.csv" target="_blank">تصدير الاعتمادات CSV</a><a class="btn-link" href="/api/export/audit.csv" target="_blank">تصدير سجل التدقيق CSV</a><button class="btn-link" type="button" data-integration-test="1">اختبار التكاملات</button></div></article>
    <article class="deep-card full"><h3>فحص جاهزية النشر</h3><table class="data-table"><thead><tr><th>الفحص</th><th>الحالة</th><th>الوزن</th><th>التوصية</th></tr></thead><tbody>${checks.map(c=>`<tr><td>${esc(c.name)}</td><td><b class="pill ${c.ok?'low':'high'}">${c.ok?'ناجح':'مطلوب'}</b></td><td>${c.weight}</td><td>${esc(c.recommendation)}</td></tr>`).join("")}</tbody></table></article>
    <article class="deep-card"><h3>إعدادات البيئة</h3><div class="sys-row"><span>Google Sheet</span><b>${env.sheetConfigured?'مضبوط':'غير مضبوط'}</b></div><div class="sys-row"><span>CSV مباشر</span><b>${env.csvUrlConfigured?'مضبوط':'غير مضبوط'}</b></div><div class="sys-row"><span>مستخدمي المسارات</span><b>${env.roleUsersConfigured||0}</b></div><div class="sys-row"><span>تسجيل الدخول</span><b>${env.loginRequired?'مفعل':'معطل'}</b></div></article>
    <article class="deep-card"><h3>قنوات التكامل</h3><div class="sys-row"><span>البريد</span><b>${env.emailWebhookConfigured?'جاهز':'غير مضبوط'}</b></div><div class="sys-row"><span>واتساب</span><b>${env.whatsappWebhookConfigured?'جاهز':'غير مضبوط'}</b></div><div class="sys-row"><span>Webhook عام</span><b>${env.notificationWebhookConfigured?'جاهز':'غير مضبوط'}</b></div>${integration?`<div class="sys-row"><span>آخر اختبار</span><b>${esc(dateText(integration.generatedAt))}</b></div>`:""}</article>`;
  }

  function renderDataLab(){
    const items=getItems();
    $("dataPage").innerHTML = `${card("عناصر البيانات", items.length, "")}${card("المسارات", getTracks().length, "")}${card("آخر مصدر", esc(state.sync?.source||"fallback"), "")}<article class="deep-card full"><h3>مركز البيانات</h3><table class="data-table"><thead><tr><th>المسار</th><th>النوع</th><th>العنوان</th><th>المسؤول</th><th>الحالة</th><th>الاستحقاق</th></tr></thead><tbody>${items.slice(0,40).map(i=>`<tr><td>${esc(i.track)}</td><td>${esc(i.type)}</td><td>${esc(i.title)}</td><td>${esc(i.owner)}</td><td>${esc(i.status)}</td><td>${esc(i.due)}</td></tr>`).join("")}</tbody></table></article>`;
  }
  function renderSystemMini(){
    const m=appMetrics();
    $("systemMini").innerHTML = [`حالة الاتصال|${state.sync?.ok===false?"تحقق":"جيدة"}`,`مزامنة البيانات|${state.sync?.at?"محدث":"احتياطي"}`,`محرك التقارير|تشغيل`,`توافر النظام|99.8%`].map(s=>{const [a,b]=s.split("|");return `<div class="sys-row"><span>${a}</span><b>${b}</b></div>`}).join("");
  }
  function renderSystemPage(){
    const h=state.systemHealth;
    if(!h){ $("systemPage").innerHTML = card("حالة النظام", "اضغط فحص من القائمة أو افتح الصفحة بصلاحية أدمن", "full"); return; }
    $("systemPage").innerHTML = `${card("حالة البيانات", h.dataSource?.ok?"متصلة":"تحتاج تحقق", "")}${card("محرك التقارير", h.report?.generateReportPy?"موجود":"غير موجود", "")}${card("الأمان", "Admin Only", "")}<article class="deep-card full"><h3>تفاصيل التشخيص</h3><table class="data-table"><tbody><tr><th>Node</th><td>${esc(h.node)}</td></tr><tr><th>آخر مزامنة</th><td>${esc(h.dataSource?.at)}</td></tr><tr><th>عدد الصفوف</th><td>${esc(h.dataSource?.rows)}</td></tr><tr><th>القوالب</th><td>${h.report?.templatesDir?"موجودة":"غير موجودة / يستخدم البديل"}</td></tr><tr><th>المسارات</th><td>${esc((h.tracks||[]).join("، "))}</td></tr></tbody></table></article>`;
  }
  function renderTrackBars(id){ $(id).innerHTML = getTracks().slice(0,6).map(t=>`<div class="metric-line"><span>${esc(t.name)}</span><div class="linebar"><i style="--w:${clamp(t.progress)}%;--accent:${t.accent}"></i></div><b>${clamp(t.progress)}%</b></div>`).join(""); }
  function renderVisitorQuality(id, deep=false){
    const arr=[["سهولة الوصول",94],["جودة المرافق",90],["تفاعل الموظفين",92],["النظافة والصيانة",89],["التجربة العامة",92],["وضوح الإرشاد",deep?88:0]].filter(x=>x[1]);
    $(id).innerHTML = arr.map(([n,v],i)=>`<div class="metric-line"><span>${n}</span><div class="linebar"><i style="--w:${v}%;--accent:${[COLORS.green,COLORS.cyan,COLORS.blue,COLORS.purple][i%4]}"></i></div><b>${(v/20).toFixed(1)}/5</b></div>`).join("");
  }
  function card(title,value,cls=""){ return `<article class="deep-card ${cls}"><h3>${title}</h3><div class="big" style="font-size:32px;color:var(--cyan);font-weight:800">${value}</div></article>`; }
  function drawRadar(id, vals, color){
    const svg=$(id); if(!svg) return;
    const cx=110, cy=98, r=70, labels=["تشغيلي","مالي","سلامة","سمعة","امتثال"];
    const pts = vals.map((v,i)=>{ const a=(-90+i*360/vals.length)*Math.PI/180; const rr=r*clamp(v)/100; return [cx+Math.cos(a)*rr, cy+Math.sin(a)*rr]; });
    const grid=[.25,.5,.75,1].map(g=>`<polygon points="${labels.map((_,i)=>{const a=(-90+i*360/labels.length)*Math.PI/180;return `${cx+Math.cos(a)*r*g},${cy+Math.sin(a)*r*g}`}).join(' ')}" fill="none" stroke="rgba(255,255,255,.13)"/>`).join("");
    const axes=labels.map((l,i)=>{const a=(-90+i*360/labels.length)*Math.PI/180; return `<line x1="${cx}" y1="${cy}" x2="${cx+Math.cos(a)*r}" y2="${cy+Math.sin(a)*r}" stroke="rgba(255,255,255,.1)"/><text x="${cx+Math.cos(a)*(r+18)}" y="${cy+Math.sin(a)*(r+18)}" text-anchor="middle" fill="#a9bad0" font-size="10">${l}</text>`;}).join("");
    svg.innerHTML = `${grid}${axes}<polygon points="${pts.map(p=>p.join(',')).join(' ')}" fill="${color}55" stroke="${color}" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="2" fill="#fff"/>`;
  }

  document.addEventListener("DOMContentLoaded", () => { bind(); loadState(); setInterval(loadState, 30000); setInterval(pollLiveNotifications, 15000); });
})();
