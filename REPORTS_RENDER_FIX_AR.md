# إصلاح تقارير PDF وPowerPoint على Render

تم إصلاح سبب الخطأ: `ModuleNotFoundError: No module named 'pptx'` عبر الآتي:

1. إضافة `python-pptx` و `reportlab` وباقي مكتبات PDF في `requirements.txt`.
2. تحديث `render.yaml` ليستخدم: `python3 -m pip install --user -r requirements.txt`.
3. إضافة `postinstall` داخل `package.json` حتى يتم تثبيت مكتبات Python حتى لو تم تجاهل أمر pip في إعدادات Render.
4. تعديل مركز التقارير ليولّد PDF أو PowerPoint فقط، بدون Excel/CSV للمستخدم النهائي.
5. إضافة مولد PDF مباشر `generate_pdf_report.py` كمسار احتياطي عند عدم توفر تحويل PowerPoint إلى PDF.

## بعد الرفع على GitHub
لازم في Render تنفيذ: Manual Deploy → Clear build cache & deploy.

## اختبار سريع
افتح مركز التقارير وجرب زر PDF ثم PowerPoint.
