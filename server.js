/**
 * KAG Operational Analytics Platform — Google Sheets Backend (V60)
 * ======================================================
 * مصدر البيانات الآن هو Google Sheet:
 *   - الفريق يعبّي البيانات داخل الجدول.
 *   - الخادم يسحب البيانات من الجدول تلقائيًا ويحوّلها إلى حالة اللوحة.
 *   - جميع المستخدمين يرون نفس البيانات وتتحدث تلقائيًا.
 *
 * التشغيل:
 *   SHEET_ID=xxxx node server.js
 * ثم افتح: http://localhost:3000
 *
 * متغيرات البيئة:
 *   SHEET_ID         معرّف Google Sheet (إلزامي لتفعيل السحب الحي)
 *   SHEET_NAME       اسم التبويب داخل الجدول (اختياري، الافتراضي أول تبويب)
 *   SHEET_REFRESH_MS مدة إعادة السحب بالمللي ثانية (افتراضي 15000)
 *   OPENING_DATE     تاريخ الافتتاح (افتراضي 2026-09-27)
 *   ADMIN_USERNAME   اسم مستخدم الأدمن لإعدادات العرض (افتراضي MAYADEEN)
 *   ADMIN_PASSWORD   كلمة مرور الأدمن (افتراضي تُولّد عشوائيًا وتُطبع عند الإقلاع)
 *   PORT             المنفذ (افتراضي 3000)
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
// معرّف جدول حدائق الملك عبدالله المثبّت مسبقًا (يمكن تجاوزه بمتغيّر البيئة SHEET_ID)
const SHEET_ID = process.env.SHEET_ID || "15m2VHVr7W2mWWz7g_Z5iMDxaIZuRshj-N3EtA9j4lWk";
const SHEET_NAME = process.env.SHEET_NAME || "";
const SHEET_GID = process.env.SHEET_GID || "";          // رقم التبويب (gid) إن وُجد
const SHEET_CSV_URL = process.env.SHEET_CSV_URL || "";  // رابط "النشر للويب" CSV (الأكثر ضمانًا)
const LOCAL_CSV = process.env.LOCAL_CSV || "";          // مسار ملف CSV محلي كحل احتياطي تام
const SHEET_REFRESH_MS = Number(process.env.SHEET_REFRESH_MS || 15000);
const OPENING_DATE = process.env.OPENING_DATE || "2026-09-27";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "MAYADEEN";
// كلمة المرور الأساسية المثبّتة (يمكن تغييرها بمتغيّر البيئة ADMIN_PASSWORD).
const GENERATED_ADMIN_PASSWORD = crypto.randomBytes(12).toString("base64url");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || GENERATED_ADMIN_PASSWORD;
// بيانات حساب المشاهد — يفتح اللوحة فقط بدون صلاحيات الأدمن
const VIEWER_USERNAME = process.env.VIEWER_USERNAME || "KAG_VIEWER";
const GENERATED_VIEWER_PASSWORD = crypto.randomBytes(10).toString("base64url");
const VIEWER_PASSWORD = process.env.VIEWER_PASSWORD || GENERATED_VIEWER_PASSWORD;
const NOTIFICATION_WEBHOOK_URL = process.env.NOTIFICATION_WEBHOOK_URL || "";
const EMAIL_WEBHOOK_URL = process.env.EMAIL_WEBHOOK_URL || "";
const WHATSAPP_WEBHOOK_URL = process.env.WHATSAPP_WEBHOOK_URL || "";
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "منصة حدائق الملك عبدالله";
const TRACK_CONTACTS = parseJsonEnv(process.env.TRACK_CONTACTS || "{}", {});
const NOTIFICATION_STORE = process.env.NOTIFICATION_STORE || path.join(__dirname, "notifications_store.json");
const MANAGEMENT_STORE = process.env.MANAGEMENT_STORE || path.join(__dirname, "management_store.json");
const AUDIT_STORE = process.env.AUDIT_STORE || path.join(__dirname, "audit_store.json");
const TRACK_USERS = parseJsonEnv(process.env.TRACK_USERS || "{}", {});
// مستخدمو مديري المسارات بصيغة مرنة. أمثلة:
// TRACK_USERS={"أ":{"username":"planning","password":"***","name":"مدير التخطيط"}}
// أو TRACK_USERS={"users":[{"username":"planning","password":"***","track":"أ","name":"مدير التخطيط"}]}
let ROLE_USERS = [];

const PUBLIC_DIR = path.join(__dirname, "public");
const sessions = new Map(); // sid -> { exp: timestamp, role: "viewer"|"admin" }
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
function parseJsonEnv(value, fallback){
  try{ return value ? JSON.parse(value) : fallback; }catch(e){ return fallback; }
}
function normalizeTrackUsers(raw){
  const users=[];
  if(!raw || typeof raw!=="object") return users;
  const source = Array.isArray(raw) ? raw : (Array.isArray(raw.users) ? raw.users : Object.entries(raw).map(([track,cfg])=>Object.assign({track}, cfg||{})));
  for(const u of source){
    if(!u || !u.username || !u.password) continue;
    const track = normalizeTrack(String(u.track||u.trackId||""));
    if(!VALID_TRACKS.includes(track)) continue;
    users.push({
      username:String(u.username), password:String(u.password), role:"track-manager",
      trackId:track, name:String(u.name||trackLabelById(track)), permissions:["read","write:own-track","notify:view","report:view","evidence:update"]
    });
  }
  return users;
}

/* ============ إعدادات الأمان ============ */
const REQUIRE_LOGIN = String(process.env.REQUIRE_LOGIN||"true").toLowerCase()!=="false"; // قفل كامل مفعّل افتراضيًا
const FETCH_TIMEOUT_MS = 10000;            // مهلة قراءة الجدول لمنع التعليق
const LOGIN_MAX_FAILS = 6;                 // عدد المحاولات قبل الحظر المؤقت
const LOGIN_WINDOW_MS = 15 * 60 * 1000;    // نافذة احتساب المحاولات
const LOGIN_BLOCK_MS = 15 * 60 * 1000;     // مدة الحظر بعد تجاوز الحد
const loginAttempts = new Map();           // ip -> {count, first, blockedUntil}

function clientIp(req){
  const xff = (req.headers["x-forwarded-for"]||"").split(",")[0].trim();
  return xff || (req.socket && req.socket.remoteAddress) || "unknown";
}
function isHttps(req){
  return !!(req.socket && req.socket.encrypted) ||
    (req.headers["x-forwarded-proto"]||"").split(",")[0].trim()==="https";
}
// مقارنة آمنة زمنيًا (تمنع هجمات التوقيت)
function safeEqual(a,b){
  const A=crypto.createHash("sha256").update(String(a)).digest();
  const B=crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(A,B);
}
// فحص نفس المصدر (دفاع ضد CSRF بالإضافة إلى SameSite)
function sameOrigin(req){
  const host=req.headers.host;
  const origin=req.headers.origin;
  const referer=req.headers.referer;
  if(!origin && !referer) return true;
  try{
    const src=new URL(origin || referer);
    // قبل نفس الـ host فقط، مع السماح للبيئة المحلية أثناء التطوير.
    if(src.host===host) return true;
    const localHosts = new Set(["localhost","127.0.0.1","::1"]);
    if(localHosts.has(src.hostname) && (String(host||"").startsWith("localhost") || String(host||"").startsWith("127.0.0.1"))) return true;
    return false;
  }catch(e){ return false; } // عند الشك نرفض — حماية CSRF أكثر صرامة
}
function loginBlocked(ip){
  const a=loginAttempts.get(ip);
  return !!(a && a.blockedUntil && Date.now()<a.blockedUntil);
}
function recordLoginFail(ip){
  const now=Date.now();
  let a=loginAttempts.get(ip);
  if(!a || now-a.first>LOGIN_WINDOW_MS) a={count:0, first:now, blockedUntil:0};
  a.count++;
  if(a.count>=LOGIN_MAX_FAILS) a.blockedUntil=now+LOGIN_BLOCK_MS;
  loginAttempts.set(ip,a);
}
function clearLoginFails(ip){ loginAttempts.delete(ip); }

/* ============ إعدادات المسارات (المصدر الوحيد لبيانات المسارات الثابتة) ============ */
const TRACK_CONFIG = [
  { id:"أ", slug:"track-a", name:"التخطيط والتنسيق", ar:"Planning & Coordination",
    sub:"الحوكمة · الجدول الزمني · المخرجات · الاعتمادات · التصاريح · المخاطر · التغيير",
    lead:"مدير مسار التخطيط والتنسيق", focus:"التنسيق والمتابعة مع أصحاب المصلحة",
    accent:"#7E6BFF", planned:88 },
  { id:"ب", slug:"track-b", name:"التواصل والتسويق", ar:"Communication & Marketing",
    sub:"الخطة الإعلامية · التغطية · التوثيق · الرسائل الإعلامية · المركز الإعلامي · المحتوى",
    lead:"مدير مسار التواصل والتسويق", focus:"التنسيق الإعلامي وإعداد التقارير والعروض",
    accent:"#A98BFF", planned:66 },
  { id:"ج", slug:"track-c", name:"الفعاليات والأنشطة المصاحبة", ar:"Events & Supporting Activities",
    sub:"الضيافة · الإنتاج التقني · العروض الفنية · إدارة الحضور · VIP · البروتوكول",
    lead:"مدير مسار الفعاليات والأنشطة المصاحبة", focus:"ضبط تجربة الفعالية والبروتوكول",
    accent:"#D9B86C", planned:55 },
  { id:"د", slug:"track-d", name:"تجهيز وتفعيل الحديقة", ar:"Garden Setup & Activation",
    sub:"الحديقة · المسارات · النقل · السلامة والطوارئ · الاستدامة · الجاهزية · التشغيل الميداني",
    lead:"مدير مسار تجهيز وتفعيل الحديقة", focus:"جاهزية الحديقة والتشغيل الميداني",
    accent:"#6454C8", planned:60 }
];
const VALID_TRACKS = TRACK_CONFIG.map(t=>t.id);
ROLE_USERS = normalizeTrackUsers(TRACK_USERS);

/* ============ بيانات تجريبية احتياطية (تُستخدم فقط إذا لم يُضبط SHEET_ID) ============ */
const SEED_ITEMS = [
  {track:"أ",type:"tasks",title:"تثبيت الجدول الزمني وخطة الاعتمادات",owner:"PMC",status:"مكتملة",due:"2026-08-20"},
  {track:"أ",type:"milestones",title:"اعتماد سجل المخرجات والمخاطر",owner:"PMC",status:"مكتملة",due:"2026-08-22"},
  {track:"ب",type:"tasks",title:"إعداد خطة التواصل والتغطية الإعلامية",owner:"التواصل والتسويق",status:"قيد التنفيذ",due:"2026-08-29"},
  {track:"ب",type:"risks",title:"تأخر اعتماد المحتوى الإعلامي",owner:"التواصل والتسويق",status:"تحت المتابعة",due:"2026-08-29"},
  {track:"ج",type:"tasks",title:"تجهيز خطة الضيافة والبروتوكول و VIP",owner:"الفعاليات",status:"قيد التنفيذ",due:"2026-09-10"},
  {track:"ج",type:"milestones",title:"اعتماد برنامج الأنشطة المصاحبة",owner:"الفعاليات",status:"تحت المتابعة",due:"2026-09-18"},
  {track:"د",type:"tasks",title:"جاهزية مسارات الحديقة والتشغيل الميداني",owner:"التشغيل الميداني",status:"معرضة للخطر",due:"2026-09-24"},
  {track:"د",type:"risks",title:"اختبار السلامة والطوارئ والاستدامة",owner:"السلامة",status:"معرضة للخطر",due:"2026-09-12"}
];

/* ============ بيانات احتياطية: ملف القالب المرفق ثم البذرة ============ */
const FALLBACK_CSV_PATH = path.join(PUBLIC_DIR, "KAG_GoogleSheet_Template.csv");
function fallbackItems(){
  try{
    if(fs.existsSync(FALLBACK_CSV_PATH)){
      const its = rowsToItems(parseCSV(fs.readFileSync(FALLBACK_CSV_PATH,"utf8")));
      if(its.length) return its;
    }
  }catch(e){}
  return SEED_ITEMS.slice();
}
function setStateFromItems(items){
  const state = buildState(items);
  liveState = state;
  liveUpdatedAt = new Date().toISOString();
  liveVersion = liveVersion || 1;
  liveHash = crypto.createHash("sha1").update(JSON.stringify({tracks:state.tracks,items:state.items})).digest("hex");
}
let liveState = null;     // آخر حالة مبنية بنجاح
let liveVersion = 0;
let liveUpdatedAt = null;
let liveHash = "";
let lastSync = { ok:false, at:null, rows:0, error:"لم تتم أي مزامنة بعد", source: SHEET_ID ? "google-sheet" : "seed" };

/* ============ أدوات التحويل (تطابق منطق الواجهة) ============ */
// تهريب HTML لمنع هجمات XSS المخزّنة عبر خلايا الجدول
function esc(v){
  return String(v==null?"":v)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
// تقليم وتقييد طول النص لمنع الإفراط/الإساءة
function clean(v, max){ return esc(String(v==null?"":v).trim().slice(0, max||300)); }
function normalizeTrack(v){
  v=(v||"").trim();
  const map={A:"أ",B:"ب",C:"ج",D:"د",E:"هـ","ه":"هـ","هـ":"هـ","ا":"أ","أ":"أ","ب":"ب","ج":"ج","د":"د"};
  return map[(v.toUpperCase?v.toUpperCase():v)]||map[v]||v;
}
function normalizeType(v){
  v=(v||"").trim().toLowerCase();
  if(["task","tasks","مهمة","مهام"].includes(v))return"tasks";
  if(["risk","risks","مخاطرة","مخاطر"].includes(v))return"risks";
  if(["permit","permits","approval","approvals","تصريح","تصاريح","اعتماد","اعتمادات"].includes(v))return"permits";
  if(["milestone","milestones","معلم","معلم رئيسي","معالم"].includes(v))return"milestones";
  return v||"tasks";
}
function normalizeHeader(h){
  return String(h||"").trim().toLowerCase().replace(/\s+/g,"")
    .replace("المسار","track").replace("نوعالعنصر","type").replace("النوع","type")
    .replace("العنوان","title").replace("المهمة","title").replace("النشاط","title")
    .replace("الوصف","title").replace("المسؤول","owner").replace("الجهة","owner")
    .replace("الحالة","status").replace("التاريخ","due").replace("الاستحقاق","due")
    .replace("تاريخالاستحقاق","due");
}
const DONE_SET=["مكتملة","معتمدة","Completed","Cleared"];
const ACTIVE_SET=["قيد التنفيذ","تحت المتابعة","In Progress","Watch"];
const RISK_SET=["معرضة للخطر","معرض للخطر","At Risk","متأخر"];

/* ============ تحليل CSV ============ */
function parseCSV(text){
  text = String(text||"").replace(/^\uFEFF/,""); // إزالة BOM
  const rows=[]; let row=[]; let cur=""; let q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(q){
      if(c==='"'){ if(text[i+1]==='"'){cur+='"';i++;} else q=false; }
      else cur+=c;
    }else{
      if(c==='"') q=true;
      else if(c===','){ row.push(cur); cur=""; }
      else if(c==='\n'){ row.push(cur); rows.push(row); row=[]; cur=""; }
      else if(c==='\r'){ /* skip */ }
      else cur+=c;
    }
  }
  if(cur.length||row.length){ row.push(cur); rows.push(row); }
  return rows.filter(r=>r.some(c=>String(c).trim()!==""));
}

/* ============ بناء العناصر من صفوف الجدول ============ */
function rowsToItems(rows){
  if(!rows.length) return [];
  const header = rows[0].map(normalizeHeader);
  const known=["track","type","title","owner","status","due"];
  const hasHeader = header.some(h=>known.includes(h));
  let map={track:0,type:1,title:2,owner:3,status:4,due:5};
  let body=rows;
  if(hasHeader){
    known.forEach(k=>{ const idx=header.findIndex(h=>h===k||h.includes(k)); if(idx>=0) map[k]=idx; });
    body=rows.slice(1);
  }
  const items=[];
  body.forEach(r=>{
    const item={
      track: normalizeTrack(r[map.track]),
      type: normalizeType(r[map.type]),
      title: clean(r[map.title], 220),
      owner: clean(r[map.owner], 120),
      status: clean(r[map.status]||"قيد التنفيذ", 60),
      due: clean(r[map.due], 40)
    };
    if(!VALID_TRACKS.includes(item.track) || !item.title) return;
    items.push(item);
  });
  return items;
}

/* ============ بناء حالة اللوحة الكاملة من العناصر ============ */
function buildState(items){
  const tracks = TRACK_CONFIG.map(cfg=>{
    const t={...cfg, status:"تحت المتابعة", progress:0, tasks:0, done:0, active:0, risk:0};
    const ti=items.filter(i=>i.track===t.id);
    const tasks=ti.filter(i=>i.type==="tasks");
    const risks=ti.filter(i=>i.type==="risks" && i.status!=="مغلقة");
    t.tasks=tasks.length;
    t.done=tasks.filter(i=>DONE_SET.includes(i.status)).length;
    t.active=tasks.filter(i=>ACTIVE_SET.includes(i.status)).length;
    t.risk=risks.length + tasks.filter(i=>RISK_SET.includes(i.status)).length;
    if(t.tasks>0){
      t.progress=Math.round((t.done/t.tasks)*100);
      t.status = t.progress>=70 ? "ضمن المسار" : t.progress>=45 ? "تحت المتابعة" : "معرض للخطر";
    }else{ t.progress=0; t.status="تحت المتابعة"; }
    return t;
  });

  // تغذية حية مشتقة من بيانات حقيقية (مخاطر/عناصر معرضة للخطر/أحدث المكتمل)
  const feed=[];
  items.filter(i=>RISK_SET.includes(i.status)).slice(0,4).forEach(i=>
    feed.push({time:i.due||"", title:"تنبيه مخاطرة", msg:`${i.title} (${i.track})`, level:"red"}));
  items.filter(i=>ACTIVE_SET.includes(i.status)).slice(0,4).forEach(i=>
    feed.push({time:i.due||"", title:"قيد المتابعة", msg:`${i.title} (${i.track})`, level:"amber"}));
  items.filter(i=>DONE_SET.includes(i.status)).slice(0,3).forEach(i=>
    feed.push({time:i.due||"", title:"إنجاز", msg:`${i.title} (${i.track})`, level:"green"}));
  if(!feed.length) feed.push({time:"", title:"النظام الحي", msg:"تمت مزامنة البيانات من Google Sheet", level:"cyan"});

  return {
    project:{ title:"حدائق الملك عبدالله", phase:"مرحلة ما قبل الإطلاق", openingDate:OPENING_DATE },
    tracks,
    items,
    feed: feed.slice(0,12),
    dailyLogs:[], decisions:[], snapshots:[]
  };
}

/* ============ سحب البيانات من Google Sheet ============ */
// قائمة روابط مرشّحة لقراءة الجدول، تُجرّب بالترتيب حتى ينجح أحدها
function sheetCandidates(){
  if(SHEET_CSV_URL) return [SHEET_CSV_URL]; // رابط النشر للويب له الأولوية
  const list=[];
  let gviz = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;
  if(SHEET_NAME) gviz += `&sheet=${encodeURIComponent(SHEET_NAME)}`;
  list.push(gviz);
  let exp = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
  if(SHEET_GID) exp += `&gid=${encodeURIComponent(SHEET_GID)}`;
  list.push(exp);
  return list;
}
// يكشف ما إذا كان الردّ صفحة تسجيل دخول/HTML بدل CSV (دليل على أن الجدول غير عام)
function looksLikeLoginOrHtml(text){
  const t=(text||"").slice(0,400).toLowerCase();
  return t.includes("<!doctype html") || t.includes("<html") ||
         t.includes("accounts.google.com") || t.includes("sign in") || t.includes("اعتذر");
}
async function fetchCsvOnce(url){
  const ctrl = new AbortController();
  const timer = setTimeout(()=>ctrl.abort(), FETCH_TIMEOUT_MS);
  try{
    const res = await fetch(url, { redirect:"follow", signal:ctrl.signal });
    const text = await res.text();
    if(!res.ok) return { ok:false, code:res.status, text };
    if(looksLikeLoginOrHtml(text)) return { ok:false, code:"private", text };
    return { ok:true, code:res.status, text };
  } finally { clearTimeout(timer); }
}
async function refreshFromSheet(){
  try{
    let items, rowsLen=0, csv=null;
    // 1) ملف CSV محلي (حل احتياطي تام يعمل بدون إنترنت)
    if(LOCAL_CSV && fs.existsSync(LOCAL_CSV)){
      csv = fs.readFileSync(LOCAL_CSV, "utf8");
      lastSync.source = "local-csv";
    }
    // 2) Google Sheet عبر عدة روابط مرشّحة
    else if(SHEET_ID || SHEET_CSV_URL){
      const tried=[]; let lastCode=null;
      for(const url of sheetCandidates()){
        const r = await fetchCsvOnce(url);
        tried.push((url.includes("gviz")?"gviz":url.includes("export")?"export":"published")+":"+r.code);
        if(r.ok){ csv = r.text; break; }
        lastCode = r.code;
      }
      lastSync.source = "google-sheet";
      if(csv===null){
        if(lastCode==="private") throw new Error("الجدول غير مُشارَك للعموم. فعّل: Anyone with the link ← Viewer، أو استخدم رابط النشر للويب.");
        throw new Error("تعذّر الوصول للجدول ("+tried.join(" / ")+")");
      }
    }
    // 3) بيانات تجريبية إن لم يُضبط أي مصدر
    else{
      items = SEED_ITEMS.slice(); rowsLen = items.length; lastSync.source="seed";
    }

    if(csv!==null){
      const rows = parseCSV(csv);
      rowsLen = Math.max(0, rows.length-1);
      items = rowsToItems(rows);
      if(!items.length) throw new Error("لم يتم العثور على صفوف صالحة (تحقق من عناوين الأعمدة: المسار/النوع/العنوان/المسؤول/الحالة/التاريخ).");
    }
    const state = buildState(items);
    const hash = crypto.createHash("sha1").update(JSON.stringify({tracks:state.tracks,items:state.items})).digest("hex");
    if(hash !== liveHash){
      liveHash = hash;
      liveVersion += 1;
      liveUpdatedAt = new Date().toISOString();
      liveState = state;
    }else if(!liveState){
      liveState = state; liveUpdatedAt = new Date().toISOString(); liveVersion = liveVersion||1;
    }
    lastSync = { ok:true, at:new Date().toISOString(), rows:rowsLen, error:null, source:lastSync.source };
  }catch(e){
    lastSync = { ok:false, at:new Date().toISOString(), rows:lastSync.rows||0, error:e.message||String(e), source:lastSync.source };
    if(!liveState){ // أول إقلاع فشل: اعرض بيانات القالب المرفقة حتى تكون اللوحة كاملة فورًا
      setStateFromItems(fallbackItems());
    }
    console.error("[sheet-sync] فشل السحب:", e.message);
  }
}

/* ============ أدوات HTTP + رؤوس الأمان ============ */
function securityHeaders(req,res){
  // سياسة أمان المحتوى: تمنع تحميل سكربتات/موارد خارجية، وتمنع التأطير (clickjacking)،
  // وتقصر الاتصالات على نفس الأصل (يمنع تسريب البيانات حتى لو وُجد XSS).
  res.setHeader("Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; " +   // hls.js لتشغيل البث المباشر
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "media-src 'self' blob: https:; " +       // مشغّل الفيديو/البث المباشر (HLS)
    "connect-src 'self' https:; " +            // جلب مقاطع البث (HLS) من مصدر القناة
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com; " +
    "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("X-Frame-Options","DENY");
  res.setHeader("Referrer-Policy","no-referrer");
  res.setHeader("Permissions-Policy","geolocation=(), microphone=(), camera=(), payment=()");
  res.setHeader("Cross-Origin-Opener-Policy","same-origin");
  res.setHeader("Cross-Origin-Resource-Policy","same-origin");
  if(isHttps(req)) res.setHeader("Strict-Transport-Security","max-age=31536000; includeSubDomains");
}
function sessionCookie(req,sid,clear){
  const parts=[`kag_session=${clear?"":encodeURIComponent(sid)}`,"HttpOnly","SameSite=Lax","Path=/"];
  if(isHttps(req)) parts.push("Secure");
  parts.push(clear?"Max-Age=0":`Max-Age=${Math.floor(SESSION_TTL_MS/1000)}`);
  return parts.join("; ");
}
function sendJson(res,status,obj){
  const body=JSON.stringify(obj);
  res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});
  res.end(body);
}
function readBody(req){
  return new Promise((resolve,reject)=>{
    let data="";
    req.on("data",ch=>{ data+=ch; if(data.length>1024*1024){reject(new Error("Request too large"));req.destroy();} });
    req.on("end",()=>resolve(data));
    req.on("error",reject);
  });
}
function getCookie(req,name){
  const cookie=req.headers.cookie||"";
  return cookie.split(";").map(s=>s.trim()).reduce((acc,part)=>{
    const idx=part.indexOf("="); if(idx>-1) acc[part.slice(0,idx)]=decodeURIComponent(part.slice(idx+1)); return acc;
  },{})[name];
}
function isAuthed(req){
  const sid=getCookie(req,"kag_session");
  if(!sid||!sessions.has(sid)) return false;
  const s=sessions.get(sid);
  if(Date.now()>s.exp){ sessions.delete(sid); return false; }
  return true;
}
function isAdmin(req){
  if(!REQUIRE_LOGIN) return true; // وضع الاختبار: السماح بإجراءات الأدمن عند تعطيل تسجيل الدخول صراحة
  const sid=getCookie(req,"kag_session");
  if(!sid||!sessions.has(sid)) return false;
  const s=sessions.get(sid);
  if(Date.now()>s.exp){ sessions.delete(sid); return false; }
  return s.role==="admin";
}
function currentSession(req){
  if(!REQUIRE_LOGIN) return {role:"admin", username:"local-dev", name:"وضع التطوير", exp:Date.now()+SESSION_TTL_MS};
  const sid=getCookie(req,"kag_session");
  if(!sid||!sessions.has(sid)) return null;
  const s=sessions.get(sid);
  if(Date.now()>s.exp){ sessions.delete(sid); return null; }
  return s;
}
function isTrackManager(req){ const s=currentSession(req); return !!(s && s.role==="track-manager" && VALID_TRACKS.includes(s.trackId)); }
function allowedTracks(req){
  const s=currentSession(req);
  if(!s) return [];
  if(s.role==="admin" || s.role==="viewer") return VALID_TRACKS.slice();
  if(s.role==="track-manager" && VALID_TRACKS.includes(s.trackId)) return [s.trackId];
  return [];
}
function trackNameById(id){ const t=TRACK_CONFIG.find(x=>x.id===id); return t?t.name:String(id||""); }
function trackIdByName(name){ const t=TRACK_CONFIG.find(x=>x.name===name || x.ar===name || x.lead===name); return t?t.id:normalizeTrack(name); }
function filterStateForUser(req, st){
  if(!st || isAdmin(req)) return st;
  const allowed = new Set(allowedTracks(req));
  if(!allowed.size || allowed.size===VALID_TRACKS.length) return st;
  return Object.assign({}, st, {
    tracks:(st.tracks||[]).filter(t=>allowed.has(t.id)),
    items:(st.items||[]).filter(i=>allowed.has(normalizeTrack(i.track)))
  });
}
function filterNotificationsForUser(req, notifications){
  if(isAdmin(req)) return notifications;
  const allowed = new Set(allowedTracks(req));
  if(!allowed.size || allowed.size===VALID_TRACKS.length) return notifications;
  return (notifications||[]).filter(n => (n.recipients||[]).some(r=>allowed.has(normalizeTrack(r))));
}
function itemBelongsToUser(req, item){
  if(isAdmin(req)) return true;
  const allowed = new Set(allowedTracks(req));
  if(!allowed.size || allowed.size===VALID_TRACKS.length) return true;
  const id = normalizeTrack(item.trackId || trackIdByName(item.track || item.owner || ""));
  return allowed.has(id);
}
function filterManagementForUser(req, management){
  if(!management || isAdmin(req)) return management;
  const allowed = new Set(allowedTracks(req));
  if(!allowed.size || allowed.size===VALID_TRACKS.length) return management;
  const clone = Object.assign({}, management);
  for(const key of ["actions","approvals","changes","meetings","zones","fieldEvidence"]){
    if(Array.isArray(clone[key])) clone[key] = clone[key].filter(item=>itemBelongsToUser(req,item));
  }
  return clone;
}
function sessionInfo(req){
  const s=currentSession(req);
  if(!s) return {authenticated:false, role:"guest", username:"", name:"زائر", permissions:[], allowedTracks:[]};
  const permissions = s.role==="admin"
    ? ["read","write","notify","approve","audit","report","admin","all-tracks"]
    : s.role==="track-manager"
      ? (s.permissions || ["read","write:own-track","notify:view","report:view","evidence:update"])
      : ["read","comment","report:view"];
  return {authenticated:true, role:s.role, username:s.username||"", name:s.name||s.username||s.role, trackId:s.trackId||"", allowedTracks:allowedTracks(req), permissions};
}
function canWrite(req){ return isAdmin(req) || isTrackManager(req); }
function canApprove(req){ return isAdmin(req) || isTrackManager(req); }
// نسخة عامة من حالة المزامنة بدون تفاصيل داخلية حساسة
function publicSync(){
  return { ok:lastSync.ok, at:lastSync.at, rows:lastSync.rows, source:lastSync.source,
           error: lastSync.error ? "تعذّر سحب البيانات من المصدر" : null };
}



/* ============ سجل التدقيق والصلاحيات ============ */
function loadAuditLog(){
  try{
    if(fs.existsSync(AUDIT_STORE)){
      const parsed = JSON.parse(fs.readFileSync(AUDIT_STORE,"utf8"));
      return Array.isArray(parsed.events) ? parsed.events : [];
    }
  }catch(e){ console.warn("تعذر قراءة سجل التدقيق:", e.message); }
  return [];
}
function saveAuditLog(events){
  try{ fs.writeFileSync(AUDIT_STORE, JSON.stringify({updatedAt:new Date().toISOString(), events:events.slice(-1200)}, null, 2), "utf8"); }
  catch(e){ console.warn("تعذر حفظ سجل التدقيق:", e.message); }
}
function addAudit(req, action, entity, details){
  const info=sessionInfo(req);
  const events=loadAuditLog();
  events.push({id:crypto.randomUUID?crypto.randomUUID():crypto.randomBytes(16).toString("hex"), at:new Date().toISOString(), role:info.role, action:sanitizeText(action,100), entity:sanitizeText(entity,100), ip:clientIp(req), details:details||{}});
  saveAuditLog(events);
}
function makeActionFromNotification(notification){
  const firstRecipient = notification.recipients && notification.recipients[0];
  const t = TRACK_CONFIG.find(x=>x.id===firstRecipient);
  return {
    id:`N-${notification.id}`,
    sourceNotificationId:notification.id,
    title:notification.title,
    description:notification.message,
    track:t?t.name:trackLabelById(firstRecipient),
    owner:t?t.lead:"مدير المسار",
    priority:notification.priority,
    due:String(notification.dueAt||"").slice(0,10) || addDaysIso(1),
    status:"جديد",
    evidenceRequired:notification.actionType!=="متابعة",
    createdAt:new Date().toISOString(),
    channels:notification.channels,
    closureNote:"",
    evidenceUrl:""
  };
}
function updateItemById(list, id, patch){
  const idx=(list||[]).findIndex(x=>String(x.id)===String(id));
  if(idx<0) return null;
  list[idx]=Object.assign({}, list[idx], patch, {updatedAt:new Date().toISOString()});
  return list[idx];
}

/* ============ مركز الإشعارات ============ */
function loadNotificationsStore(){
  try{
    if(fs.existsSync(NOTIFICATION_STORE)){
      const parsed = JSON.parse(fs.readFileSync(NOTIFICATION_STORE, "utf8"));
      return Array.isArray(parsed.notifications) ? parsed.notifications : [];
    }
  }catch(e){ console.warn("تعذر قراءة سجل الإشعارات:", e.message); }
  return [];
}
function saveNotificationsStore(notifications){
  try{
    fs.writeFileSync(NOTIFICATION_STORE, JSON.stringify({updatedAt:new Date().toISOString(), notifications}, null, 2), "utf8");
  }catch(e){ console.warn("تعذر حفظ سجل الإشعارات:", e.message); }
}
function trackLabelById(id){
  const t = TRACK_CONFIG.find(x=>x.id===id);
  return t ? `${t.name} — ${t.lead}` : String(id || "غير محدد");
}
function validPriority(v){ return ["حرجة","عالية","متوسطة","منخفضة"].includes(v) ? v : "متوسطة"; }
function validActionType(v){ return ["تسليم","تحديث","قرار","متابعة"].includes(v) ? v : "تحديث"; }
function validChannels(v){
  const allowed = new Set(["inApp","email","whatsapp","webhook"]);
  const arr = Array.isArray(v) ? v.filter(x=>allowed.has(String(x))) : ["inApp"];
  return Array.from(new Set(arr.length ? arr : ["inApp"]));
}
function contactForTrack(trackId){
  const c = TRACK_CONTACTS[String(trackId)] || {};
  return { trackId:String(trackId), label:trackLabelById(trackId), email:String(c.email||""), whatsapp:String(c.whatsapp||c.phone||"") };
}
function splitList(v){ return String(v||"").split(/[،,;\n]+/).map(x=>x.trim()).filter(Boolean).slice(0,50); }
async function postJson(url, payload, channel){
  try{
    const r = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload)});
    return {channel, ok:r.ok, status:r.status, at:new Date().toISOString()};
  }catch(e){ return {channel, ok:false, error:"تعذر الإرسال", at:new Date().toISOString()}; }
}
async function deliverNotification(notification){
  const channels = validChannels(notification.channels);
  const contacts = notification.recipients.map(contactForTrack);
  const delivery = [{channel:"داخل النظام", ok:true, at:new Date().toISOString()}];
  if(channels.includes("email")){
    const emailRecipients = contacts.map(c=>c.email).filter(Boolean).concat(notification.extraEmails||[]);
    if(EMAIL_WEBHOOK_URL){
      delivery.push(await postJson(EMAIL_WEBHOOK_URL, {source:"KAG", type:"email", fromName:EMAIL_FROM_NAME, recipients:emailRecipients, contacts, notification}, "البريد الإلكتروني"));
    }else{
      delivery.push({channel:"البريد الإلكتروني", ok:false, skipped:true, reason:"لم يتم ضبط EMAIL_WEBHOOK_URL", recipients:emailRecipients.length, at:new Date().toISOString()});
    }
  }
  if(channels.includes("whatsapp")){
    const whatsappRecipients = contacts.map(c=>c.whatsapp).filter(Boolean).concat(notification.extraWhatsApp||[]);
    if(WHATSAPP_WEBHOOK_URL){
      delivery.push(await postJson(WHATSAPP_WEBHOOK_URL, {source:"KAG", type:"whatsapp", recipients:whatsappRecipients, contacts, notification}, "واتساب"));
    }else{
      delivery.push({channel:"واتساب", ok:false, skipped:true, reason:"لم يتم ضبط WHATSAPP_WEBHOOK_URL", recipients:whatsappRecipients.length, at:new Date().toISOString()});
    }
  }
  if(channels.includes("webhook")){
    if(NOTIFICATION_WEBHOOK_URL){
      delivery.push(await postJson(NOTIFICATION_WEBHOOK_URL, {source:"KAG", type:"general-webhook", notification}, "Webhook"));
    }else{
      delivery.push({channel:"Webhook", ok:false, skipped:true, reason:"لم يتم ضبط NOTIFICATION_WEBHOOK_URL", at:new Date().toISOString()});
    }
  }
  delivery.push({channel:"سجل المتابعة", ok:true, at:new Date().toISOString()});
  return delivery;
}
function sanitizeText(v, max=1200){
  return String(v || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0,max);
}


/* ============ مراكز الإدارة التشغيلية المتقدمة ============ */
function addDaysIso(days){ const d=new Date(); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }
function seedManagementStore(){
  const tracks = TRACK_CONFIG;
  return {
    updatedAt:new Date().toISOString(),
    actions: tracks.flatMap((t,i)=>[
      {id:`A-${t.id}-1`, title:`إغلاق تحديث ${t.name}`, track:t.name, owner:t.lead, priority:i%3===0?"حرجة":i%3===1?"عالية":"متوسطة", due:addDaysIso(i-1), status:i%4===0?"متأخر":i%4===1?"قيد العمل":"جديد", evidenceRequired:true},
      {id:`A-${t.id}-2`, title:`رفع دليل جاهزية ${t.name}`, track:t.name, owner:t.lead, priority:"متوسطة", due:addDaysIso(i+2), status:i%2?"قيد العمل":"جديد", evidenceRequired:true}
    ]),
    approvals: tracks.map((t,i)=>({id:`AP-${t.id}`, title:`اعتماد حزمة ${t.name}`, type:i%2?"اعتماد خطة":"اعتماد مورد/تصريح", owner:t.lead, track:t.name, due:addDaysIso(i+1), impact:i<2?"مرتفع":"متوسط", status:i%3===0?"متأخر":"قيد الاعتماد"})),
    changes:[
      {id:"CH-01",title:"تعديل نطاق جاهزية نقطة تشغيل",track:"التشغيل",time:"متوسط",cost:"منخفض",quality:"متوسط",risk:"مرتفع",status:"قيد الدراسة"},
      {id:"CH-02",title:"زيادة فرق النظافة في أوقات الذروة",track:"التجربة",time:"منخفض",cost:"متوسط",quality:"مرتفع",risk:"منخفض",status:"مقبول مشروط"},
      {id:"CH-03",title:"تغيير مورد دعم ميداني احتياطي",track:"الموردين",time:"متوسط",cost:"متوسط",quality:"متوسط",risk:"متوسط",status:"يحتاج اعتماد"}
    ],
    meetings:[
      {id:"M-01",title:"اجتماع تشغيل يومي",date:addDaysIso(0),attendees:8,decisions:4,actions:6,status:"مخرجات مفتوحة"},
      {id:"M-02",title:"مراجعة السلامة والتصاريح",date:addDaysIso(1),attendees:6,decisions:3,actions:5,status:"يتطلب متابعة"},
      {id:"M-03",title:"جلسة الموردين الحرجة",date:addDaysIso(2),attendees:7,decisions:2,actions:4,status:"مجدول"}
    ],
    zones:["البوابات","المواقف","الممرات","مناطق الضيافة","دورات المياه","نقاط الإسعاف","غرف التشغيل","الساحات الخارجية"].map((z,i)=>({zone:z,operations:92-i*3,safety:88-i*2,cleaning:85+i%3*3,experience:90-i,open:i%4+1,status:i<2?"جاهزة":i<5?"جاهزة بشروط":"تحتاج متابعة"})),
    fieldEvidence:["قبل/بعد تجهيز البوابة","إغلاق ملاحظة سلامة","اختبار إنارة المسار","جاهزية نقطة إسعاف","نظافة منطقة الضيافة","تقدم أعمال المورد"].map((x,i)=>({id:`FE-${i+1}`,title:x,type:i%2?"صورة إغلاق":"صورة تقدم",track:tracks[i%tracks.length].name,zone:["البوابات","الممرات","الضيافة","الإسعاف"][i%4],date:addDaysIso(-i),status:i%3?"معتمد":"بانتظار مراجعة"}))
  };
}
function loadManagementStore(){
  try{
    if(fs.existsSync(MANAGEMENT_STORE)){
      const parsed=JSON.parse(fs.readFileSync(MANAGEMENT_STORE,"utf8"));
      if(parsed && typeof parsed==="object") return Object.assign(seedManagementStore(), parsed);
    }
  }catch(e){ console.warn("تعذر قراءة سجل مراكز الإدارة:", e.message); }
  return seedManagementStore();
}
function saveManagementStore(management){
  try{ fs.writeFileSync(MANAGEMENT_STORE, JSON.stringify(Object.assign({}, management, {updatedAt:new Date().toISOString()}), null, 2), "utf8"); }
  catch(e){ console.warn("تعذر حفظ سجل مراكز الإدارة:", e.message); }
}
function computeDataQuality(req){
  const st = filterStateForUser(req, liveState || buildState(fallbackItems()));
  const management = filterManagementForUser(req, loadManagementStore());
  const notifications = filterNotificationsForUser(req, loadNotificationsStore());
  const findings=[];
  const actions = management.actions || [];
  const approvals = management.approvals || [];
  const items = st.items || [];
  const today = new Date(); today.setHours(0,0,0,0);
  const missingOwner = actions.filter(a=>!a.owner).length + items.filter(i=>!i.owner).length;
  const missingDue = actions.filter(a=>!a.due).length + approvals.filter(a=>!a.due).length + items.filter(i=>!i.due).length;
  const overdueActions = actions.filter(a=>a.due && Date.parse(a.due)<today.getTime() && !/مغلق|مكتمل|معتمد/.test(a.status||"")).length;
  const noEvidenceClosed = actions.filter(a=>/مغلق|مكتمل/.test(a.status||"") && a.evidenceRequired && !a.evidenceUrl).length;
  const risksWithoutAction = items.filter(i=>normalizeType(i.type)==="risks" && !i.owner).length;
  const staleSync = lastSync.at ? ((Date.now()-Date.parse(lastSync.at))/3600000>24) : true;
  if(missingOwner) findings.push({type:"مالك ناقص", count:missingOwner, severity:"عالية", recommendation:"تحديد مالك لكل مهمة ومخاطرة قبل اعتماد التقارير."});
  if(missingDue) findings.push({type:"موعد ناقص", count:missingDue, severity:"متوسطة", recommendation:"تحديد موعد لكل مهمة واعتماد وقرار."});
  if(overdueActions) findings.push({type:"مهام متأخرة", count:overdueActions, severity:"حرجة", recommendation:"تفعيل التصعيد وربط كل مهمة متأخرة بتحديث أو دليل."});
  if(noEvidenceClosed) findings.push({type:"إغلاقات بدون دليل", count:noEvidenceClosed, severity:"عالية", recommendation:"منع اعتماد الإغلاق بدون رابط دليل أو مرفق."});
  if(risksWithoutAction) findings.push({type:"مخاطر بلا مالك", count:risksWithoutAction, severity:"حرجة", recommendation:"ربط كل مخاطرة بمالك وإجراء معالجة."});
  if(staleSync) findings.push({type:"مزامنة قديمة", count:1, severity:"متوسطة", recommendation:"مراجعة اتصال Google Sheet أو تنفيذ تحديث يدوي."});
  const penalty = findings.reduce((sum,f)=>sum + f.count * (f.severity==="حرجة"?9:f.severity==="عالية"?6:3), 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));
  return {ok:true, score, grade:score>=90?"موثوقة":score>=75?"قابلة للاعتماد مع ملاحظات":score>=60?"تحتاج تنظيف":"غير جاهزة للاعتماد", findings, counts:{actions:actions.length, approvals:approvals.length, notifications:notifications.length, items:items.length}, sync:publicSync(), generatedAt:new Date().toISOString()};
}
function computeOperationalSummary(req){
  const management = filterManagementForUser(req, loadManagementStore());
  const st = filterStateForUser(req, liveState || buildState(fallbackItems()));
  const quality = computeDataQuality(req);
  const actions = management.actions||[];
  const approvals = management.approvals||[];
  const openActions = actions.filter(a=>!/مغلق|مكتمل/.test(a.status||""));
  const overdue = openActions.filter(a=>a.due && Date.parse(a.due)<Date.now());
  const critical = openActions.filter(a=>a.priority==="حرجة");
  const pendingApprovals = approvals.filter(a=>!/معتمد|مغلق/.test(a.status||""));
  const tracks = st.tracks || [];
  const avgProgress = tracks.length ? Math.round(tracks.reduce((s,t)=>s+Number(t.progress||0),0)/tracks.length) : 0;
  const recommendation = critical.length || overdue.length
    ? "يوصى بعقد مراجعة تشغيلية قصيرة اليوم لإغلاق المهام الحرجة والمتأخرة قبل تحديث التقرير القادم."
    : pendingApprovals.length
      ? "الوضع مستقر تشغيليًا، مع الحاجة إلى تسريع الاعتمادات المفتوحة."
      : "الوضع مستقر وجاهز للاستمرار وفق دورة المتابعة الحالية.";
  return {ok:true, generatedAt:new Date().toISOString(), avgProgress, dataQuality:quality.score, openActions:openActions.length, overdue:overdue.length, critical:critical.length, pendingApprovals:pendingApprovals.length, recommendation, nextActions:openActions.slice(0,8).map(a=>({id:a.id,title:a.title,owner:a.owner,track:a.track,priority:a.priority,due:a.due,status:a.status}))};
}
function normalizeManagementItem(section, body){
  const common={id: crypto.randomUUID?crypto.randomUUID():crypto.randomBytes(16).toString("hex"), createdAt:new Date().toISOString()};
  if(section==="actions") return Object.assign(common,{title:sanitizeText(body.title,180), track:sanitizeText(body.track,80), owner:sanitizeText(body.owner,100), priority:validPriority(body.priority), due:sanitizeText(body.due,30), status:sanitizeText(body.status||"جديد",40), evidenceRequired:!!body.evidenceRequired});
  if(section==="approvals") return Object.assign(common,{title:sanitizeText(body.title,180), type:sanitizeText(body.type,80), track:sanitizeText(body.track,80), owner:sanitizeText(body.owner,100), due:sanitizeText(body.due,30), impact:sanitizeText(body.impact||"متوسط",40), status:sanitizeText(body.status||"قيد الاعتماد",40)});
  if(section==="changes") return Object.assign(common,{title:sanitizeText(body.title,180), track:sanitizeText(body.track,80), time:sanitizeText(body.time||"متوسط",40), cost:sanitizeText(body.cost||"متوسط",40), quality:sanitizeText(body.quality||"متوسط",40), risk:sanitizeText(body.risk||"متوسط",40), status:sanitizeText(body.status||"قيد الدراسة",40)});
  if(section==="meetings") return Object.assign(common,{title:sanitizeText(body.title,180), date:sanitizeText(body.date||addDaysIso(0),30), attendees:Number(body.attendees||0), decisions:Number(body.decisions||0), actions:Number(body.actions||0), status:sanitizeText(body.status||"مخرجات مفتوحة",60)});
  if(section==="zones") return Object.assign(common,{zone:sanitizeText(body.zone,100), operations:Number(body.operations||0), safety:Number(body.safety||0), cleaning:Number(body.cleaning||0), experience:Number(body.experience||0), open:Number(body.open||0), status:sanitizeText(body.status||"تحتاج متابعة",60)});
  if(section==="fieldEvidence") return Object.assign(common,{title:sanitizeText(body.title,180), type:sanitizeText(body.type||"دليل ميداني",80), track:sanitizeText(body.track,80), zone:sanitizeText(body.zone,80), date:sanitizeText(body.date||addDaysIso(0),30), status:sanitizeText(body.status||"بانتظار مراجعة",60), evidenceUrl:sanitizeText(body.evidenceUrl||"",500)});
  return Object.assign(common, body||{});
}


/* ============ مركز جاهزية النشر والتشغيل + النسخ والتصدير ============ */
function csvEscape(v){
  const x = String(v==null?"":v);
  return /[",\n\r]/.test(x) ? '"' + x.replace(/"/g,'""') + '"' : x;
}
function toCsv(rows, columns){
  const header = columns.map(c=>csvEscape(c.label)).join(',');
  const body = (rows||[]).map(row => columns.map(c=>csvEscape(typeof c.value === 'function' ? c.value(row) : row[c.key])).join(',')).join('\n');
  return '\ufeff' + header + (body ? '\n' + body : '');
}
function sendText(res,status,text,type="text/plain; charset=utf-8",headers={}){
  res.writeHead(status, Object.assign({"Content-Type":type,"Cache-Control":"no-store"}, headers));
  return res.end(text);
}

function reportContentType(format){
  return format === "pdf"
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.presentationml.presentation";
}
function normalizeReportFormat(v){
  const x = String(v || "pdf").toLowerCase().trim();
  if(["ppt","pptx","powerpoint"].includes(x)) return "pptx";
  return "pdf";
}
function asciiReportName(reportType, format){
  const safeNames = {"comprehensive":"Comprehensive","أ":"TrackA","ب":"TrackB","ج":"TrackC","د":"TrackD","daily_ops":"DailyOps","executive":"Executive","approvals":"Approvals","evidence":"Evidence"};
  const safeName  = safeNames[reportType] || "Report";
  const dateStr   = new Date().toISOString().slice(0,10);
  return `KAGA-Report-${safeName}-${dateStr}.${format}`;
}
function composeReportState(req){
  const base = JSON.parse(JSON.stringify(filterStateForUser(req, liveState || buildState(fallbackItems())) || {}));
  const management = filterManagementForUser(req, loadManagementStore());
  const notifications = filterNotificationsForUser(req, loadNotificationsStore());
  const auditLog = isAdmin(req) ? loadAuditLog().slice(-80) : [];
  base.management = management;
  base.notifications = notifications;
  base.auditLog = auditLog;
  base.dataQuality = computeDataQuality(req);
  base.operationalSummary = computeOperationalSummary(req);
  return base;
}
// ═══════════════════════════════════════════════════════════════
// محرك PPTX/PDF — pptxgenjs (Node.js) — بدون Python
// يعمل على Render Free Plan بدون أي تبعيات خارجية
// ═══════════════════════════════════════════════════════════════
async function generateNodeReport(reportType, format, state){
  const PptxGenJS = require("pptxgenjs");
  const prs = new PptxGenJS();
  prs.layout = "LAYOUT_WIDE";

  const C = {
    bg:"0D1B2A", gold:"C9A84C", white:"EAF0F7", muted:"7A9BB5",
    green:"27AE60", red:"E74C3C", amber:"F39C12", blue:"2979FF",
    line:"1E3A5F", rowA:"0F2035", rowB:"162A3D", header:"0A1628",
    greenBg:"1A3A2A", redBg:"3A1A1A", amberBg:"3A2E0A",
  };

  const tracks  = state.tracks  || [];
  const items   = state.items   || [];
  const today   = new Date().toISOString().slice(0,10);
  const weekNum = Math.ceil((Date.now() - new Date(new Date().getFullYear(),0,1)) / 604800000);
  const overall = tracks.length ? Math.round(tracks.reduce((a,t)=>a+(t.progress||0),0)/tracks.length) : 0;

  const isDone   = i => /مكتملة|مكتمل|معتمدة|معتمد|Completed/i.test(i.status||"");
  const isRisk   = i => /خطر|معرض|متأخر|حرج/i.test(i.status||"") || i.type==="risks";
  const isActive = i => /قيد|تحت|نشط/i.test(i.status||"");
  const fmtD     = d => { try{ return d?new Date(String(d).slice(0,10)).toLocaleDateString("ar-SA"):"—"; }catch{ return d||"—"; } };
  const clip     = (s,n=55) => String(s||"—").slice(0,n);

  const risks     = items.filter(isRisk);
  const critical  = risks.filter(r=>/خطر|حرج|معرضة/i.test(r.status||""));
  const doneItems = items.filter(isDone);
  const actItems  = items.filter(isActive);
  const overdue   = items.filter(i=>!isDone(i)&&i.due&&i.due<today);

  // ── إضافة مستطيل خلفية ──
  function bg(s){ s.addShape(prs.ShapeType.rect,{x:0,y:0,w:"100%",h:"100%",fill:{color:C.bg}}); }

  // ── شريط العنوان ──
  function addHeader(s, title, sub){
    s.addShape(prs.ShapeType.rect,{x:0,y:0,w:"100%",h:0.07,fill:{color:C.gold}});
    s.addShape(prs.ShapeType.rect,{x:0,y:0.07,w:"100%",h:1.1,fill:{color:C.header}});
    s.addText(title,{x:0.35,y:0.12,w:12.6,h:0.62,
      fontSize:24,bold:true,color:C.gold,fontFace:"Arial",align:"right",valign:"middle"});
    if(sub) s.addText(sub,{x:0.35,y:0.74,w:12.6,h:0.34,
      fontSize:11,color:C.muted,fontFace:"Arial",align:"right",valign:"middle"});
    s.addShape(prs.ShapeType.line,{x:0.35,y:1.17,w:12.6,h:0,line:{color:C.line,width:1}});
  }

  // ── صف KPI ──
  function addKpis(s, kpis, top=1.3){
    const w=(13.33-0.7)/kpis.length;
    kpis.forEach((k,i)=>{
      const x=0.35+i*w;
      s.addShape(prs.ShapeType.rect,{x:x+0.05,y:top,w:w-0.1,h:0.82,fill:{color:C.rowA},line:{color:C.line,width:0.8}});
      s.addText(String(k.v),{x:x+0.08,y:top+0.03,w:w-0.16,h:0.44,
        fontSize:20,bold:true,color:k.c||C.blue,fontFace:"Arial",align:"center",valign:"middle"});
      s.addText(k.l,{x:x+0.08,y:top+0.49,w:w-0.16,h:0.26,
        fontSize:9,color:C.muted,fontFace:"Arial",align:"center",valign:"top"});
    });
  }

  // ── جدول بيانات ──
  function addTable(s, headers, rows, top, colW){
    const nC = headers.length;
    const autoW = (13.33-0.7)/nC;
    const ww = colW || headers.map(()=>autoW);
    // رأس
    let x=0.35;
    headers.forEach((h,i)=>{
      s.addShape(prs.ShapeType.rect,{x,y:top,w:ww[i],h:0.30,fill:{color:C.gold},line:{color:C.gold,width:0}});
      s.addText(h,{x:x+0.03,y:top,w:ww[i]-0.06,h:0.30,
        fontSize:9.5,bold:true,color:C.header,fontFace:"Arial",align:"center",valign:"middle"});
      x+=ww[i];
    });
    const show = rows.length ? rows : [headers.map(()=>"—")];
    show.slice(0,12).forEach((row,ri)=>{
      const rbg = ri%2===0?C.rowA:C.rowB;
      let cx=0.35;
      row.forEach((cell,ci)=>{
        s.addShape(prs.ShapeType.rect,{x:cx,y:top+0.30+ri*0.295,w:ww[ci],h:0.295,fill:{color:rbg},line:{color:C.line,width:0.5}});
        s.addText(clip(cell,ci===0?52:40),{x:cx+0.04,y:top+0.30+ri*0.295,w:ww[ci]-0.08,h:0.295,
          fontSize:9,color:C.white,fontFace:"Arial",align:"right",valign:"middle"});
        cx+=ww[ci];
      });
    });
  }

  // ── تسمية قسم ──
  function secLabel(s,t,top){
    s.addShape(prs.ShapeType.rect,{x:0.35,y:top,w:12.63,h:0.26,fill:{color:C.rowA},line:{color:C.gold,width:0.8}});
    s.addText(t,{x:0.45,y:top,w:12.43,h:0.26,fontSize:10,bold:true,color:C.gold,fontFace:"Arial",align:"right",valign:"middle"});
  }

  // ── تذييل ──
  function footer(s){
    s.addShape(prs.ShapeType.rect,{x:0,y:7.26,w:"100%",h:0.24,fill:{color:C.header}});
    s.addText(`حدائق الملك عبدالله 2026  |  ${today}  |  سري — للاستخدام الداخلي فقط`,
      {x:0.35,y:7.26,w:12.63,h:0.24,fontSize:8,color:C.muted,fontFace:"Arial",align:"center"});
  }

  // ══ شريحة الغلاف ══
  function coverSlide(titleTxt, sub){
    const s=prs.addSlide();
    bg(s);
    s.addShape(prs.ShapeType.rect,{x:0,y:0,w:0.14,h:"100%",fill:{color:C.gold}});
    s.addShape(prs.ShapeType.rect,{x:0.14,y:2.65,w:13.19,h:0.05,fill:{color:C.gold}});
    s.addText("حدائق الملك عبدالله",      {x:0.55,y:0.8,  w:12.4,h:0.75,fontSize:34,bold:true, color:C.gold, fontFace:"Arial",align:"right"});
    s.addText("King Abdullah Gardens 2026",{x:0.55,y:1.55, w:12.4,h:0.42,fontSize:16,color:C.muted,fontFace:"Arial",align:"right"});
    s.addText(titleTxt,                    {x:0.55,y:2.78, w:12.4,h:0.65,fontSize:24,bold:true, color:C.white,fontFace:"Arial",align:"right"});
    s.addText(sub||"",                     {x:0.55,y:3.48, w:12.4,h:0.4, fontSize:13,color:C.muted, fontFace:"Arial",align:"right"});
    const colorO = overall>=70?C.green:overall>=45?C.amber:C.red;
    s.addShape(prs.ShapeType.rect,{x:0.55,y:4.1,w:2.4,h:0.7,fill:{color:C.rowA},line:{color:C.line,width:1}});
    s.addText(`${overall}%`,{x:0.55,y:4.12,w:2.4,h:0.36,fontSize:22,bold:true,color:colorO,fontFace:"Arial",align:"center"});
    s.addText("الإنجاز العام",{x:0.55,y:4.5,w:2.4,h:0.26,fontSize:10,color:C.muted,fontFace:"Arial",align:"center"});
    s.addShape(prs.ShapeType.rect,{x:3.15,y:4.1,w:2.4,h:0.7,fill:{color:C.rowA},line:{color:C.line,width:1}});
    s.addText(String(critical.length),{x:3.15,y:4.12,w:2.4,h:0.36,fontSize:22,bold:true,color:C.red,fontFace:"Arial",align:"center"});
    s.addText("مخاطر حرجة",{x:3.15,y:4.5,w:2.4,h:0.26,fontSize:10,color:C.muted,fontFace:"Arial",align:"center"});
    s.addShape(prs.ShapeType.rect,{x:5.75,y:4.1,w:2.4,h:0.7,fill:{color:C.rowA},line:{color:C.line,width:1}});
    s.addText(String(tracks.length),{x:5.75,y:4.12,w:2.4,h:0.36,fontSize:22,bold:true,color:C.blue,fontFace:"Arial",align:"center"});
    s.addText("المسارات",{x:5.75,y:4.5,w:2.4,h:0.26,fontSize:10,color:C.muted,fontFace:"Arial",align:"center"});
    s.addShape(prs.ShapeType.rect,{x:8.35,y:4.1,w:2.4,h:0.7,fill:{color:C.rowA},line:{color:C.line,width:1}});
    s.addText(String(items.length),{x:8.35,y:4.12,w:2.4,h:0.36,fontSize:22,bold:true,color:C.white,fontFace:"Arial",align:"center"});
    s.addText("إجمالي العناصر",{x:8.35,y:4.5,w:2.4,h:0.26,fontSize:10,color:C.muted,fontFace:"Arial",align:"center"});
    s.addText(`التاريخ: ${today}  |  الأسبوع: ${weekNum}  |  أُعدّ تلقائياً من بيانات المنصة`,
      {x:0.55,y:6.7,w:12.4,h:0.3,fontSize:10,color:C.muted,fontFace:"Arial",align:"right"});
    footer(s);
  }

  // ══ ملخص المؤشرات ══
  function summarySlide(){
    const s=prs.addSlide(); bg(s);
    addHeader(s,"ملخص المؤشرات التنفيذية",
      `الإنجاز: ${overall}%  |  المسارات: ${tracks.length}  |  المهام: ${items.length}  |  المخاطر: ${risks.length}`);
    addKpis(s,[
      {l:"الإنجاز العام",    v:overall+"%",            c:overall>=70?C.green:overall>=45?C.amber:C.red},
      {l:"مهام منجزة",       v:doneItems.length,        c:C.green},
      {l:"قيد التنفيذ",      v:actItems.length,         c:C.amber},
      {l:"متأخرة",           v:overdue.length,          c:C.red},
      {l:"مخاطر كلية",      v:risks.length,            c:C.amber},
      {l:"مخاطر حرجة",      v:critical.length,         c:C.red},
    ],1.3);
    secLabel(s,"أداء المسارات",2.25);
    addTable(s,
      ["المسار","الاسم","الإنجاز%","المخطط%","مهام","منجز","نشط","مخاطر","الحالة","المالك"],
      tracks.map(t=>[t.id||"",t.name||"",`${t.progress||0}%`,`${t.planned||80}%`,
        t.tasks||0,t.done||0,t.active||0,t.risk||0,t.status||"—",t.lead||"—"]),
      2.52,[0.45,1.85,0.75,0.75,0.65,0.65,0.65,0.65,1.55,1.6]
    );
    footer(s);
  }

  // ══ شريحة المخاطر ══
  function risksSlide(){
    const s=prs.addSlide(); bg(s);
    addHeader(s,"المخاطر والقرارات",`مخاطر مفتوحة: ${risks.length}  |  حرجة: ${critical.length}  |  متأخرة: ${overdue.length}`);
    addKpis(s,[
      {l:"مخاطر مفتوحة",    v:risks.length,    c:C.amber},
      {l:"حرجة",             v:critical.length, c:C.red},
      {l:"تحت المتابعة",    v:risks.filter(r=>/متابعة|قيد/.test(r.status||"")).length, c:C.amber},
      {l:"مهام متأخرة",     v:overdue.length,  c:C.red},
    ],1.3);
    secLabel(s,"سجل المخاطر",2.25);
    addTable(s,
      ["المخاطرة","المسار","المالك","الحالة","الموعد"],
      risks.length
        ? risks.map(r=>[clip(r.title),r.track||"",r.owner||"—",r.status||"—",fmtD(r.due)])
        : [["لا توجد مخاطر مفتوحة","","","",""]],
      2.52,[4.2,1.5,1.9,1.75,1.4]
    );
    footer(s);
  }

  // ══ شريحة المهام ══
  function actionsSlide(trackId=null){
    const s=prs.addSlide(); bg(s);
    const src = trackId
      ? items.filter(i=>(i.track===trackId||i.track===tracks.find(t=>t.id===trackId)?.name))
      : items;
    const od = src.filter(i=>!isDone(i)&&i.due&&i.due<today);
    addHeader(s, trackId?`مهام مسار ${trackId}`:"المهام والإجراءات",
      `إجمالي: ${src.length}  |  منجز: ${src.filter(isDone).length}  |  نشط: ${src.filter(isActive).length}  |  متأخر: ${od.length}`);
    addKpis(s,[
      {l:"إجمالي",  v:src.length,                    c:C.white},
      {l:"منجز",    v:src.filter(isDone).length,      c:C.green},
      {l:"نشط",     v:src.filter(isActive).length,    c:C.amber},
      {l:"متأخر",   v:od.length,                      c:C.red},
    ],1.3);
    secLabel(s,"قائمة المهام",2.25);
    addTable(s,
      ["المهمة","المسار","المالك","الحالة","الموعد","التقدم%"],
      src.length
        ? src.map(i=>[clip(i.title),i.track||"",i.owner||"—",i.status||"—",fmtD(i.due),`${i.progress||0}%`])
        : [["لا توجد مهام","","","","",""]],
      2.52,[4.2,1.3,1.8,1.65,1.35,1.0]
    );
    footer(s);
  }

  // ══ شريحة الاعتمادات ══
  function approvalsSlide(){
    const s=prs.addSlide(); bg(s);
    const appr = state.management?.approvals || items.filter(i=>i.type==="permits"||/اعتماد/.test(i.title||""));
    const late  = appr.filter(a=>a.due&&a.due<today&&!isDone(a));
    addHeader(s,"الاعتمادات والتصعيد",`إجمالي: ${appr.length}  |  متأخرة: ${late.length}`);
    addKpis(s,[
      {l:"إجمالي الاعتمادات",  v:appr.length,   c:C.white},
      {l:"متأخرة",              v:late.length,   c:C.red},
      {l:"معتمدة",              v:appr.filter(isDone).length, c:C.green},
      {l:"قيد الاعتماد",        v:appr.filter(a=>!isDone(a)&&!late.includes(a)).length, c:C.amber},
    ],1.3);
    secLabel(s,"سجل الاعتمادات",2.25);
    const rows = appr.length
      ? appr.map(a=>[clip(a.title),a.track||"",a.owner||"—",a.status||"—",fmtD(a.due),a.type||"—"])
      : [["لا توجد اعتمادات بانتظار الإجراء","","","","",""]];
    addTable(s,["الاعتماد","المسار","المالك","الحالة","الموعد","النوع"],rows,2.52,[3.8,1.4,1.8,1.65,1.35,1.0]);
    footer(s);
  }

  // ══ شريحة الأدلة ══
  function evidenceSlide(){
    const s=prs.addSlide(); bg(s);
    const fe = state.management?.fieldEvidence || doneItems;
    addHeader(s,"الأدلة الميدانية والإغلاقات",`مهام مغلقة: ${doneItems.length}  |  نسبة الإغلاق: ${items.length?Math.round(doneItems.length*100/items.length):0}%`);
    addKpis(s,[
      {l:"مهام مغلقة",    v:doneItems.length,    c:C.green},
      {l:"إجمالي المهام", v:items.length,        c:C.white},
      {l:"نسبة الإغلاق",  v:(items.length?Math.round(doneItems.length*100/items.length):0)+"%", c:C.green},
      {l:"مخاطر مفتوحة", v:risks.length,        c:C.amber},
    ],1.3);
    secLabel(s,"المهام المغلقة — أدلة الإغلاق",2.25);
    const rows = doneItems.length
      ? doneItems.slice(0,12).map(i=>[clip(i.title),i.track||"",i.owner||"—",i.status||"—",fmtD(i.due)])
      : [["لا توجد مهام مغلقة حتى الآن","","","",""]];
    addTable(s,["المهمة","المسار","المالك","الحالة","تاريخ الإغلاق"],rows,2.52,[4.2,1.5,1.9,1.75,1.4]);
    footer(s);
  }

  // ══ شريحة مسار واحد ══
  function trackSlide(track){
    const s=prs.addSlide(); bg(s);
    const tid  = track.id||track.name;
    const ti   = items.filter(i=>i.track===tid||i.track===track.name||i.track===track.id);
    const tR   = ti.filter(isRisk);
    const colorP = (track.progress||0)>=70?C.green:(track.progress||0)>=45?C.amber:C.red;
    addHeader(s,`مسار ${track.id||""} — ${track.name||""}`,
      `الإنجاز: ${track.progress||0}%  |  المهام: ${ti.length}  |  المخاطر: ${tR.length}  |  الحالة: ${track.status||"—"}`);
    addKpis(s,[
      {l:"الإنجاز",  v:`${track.progress||0}%`, c:colorP},
      {l:"المخطط",   v:`${track.planned||80}%`, c:C.muted},
      {l:"منجز",     v:ti.filter(isDone).length, c:C.green},
      {l:"نشط",      v:ti.filter(isActive).length,c:C.amber},
      {l:"مخاطر",    v:tR.length,                c:C.red},
      {l:"الحالة",   v:track.status||"—",         c:C.white},
    ],1.3);
    secLabel(s,"مهام المسار",2.25);
    addTable(s,
      ["المهمة","المالك","الحالة","الموعد","التقدم%","النوع"],
      ti.length
        ? ti.slice(0,12).map(i=>[clip(i.title),i.owner||"—",i.status||"—",fmtD(i.due),`${i.progress||0}%`,i.type||"—"])
        : [["لا توجد بيانات لهذا المسار","","","","",""]],
      2.52,[4.2,1.8,1.65,1.35,0.9,1.38]
    );
    footer(s);
  }

  // ══ بناء التقرير حسب النوع ══
  if(reportType==="daily_ops"){
    coverSlide("تقرير غرفة العمليات اليومي",`الأسبوع ${weekNum} | ${today}`);
    summarySlide(); actionsSlide(); risksSlide();
  } else if(reportType==="executive"){
    coverSlide("تقرير اللجنة التنفيذية",`الإنجاز العام: ${overall}%`);
    summarySlide(); risksSlide(); approvalsSlide();
  } else if(reportType==="approvals"){
    coverSlide("تقرير الاعتمادات والتصعيد",`متأخرة: ${items.filter(i=>i.due&&i.due<today&&!isDone(i)).length}`);
    approvalsSlide(); risksSlide(); actionsSlide();
  } else if(reportType==="evidence"){
    coverSlide("تقرير الأدلة الميدانية",`مهام مغلقة: ${doneItems.length}`);
    evidenceSlide(); actionsSlide();
  } else if(/^[أبجدهو]$/.test(reportType)){
    const track = tracks.find(t=>t.id===reportType)||{id:reportType,name:reportType,progress:0};
    coverSlide(`تقرير مسار ${reportType}`,track.name||"");
    trackSlide(track); actionsSlide(reportType); risksSlide();
  } else {
    // comprehensive — جميع المسارات
    coverSlide("التقرير الشامل",`${tracks.length} مسار | ${items.length} عنصر`);
    summarySlide(); risksSlide(); approvalsSlide(); evidenceSlide(); actionsSlide();
    tracks.forEach(t=>trackSlide(t));
  }

  // إنتاج PPTX buffer
  const pptxBuf = await prs.write({outputType:"nodebuffer"});

  // إذا طُلب PDF: نُرسل PPTX مع Content-Type صحيح ونُبلّغ الواجهة
  // (LibreOffice غير متاح على Render Free — نُرجع PPTX دائماً)
  return { buf: pptxBuf, format: "pptx" };
}
function deploymentCheck(name, ok, weight, recommendation){ return {name, ok:!!ok, weight:Number(weight||1), recommendation: recommendation||""}; }
function computeDeploymentReadiness(){
  const publicFiles = ["index.html","style.css","script.js","manifest.webmanifest","service-worker.js","UI_VERSION.json"].map(f=>({file:f, exists:fs.existsSync(path.join(PUBLIC_DIR,f))}));
  const management = loadManagementStore();
  const notifications = loadNotificationsStore();
  const audits = loadAuditLog();
  const checks = [
    deploymentCheck("ملفات الواجهة الرئيسية موجودة", publicFiles.every(x=>x.exists), 10, "تأكد من وجود public/index.html و style.css و script.js في جذر المشروع المفكوك."),
    deploymentCheck("خادم Node يعمل وملف server.js موجود", fs.existsSync(path.join(__dirname,"server.js")), 8, "يجب أن يكون server.js في جذر المستودع وليس داخل مجلد فرعي."),
    deploymentCheck("package.json موجود", fs.existsSync(path.join(__dirname,"package.json")), 6, "Render يحتاج package.json في الجذر لتثبيت الحزم."),
    deploymentCheck("render.yaml موجود", fs.existsSync(path.join(__dirname,"render.yaml")), 4, "وجود render.yaml يقلل أخطاء إعدادات Render."),
    deploymentCheck("محرك التقارير Python موجود", fs.existsSync(path.join(__dirname,"generate_report.py")), 7, "يجب بقاء generate_report.py في الجذر لتفعيل تقارير PPTX."),
    deploymentCheck("مجلد report_engine موجود", fs.existsSync(path.join(__dirname,"report_engine")), 6, "مطلوب للتقارير الشاملة والقوالب الاحتياطية."),
    deploymentCheck("PWA مفعلة", fs.existsSync(path.join(PUBLIC_DIR,"manifest.webmanifest")) && fs.existsSync(path.join(PUBLIC_DIR,"service-worker.js")), 5, "مطلوب لتجربة إضافة المنصة على شاشة الجوال."),
    deploymentCheck("نموذج بيانات Google Sheet موجود", fs.existsSync(path.join(PUBLIC_DIR,"KAG_GoogleSheet_Template.csv")), 5, "استخدم القالب لبناء مصدر البيانات الحقيقي."),
    deploymentCheck("مصدر بيانات حي أو CSV احتياطي محدد", !!(SHEET_ID || SHEET_CSV_URL || LOCAL_CSV), 8, "اضبط SHEET_ID أو SHEET_CSV_URL في Render."),
    deploymentCheck("متغيرات تسجيل الدخول مفعلة", !!(ADMIN_USERNAME && ADMIN_PASSWORD && VIEWER_USERNAME && VIEWER_PASSWORD), 7, "اضبط كلمات المرور من Environment Variables ولا تضعها في GitHub."),
    deploymentCheck("مستخدمو المسارات مهيؤون أو يمكن تشغيلهم", ROLE_USERS.length>0 || !REQUIRE_LOGIN, 5, "اضبط ROLE_USERS_JSON لمديري المسارات عند التشغيل الرسمي."),
    deploymentCheck("مركز الإشعارات يعمل", Array.isArray(notifications), 5, "تأكد من صلاحية الكتابة على notifications_store.json في بيئة التشغيل."),
    deploymentCheck("مركز المهام والاعتمادات يعمل", Array.isArray(management.actions) && Array.isArray(management.approvals), 6, "تأكد من صلاحية الكتابة على management_store.json."),
    deploymentCheck("سجل التدقيق يعمل", Array.isArray(audits), 5, "تأكد من صلاحية الكتابة على audit_store.json."),
    deploymentCheck("ربط البريد أو واتساب أو Webhook جاهز", !!(EMAIL_WEBHOOK_URL || WHATSAPP_WEBHOOK_URL || NOTIFICATION_WEBHOOK_URL), 4, "اختياري، لكن يرفع جاهزية التشغيل الخارجي."),
    deploymentCheck("حالة المزامنة سليمة أو يوجد fallback", !!liveState, 6, "يجب أن ترجع /api/state بيانات صالحة دائمًا حتى عند تعطل المصدر."),
  ];
  const total = checks.reduce((s,c)=>s+c.weight,0);
  const earned = checks.reduce((s,c)=>s+(c.ok?c.weight:0),0);
  const score = Math.round((earned/Math.max(total,1))*100);
  return {ok:true, score, grade:score>=95?"جاهزة للنشر الرسمي":score>=85?"جاهزة مع ملاحظات":score>=70?"تحتاج استكمال قبل العرض":"غير جاهزة للنشر", generatedAt:new Date().toISOString(), checks, files:publicFiles, environment:{loginRequired:REQUIRE_LOGIN, sheetConfigured:!!SHEET_ID, csvUrlConfigured:!!SHEET_CSV_URL, localCsvConfigured:!!LOCAL_CSV, emailWebhookConfigured:!!EMAIL_WEBHOOK_URL, whatsappWebhookConfigured:!!WHATSAPP_WEBHOOK_URL, notificationWebhookConfigured:!!NOTIFICATION_WEBHOOK_URL, roleUsersConfigured:ROLE_USERS.length}};
}

function computeGoLiveControl(req){
  const readiness = computeDeploymentReadiness();
  const quality = computeDataQuality(req);
  const summary = computeOperationalSummary(req);
  const env = readiness.environment || {};
  const gates = [
    {name:"رفع الملفات مفكوكة على GitHub", ok:readiness.checks.some(c=>c.name.includes("ملفات الواجهة") && c.ok), criteria:"وجود server.js و public/index.html و package.json في جذر المستودع", owner:"الفريق التقني"},
    {name:"تفعيل تسجيل الدخول والصلاحيات", ok:env.loginRequired && !!ADMIN_PASSWORD, criteria:"ADMIN / VIEWER / Track Managers مضبوطة من متغيرات البيئة", owner:"الفريق التقني"},
    {name:"مصدر البيانات جاهز", ok:env.sheetConfigured || env.csvUrlConfigured || env.localCsvConfigured, criteria:"Google Sheet أو CSV مباشر متصل ويعيد بيانات", owner:"مسؤول البيانات"},
    {name:"مركز الإشعارات جاهز", ok:env.emailWebhookConfigured || env.whatsappWebhookConfigured || env.notificationWebhookConfigured, criteria:"Webhook واحد على الأقل مفعّل للإرسال الخارجي", owner:"الفريق التقني"},
    {name:"دورة التشغيل قابلة للاختبار", ok:(summary.openActions>=0 && quality.score>=70), criteria:"إشعار ← مهمة ← تصعيد ← دليل ← اعتماد ← تقرير", owner:"مدير المشروع"},
    {name:"جودة البيانات قابلة للاعتماد", ok:quality.score>=85, criteria:"لا توجد فجوات جوهرية في المالك أو الموعد أو الدليل", owner:"مدير البيانات"},
    {name:"النسخ والتصدير مفعلة", ok:true, criteria:"Backup JSON وCSV للمهام والاعتمادات والتدقيق متاحة", owner:"الفريق التقني"}
  ];
  const gateScore = Math.round(gates.filter(g=>g.ok).length / Math.max(gates.length,1) * 100);
  const score = Math.round(gateScore*.45 + readiness.score*.35 + quality.score*.20);
  const actions = [];
  if(!env.emailWebhookConfigured && !env.whatsappWebhookConfigured && !env.notificationWebhookConfigured) actions.push({title:"ربط قناة إرسال خارجية", detail:"اضبط EMAIL_WEBHOOK_URL أو WHATSAPP_WEBHOOK_URL أو NOTIFICATION_WEBHOOK_URL في Render ثم اختبر الإرسال من صفحة جاهزية النشر."});
  if(quality.score<85) actions.push({title:"رفع موثوقية البيانات", detail:"أغلق الحقول الناقصة: المالك، تاريخ الاستحقاق، الدليل، وربط المخاطر بإجراءات معالجة."});
  if(!env.roleUsersConfigured) actions.push({title:"تعريف مديري المسارات", detail:"اضبط TRACK_USERS بصيغة JSON حتى يرى كل مدير مسار مهامه وصلاحياته بوضوح."});
  actions.push({title:"تشغيل تجربة أول أسبوع", detail:"استخدم الخطة أدناه لتجربة النظام يوميًا قبل العرض الرسمي، وصدّر تقرير نهاية الأسبوع."});
  const weekPlan = [
    {day:"اليوم 1", output:"رفع البيانات الحقيقية وربط Google Sheet", meeting:"جلسة تشغيل 30 دقيقة", measure:"نجاح /api/state وجودة البيانات فوق 80%"},
    {day:"اليوم 2", output:"إرسال إشعارات فعلية لمديري المسارات", meeting:"متابعة الإشعارات", measure:"كل إشعار يتحول إلى مهمة"},
    {day:"اليوم 3", output:"إغلاق مهام بدليل", meeting:"مراجعة الأدلة", measure:"70% من الإغلاقات لها دليل"},
    {day:"اليوم 4", output:"اختبار التصعيد والاعتمادات", meeting:"جلسة قرارات", measure:"إغلاق اعتمادين أو توثيق سبب التأخير"},
    {day:"اليوم 5", output:"توليد تقرير تشغيلي", meeting:"عرض داخلي", measure:"تقرير PDF أو PowerPoint جاهز للإرسال"},
    {day:"اليوم 6", output:"اختبار الجوال وPWA", meeting:"تجربة مستخدم", measure:"القائمة والبطاقات واضحة على iPhone/Android"},
    {day:"اليوم 7", output:"اعتماد النسخة المستقرة", meeting:"Go-Live Review", measure:"درجة الإطلاق فوق 90%"}
  ];
  const handover = [
    {item:"رابط Render النهائي", status:"يسلمه الفني بعد النشر"},
    {item:"حسابات الأدمن والمشاهد ومديري المسارات", status:env.loginRequired?"مطلوبة من Render ENV":"تسجيل الدخول معطل"},
    {item:"Google Sheet التشغيلي", status:env.sheetConfigured?"مربوط":"يحتاج ضبط"},
    {item:"قنوات الإشعار", status:(env.emailWebhookConfigured||env.whatsappWebhookConfigured)?"جاهزة جزئيًا":"تحتاج ربط"},
    {item:"نسخة احتياطية أولية", status:"متاحة من /api/backup"}
  ];
  const acceptanceRisks = [
    {risk:"رفع ZIP بدل محتويات المشروع", treatment:"فك الضغط ورفع الملفات في الجذر، ثم Clear build cache & deploy."},
    {risk:"ظهور واجهة قديمة بسبب كاش Render", treatment:"استخدم Manual Deploy مع Clear build cache وتأكد من public/UI_VERSION.json."},
    {risk:"بيانات تجريبية بدل بيانات حقيقية", treatment:"اضبط SHEET_CSV_URL أو SHEET_ID وتأكد من عدد الصفوف في صفحة حالة النظام."},
    {risk:"فشل إرسال واتساب", treatment:"واتساب يحتاج مزود WhatsApp Business API أو Webhook وسيط؛ النظام جاهز للإرسال وليس مزودًا بحد ذاته."}
  ];
  return {ok:true, version:"1000.5.0", generatedAt:new Date().toISOString(), score, grade:score>=95?"جاهز للإطلاق التشغيلي":score>=85?"جاهز مع ملاحظات محدودة":score>=70?"يحتاج استكمال قبل العرض":"غير جاهز", readinessScore:readiness.score, dataQualityScore:quality.score, operationalSummary:summary, gates, actions, weekPlan, handover, acceptanceRisks};
}

function makeBackupPayload(req){
  return {meta:{name:"KAG Operational Platform Backup", version:"1000.5.0", generatedAt:new Date().toISOString(), generatedBy:sessionInfo(req)}, state:{liveVersion, liveUpdatedAt, sync:lastSync, publicState:filterStateForUser(req, liveState || buildState(fallbackItems()))}, stores:{notifications:loadNotificationsStore(), management:loadManagementStore(), auditLog:loadAuditLog().slice(-500)}};
}

function mimeType(file){
  const ext=path.extname(file).toLowerCase();
  return {".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",
    ".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".csv":"text/csv; charset=utf-8",
    ".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".svg":"image/svg+xml",".ico":"image/x-icon"
  }[ext]||"application/octet-stream";
}
function serveStatic(req,res){
  let urlPath=decodeURIComponent((req.url||"/").split("?")[0]);
  if(urlPath==="/") urlPath="/index.html";
  if(urlPath.indexOf("\0")!==-1){ res.writeHead(400); return res.end("Bad request"); }
  const filePath=path.normalize(path.join(PUBLIC_DIR,urlPath));
  // منع تجاوز المسار: يجب أن يبقى داخل مجلد public تمامًا
  if(filePath!==PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR+path.sep)){ res.writeHead(403); return res.end("Forbidden"); }
  fs.stat(filePath,(err,stat)=>{
    if(err||!stat.isFile()){ res.writeHead(404); return res.end("Not found"); }
    const cache = /\.(png|jpg|jpeg|svg|ico)$/i.test(filePath) ? "public, max-age=3600" : "no-store, no-cache, must-revalidate, proxy-revalidate";
    res.writeHead(200,{"Content-Type":mimeType(filePath),"Cache-Control":cache});
    fs.createReadStream(filePath).pipe(res);
  });
}

let lastForcedRefresh=0;
function serveLoginGate(res){
  var html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>تسجيل الدخول — منصة التحليل التشغيلي</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:'Segoe UI',Tahoma,Arial,sans-serif}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 30% 20%,#13293D,#0D1B2A 70%);color:#EAF0F7;padding:20px}
.card{width:min(420px,94vw);background:rgba(13,27,42,.85);border:1px solid rgba(201,168,76,.45);border-radius:18px;padding:34px 30px;box-shadow:0 24px 70px rgba(0,0,0,.5)}
.brand{text-align:center;margin-bottom:24px}
.brand h1{font-size:22px;color:#C9A84C;margin-bottom:6px}
.brand p{font-size:13px;color:#9FB0C3}
label{display:block;font-size:13px;color:#C9D4E0;margin:14px 0 6px}
input{width:100%;padding:12px 14px;border-radius:10px;border:1px solid rgba(201,168,76,.35);background:rgba(255,255,255,.06);color:#fff;font-size:15px;outline:none}
input:focus{border-color:#C9A84C}
button{width:100%;margin-top:22px;padding:13px;border:none;border-radius:10px;background:#C9A84C;color:#0D1B2A;font-size:16px;font-weight:bold;cursor:pointer}
button:disabled{opacity:.6;cursor:default}
.err{margin-top:14px;color:#FF6B6B;font-size:13px;min-height:18px;text-align:center}
</style></head><body>
<div class="card">
  <div class="brand"><h1>منصة التحليل التشغيلي</h1><p>حدائق الملك عبدالله — سجّل دخولك (Viewer أو Admin)</p></div>
  <form id="f" autocomplete="off">
    <label>اسم المستخدم</label>
    <input id="u" type="text" required autocomplete="username">
    <label>كلمة المرور</label>
    <input id="p" type="password" required autocomplete="current-password">
    <button id="b" type="submit">تسجيل الدخول</button>
    <div class="err" id="e"></div>
  </form>
</div>
<script>
var f=document.getElementById('f'),b=document.getElementById('b'),e=document.getElementById('e');
f.addEventListener('submit',function(ev){
  ev.preventDefault();
  b.disabled=true;e.textContent='جارٍ التحقق...';
  fetch('/api/login',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({username:document.getElementById('u').value.trim(),password:document.getElementById('p').value})})
    .then(function(r){return r.json();})
    .then(function(d){ if(d&&d.ok){ location.href='/'; } else { e.textContent='اسم المستخدم أو كلمة المرور غير صحيحة.'; b.disabled=false; } })
    .catch(function(){ e.textContent='تعذّر الاتصال بالخادم.'; b.disabled=false; });
});
</script>
</body></html>`;
  res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
  res.end(html);
}
const server=http.createServer(async (req,res)=>{
  try{
    securityHeaders(req,res);
    const url=(req.url||"").split("?")[0];

    if(req.method==="GET" && url==="/api/health")
      return sendJson(res,200,{ok:true,time:new Date().toISOString()});

    // الحالة الحية (للقراءة) — مشتقة من Google Sheet
    if(req.method==="GET" && url==="/api/state"){
      if(REQUIRE_LOGIN && !isAuthed(req)) return sendJson(res,401,{error:"يلزم تسجيل الدخول"});
      return sendJson(res,200,{version:liveVersion,updatedAt:liveUpdatedAt,state:filterStateForUser(req, liveState),sync:publicSync(), user:sessionInfo(req)});
    }


    // مركز الإشعارات: قراءة للجميع، إنشاء للأدمن فقط
    if(url==="/api/notifications"){
      if(REQUIRE_LOGIN && !isAuthed(req)) return sendJson(res,401,{error:"يلزم تسجيل الدخول"});
      if(req.method==="GET"){
        return sendJson(res,200,{ok:true, notifications:filterNotificationsForUser(req, loadNotificationsStore())});
      }
      if(req.method==="POST"){
        if(!sameOrigin(req)) return sendJson(res,403,{error:"مصدر غير موثوق"});
        if(!isAdmin(req)) return sendJson(res,403,{error:"صلاحية أدمن مطلوبة لإرسال الإشعارات"});
        let body={};
        const raw=await readBody(req);
        try{ body=raw?JSON.parse(raw):{}; }catch(e){ return sendJson(res,400,{error:"طلب غير صالح"}); }
        const requested = Array.isArray(body.recipients) ? body.recipients.map(x=>String(x)) : [];
        const recipients = body.mode==="all" ? VALID_TRACKS.slice() : requested.filter(x=>VALID_TRACKS.includes(x));
        if(!recipients.length) return sendJson(res,400,{error:"يجب اختيار مستلم واحد على الأقل"});
        const title = sanitizeText(body.title, 140);
        const message = sanitizeText(body.message, 1600);
        if(!title || !message) return sendJson(res,400,{error:"العنوان ونص الإشعار مطلوبان"});
        const notification = {
          id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex"),
          mode: ["individual","group","all"].includes(body.mode) ? body.mode : "individual",
          recipients,
          recipientLabels: recipients.map(trackLabelById),
          title, message,
          priority: validPriority(body.priority),
          actionType: validActionType(body.actionType),
          dueAt: sanitizeText(body.dueAt, 40),
          updateAt: sanitizeText(body.updateAt, 40),
          channels: validChannels(body.channels),
          extraEmails: splitList(body.extraEmails),
          extraWhatsApp: splitList(body.extraWhatsApp),
          status:"مرسل",
          createdAt:new Date().toISOString(),
          createdBy:isAdmin(req)?"admin":"viewer",
          delivery:[]
        };
        notification.delivery = await deliverNotification(notification);
        const notifications = loadNotificationsStore();
        notifications.push(notification);
        saveNotificationsStore(notifications.slice(-500));
        // تحويل الإشعار تلقائيًا إلى مهمة قابلة للإغلاق إذا كان المطلوب تسليم/تحديث/قرار
        const management = loadManagementStore();
        management.actions = Array.isArray(management.actions) ? management.actions : [];
        if(notification.actionType !== "متابعة"){ management.actions.push(makeActionFromNotification(notification)); saveManagementStore(management); }
        addAudit(req, "إنشاء إشعار", "notifications", {id:notification.id, title:notification.title, recipients:notification.recipients, priority:notification.priority, actionType:notification.actionType});
        return sendJson(res,201,{ok:true, notification, notifications:filterNotificationsForUser(req, loadNotificationsStore()), management:filterManagementForUser(req, loadManagementStore())});
      }
      return sendJson(res,405,{error:"الطريقة غير مسموحة"});
    }



    // مراكز الإدارة التشغيلية المتقدمة: قراءة للجميع، إضافة للأدمن فقط
    if(url==="/api/management-center"){
      if(REQUIRE_LOGIN && !isAuthed(req)) return sendJson(res,401,{error:"يلزم تسجيل الدخول"});
      if(req.method==="GET") return sendJson(res,200,{ok:true, management:filterManagementForUser(req, loadManagementStore())});
      if(req.method==="POST"){
        if(!sameOrigin(req)) return sendJson(res,403,{error:"مصدر غير موثوق"});
        if(!isAdmin(req)) return sendJson(res,403,{error:"صلاحية أدمن مطلوبة"});
        const raw=await readBody(req); let body={};
        try{ body=raw?JSON.parse(raw):{}; }catch(e){ return sendJson(res,400,{error:"طلب غير صالح"}); }
        const section = sanitizeText(body.section,40);
        if(!["actions","approvals","changes","meetings","zones","fieldEvidence"].includes(section)) return sendJson(res,400,{error:"قسم غير مدعوم"});
        const management=loadManagementStore();
        const item=normalizeManagementItem(section, body.item||{});
        management[section]=Array.isArray(management[section])?management[section]:[];
        management[section].push(item);
        saveManagementStore(management);
        addAudit(req, "إضافة عنصر إدارة", section, {id:item.id, title:item.title || item.zone || item.date});
        return sendJson(res,201,{ok:true,item,management:loadManagementStore()});
      }
      return sendJson(res,405,{error:"الطريقة غير مسموحة"});
    }


    // معلومات الجلسة والصلاحيات الحالية
    if(req.method==="GET" && url==="/api/me"){
      if(REQUIRE_LOGIN && !isAuthed(req)) return sendJson(res,401,{error:"يلزم تسجيل الدخول"});
      return sendJson(res,200,{ok:true, user:sessionInfo(req), tracks:TRACK_CONFIG.map(t=>({id:t.id,name:t.name,lead:t.lead}))});
    }

    // سجل التدقيق: قراءة للأدمن فقط
    if(req.method==="GET" && url==="/api/audit-log"){
      if(!isAdmin(req)) return sendJson(res,403,{error:"صلاحية أدمن مطلوبة"});
      return sendJson(res,200,{ok:true, events:loadAuditLog().slice(-300).reverse()});
    }

    // تحديث حالة مهمة قابلة للإغلاق مع ملاحظة ودليل
    if(url==="/api/action-update" && req.method==="POST"){
      if(!sameOrigin(req)) return sendJson(res,403,{error:"مصدر غير موثوق"});
      if(!canWrite(req)) return sendJson(res,403,{error:"صلاحية تعديل مطلوبة"});
      let body={}; const raw=await readBody(req);
      try{ body=raw?JSON.parse(raw):{}; }catch(e){ return sendJson(res,400,{error:"طلب غير صالح"}); }
      const management=loadManagementStore();
      const item=updateItemById(management.actions, body.id, {
        status:sanitizeText(body.status||"قيد العمل",50),
        closureNote:sanitizeText(body.closureNote||"",500),
        evidenceUrl:sanitizeText(body.evidenceUrl||"",500)
      });
      if(!item) return sendJson(res,404,{error:"المهمة غير موجودة"});
      if(!itemBelongsToUser(req,item)) return sendJson(res,403,{error:"لا تملك صلاحية تحديث هذا المسار"});
      saveManagementStore(management);
      addAudit(req, "تحديث مهمة", "actions", {id:item.id, status:item.status, evidenceUrl:item.evidenceUrl});
      return sendJson(res,200,{ok:true,item,management:loadManagementStore()});
    }

    // تحديث اعتماد
    if(url==="/api/approval-update" && req.method==="POST"){
      if(!sameOrigin(req)) return sendJson(res,403,{error:"مصدر غير موثوق"});
      if(!canWrite(req)) return sendJson(res,403,{error:"صلاحية تعديل مطلوبة"});
      let body={}; const raw=await readBody(req);
      try{ body=raw?JSON.parse(raw):{}; }catch(e){ return sendJson(res,400,{error:"طلب غير صالح"}); }
      const management=loadManagementStore();
      const item=updateItemById(management.approvals, body.id, {status:sanitizeText(body.status||"قيد الاعتماد",50), note:sanitizeText(body.note||"",500)});
      if(!item) return sendJson(res,404,{error:"الاعتماد غير موجود"});
      if(!itemBelongsToUser(req,item)) return sendJson(res,403,{error:"لا تملك صلاحية تحديث هذا الاعتماد"});
      saveManagementStore(management); addAudit(req, "تحديث اعتماد", "approvals", {id:item.id, status:item.status});
      return sendJson(res,200,{ok:true,item,management:loadManagementStore()});
    }

    // إشعارات حيّة منذ وقت محدد للمزامنة السريعة داخل الواجهة
    if(req.method==="GET" && url==="/api/live-notifications"){
      if(REQUIRE_LOGIN && !isAuthed(req)) return sendJson(res,401,{error:"يلزم تسجيل الدخول"});
      const since = new URL(req.url, `http://${req.headers.host}`).searchParams.get("since") || "";
      const sinceTime = since ? Date.parse(since) : 0;
      const notifications = filterNotificationsForUser(req, loadNotificationsStore()).filter(n=>Date.parse(n.createdAt||0)>sinceTime).slice(-50);
      return sendJson(res,200,{ok:true, at:new Date().toISOString(), notifications});
    }

    // جودة البيانات: متاحة للمستخدم حسب نطاق صلاحياته
    if(req.method==="GET" && url==="/api/data-quality"){
      if(REQUIRE_LOGIN && !isAuthed(req)) return sendJson(res,401,{error:"يلزم تسجيل الدخول"});
      return sendJson(res,200,computeDataQuality(req));
    }

    // ملخص تشغيلي جاهز للعرض حسب صلاحيات المستخدم
    if(req.method==="GET" && url==="/api/operational-summary"){
      if(REQUIRE_LOGIN && !isAuthed(req)) return sendJson(res,401,{error:"يلزم تسجيل الدخول"});
      return sendJson(res,200,computeOperationalSummary(req));
    }

    // مركز جاهزية النشر والتشغيل — للأدمن فقط
    if(req.method==="GET" && url==="/api/deployment-readiness"){
      if(!isAdmin(req)) return sendJson(res,403,{error:"صلاحية أدمن مطلوبة"});
      return sendJson(res,200,computeDeploymentReadiness());
    }

    // مركز الإطلاق التشغيلي — للأدمن فقط
    if(req.method==="GET" && url==="/api/go-live-control"){
      if(!isAdmin(req)) return sendJson(res,403,{error:"صلاحية أدمن مطلوبة"});
      return sendJson(res,200,computeGoLiveControl(req));
    }

    // نسخة احتياطية تشغيلية — للأدمن فقط
    if(req.method==="GET" && url==="/api/backup"){
      if(!isAdmin(req)) return sendJson(res,403,{error:"صلاحية أدمن مطلوبة"});
      addAudit(req, "تنزيل نسخة احتياطية", "backup", {version:"1000.5.0"});
      const json=JSON.stringify(makeBackupPayload(req), null, 2);
      return sendText(res,200,json,"application/json; charset=utf-8", {"Content-Disposition":"attachment; filename=KAG_operational_backup.json"});
    }

    // تصدير المهام والاعتمادات وسجل التدقيق — للأدمن فقط
    if(req.method==="GET" && url==="/api/export/actions.csv"){
      if(!isAdmin(req)) return sendJson(res,403,{error:"صلاحية أدمن مطلوبة"});
      const rows=(loadManagementStore().actions||[]);
      const csv=toCsv(rows,[{key:"id",label:"المعرف"},{key:"title",label:"المهمة"},{key:"track",label:"المسار"},{key:"owner",label:"المالك"},{key:"priority",label:"الأهمية"},{key:"due",label:"الموعد"},{key:"status",label:"الحالة"},{key:"evidenceUrl",label:"رابط الدليل"},{key:"closureNote",label:"ملاحظة الإغلاق"}]);
      addAudit(req, "تصدير المهام", "export", {rows:rows.length});
      return sendText(res,200,csv,"text/csv; charset=utf-8", {"Content-Disposition":"attachment; filename=KAG_actions.csv"});
    }
    if(req.method==="GET" && url==="/api/export/approvals.csv"){
      if(!isAdmin(req)) return sendJson(res,403,{error:"صلاحية أدمن مطلوبة"});
      const rows=(loadManagementStore().approvals||[]);
      const csv=toCsv(rows,[{key:"id",label:"المعرف"},{key:"title",label:"الاعتماد"},{key:"type",label:"النوع"},{key:"track",label:"المسار"},{key:"owner",label:"المالك"},{key:"due",label:"الموعد"},{key:"impact",label:"الأثر"},{key:"status",label:"الحالة"},{key:"note",label:"ملاحظة"}]);
      addAudit(req, "تصدير الاعتمادات", "export", {rows:rows.length});
      return sendText(res,200,csv,"text/csv; charset=utf-8", {"Content-Disposition":"attachment; filename=KAG_approvals.csv"});
    }
    if(req.method==="GET" && url==="/api/export/audit.csv"){
      if(!isAdmin(req)) return sendJson(res,403,{error:"صلاحية أدمن مطلوبة"});
      const rows=loadAuditLog().slice(-1000).reverse();
      const csv=toCsv(rows,[{key:"at",label:"الوقت"},{key:"role",label:"الدور"},{key:"action",label:"الإجراء"},{key:"entity",label:"الكيان"},{key:"ip",label:"IP"},{label:"التفاصيل", value:r=>JSON.stringify(r.details||{})}]);
      return sendText(res,200,csv,"text/csv; charset=utf-8", {"Content-Disposition":"attachment; filename=KAG_audit_log.csv"});
    }

    // اختبار جاهزية التكاملات دون إرسال فعلي — للأدمن فقط
    if(req.method==="POST" && url==="/api/integrations-test"){
      if(!sameOrigin(req)) return sendJson(res,403,{error:"مصدر غير موثوق"});
      if(!isAdmin(req)) return sendJson(res,403,{error:"صلاحية أدمن مطلوبة"});
      const result={ok:true, generatedAt:new Date().toISOString(), emailWebhookConfigured:!!EMAIL_WEBHOOK_URL, whatsappWebhookConfigured:!!WHATSAPP_WEBHOOK_URL, notificationWebhookConfigured:!!NOTIFICATION_WEBHOOK_URL, trackContactsConfigured:Object.keys(TRACK_CONTACTS||{}).length, note:"هذا اختبار إعدادات فقط ولا يرسل رسائل فعلية."};
      addAudit(req, "اختبار جاهزية التكاملات", "integrations", result);
      return sendJson(res,200,result);
    }

    // حالة مصدر البيانات (تفاصيل حساسة) — للأدمن فقط
    if(url==="/api/config"){
      if(req.method!=="GET") return sendJson(res,405,{error:"الطريقة غير مسموحة"});
      if(!isAdmin(req)) return sendJson(res,403,{error:"صلاحية أدمن مطلوبة"});
      return sendJson(res,200,{
        sheetConfigured:!!SHEET_ID,
        sheetName:SHEET_NAME||"(أول تبويب)",
        refreshMs:SHEET_REFRESH_MS,
        sheetViewUrl: SHEET_ID?`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`:null,
        sync:lastSync, version:liveVersion, updatedAt:liveUpdatedAt
      });
    }

    // إعادة سحب فورية — للأدمن فقط + فحص المصدر + تحديد معدل
    if(url==="/api/refresh"){
      if(req.method!=="POST") return sendJson(res,405,{error:"الطريقة غير مسموحة"});
      if(!sameOrigin(req)) return sendJson(res,403,{error:"مصدر غير موثوق"});
      if(!isAdmin(req)) return sendJson(res,403,{error:"صلاحية أدمن مطلوبة"});
      const nowMs=Date.now();
      if(nowMs-lastForcedRefresh<3000) return sendJson(res,429,{ok:false,error:"الرجاء الانتظار قليلًا"});
      lastForcedRefresh=nowMs;
      await refreshFromSheet();
      return sendJson(res,200,{ok:lastSync.ok,version:liveVersion,updatedAt:liveUpdatedAt,sync:publicSync()});
    }

    // تسجيل دخول الأدمن (تحقق من الخادم فقط) — مقارنة آمنة + حظر تخمين + فحص المصدر
    if(url==="/api/login"){
      if(req.method!=="POST") return sendJson(res,405,{error:"الطريقة غير مسموحة"});
      if(!sameOrigin(req)) return sendJson(res,403,{ok:false,error:"مصدر غير موثوق"});
      const ip=clientIp(req);
      if(loginBlocked(ip)) return sendJson(res,429,{ok:false,error:"محاولات كثيرة. حاول لاحقًا."});
      let body={};
      const raw=await readBody(req);
      try{ body=raw?JSON.parse(raw):{}; }catch(e){ return sendJson(res,400,{ok:false,error:"طلب غير صالح"}); }
      const adminMatch = safeEqual(body.username||"",ADMIN_USERNAME) & safeEqual(body.password||"",ADMIN_PASSWORD);
      const viewerMatch = safeEqual(body.username||"",VIEWER_USERNAME) & safeEqual(body.password||"",VIEWER_PASSWORD);
      const trackUser = ROLE_USERS.find(u => safeEqual(body.username||"",u.username) & safeEqual(body.password||"",u.password));
      if(adminMatch || viewerMatch || trackUser){
        clearLoginFails(ip);
        const sid=crypto.randomBytes(32).toString("hex");
        const session = trackUser ? {exp:Date.now()+SESSION_TTL_MS, role:"track-manager", username:trackUser.username, name:trackUser.name, trackId:trackUser.trackId, permissions:trackUser.permissions}
                                  : {exp:Date.now()+SESSION_TTL_MS, role:adminMatch ? "admin" : "viewer", username:adminMatch?ADMIN_USERNAME:VIEWER_USERNAME, name:adminMatch?"مدير النظام":"مشاهد"};
        sessions.set(sid,session);
        res.writeHead(200,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
          "Set-Cookie":sessionCookie(req,sid,false)});
        return res.end(JSON.stringify({ok:true, role:session.role, trackId:session.trackId||""}));
      }
      recordLoginFail(ip);
      return sendJson(res,401,{ok:false,error:"بيانات الدخول غير صحيحة"});
    }
    // admin-login: يرفع صلاحية الجلسة الحالية إلى admin (يُستدعى من popup داخل اللوحة)
    if(url==="/api/admin-login"){
      if(req.method!=="POST") return sendJson(res,405,{error:"الطريقة غير مسموحة"});
      if(!sameOrigin(req)) return sendJson(res,403,{ok:false,error:"مصدر غير موثوق"});
      const ip=clientIp(req);
      if(loginBlocked(ip)) return sendJson(res,429,{ok:false,error:"محاولات كثيرة. حاول لاحقًا."});
      let body={};
      const raw=await readBody(req);
      try{ body=raw?JSON.parse(raw):{}; }catch(e){ return sendJson(res,400,{ok:false,error:"طلب غير صالح"}); }
      const ok = safeEqual(body.username||"",ADMIN_USERNAME) & safeEqual(body.password||"",ADMIN_PASSWORD);
      if(ok){
        clearLoginFails(ip);
        // ارفع دور الجلسة الحالية إلى admin إن وُجدت، وإلا أنشئ جلسة جديدة
        const existingSid=getCookie(req,"kag_session");
        if(existingSid && sessions.has(existingSid)){
          const s=sessions.get(existingSid); s.role="admin"; s.exp=Date.now()+SESSION_TTL_MS;
          sessions.set(existingSid,s);
          return res.end(JSON.stringify({ok:true,role:"admin"}));
        }
        const sid=crypto.randomBytes(32).toString("hex");
        sessions.set(sid,{exp:Date.now()+SESSION_TTL_MS, role:"admin"});
        res.writeHead(200,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
          "Set-Cookie":sessionCookie(req,sid,false)});
        return res.end(JSON.stringify({ok:true,role:"admin"}));
      }
      recordLoginFail(ip);
      return sendJson(res,401,{ok:false,error:"بيانات دخول الإدارة غير صحيحة"});
    }
    if(url==="/api/logout"){
      if(req.method!=="POST") return sendJson(res,405,{error:"الطريقة غير مسموحة"});
      if(!sameOrigin(req)) return sendJson(res,403,{ok:false,error:"مصدر غير موثوق"});
      const sid=getCookie(req,"kag_session"); if(sid) sessions.delete(sid);
      res.writeHead(200,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
        "Set-Cookie":sessionCookie(req,"",true)});
      return res.end(JSON.stringify({ok:true}));
    }
    if(req.method==="GET" && url==="/api/admin-check")
      return sendJson(res,200,{authed:isAuthed(req), isAdmin:isAdmin(req)});

    // ===== تشخيص النظام ومحرك التقارير =====
    if(req.method==="GET" && url==="/api/system-health"){
      if(!isAdmin(req)) return sendJson(res,403,{error:"صلاحية أدمن مطلوبة"});
      const reportScript = path.join(__dirname,"generate_report.py");
      const templatesDir = path.join(__dirname,"templates");
      const reportEngineDir = path.join(__dirname,"report_engine");
      return sendJson(res,200,{
        ok:true,
        time:new Date().toISOString(),
        node:process.version,
        loginRequired:REQUIRE_LOGIN,
        dataSource:lastSync,
        liveVersion,
        stateLoaded:!!liveState,
        tracks:VALID_TRACKS,
        roleUsersConfigured:ROLE_USERS.length,
        report:{
          generateReportPy:fs.existsSync(reportScript),
          templatesDir:fs.existsSync(templatesDir),
          reportEngineDir:fs.existsSync(reportEngineDir)
        },
        notifications:{
          store:fs.existsSync(NOTIFICATION_STORE),
          count:loadNotificationsStore().length,
          webhookConfigured:!!NOTIFICATION_WEBHOOK_URL,
          emailWebhookConfigured:!!EMAIL_WEBHOOK_URL,
          whatsappWebhookConfigured:!!WHATSAPP_WEBHOOK_URL,
          trackContactsConfigured:Object.keys(TRACK_CONTACTS||{}).length
        },
        security:{
          fixedPasswordsInCode:false,
          sameOrigin:"strict-host",
          sensitiveApis:"admin-only"
        }
      });
    }

    // ===== توليد التقارير الرسمية: PDF افتراضيًا أو PowerPoint قابل للتعديل =====
    if(url.startsWith("/api/report") && req.method==="POST"){
      if(!isAdmin(req)) return sendJson(res,403,{error:"صلاحية أدمن مطلوبة"});
      let body={};
      const raw=await readBody(req);
      try{ body=raw?JSON.parse(raw):{}; }catch(e){ return sendJson(res,400,{error:"طلب غير صالح"}); }
      const reportType = body.type || "comprehensive";
      const format = normalizeReportFormat(body.format || body.output || "pdf");
      if(!liveState) return sendJson(res,503,{error:"البيانات غير متاحة بعد"});
      try{
        const reportState = composeReportState(req);
        const {buf: finalBuf, format: actualFormat} = await generateNodeReport(reportType, format, reportState);
        const fname = asciiReportName(reportType, actualFormat);
        addAudit(req, `توليد تقرير ${actualFormat.toUpperCase()}`, "report", {type:reportType, format:actualFormat, bytes:finalBuf.length});
        res.writeHead(200,{
          "Content-Type": reportContentType(actualFormat),
          "Content-Disposition":`attachment; filename="${fname}"`,
          "Content-Length": finalBuf.length,
          "Cache-Control":"no-store"
        });
        return res.end(finalBuf);
      }catch(e){
        console.error("خطأ في توليد التقرير:", e);
        return sendJson(res,500,{error:"فشل توليد التقرير: "+e.message});
      }
    }

    if(url.startsWith("/api/")) return sendJson(res,404,{error:"غير موجود"});
    if(req.method!=="GET" && req.method!=="HEAD"){ res.writeHead(405); return res.end("Method not allowed"); }
    // بوابة تسجيل الدخول: لا يُعرض أي محتوى قبل الدخول عند تفعيل القفل الكامل
    if(REQUIRE_LOGIN && !isAuthed(req)) return serveLoginGate(res);
    return serveStatic(req,res);
  }catch(e){
    console.error("[server]", e && e.message ? e.message : e);
    return sendJson(res,500,{ok:false,error:"خطأ داخلي في الخادم"});
  }
});
// تحصين ضد هجمات الإبطاء (slowloris) والطلبات المعلّقة
server.requestTimeout = 20000;
server.headersTimeout = 15000;
server.keepAliveTimeout = 8000;

(async ()=>{
  await refreshFromSheet();
  setInterval(refreshFromSheet, SHEET_REFRESH_MS);
  server.listen(PORT,()=>{
    console.log(`KAG Operational Analytics Platform يعمل على http://localhost:${PORT}`);
    console.log(`مصدر البيانات: ${SHEET_ID?("Google Sheet ["+SHEET_ID+"]"):"بيانات تجريبية (لم يُضبط SHEET_ID)"}`);
    console.log(`اسم مستخدم الأدمن: ${ADMIN_USERNAME}`);
    if(!process.env.ADMIN_PASSWORD) console.log(`كلمة مرور الأدمن المؤقتة لهذا التشغيل: ${ADMIN_PASSWORD}  (يفضل ضبط ADMIN_PASSWORD في متغيرات البيئة)`);
    if(!process.env.VIEWER_PASSWORD) console.log(`كلمة مرور المشاهد المؤقتة لهذا التشغيل: ${VIEWER_PASSWORD}  (يفضل ضبط VIEWER_PASSWORD في متغيرات البيئة)`);
    if(REQUIRE_LOGIN) console.log("الوضع: قفل كامل (REQUIRE_LOGIN=true) — لا تُعرض البيانات إلا بعد تسجيل الدخول.");
  });
})();
