// إعدادات تشغيل دائم عبر PM2.
// التشغيل:  pm2 start ecosystem.config.js   ثم   pm2 save
//
// ملاحظة أمنية: لا تكتب كلمات المرور هنا. اضبطها كمتغيّرات بيئة في النظام
// قبل التشغيل، مثل:
//   export ADMIN_PASSWORD="كلمة_قوية"
//   export VIEWER_PASSWORD="كلمة_المشاهد"
//   export SESSION_SECRET="سر_عشوائي_ثابت"
//   export SHEET_ID="معرّف_جوجل_شيت"
//   pm2 start ecosystem.config.js
module.exports = {
  apps: [{
    name: "kag",
    script: "server.js",
    env: {
      PORT: 3000,
      REQUIRE_LOGIN: "true",   // قفل كامل: لا يُعرض أي شيء قبل تسجيل الدخول
      ADMIN_USERNAME: "MAYADEEN",
      VIEWER_USERNAME: "KAG_VIEWER"
      // كلمات المرور وSESSION_SECRET وSHEET_ID تُقرأ من بيئة النظام (لا تُكتب هنا)
    }
  }]
};
