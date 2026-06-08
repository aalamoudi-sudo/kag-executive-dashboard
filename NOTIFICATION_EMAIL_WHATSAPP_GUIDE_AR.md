# دليل ربط مركز الإشعارات بالبريد الإلكتروني والواتساب

تمت إضافة مركز الإشعارات مع دعم قنوات إرسال متعددة:

- داخل النظام
- البريد الإلكتروني عبر Webhook
- واتساب عبر Webhook / WhatsApp Business API وسيط
- Webhook خارجي عام

## متغيرات البيئة المطلوبة

```bash
EMAIL_WEBHOOK_URL=https://example.com/email-webhook
WHATSAPP_WEBHOOK_URL=https://example.com/whatsapp-webhook
NOTIFICATION_WEBHOOK_URL=https://example.com/general-webhook
EMAIL_FROM_NAME=منصة حدائق الملك عبدالله
TRACK_CONTACTS={"أ":{"email":"track-a@example.com","whatsapp":"+966500000001"},"ب":{"email":"track-b@example.com","whatsapp":"+966500000002"}}
```

## صيغة البيانات المرسلة للـ Webhook

يرسل النظام JSON يحتوي على:

- `source`: KAG
- `type`: email أو whatsapp أو general-webhook
- `recipients`: قائمة الإيميلات أو أرقام الواتساب
- `contacts`: بيانات مديري المسارات
- `notification`: تفاصيل الإشعار، الأهمية، الإجراء، موعد التسليم، وموعد التحديث

## ملاحظات تشغيلية

- إرسال الإشعارات مقصور على صلاحية Admin.
- في حال عدم ضبط Webhook، يتم تسجيل الإشعار داخل النظام مع توضيح أن قناة البريد أو الواتساب غير مفعلة.
- يمكن ربط `WHATSAPP_WEBHOOK_URL` بخدمة وسيطة تتعامل مع WhatsApp Business API أو مزود معتمد.
- لا يتم تخزين كلمات مرور أو مفاتيح API داخل الكود؛ جميعها من متغيرات البيئة في Render.
