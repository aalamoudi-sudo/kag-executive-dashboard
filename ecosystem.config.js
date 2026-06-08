// إعدادات تشغيل دائم عبر PM2.
// التشغيل: pm2 start ecosystem.config.js ثم pm2 save
// ملاحظة: لا تضع كلمات المرور داخل هذا الملف. اضبطها من متغيرات البيئة.
module.exports = {
  apps: [{
    name: "kag-operational-analytics",
    script: "server.js",
    env: {
      PORT: 3000,
      ADMIN_USERNAME: process.env.ADMIN_USERNAME || "MAYADEEN",
      VIEWER_USERNAME: process.env.VIEWER_USERNAME || "KAG_VIEWER",
      REQUIRE_LOGIN: "true"
      // ADMIN_PASSWORD و VIEWER_PASSWORD و SHEET_ID و SHEET_CSV_URL تُضبط خارج الملف
    }
  }]
};
