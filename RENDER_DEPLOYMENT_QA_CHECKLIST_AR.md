# قائمة فحص النشر على Render

1. فك ضغط الحزمة وارفع محتوياتها إلى GitHub، وليس ملف ZIP نفسه.
2. تأكد أن الملفات التالية في جذر المستودع: `server.js`, `package.json`, `render.yaml`, `public/index.html`.
3. في Render استخدم:
   - Build Command: `npm install && pip install -r requirements.txt`
   - Start Command: `node server.js`
   - Health Check Path: `/api/health`
4. أضف متغيرات البيئة من ملف `.env.example`.
5. بعد أي رفع جديد استخدم: Manual Deploy → Clear build cache & deploy.
6. اختبر الروابط:
   - `/api/health`
   - `/api/state`
   - `/api/operational-summary`
   - `/api/data-quality`
7. جرّب دخول الأدمن، المشاهد، ومدير مسار واحد على الأقل.
8. أرسل إشعارًا تجريبيًا وتأكد أنه تحول إلى مهمة.
9. أغلق مهمة تجريبية مع رابط دليل وتأكد من ظهورها في سجل التدقيق.
