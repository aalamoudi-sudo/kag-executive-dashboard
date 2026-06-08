# تشغيل سريع للتقني

## محليًا
```bash
npm install
pip install -r requirements.txt
npm run check
REQUIRE_LOGIN=false npm start
```

## اختبار سريع
```bash
npm run smoke
```

## إعداد مديري المسارات
ضع في Render متغير `TRACK_USERS` بصيغة JSON، مثال:
```json
{
  "أ": {"username":"planning","password":"StrongPass1!","name":"مدير التخطيط"},
  "ب": {"username":"media","password":"StrongPass2!","name":"مدير التواصل"}
}
```

## إعداد جهات الاتصال للإشعارات
ضع في Render متغير `TRACK_CONTACTS` بصيغة JSON، مثال:
```json
{
  "أ": {"email":"planning@example.com","whatsapp":"+9665xxxxxxxx"},
  "ب": {"email":"media@example.com","whatsapp":"+9665xxxxxxxx"}
}
```

## نقاط مهمة
- الأدمن يرى كل شيء.
- مدير المسار يرى مساره فقط.
- كل تحديث مهمة أو اعتماد يُسجّل في Audit Log.
- صفحة ملخص التشغيل تعتمد على بيانات المهام والاعتمادات وجودة البيانات.
