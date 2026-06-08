# قالب متغيرات Render المقترح

انسخ هذه المتغيرات إلى Render Environment Variables وعدّل القيم حسب المشروع.

```txt
REQUIRE_LOGIN=true
ADMIN_USERNAME=MAYADEEN
ADMIN_PASSWORD=ضع_كلمة_مرور_قوية
VIEWER_USERNAME=VIEWER
VIEWER_PASSWORD=ضع_كلمة_مرور_مشاهد
SHEET_ID=ضع_معرف_Google_Sheet
SHEET_NAME=
SHEET_CSV_URL=
OPENING_DATE=2026-09-27
EMAIL_WEBHOOK_URL=
WHATSAPP_WEBHOOK_URL=
NOTIFICATION_WEBHOOK_URL=
EMAIL_FROM_NAME=منصة حدائق الملك عبدالله
ROLE_USERS_JSON=[]
TRACK_CONTACTS={}
```

## مثال ROLE_USERS_JSON

```json
[
  {"username":"ops","password":"change-me","name":"مدير التشغيل","trackId":"أ","permissions":["read","write","notify"]},
  {"username":"safety","password":"change-me","name":"مدير السلامة","trackId":"ب","permissions":["read","write","notify"]}
]
```

## مثال TRACK_CONTACTS

```json
{
  "أ":{"email":"ops@example.com","whatsapp":"9665XXXXXXXX"},
  "ب":{"email":"safety@example.com","whatsapp":"9665XXXXXXXX"}
}
```
