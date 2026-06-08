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

/* ============ بيانات الدخول — تُقرأ من متغيّرات البيئة فقط ============
 * لم تعد أي كلمة مرور مكتوبة داخل الكود. إن لم تُضبط في إعدادات الاستضافة
 * (Render → Environment) يُولّد الخادم كلمة مرور عشوائية قوية ويطبعها في السجل
 * عند الإقلاع — فلا توجد كلمة مرور ثابتة معروفة يمكن تخمينها من الملفات. */
const ADMIN_USERNAME  = process.env.ADMIN_USERNAME  || "MAYADEEN";
const VIEWER_USERNAME = process.env.VIEWER_USERNAME || "KAG_VIEWER";
let   _genAdminPw = false, _genViewerPw = false;
const ADMIN_PASSWORD  = process.env.ADMIN_PASSWORD  || (function(){ _genAdminPw = true;  return "KAG-" + crypto.randomBytes(9).toString("base64").replace(/[^a-zA-Z0-9]/g,"").slice(0,12); })();
const VIEWER_PASSWORD = process.env.VIEWER_PASSWORD || (function(){ _genViewerPw = true; return "VW-"  + crypto.randomBytes(9).toString("base64").replace(/[^a-zA-Z0-9]/g,"").slice(0,12); })();

// سرّ توقيع الجلسات: يُفضّل ضبطه في البيئة (SESSION_SECRET) ليبقى الدخول صالحًا بعد إعادة التشغيل.
let _genSessionSecret = false;
const SESSION_SECRET = process.env.SESSION_SECRET || (function(){ _genSessionSecret = true; return crypto.randomBytes(48).toString("hex"); })();

const PUBLIC_DIR = path.join(__dirname, "public");
// مجلد تخزين دائم للبيانات المُدخلة من اللوحة وسجل التدقيق
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const OVERRIDES_FILE = path.join(DATA_DIR, "overrides.json");
const AUDIT_FILE = path.join(DATA_DIR, "audit.json");
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

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
    // اقبل نفس الـ host فقط، مع localhost للتطوير المحلي.
    if(src.host===host) return true;
    if((src.hostname==="localhost" || src.hostname==="127.0.0.1") && (host||"").startsWith(src.hostname)) return true;
    return false;
  }catch(e){ return false; }
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

/* ============ جلسات بلا حالة (موقّعة) — تبقى صالحة بعد إعادة التشغيل ============
 * بدل تخزين الجلسات في ذاكرة الخادم (التي تُمسح عند كل إعادة تشغيل أو سكون)،
 * نوقّع رمز الجلسة بمفتاح سرّي. الرمز يحمل الدور وتاريخ الانتهاء، ويُتحقق منه
 * عند كل طلب. ضبط SESSION_SECRET في البيئة يجعل الدخول مستمرًا عبر عمليات النشر. */
function signSession(role){
  const payload = Buffer.from(JSON.stringify({ r:role, e:Date.now()+SESSION_TTL_MS, n:crypto.randomBytes(6).toString("hex") }))
    .toString("base64").replace(/=+$/,"").replace(/\+/g,"-").replace(/\//g,"_");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64")
    .replace(/=+$/,"").replace(/\+/g,"-").replace(/\//g,"_");
  return payload + "." + sig;
}
function verifySession(token){
  if(!token || token.indexOf(".")<0) return null;
  const [payload, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64")
    .replace(/=+$/,"").replace(/\+/g,"-").replace(/\//g,"_");
  try{
    const a = Buffer.from(sig), b = Buffer.from(expected);
    if(a.length!==b.length || !crypto.timingSafeEqual(a,b)) return null;
    const data = JSON.parse(Buffer.from(payload.replace(/-/g,"+").replace(/_/g,"/"),"base64").toString("utf8"));
    if(!data || Date.now()>Number(data.e)) return null;
    return { role: data.r };
  }catch(e){ return null; }
}

/* ============ تخزين دائم: العناصر المُدخلة يدويًا + سجل التدقيق ============ */
function ensureDataDir(){ try{ fs.mkdirSync(DATA_DIR,{recursive:true}); }catch(e){} }
function readJsonFile(file, fallback){
  try{ if(fs.existsSync(file)) return JSON.parse(fs.readFileSync(file,"utf8")); }catch(e){}
  return fallback;
}
function writeJsonFile(file, data){
  try{ ensureDataDir(); fs.writeFileSync(file, JSON.stringify(data,null,2)); return true; }
  catch(e){ console.error("[persist] فشل الحفظ:", file, e.message); return false; }
}
let overrides = readJsonFile(OVERRIDES_FILE, []);   // عناصر يضيفها الأدمن من اللوحة
let auditLog  = readJsonFile(AUDIT_FILE, []);       // سجل "مَن غيّر ماذا ومتى"
const MANAGEMENT_FILE = path.join(DATA_DIR, "management-center.json");
let managementCenter = readJsonFile(MANAGEMENT_FILE, {
  notifications:[], actions:[], approvals:[], changes:[], evidence:[], meetings:[], zones:[], gallery:[], escalations:[]
});
function saveManagementCenter(){ writeJsonFile(MANAGEMENT_FILE, managementCenter); }
function ensureManagementBuckets(){
  ["notifications","actions","approvals","changes","evidence","meetings","zones","gallery","escalations"].forEach(k=>{
    if(!Array.isArray(managementCenter[k])) managementCenter[k]=[];
  });
}
function saveOverrides(){ writeJsonFile(OVERRIDES_FILE, overrides); }
function audit(actor, action, detail){
  const entry = { at:new Date().toISOString(), actor:actor||"—", action, detail:detail||"" };
  auditLog.unshift(entry);
  if(auditLog.length>500) auditLog = auditLog.slice(0,500);
  writeJsonFile(AUDIT_FILE, auditLog);
}

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
  const state = buildState(mergeOverrides(items));
  liveState = state;
  liveUpdatedAt = new Date().toISOString();
  liveVersion = liveVersion || 1;
  liveHash = crypto.createHash("sha1").update(JSON.stringify({tracks:state.tracks,items:state.items})).digest("hex");
}
let liveState = null;     // آخر حالة مبنية بنجاح
let lastBaseItems = [];   // آخر عناصر مصدر معروفة (جدول/تجريبية) قبل دمج الإدخال اليدوي
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
function cleanManagementPayload(body){
  return {
    id: crypto.randomBytes(8).toString("hex"),
    recipients: clean(body.recipients || body.to || "جميع مديري المسارات", 160),
    priority: clean(body.priority || "متوسطة", 40),
    type: clean(body.type || "متابعة", 60),
    due: clean(body.due || "", 40),
    updateDue: clean(body.updateDue || "", 40),
    message: clean(body.message || body.title || "", 600),
    title: clean(body.title || body.message || "", 220),
    owner: clean(body.owner || body.recipients || "", 160),
    status: clean(body.status || "مرسل", 60),
    createdAt: new Date().toISOString()
  };
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

/* ============ دمج العناصر المُدخلة يدويًا مع عناصر الجدول ============ */
function mergeOverrides(items){
  if(!Array.isArray(overrides) || !overrides.length) return items;
  const extra = overrides
    .filter(o=>o && VALID_TRACKS.includes(o.track) && o.title)
    .map(o=>({ track:o.track, type:normalizeType(o.type), title:clean(o.title,220),
               owner:clean(o.owner,120), status:clean(o.status||"قيد التنفيذ",60),
               due:clean(o.due,40), _src:"manual", _id:o.id }));
  return items.concat(extra);
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
    lastBaseItems = items.slice();   // عناصر المصدر قبل دمج الإدخال اليدوي (لإعادة البناء لاحقًا)
    applyBuiltState(buildState(mergeOverrides(items)));
    lastSync = { ok:true, at:new Date().toISOString(), rows:rowsLen, error:null, source:lastSync.source };
  }catch(e){
    lastSync = { ok:false, at:new Date().toISOString(), rows:lastSync.rows||0, error:e.message||String(e), source:lastSync.source };
    if(!liveState){ // أول إقلاع فشل: اعرض بيانات القالب المرفقة حتى تكون اللوحة كاملة فورًا
      lastBaseItems = fallbackItems();
      applyBuiltState(buildState(mergeOverrides(lastBaseItems)));
    }
    console.error("[sheet-sync] فشل السحب:", e.message);
  }
}
// يعيد بناء اللوحة من آخر عناصر مصدر معروفة + الإدخال اليدوي (لا يعتمد على نجاح سحب الجدول)
function rebuildLiveState(){
  applyBuiltState(buildState(mergeOverrides(lastBaseItems)));
}
// يطبّق حالة مبنية ويحدّث النسخة/البصمة عند تغيّر المحتوى فقط
function applyBuiltState(state){
  const hash = crypto.createHash("sha1").update(JSON.stringify({tracks:state.tracks,items:state.items})).digest("hex");
  if(hash !== liveHash){
    liveHash = hash; liveVersion += 1; liveUpdatedAt = new Date().toISOString(); liveState = state;
  }else if(!liveState){
    liveState = state; liveUpdatedAt = new Date().toISOString(); liveVersion = liveVersion||1;
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
  const tok=getCookie(req,"kag_session");
  return !!verifySession(tok);
}
function isAdmin(req){
  const tok=getCookie(req,"kag_session");
  const s=verifySession(tok);
  return !!(s && s.role==="admin");
}
// نسخة عامة من حالة المزامنة بدون تفاصيل داخلية حساسة
function publicSync(){
  return { ok:lastSync.ok, at:lastSync.at, rows:lastSync.rows, source:lastSync.source,
           error: lastSync.error ? "تعذّر سحب البيانات من المصدر" : null };
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
    const cache = /\.(png|jpg|jpeg|svg|ico)$/i.test(filePath) ? "public, max-age=3600" : "no-cache";
    res.writeHead(200,{"Content-Type":mimeType(filePath),"Cache-Control":cache});
    fs.createReadStream(filePath).pipe(res);
  });
}

let lastForcedRefresh=0;
function serveLoginGate(res){
  var html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>تسجيل الدخول — مركز القيادة المباشر</title>
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
  <div class="brand"><h1>مركز القيادة المباشر</h1><p>حدائق الملك عبدالله — سجّل دخولك (Viewer أو Admin)</p></div>
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
      return sendJson(res,200,{version:liveVersion,updatedAt:liveUpdatedAt,state:liveState,sync:publicSync()});
    }

    // حالة مصدر البيانات (تفاصيل حساسة) — للأدمن فقط
    if(url==="/api/config"){
      if(req.method!=="GET") return sendJson(res,405,{error:"الطريقة غير مسموحة"});
      if(!isAdmin(req)) return sendJson(res,403,{error:"تتطلب صلاحية أدمن"});
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
      if(!isAdmin(req)) return sendJson(res,403,{error:"تتطلب صلاحية أدمن"});
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
      if(adminMatch || viewerMatch){
        clearLoginFails(ip);
        const role = adminMatch ? "admin" : "viewer";
        const tok = signSession(role);
        audit(role==="admin"?ADMIN_USERNAME:VIEWER_USERNAME, "تسجيل دخول", "الدور: "+role);
        res.writeHead(200,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
          "Set-Cookie":sessionCookie(req,tok,false)});
        return res.end(JSON.stringify({ok:true, role}));
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
        const tok = signSession("admin");
        audit(ADMIN_USERNAME, "ترقية إلى أدمن", "");
        res.writeHead(200,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
          "Set-Cookie":sessionCookie(req,tok,false)});
        return res.end(JSON.stringify({ok:true,role:"admin"}));
      }
      recordLoginFail(ip);
      return sendJson(res,401,{ok:false,error:"بيانات دخول الإدارة غير صحيحة"});
    }
    if(url==="/api/logout"){
      if(req.method!=="POST") return sendJson(res,405,{error:"الطريقة غير مسموحة"});
      if(!sameOrigin(req)) return sendJson(res,403,{ok:false,error:"مصدر غير موثوق"});
      res.writeHead(200,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
        "Set-Cookie":sessionCookie(req,"",true)});
      return res.end(JSON.stringify({ok:true}));
    }
    if(req.method==="GET" && url==="/api/admin-check")
      return sendJson(res,200,{authed:isAuthed(req), isAdmin:isAdmin(req)});

    // ===== العناصر المُدخلة يدويًا من اللوحة (إضافة/حذف/عرض) =====
    if(url==="/api/items"){
      if(req.method==="GET"){
        if(!isAuthed(req)) return sendJson(res,401,{error:"يلزم تسجيل الدخول"});
        return sendJson(res,200,{items:overrides});
      }
      if(req.method==="POST"){
        if(!sameOrigin(req)) return sendJson(res,403,{error:"مصدر غير موثوق"});
        if(!isAdmin(req)) return sendJson(res,403,{error:"تتطلب صلاحية أدمن"});
        let body={}; const raw=await readBody(req);
        try{ body=raw?JSON.parse(raw):{}; }catch(e){ return sendJson(res,400,{error:"طلب غير صالح"}); }
        const track=normalizeTrack(body.track);
        if(!VALID_TRACKS.includes(track) || !String(body.title||"").trim())
          return sendJson(res,400,{error:"المسار أو العنوان غير صالح"});
        const item={ id:crypto.randomBytes(8).toString("hex"),
          track, type:normalizeType(body.type), title:clean(body.title,220),
          owner:clean(body.owner,120), status:clean(body.status||"قيد التنفيذ",60),
          due:clean(body.due,40), createdAt:new Date().toISOString() };
        overrides.push(item); saveOverrides();
        audit(ADMIN_USERNAME, "إضافة عنصر", `[${track}] ${item.title}`);
        rebuildLiveState();
        return sendJson(res,200,{ok:true,item,version:liveVersion});
      }
      return sendJson(res,405,{error:"الطريقة غير مسموحة"});
    }
    if(url==="/api/items/delete" && req.method==="POST"){
      if(!sameOrigin(req)) return sendJson(res,403,{error:"مصدر غير موثوق"});
      if(!isAdmin(req)) return sendJson(res,403,{error:"تتطلب صلاحية أدمن"});
      let body={}; const raw=await readBody(req);
      try{ body=raw?JSON.parse(raw):{}; }catch(e){ return sendJson(res,400,{error:"طلب غير صالح"}); }
      const id=String(body.id||""); const before=overrides.length;
      const removed=overrides.find(o=>o.id===id);
      overrides=overrides.filter(o=>o.id!==id);
      if(overrides.length!==before){ saveOverrides(); audit(ADMIN_USERNAME,"حذف عنصر",removed?`[${removed.track}] ${removed.title}`:id); rebuildLiveState(); }
      return sendJson(res,200,{ok:true,version:liveVersion});
    }

    // ===== مركز الإشعارات ومراكز التشغيل المتقدمة =====
    if(req.method==="GET" && url==="/api/management-center"){
      if(REQUIRE_LOGIN && !isAuthed(req)) return sendJson(res,401,{error:"يلزم تسجيل الدخول"});
      ensureManagementBuckets();
      return sendJson(res,200,{ok:true,data:managementCenter});
    }
    if(req.method==="POST" && url==="/api/management-center"){
      if(!sameOrigin(req)) return sendJson(res,403,{error:"مصدر غير موثوق"});
      if(!isAdmin(req)) return sendJson(res,403,{error:"تتطلب صلاحية أدمن"});
      let body={}; const raw=await readBody(req);
      try{ body=raw?JSON.parse(raw):{}; }catch(e){ return sendJson(res,400,{error:"طلب غير صالح"}); }
      const bucket=String(body.bucket||"actions");
      ensureManagementBuckets();
      if(!Object.prototype.hasOwnProperty.call(managementCenter,bucket)) return sendJson(res,400,{error:"نوع المركز غير صالح"});
      const item=cleanManagementPayload(body);
      managementCenter[bucket].unshift(item);
      if(managementCenter[bucket].length>300) managementCenter[bucket]=managementCenter[bucket].slice(0,300);
      saveManagementCenter(); audit(ADMIN_USERNAME,"إضافة في مركز التشغيل",`${bucket}: ${item.title||item.message}`);
      return sendJson(res,200,{ok:true,item,data:managementCenter});
    }
    if(req.method==="GET" && url==="/api/notifications"){
      if(REQUIRE_LOGIN && !isAuthed(req)) return sendJson(res,401,{error:"يلزم تسجيل الدخول"});
      ensureManagementBuckets();
      return sendJson(res,200,{ok:true,notifications:managementCenter.notifications});
    }
    if(req.method==="POST" && url==="/api/notifications"){
      if(!sameOrigin(req)) return sendJson(res,403,{error:"مصدر غير موثوق"});
      if(!isAdmin(req)) return sendJson(res,403,{error:"تتطلب صلاحية أدمن"});
      let body={}; const raw=await readBody(req);
      try{ body=raw?JSON.parse(raw):{}; }catch(e){ return sendJson(res,400,{error:"طلب غير صالح"}); }
      const notification=cleanManagementPayload(body);
      ensureManagementBuckets();
      managementCenter.notifications.unshift(notification);
      if(managementCenter.notifications.length>500) managementCenter.notifications=managementCenter.notifications.slice(0,500);
      saveManagementCenter(); audit(ADMIN_USERNAME,"إرسال إشعار",`${notification.recipients}: ${notification.message}`);
      return sendJson(res,200,{ok:true,notification,notifications:managementCenter.notifications});
    }
    if(req.method==="GET" && url==="/api/system-health"){
      if(REQUIRE_LOGIN && !isAuthed(req)) return sendJson(res,401,{error:"يلزم تسجيل الدخول"});
      ensureManagementBuckets();
      return sendJson(res,200,{ok:true,health:{
        server:true,
        sync:lastSync,
        version:liveVersion,
        updatedAt:liveUpdatedAt,
        rows:lastSync.rows||0,
        notifications:managementCenter.notifications.length,
        audit:auditLog.length,
        reportEngine:fs.existsSync(path.join(__dirname,"generate_report.py")),
        dataDir:DATA_DIR
      }});
    }

    // ===== سجل التدقيق (مَن غيّر ماذا ومتى) — للأدمن فقط =====
    if(req.method==="GET" && url==="/api/audit"){
      if(!isAdmin(req)) return sendJson(res,403,{error:"تتطلب صلاحية أدمن"});
      return sendJson(res,200,{audit:auditLog.slice(0,100)});
    }

    // ===== توليد التقارير (Python) =====
    if(url.startsWith("/api/report") && req.method==="POST"){
      if(!isAdmin(req)) return sendJson(res,403,{error:"تتطلب صلاحية أدمن"});
      let body={};
      const raw=await readBody(req);
      try{ body=raw?JSON.parse(raw):{}; }catch(e){ return sendJson(res,400,{error:"طلب غير صالح"}); }
      const reportType = body.type || "comprehensive";
      if(!liveState) return sendJson(res,503,{error:"البيانات غير متاحة بعد"});
      try{
        const {execFile} = require("child_process");
        const scriptPath = path.join(__dirname,"generate_report.py");
        const inputData  = JSON.stringify({type:reportType, state:liveState});
        const buf = await new Promise((resolve,reject)=>{
          const chunks=[];
          const proc = execFile("python3",[scriptPath],{maxBuffer:50*1024*1024},(err,stdout,stderr)=>{
            if(err){ reject(new Error(stderr||err.message)); return; }
          });
          proc.stdin.write(inputData);
          proc.stdin.end();
          proc.stdout.on("data",chunk=>chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk)));
          proc.stdout.on("end",()=>resolve(Buffer.concat(chunks)));
          proc.stderr.on("data",d=>{}); // تجاهل stderr
          proc.on("error",reject);
        });
        const safeNames = {"comprehensive":"Comprehensive","أ":"A","ب":"B","ج":"C","د":"D"};
        const safeName  = safeNames[reportType] || "Report";
        const dateStr   = new Date().toISOString().slice(0,10);
        const fname     = `KAGA-Report-${safeName}-${dateStr}.pptx`;
        res.writeHead(200,{
          "Content-Type":"application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "Content-Disposition":`attachment; filename="${fname}"`,
          "Content-Length": buf.length,
          "Cache-Control":"no-store"
        });
        return res.end(buf);
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
  ensureDataDir();
  await refreshFromSheet();
  setInterval(refreshFromSheet, SHEET_REFRESH_MS);
  server.listen(PORT,()=>{
    console.log(`KAG Operational Analytics Platform يعمل على http://localhost:${PORT}`);
    console.log(`مصدر البيانات: ${SHEET_ID?("Google Sheet ["+SHEET_ID+"]"):"بيانات تجريبية (لم يُضبط SHEET_ID)"}`);
    console.log(`اسم مستخدم الأدمن: ${ADMIN_USERNAME}  |  اسم مستخدم المشاهد: ${VIEWER_USERNAME}`);
    console.log(`العناصر المُدخلة يدويًا: ${overrides.length}  |  سجل التدقيق: ${auditLog.length} مدخل`);
    if(_genAdminPw)  console.log(`⚠️  لم تُضبط ADMIN_PASSWORD — كلمة مرور أدمن مؤقتة: ${ADMIN_PASSWORD}`);
    if(_genViewerPw) console.log(`⚠️  لم تُضبط VIEWER_PASSWORD — كلمة مرور مشاهد مؤقتة: ${VIEWER_PASSWORD}`);
    if(_genSessionSecret) console.log("⚠️  لم يُضبط SESSION_SECRET — ستنتهي الجلسات عند كل إعادة نشر. اضبطه في البيئة لجلسات ثابتة.");
    if(!_genAdminPw && !_genViewerPw && !_genSessionSecret) console.log("✓ جميع الأسرار مضبوطة من متغيّرات البيئة.");
    if(REQUIRE_LOGIN) console.log("الوضع: قفل كامل (REQUIRE_LOGIN=true) — لا تُعرض البيانات إلا بعد تسجيل الدخول.");
  });
})();
