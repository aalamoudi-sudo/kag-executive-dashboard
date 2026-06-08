#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_report.py v4 — مولّد تقارير PPTX (قائم بذاته)
======================================================
يبني العرض التقديمي بالكامل برمجيًا باستخدام python-pptx،
بدون الاعتماد على أي ملفات قوالب خارجية (هذا يمنع أعطال
"القالب غير موجود" نهائيًا ويجعل المحرك يعمل في أي بيئة).

الاستخدام:
    echo '{"type":"comprehensive","state":{...}}' | python3 generate_report.py > out.pptx

الأنواع المدعومة: comprehensive | أ | ب | ج | د
"""
import sys, json, io
from datetime import datetime
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn

# ============================================================
# هوية بصرية — Royal Emerald & Gold / Navy
# ============================================================
NAVY      = RGBColor(0x0D, 0x1B, 0x2A)   # خلفية داكنة
NAVY2     = RGBColor(0x13, 0x29, 0x3D)   # بطاقات داكنة
GOLD      = RGBColor(0xC9, 0xA8, 0x4C)   # ذهبي
GOLD_SOFT = RGBColor(0xD9, 0xB8, 0x6C)
WHITE     = RGBColor(0xEA, 0xF0, 0xF7)
MUTED     = RGBColor(0x9F, 0xB0, 0xC3)
GREEN     = RGBColor(0x4C, 0xC9, 0x8A)
AMBER     = RGBColor(0xE8, 0xB5, 0x4C)
RED       = RGBColor(0xE8, 0x6C, 0x6C)
CARD_LINE = RGBColor(0x2A, 0x3D, 0x52)

SW, SH = Inches(13.333), Inches(7.5)   # 16:9
FONT = "Tahoma"

TRACK_META = {
    "أ": ("التخطيط والتنسيق", "Planning & Coordination"),
    "ب": ("التواصل والتسويق", "Communication & Marketing"),
    "ج": ("الفعاليات والأنشطة المصاحبة", "Events & Supporting Activities"),
    "د": ("تجهيز وتفعيل الحديقة", "Garden Setup & Activation"),
}

# ============================================================
# مساعدات بيانات
# ============================================================
def today_str(): return datetime.now().strftime("%Y/%m/%d")
def week_num():  return datetime.now().isocalendar()[1]

def fmt_date(d):
    if not d: return "—"
    try: return datetime.strptime(str(d)[:10], "%Y-%m-%d").strftime("%Y/%m/%d")
    except: return str(d)[:10] or "—"

DONE_SET   = ["مكتملة","مكتمل","معتمدة","معتمد","ضمن المسار","Completed","Cleared"]
ACTIVE_SET = ["قيد التنفيذ","تحت المتابعة","In Progress","Watch"]
RISK_SET   = ["معرضة للخطر","معرض للخطر","متأخرة","At Risk"]

def is_done(i):   return i.get("status","") in DONE_SET
def is_active(i): return i.get("status","") in ACTIVE_SET
def is_risk_item(i): return i.get("type","") in ["risks","مخاطرة","مخاطر"]

def status_color(s):
    if s in DONE_SET:   return GREEN
    if s in ACTIVE_SET: return AMBER
    if s in RISK_SET:   return RED
    return MUTED

def days_to_open(state):
    od = state.get("project",{}).get("openingDate","2026-09-27")
    try:
        d = datetime.strptime(od[:10], "%Y-%m-%d")
        return max(0, (d - datetime.now()).days)
    except: return "—"

# ============================================================
# مساعدات رسم
# ============================================================
def _rtl(paragraph):
    pPr = paragraph._pPr
    if pPr is None:
        pPr = paragraph._p.get_or_add_pPr()
    pPr.set("rtl", "1")

def bg(slide, color):
    f = slide.background.fill
    f.solid(); f.fore_color.rgb = color

def textbox(slide, x, y, w, h, lines, *, size=14, color=WHITE, bold=False,
            align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.TOP, rtl=True, space=2, font=FONT):
    """lines = نص واحد أو قائمة (نص) أو قائمة tuples (نص, dict خصائص)."""
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame; tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = Pt(2)
    tf.margin_top = tf.margin_bottom = Pt(1)
    if isinstance(lines, (str, int, float)):
        lines = [str(lines)]
    first = True
    for ln in lines:
        props = {}
        if isinstance(ln, tuple):
            ln, props = ln[0], ln[1]
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        p.alignment = props.get("align", align)
        p.space_after = Pt(props.get("space", space))
        if rtl: _rtl(p)
        run = p.add_run(); run.text = str(ln)
        fn = run.font
        fn.name = props.get("font", font)
        fn.size = Pt(props.get("size", size))
        fn.bold = props.get("bold", bold)
        fn.color.rgb = props.get("color", color)
    return tb

def card(slide, x, y, w, h, fill=NAVY2, line=CARD_LINE, line_w=1.0, radius=True):
    shp_type = MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE
    s = slide.shapes.add_shape(shp_type, x, y, w, h)
    s.fill.solid(); s.fill.fore_color.rgb = fill
    s.line.color.rgb = line; s.line.width = Pt(line_w)
    s.shadow.inherit = False
    return s

def accent_bar(slide, x, y, w, h, color=GOLD):
    s = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    s.fill.solid(); s.fill.fore_color.rgb = color
    s.line.fill.background(); s.shadow.inherit = False
    return s

def new_slide(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])  # blank
    return s

# ============================================================
# شرائح مشتركة
# ============================================================
def slide_cover(prs, title, subtitle, state):
    s = new_slide(prs); bg(s, NAVY)
    accent_bar(s, Inches(0), Inches(0), SW, Inches(0.12), GOLD)
    textbox(s, Inches(0.8), Inches(1.7), Inches(11.7), Inches(0.6),
            "حدائق الملك عبدالله", size=22, color=GOLD, bold=True)
    textbox(s, Inches(0.8), Inches(2.35), Inches(11.7), Inches(1.4),
            title, size=40, color=WHITE, bold=True)
    textbox(s, Inches(0.8), Inches(3.9), Inches(11.7), Inches(0.6),
            subtitle, size=18, color=MUTED)
    # شريط معلومات سفلي
    info = f"الأسبوع {week_num()} · {today_str()}   |   متبقٍّ على الافتتاح: {days_to_open(state)} يوم"
    textbox(s, Inches(0.8), Inches(6.4), Inches(11.7), Inches(0.6),
            info, size=15, color=GOLD_SOFT, bold=True)
    return s

def kpi_callout(slide, x, y, w, value, label, color=GOLD):
    card(slide, x, y, w, Inches(1.25), NAVY2)
    textbox(slide, x, y+Inches(0.14), w, Inches(0.7), str(value),
            size=34, color=color, bold=True, align=PP_ALIGN.CENTER)
    textbox(slide, x, y+Inches(0.86), w, Inches(0.32), label,
            size=12, color=MUTED, align=PP_ALIGN.CENTER)

def data_table(slide, x, y, w, headers, rows, *, row_h=Inches(0.42),
               col_ratios=None, max_rows=8, empty_text="لا توجد عناصر"):
    n = len(headers)
    col_ratios = col_ratios or [1.0/n]*n
    widths = [Emu(int(w * r)) for r in col_ratios]
    # رأس الجدول
    hx = x
    hbar = accent_bar(slide, x, y, w, row_h, NAVY2)
    hbar.line.color.rgb = GOLD; hbar.line.width = Pt(0.75)
    cx = x + w
    for i, head in enumerate(headers):
        cx -= widths[i]
        textbox(slide, cx, y+Inches(0.05), widths[i], Inches(0.32), head,
                size=12, color=GOLD, bold=True, align=PP_ALIGN.CENTER)
    # الصفوف
    yy = y + row_h
    shown = rows[:max_rows]
    if not shown:
        textbox(slide, x, yy+Inches(0.12), w, Inches(0.4), empty_text,
                size=13, color=MUTED, align=PP_ALIGN.CENTER)
        return
    for r in shown:
        card(slide, x, yy, w, row_h, NAVY, CARD_LINE, 0.75, radius=False)
        cx = x + w
        for i, cell in enumerate(r):
            cx -= widths[i]
            txt = cell[0] if isinstance(cell, tuple) else cell
            col = cell[1] if isinstance(cell, tuple) else WHITE
            textbox(slide, cx, yy+Inches(0.06), widths[i], Inches(0.32), txt,
                    size=11, color=col, bold=False, align=PP_ALIGN.CENTER)
        yy += row_h

# ============================================================
# التقرير الشامل
# ============================================================
def build_comprehensive(prs, state):
    tracks = state.get("tracks", [])
    items  = state.get("items", [])
    risks  = [i for i in items if is_risk_item(i) and i.get("status")!="مغلقة"]
    done   = [i for i in items if is_done(i)]
    active = [i for i in items if is_active(i)]
    overall = round(sum(t.get("progress",0) for t in tracks)/len(tracks)) if tracks else 0
    total_tasks = sum(int(t.get("tasks",0)) for t in tracks)
    total_done  = sum(int(t.get("done",0)) for t in tracks)
    open_risks  = len(risks) + sum(1 for i in items if i.get("status") in RISK_SET)

    # 1) الغلاف
    slide_cover(prs, "التقرير التنفيذي الشامل", "مركز القيادة المباشر — المكتب التنفيذي للمشروع", state)

    # 2) الملخص التنفيذي + KPIs
    s = new_slide(prs); bg(s, NAVY)
    textbox(s, Inches(0.6), Inches(0.45), Inches(12.1), Inches(0.7),
            "الملخص التنفيذي", size=30, color=GOLD, bold=True)
    gap = Inches(0.28); kw = Inches(2.86); kx = SW - Inches(0.6) - kw
    data_kpis = [(f"{overall}٪","الإنجاز العام",GOLD),
                 (total_tasks,"إجمالي المهام",WHITE),
                 (total_done,"المهام المنجزة",GREEN),
                 (open_risks,"المخاطر المفتوحة",RED)]
    for v,l,c in data_kpis:
        kpi_callout(s, kx, Inches(1.35), kw, v, l, c); kx -= (kw+gap)
    # عمودان: إنجازات / قيد التنفيذ
    colw = Inches(5.95)
    card(s, SW-Inches(0.6)-colw, Inches(2.95), colw, Inches(3.9), NAVY2)
    textbox(s, SW-Inches(0.6)-colw, Inches(3.05), colw, Inches(0.4),
            "أبرز الإنجازات", size=16, color=GREEN, bold=True, align=PP_ALIGN.CENTER)
    textbox(s, SW-Inches(0.6)-colw+Inches(0.2), Inches(3.55), colw-Inches(0.4), Inches(3.2),
            [(f"• {i.get('title','')}", {"size":13}) for i in done[:8]] or [("لا يوجد",{"color":MUTED})])
    card(s, Inches(0.6), Inches(2.95), colw, Inches(3.9), NAVY2)
    textbox(s, Inches(0.6), Inches(3.05), colw, Inches(0.4),
            "قيد التنفيذ والمتابعة", size=16, color=AMBER, bold=True, align=PP_ALIGN.CENTER)
    textbox(s, Inches(0.8), Inches(3.55), colw-Inches(0.4), Inches(3.2),
            [(f"• {i.get('title','')}", {"size":13}) for i in active[:8]] or [("لا يوجد",{"color":MUTED})])

    # 3) المسارات الأربعة
    s = new_slide(prs); bg(s, NAVY)
    textbox(s, Inches(0.6), Inches(0.45), Inches(12.1), Inches(0.7),
            "حالة المسارات الأربعة", size=30, color=GOLD, bold=True)
    cw = Inches(2.95); gap = Inches(0.2); cx = SW - Inches(0.6) - cw
    for t in tracks[:4]:
        tid = t.get("track") or t.get("id","")
        name = t.get("name") or TRACK_META.get(tid,("",""))[0]
        prog = int(t.get("progress",0)); st = t.get("status","—")
        card(s, cx, Inches(1.5), cw, Inches(4.6), NAVY2)
        accent_bar(s, cx, Inches(1.5), cw, Inches(0.1), GOLD)
        textbox(s, cx, Inches(1.75), cw, Inches(0.5), f"المسار {tid}", size=15, color=GOLD, bold=True, align=PP_ALIGN.CENTER)
        textbox(s, cx+Inches(0.1), Inches(2.25), cw-Inches(0.2), Inches(0.9), name, size=13, color=WHITE, bold=True, align=PP_ALIGN.CENTER)
        textbox(s, cx, Inches(3.25), cw, Inches(1.0), f"{prog}٪", size=44, color=GOLD, bold=True, align=PP_ALIGN.CENTER)
        textbox(s, cx, Inches(4.35), cw, Inches(0.4), st, size=13, color=status_color(st), bold=True, align=PP_ALIGN.CENTER)
        mini = f"المهام {t.get('tasks',0)} · منجزة {t.get('done',0)} · خطر {t.get('risk',0)}"
        textbox(s, cx, Inches(5.5), cw, Inches(0.5), mini, size=11, color=MUTED, align=PP_ALIGN.CENTER)
        cx -= (cw+gap)

    # 4) المخاطر والقرارات
    s = new_slide(prs); bg(s, NAVY)
    textbox(s, Inches(0.6), Inches(0.45), Inches(12.1), Inches(0.7),
            "سجل المخاطر والقرارات", size=30, color=GOLD, bold=True)
    rows = []
    for r in risks[:9]:
        rows.append([(r.get("title","—"),WHITE),(r.get("owner","—"),MUTED),
                     (r.get("status","—"),status_color(r.get("status",""))),(fmt_date(r.get("due","")),MUTED)])
    data_table(s, Inches(0.6), Inches(1.35), Inches(12.13),
               ["البند","المسؤول","الحالة","الاستحقاق"], rows,
               col_ratios=[0.46,0.22,0.18,0.14], max_rows=9,
               empty_text="لا توجد مخاطر مفتوحة مسجلة")

    # 5) الجدول الزمني
    s = new_slide(prs); bg(s, NAVY)
    textbox(s, Inches(0.6), Inches(0.45), Inches(12.1), Inches(0.7),
            "الجدول الزمني والمهام القادمة", size=30, color=GOLD, bold=True)
    tasks = [i for i in items if not is_risk_item(i)]
    upcoming = sorted([i for i in tasks if str(i.get("due",""))>datetime.now().strftime("%Y-%m-%d")],
                      key=lambda x:x.get("due",""))
    cols = [("منجزة", [i for i in tasks if is_done(i)][:7], GREEN),
            ("قيد التنفيذ", [i for i in tasks if is_active(i)][:7], AMBER),
            ("قادمة", upcoming[:7], GOLD)]
    colw = Inches(3.9); gap = Inches(0.2); cx = SW - Inches(0.6) - colw
    for title,lst,c in cols:
        card(s, cx, Inches(1.4), colw, Inches(5.4), NAVY2)
        textbox(s, cx, Inches(1.5), colw, Inches(0.4), title, size=16, color=c, bold=True, align=PP_ALIGN.CENTER)
        textbox(s, cx+Inches(0.15), Inches(2.05), colw-Inches(0.3), Inches(4.6),
                [(f"• {i.get('title','')}", {"size":12}) for i in lst] or [("لا يوجد",{"color":MUTED})])
        cx -= (colw+gap)

# ============================================================
# تقرير مسار واحد
# ============================================================
def build_track(prs, tid, state):
    tracks = state.get("tracks", [])
    items  = state.get("items", [])
    track  = next((t for t in tracks if (t.get("track") or t.get("id"))==tid), {})
    ti     = [i for i in items if i.get("track")==tid]
    risks  = [i for i in ti if is_risk_item(i) and i.get("status")!="مغلقة"]
    tasks  = [i for i in ti if not is_risk_item(i)]
    done   = [i for i in tasks if is_done(i)]
    active = [i for i in tasks if is_active(i)]
    upcoming = sorted([i for i in tasks if str(i.get("due",""))>datetime.now().strftime("%Y-%m-%d")],
                      key=lambda x:x.get("due",""))
    name, en = TRACK_META.get(tid, (track.get("name","مسار"), track.get("ar","")))
    prog = int(track.get("progress",0)); st = track.get("status","—")

    # 1) الغلاف
    slide_cover(prs, f"تقرير المسار {tid}", f"{name} · {en}", state)

    # 2) ملخص المسار
    s = new_slide(prs); bg(s, NAVY)
    textbox(s, Inches(0.6), Inches(0.45), Inches(12.1), Inches(0.7),
            f"المسار {tid} — {name}", size=28, color=GOLD, bold=True)
    kw = Inches(2.86); gap = Inches(0.28); kx = SW - Inches(0.6) - kw
    for v,l,c in [(f"{prog}٪","نسبة الإنجاز",GOLD),(len(tasks),"إجمالي المهام",WHITE),
                  (len(done),"المنجزة",GREEN),(len(risks),"المخاطر",RED)]:
        kpi_callout(s, kx, Inches(1.4), kw, v, l, c); kx -= (kw+gap)
    textbox(s, Inches(0.6), Inches(2.95), Inches(12.1), Inches(0.5),
            f"الحالة العامة للمسار: {st}", size=18, color=status_color(st), bold=True)
    colw = Inches(5.95)
    card(s, SW-Inches(0.6)-colw, Inches(3.6), colw, Inches(3.25), NAVY2)
    textbox(s, SW-Inches(0.6)-colw, Inches(3.7), colw, Inches(0.4), "أبرز الإنجازات", size=15, color=GREEN, bold=True, align=PP_ALIGN.CENTER)
    textbox(s, SW-Inches(0.6)-colw+Inches(0.2), Inches(4.15), colw-Inches(0.4), Inches(2.6),
            [(f"• {i.get('title','')}",{"size":13}) for i in done[:6]] or [("لا يوجد",{"color":MUTED})])
    card(s, Inches(0.6), Inches(3.6), colw, Inches(3.25), NAVY2)
    textbox(s, Inches(0.6), Inches(3.7), colw, Inches(0.4), "قيد التنفيذ", size=15, color=AMBER, bold=True, align=PP_ALIGN.CENTER)
    textbox(s, Inches(0.8), Inches(4.15), colw-Inches(0.4), Inches(2.6),
            [(f"• {i.get('title','')}",{"size":13}) for i in active[:6]] or [("لا يوجد",{"color":MUTED})])

    # 3) تفاصيل المهام
    s = new_slide(prs); bg(s, NAVY)
    textbox(s, Inches(0.6), Inches(0.45), Inches(12.1), Inches(0.7), "تفاصيل المهام", size=28, color=GOLD, bold=True)
    rows = [[(t.get("title","—"),WHITE),(t.get("owner","—"),MUTED),
             (t.get("status","—"),status_color(t.get("status",""))),(fmt_date(t.get("due","")),MUTED)] for t in tasks]
    data_table(s, Inches(0.6), Inches(1.35), Inches(12.13),
               ["المهمة","المسؤول","الحالة","الاستحقاق"], rows,
               col_ratios=[0.48,0.22,0.16,0.14], max_rows=11, empty_text="لا توجد مهام مسجلة")

    # 4) المخاطر
    s = new_slide(prs); bg(s, NAVY)
    textbox(s, Inches(0.6), Inches(0.45), Inches(12.1), Inches(0.7), "المخاطر والقرارات", size=28, color=GOLD, bold=True)
    rows = [[(r.get("title","—"),WHITE),(r.get("owner","—"),MUTED),
             (r.get("status","—"),status_color(r.get("status",""))),(fmt_date(r.get("due","")),MUTED)] for r in risks]
    data_table(s, Inches(0.6), Inches(1.35), Inches(12.13),
               ["البند","المسؤول","الحالة","الاستحقاق"], rows,
               col_ratios=[0.48,0.22,0.16,0.14], max_rows=11, empty_text="لا توجد مخاطر مفتوحة")

    # 5) الجدول الزمني
    s = new_slide(prs); bg(s, NAVY)
    textbox(s, Inches(0.6), Inches(0.45), Inches(12.1), Inches(0.7), "المهام القادمة", size=28, color=GOLD, bold=True)
    card(s, Inches(0.6), Inches(1.4), Inches(12.13), Inches(5.4), NAVY2)
    textbox(s, Inches(0.8), Inches(1.7), Inches(11.7), Inches(4.9),
            [(f"• {i.get('title','')}   ({fmt_date(i.get('due',''))})", {"size":14}) for i in upcoming[:14]]
            or [("لا توجد مهام قادمة مجدولة",{"color":MUTED})])

# ============================================================
# نقطة الدخول
# ============================================================
def generate_report(report_type, state):
    prs = Presentation()
    prs.slide_width = SW; prs.slide_height = SH
    if report_type == "comprehensive":
        build_comprehensive(prs, state)
    elif report_type in TRACK_META:
        build_track(prs, report_type, state)
    else:
        raise ValueError(f"نوع تقرير غير معروف: {report_type}")
    buf = io.BytesIO(); prs.save(buf); return buf.getvalue()

if __name__ == "__main__":
    data = json.loads(sys.stdin.read())
    out = generate_report(data.get("type","comprehensive"), data.get("state",{}))
    sys.stdout.buffer.write(out)
