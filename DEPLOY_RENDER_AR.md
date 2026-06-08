# نشر "منصة التحليل التشغيلي" على Render — تعليمات مختصرة

> الهدف: رابط ثابت دائم يفتحه الفريق، مع قفل دخول كامل.
> الوقت المتوقع: ١٠–١٥ دقيقة، مرة واحدة فقط.

## المرحلة (أ): رفع الكود على GitHub
1. أنشئ حسابًا مجانيًا على https://github.com
2. اضغط **New** لإنشاء مستودع (Repository) جديد، سمّه مثلًا: `kaga-command-center`، واتركه **Public** أو **Private** (كلاهما يعمل).
3. داخل المستودع اضغط **Add file ‹ Upload files**، ثم **اسحب كل ملفات هذا المجلد** (وليس المجلد نفسه — بل محتوياته: server.js و package.json و render.yaml ومجلد public ... إلخ).
4. اضغط **Commit changes**.

## المرحلة (ب): الربط بـ Render
1. على https://render.com اضغط **New + ‹ Web Service**.
2. اختر **Git Provider ‹ GitHub**، واربط حسابك، ثم اختر المستودع `kaga-command-center`.
3. إعدادات الخدمة (إن لم تُضبط تلقائيًا من render.yaml):
   - **Language / Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** Free
4. تحت **Environment Variables** تأكد من وجود (موجودة تلقائيًا عبر render.yaml):
   - `REQUIRE_LOGIN` = `true`
   - `ADMIN_USERNAME` = `MAYADEEN`
   - `ADMIN_PASSWORD` = `<يتم ضبطها في متغير ADMIN_PASSWORD>`
5. اضغط **Create Web Service** وانتظر حتى تظهر "Live".

## النتيجة
- ستحصل على رابط ثابت مثل: `https://kaga-command-center.onrender.com`
- يفتحه الفريق ← تظهر بوابة الدخول ← يدخلون بـ MAYADEEN / <يتم ضبطها في متغير ADMIN_PASSWORD> ← تظهر اللوحة.
- لا أحد يرى أي شيء بدون تسجيل الدخول.
- HTTPS مفعّل تلقائيًا من Render (الكوكي الآمن يعمل).

## ملاحظات
- الخطة المجانية: الخدمة "تنام" بعد فترة خمول، وتستيقظ خلال ٣٠–٦٠ ثانية عند أول فتح. للاستخدام الدائم بلا انتظار، رقّ الخطة لاحقًا.
- تحديث البيانات يبقى من Google Sheet مباشرة — لا علاقة له بـ Render.
- لتغيير كلمة المرور: عدّل قيمة `ADMIN_PASSWORD` في صفحة Environment داخل Render ثم احفظ.
