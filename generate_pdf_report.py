#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
مولّد PDF مباشر لتقارير منصة KAG
- يستخدم بيانات النظام مباشرة.
- يعمل كمسار احتياطي/أساسي عندما لا يتوفر LibreOffice أو تكون قوالب PowerPoint كبيرة.
- يحافظ على الهوية البصرية التنفيذية: خلفية داكنة، سماوي ملكي، ذهبي، أخضر، أحمر.
"""
import sys, json, io, os
from datetime import datetime
from reportlab.lib.pagesizes import landscape, A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

try:
    import arabic_reshaper
    from bidi.algorithm import get_display
except Exception:
    arabic_reshaper = None
    get_display = None

PAGE_W, PAGE_H = landscape(A4)
M = 34
BG = colors.HexColor('#06111F')
CARD = colors.HexColor('#0B1B2E')
BORDER = colors.HexColor('#1F4D73')
CYAN = colors.HexColor('#16D9FF')
GOLD = colors.HexColor('#D9B86C')
GREEN = colors.HexColor('#20E38A')
AMBER = colors.HexColor('#F6B73C')
RED = colors.HexColor('#FF4D6D')
WHITE = colors.HexColor('#EAF4FF')
MUTED = colors.HexColor('#91A7BD')

FONT = 'Helvetica'
FONT_B = 'Helvetica-Bold'
for fp in ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed.ttf']:
    if os.path.exists(fp):
        try:
            pdfmetrics.registerFont(TTFont('ArabicSans', fp))
            FONT = 'ArabicSans'; FONT_B = 'ArabicSans'
            break
        except Exception:
            pass

def ar(s):
    s = str(s if s is not None else '—')
    if arabic_reshaper and get_display:
        try: return get_display(arabic_reshaper.reshape(s))
        except Exception: return s
    return s

def today(): return datetime.now().strftime('%Y-%m-%d')
def num(v, default=0):
    try: return int(float(v))
    except Exception: return default

def merged_state(data):
    st = data.get('state') or {}
    mg = st.get('management') or {}
    items = list(st.get('items') or [])
    for a in mg.get('actions', []) or []:
        items.append({'type':'tasks','title':a.get('title'),'track':a.get('track'),'owner':a.get('owner'),'due':a.get('due'),'status':a.get('status'),'priority':a.get('priority')})
    for ap in mg.get('approvals', []) or []:
        items.append({'type':'approval','title':ap.get('title'),'track':ap.get('track'),'owner':ap.get('owner'),'due':ap.get('due'),'status':ap.get('status'),'impact':ap.get('impact')})
    for ev in mg.get('fieldEvidence', []) or []:
        items.append({'type':'evidence','title':ev.get('title'),'track':ev.get('track'),'owner':ev.get('zone'),'due':ev.get('date'),'status':ev.get('status')})
    return st, mg, items

def is_done(x): return str(x.get('status','')) in ['مكتملة','مكتمل','معتمدة','معتمد','مغلق']
def is_overdue(x):
    d = str(x.get('due',''))[:10]
    return bool(d and d < today() and not is_done(x))
def is_risk(x): return x.get('type') in ['risks','مخاطرة','مخاطر']

def draw_bg(c, title, subtitle=''):
    c.setFillColor(BG); c.rect(0,0,PAGE_W,PAGE_H,stroke=0,fill=1)
    c.setStrokeColor(BORDER); c.setLineWidth(0.7)
    c.line(M, PAGE_H-72, PAGE_W-M, PAGE_H-72)
    c.setFillColor(GOLD); c.setFont(FONT_B, 18); c.drawRightString(PAGE_W-M, PAGE_H-45, ar(title))
    c.setFillColor(MUTED); c.setFont(FONT, 9); c.drawString(M, PAGE_H-45, ar(f'حدائق الملك عبدالله 2026 | {today()}'))
    if subtitle:
        c.setFillColor(WHITE); c.setFont(FONT, 11); c.drawRightString(PAGE_W-M, PAGE_H-64, ar(subtitle))

def card(c, x, y, w, h, label, value, color=CYAN):
    c.setFillColor(CARD); c.setStrokeColor(BORDER); c.roundRect(x,y,w,h,10,stroke=1,fill=1)
    c.setFillColor(color); c.setFont(FONT_B, 20); c.drawCentredString(x+w/2, y+h-30, ar(value))
    c.setFillColor(MUTED); c.setFont(FONT, 9); c.drawCentredString(x+w/2, y+15, ar(label))

def table(c, x, y, w, headers, rows, row_h=22, max_rows=11):
    col_w = w / len(headers)
    c.setFillColor(GOLD); c.setStrokeColor(BORDER)
    for i,h in enumerate(headers):
        c.rect(x+i*col_w, y, col_w, row_h, stroke=1, fill=1)
        c.setFillColor(BG); c.setFont(FONT_B, 8); c.drawCentredString(x+i*col_w+col_w/2, y+7, ar(h)); c.setFillColor(GOLD)
    y0 = y - row_h
    for r, row in enumerate(rows[:max_rows]):
        c.setFillColor(colors.HexColor('#10243A') if r%2 else CARD)
        for i,cell in enumerate(row[:len(headers)]):
            c.rect(x+i*col_w, y0-r*row_h, col_w, row_h, stroke=1, fill=1)
            c.setFillColor(WHITE); c.setFont(FONT, 7)
            txt = str(cell if cell is not None else '—')[:45]
            c.drawRightString(x+(i+1)*col_w-5, y0-r*row_h+7, ar(txt)); c.setFillColor(colors.HexColor('#10243A') if r%2 else CARD)

def section(c, title, x=M, y=PAGE_H-92):
    c.setFillColor(CYAN); c.setFont(FONT_B, 13); c.drawRightString(PAGE_W-M, y, ar(title))

def make_report(data):
    report_type = data.get('type','comprehensive')
    st, mg, items = merged_state(data)
    tracks = st.get('tracks') or []
    actions = mg.get('actions') or []
    approvals = mg.get('approvals') or []
    evidence = mg.get('fieldEvidence') or []
    meetings = mg.get('meetings') or []
    zones = mg.get('zones') or []
    risks = [i for i in items if is_risk(i) and not is_done(i)]
    tasks = [i for i in items if i.get('type') == 'tasks']
    done = [i for i in tasks if is_done(i)]
    overdue = [i for i in tasks if is_overdue(i)]
    overall = round(sum(num(t.get('progress')) for t in tracks)/len(tracks)) if tracks else 0
    quality = (st.get('dataQuality') or {}).get('score','—')
    oprec = (st.get('operationalSummary') or {}).get('recommendation','')

    buf = io.BytesIO(); c = canvas.Canvas(buf, pagesize=landscape(A4)); c.setTitle('KAG Report')
    title_map = {'daily_ops':'تقرير غرفة العمليات اليومي','executive':'التقرير التنفيذي','approvals':'تقرير الاعتمادات والتصعيد','evidence':'تقرير التوثيق والأدلة','comprehensive':'التقرير الشامل'}
    title = title_map.get(report_type, 'تقرير المنصة')

    draw_bg(c, title, 'تقرير PDF جاهز للطباعة والعرض')
    c.setFillColor(GOLD); c.setFont(FONT_B, 26); c.drawRightString(PAGE_W-M, PAGE_H-150, ar('منصة إدارة وتشغيل المشروع'))
    c.setFillColor(WHITE); c.setFont(FONT, 13); c.drawRightString(PAGE_W-M, PAGE_H-178, ar('تقرير مباشر من بيانات النظام دون ملفات Excel وسيطة'))
    card(c, PAGE_W-M-130, PAGE_H-270, 120, 70, 'الإنجاز الكلي', f'{overall}%', GREEN if overall>=75 else AMBER)
    card(c, PAGE_W-M-270, PAGE_H-270, 120, 70, 'المهام المفتوحة', str(len([a for a in actions if not is_done(a)])), CYAN)
    card(c, PAGE_W-M-410, PAGE_H-270, 120, 70, 'المخاطر', str(len(risks)), RED if risks else GREEN)
    card(c, PAGE_W-M-550, PAGE_H-270, 120, 70, 'الاعتمادات', str(len(approvals)), GOLD)
    card(c, PAGE_W-M-690, PAGE_H-270, 120, 70, 'جودة البيانات', f'{quality}%', GREEN if isinstance(quality,int) and quality>=85 else AMBER)
    c.setFillColor(CARD); c.setStrokeColor(BORDER); c.roundRect(M, 80, PAGE_W-2*M, 80, 10, stroke=1, fill=1)
    c.setFillColor(WHITE); c.setFont(FONT, 11); c.drawRightString(PAGE_W-M-18, 128, ar('التوصية التشغيلية'))
    c.setFillColor(MUTED); c.setFont(FONT, 9); c.drawRightString(PAGE_W-M-18, 104, ar(oprec or 'تتم مراجعة المؤشرات والمهام والاعتمادات وفق دورة التشغيل اليومية.'))
    c.showPage()

    draw_bg(c, 'ملخص الأداء والمسارات')
    table(c, M, PAGE_H-120, PAGE_W-2*M, ['المسار','الاسم','التقدم','الحالة','المخاطر'], [[t.get('id',''),t.get('name',''),f"{t.get('progress',0)}%",t.get('status','—'),t.get('risk',0)] for t in tracks] or [['—','لا توجد بيانات','—','—','—']])
    c.showPage()

    draw_bg(c, 'المهام والإشعارات والمتابعات')
    table(c, M, PAGE_H-120, PAGE_W-2*M, ['المهمة','المسار','المالك','الأهمية','الموعد','الحالة'], [[a.get('title'),a.get('track'),a.get('owner'),a.get('priority'),a.get('due'),a.get('status')] for a in (actions or tasks)[:14]] or [['لا توجد مهام','','','','','']], row_h=21, max_rows=14)
    c.showPage()

    draw_bg(c, 'الاعتمادات والتصعيد')
    table(c, M, PAGE_H-120, PAGE_W-2*M, ['الاعتماد','النوع','المسار','المالك','الموعد','الحالة'], [[a.get('title'),a.get('type'),a.get('track'),a.get('owner'),a.get('due'),a.get('status')] for a in approvals[:14]] or [['لا توجد اعتمادات','','','','','']], row_h=21, max_rows=14)
    c.showPage()

    draw_bg(c, 'التوثيق والأدلة الميدانية')
    table(c, M, PAGE_H-120, PAGE_W-2*M, ['الدليل','النوع','المسار','المنطقة','التاريخ','الحالة'], [[e.get('title'),e.get('type'),e.get('track'),e.get('zone'),e.get('date'),e.get('status')] for e in evidence[:14]] or [['لا توجد أدلة','','','','','']], row_h=21, max_rows=14)
    c.showPage()

    draw_bg(c, 'المناطق والاجتماعات')
    table(c, M, PAGE_H-120, (PAGE_W-2*M), ['المنطقة','التشغيل','السلامة','النظافة','التجربة','الحالة'], [[z.get('zone'),z.get('operations'),z.get('safety'),z.get('cleaning'),z.get('experience'),z.get('status')] for z in zones[:8]] or [['لا توجد مناطق','','','','','']], row_h=22, max_rows=8)
    table(c, M, PAGE_H-335, (PAGE_W-2*M), ['الاجتماع','التاريخ','الحضور','القرارات','المهام','الحالة'], [[m.get('title'),m.get('date'),m.get('attendees'),m.get('decisions'),m.get('actions'),m.get('status')] for m in meetings[:7]] or [['لا توجد اجتماعات','','','','','']], row_h=22, max_rows=7)
    c.showPage()

    c.save(); return buf.getvalue()

if __name__ == '__main__':
    data = json.loads(sys.stdin.read() or '{}')
    sys.stdout.buffer.write(make_report(data))
