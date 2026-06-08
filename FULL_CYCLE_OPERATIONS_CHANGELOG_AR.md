# سجل تطوير دورة التشغيل الكاملة

تمت إضافة طبقة تشغيل كاملة تربط الإشعار بالمهمة، ثم المتابعة، ثم التصعيد، ثم الدليل، ثم التقرير.

## أهم الإضافات
- تحويل الإشعارات تلقائيًا إلى مهام قابلة للإغلاق.
- سجل تدقيق Audit Log لكل عملية مهمة.
- صلاحيات أساسية حسب الدور: Admin / Viewer.
- تحديث حالة المهام مع ملاحظة ورابط دليل.
- تحديث الاعتمادات من الواجهة.
- إشعارات حيّة داخلية عبر polling.
- PWA لإضافة المنصة على شاشة الجوال.
- ملف manifest و service worker.

## نقاط يجب على التقني ضبطها في Render
- ADMIN_USERNAME / ADMIN_PASSWORD
- VIEWER_USERNAME / VIEWER_PASSWORD
- TRACK_CONTACTS
- EMAIL_WEBHOOK_URL
- WHATSAPP_WEBHOOK_URL
- NOTIFICATION_WEBHOOK_URL
- REQUIRE_LOGIN=true بعد الانتهاء من الاختبار
