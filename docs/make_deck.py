"""Seminar deck, generated from the codebase.

Counts come from facts.py, the same source the PDFs use, so the slides cannot
quietly disagree with the code or with the report.

    cd docs && python3 make_deck.py
"""
from datetime import date
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt

import facts

OUT = Path(__file__).resolve().parent

BLOOD = RGBColor(0x99, 0x00, 0x11)
BLOOD_LT = RGBColor(0xC1, 0x12, 0x1F)
NAVY = RGBColor(0x2F, 0x3C, 0x7E)
INK = RGBColor(0x1A, 0x16, 0x18)
MUTED = RGBColor(0x6D, 0x68, 0x75)
CREAM = RGBColor(0xFC, 0xF6, 0xF5)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
PINK = RGBColor(0xF3, 0xD9, 0xDC)
LINE = RGBColor(0xE8, 0xDD, 0xDE)

HEAD_FONT = "Cambria"
BODY_FONT = "Calibri"

W, H, M = 13.333, 7.5, 0.65

AUTHORS = [("Animesh Satyapragyan Patra", "23CS8102"), ("Dasari Keerthana", "23CS8039")]
SUPERVISOR = "Prof. Nanda Dulal Jena"
FOOT = ("BloodDrop | " + " · ".join(f"{n} ({r})" for n, r in AUTHORS) + " | NIT Durgapur")

prs = Presentation()
prs.slide_width = Inches(W)
prs.slide_height = Inches(H)
BLANK = prs.slide_layouts[6]


# --------------------------------------------------------------- helpers ---

def slide(bg=WHITE, footer=True):
    s = prs.slides.add_slide(BLANK)
    rect = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(W), Inches(H))
    rect.fill.solid()
    rect.fill.fore_color.rgb = bg
    rect.line.fill.background()
    rect.shadow.inherit = False
    if footer:
        text(s, FOOT, M, H - 0.46, 10.0, 0.3, size=9, color=MUTED)
        # The slide is already appended, so the count is this slide's number.
        text(s, str(len(prs.slides._sldIdLst)), W - M - 0.6, H - 0.46, 0.6, 0.3,
             size=9, color=MUTED, align=PP_ALIGN.RIGHT)
    return s


def text(s, body, x, y, w, h, *, size=14, bold=False, italic=False, color=INK,
         align=PP_ALIGN.LEFT, font=BODY_FONT, anchor=MSO_ANCHOR.TOP, spacing=1.0):
    box = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    lines = body if isinstance(body, list) else [body]
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = spacing
        r = p.add_run()
        r.text = line
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.italic = italic
        r.font.color.rgb = color
        r.font.name = font
    return box


def title(s, label):
    text(s, label, M, 0.45, W - 2 * M, 0.85, size=32, bold=True, color=BLOOD,
         font=HEAD_FONT, anchor=MSO_ANCHOR.MIDDLE)


def card(s, x, y, w, h, fill=WHITE):
    sh = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    sh.fill.solid()
    sh.fill.fore_color.rgb = fill
    sh.line.color.rgb = LINE
    sh.line.width = Pt(1)
    sh.shadow.inherit = False
    sh.adjustments[0] = 0.05
    if sh.has_text_frame:
        sh.text_frame.text = ""
    return sh


def disc(s, x, y, label, d=0.5, size=14):
    sh = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(d), Inches(d))
    sh.fill.solid()
    sh.fill.fore_color.rgb = BLOOD
    sh.line.fill.background()
    sh.shadow.inherit = False
    tf = sh.text_frame
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = str(label)
    r.font.size = Pt(size)
    r.font.bold = True
    r.font.color.rgb = WHITE
    r.font.name = BODY_FONT
    return sh


def bullets(s, items, x, y, w, h, size=13.5, spacing=1.25):
    box = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    for i, item in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.line_spacing = spacing
        p.space_after = Pt(6)
        r = p.add_run()
        r.text = "•  " + item
        r.font.size = Pt(size)
        r.font.color.rgb = INK
        r.font.name = BODY_FONT
    return box


def code(s, lines, x, y, w, h):
    sh = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    sh.fill.solid()
    sh.fill.fore_color.rgb = INK
    sh.line.fill.background()
    sh.shadow.inherit = False
    sh.adjustments[0] = 0.04
    tf = sh.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = Inches(0.18)
    tf.margin_top = tf.margin_bottom = Inches(0.12)
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.line_spacing = 1.15
        r = p.add_run()
        r.text = line
        r.font.size = Pt(12)
        r.font.name = "Consolas"
        r.font.color.rgb = PINK
    return sh


def stat(s, x, y, w, value, label):
    text(s, value, x, y, w, 0.85, size=50, bold=True, color=BLOOD, font=HEAD_FONT,
         anchor=MSO_ANCHOR.BOTTOM)
    text(s, label, x, y + 0.9, w, 0.45, size=12.5, color=INK)


def notes(s, body):
    s.notes_slide.notes_text_frame.text = body


def rule_cards(s, rows, y, h, cols=3, fill=WHITE, gap=0.25, numbered=True):
    width = (W - 2 * M - gap * (cols - 1)) / cols
    for i, (head, body) in enumerate(rows):
        x = M + i * (width + gap)
        card(s, x, y, width, h, fill=fill)
        top = y + 0.26
        if numbered:
            disc(s, x + 0.28, top, i + 1, d=0.46, size=13)
            top += 0.62
        else:
            top += 0.02
        text(s, head, x + 0.28, top, width - 0.56, 0.38, size=16, bold=True, color=BLOOD)
        text(s, body, x + 0.28, top + 0.42, width - 0.56, h - (top - y) - 0.6,
             size=12.5, spacing=1.2)


# ------------------------------------------------------------------ data ---

f = facts.gather()
N_TABLES = len(f["tables"])
N_ROUTES = len(f["routes"])
N_PAGES = len(f["pages"])
N_POLICIES = f["policies"]
N_INDEXES = f["indexes"]
N_CHECKS = f["assertions"]


# ---------------------------------------------------------------- slides ---

# 1 — Title
s = slide(bg=BLOOD, footer=False)
text(s, "BloodDrop", M, 2.2, 9.0, 1.1, size=46, bold=True, color=WHITE, font=HEAD_FONT)
text(s, "Emergency Blood Donor Alert Network", M, 3.35, 9.5, 0.45, size=21, bold=True, color=WHITE)
text(s, "Final Year Project · Departmental Seminar", M, 3.85, 9.5, 0.35, size=13, italic=True, color=PINK)
text(s, "A location-aware platform connecting blood requests to eligible donors nearby",
     M, 4.2, 9.5, 0.4, size=14, color=PINK)
text(s, " · ".join(f"{n} ({r})" for n, r in AUTHORS), M, 4.85, 10.0, 0.35, size=14, color=WHITE)
text(s, "B.Tech, Computer Science and Engineering  |  NIT Durgapur", M, 5.2, 10.0, 0.35, size=13, color=PINK)
text(s, f"Supervisor: {SUPERVISOR}", M, 5.62, 10.0, 0.35, size=13, italic=True, color=PINK)
mark = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(11.0), Inches(1.5), Inches(1.6), Inches(1.6))
mark.fill.solid(); mark.fill.fore_color.rgb = WHITE; mark.line.fill.background(); mark.shadow.inherit = False
p = mark.text_frame.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
r = p.add_run(); r.text = "BD"; r.font.size = Pt(38); r.font.bold = True
r.font.color.rgb = BLOOD; r.font.name = HEAD_FONT
notes(s, "One line: BloodDrop turns an emergency blood request into targeted alerts to donors who "
         "are actually eligible and actually nearby, and then books them a slot. 20 minutes, "
         "questions at the end.")

# 2 — Problem
s = slide()
title(s, "The problem is not supply alone — it is matching")
rule_cards(s, [
    ("Blood cannot be manufactured",
     "It comes only from donors, and red cells have a short shelf life. Supply has to be mobilised, not stored indefinitely."),
    ("Requests go out as broadcasts",
     "An emergency need is forwarded to messaging groups, reaching thousands of people who cannot help."),
    ("The requester hears silence",
     "No way to know who saw it, who is eligible, who is close enough, or who is actually coming."),
], y=1.6, h=2.9)
text(s, "A blood request is a matching problem under time pressure — not a broadcasting problem.",
     M, 4.85, W - 2 * M, 0.45, size=15, italic=True, color=NAVY)
notes(s, "If you want a national statistic here, insert one you can cite from NACO or WHO. "
         "Numbers are deliberately left out rather than quoting a figure you cannot source if asked.")

# 3 — Gaps
s = slide(bg=CREAM)
title(s, "What existing channels do not do")
gaps = [
    ("No eligibility filter", "A donor who gave blood three weeks ago is still alerted, and cannot donate for another nine weeks."),
    ("No distance awareness", "A willing donor 40 km away is no use for a critical case; a donor 2 km away never sees the message."),
    ("No compatibility logic", "Requests name one blood group, ignoring the donors whose blood is medically safe for that patient."),
    ("No status, no accountability", "Nobody records who responded or who actually donated, so the same request keeps circulating."),
]
for i, (head, body) in enumerate(gaps):
    col, row = i % 2, i // 2
    x, y = M + col * 6.15, 1.6 + row * 1.75
    card(s, x, y, 5.85, 1.55)
    disc(s, x + 0.28, y + 0.3, "×", d=0.44, size=14)
    text(s, head, x + 0.9, y + 0.26, 4.7, 0.38, size=16, bold=True, color=BLOOD)
    text(s, body, x + 0.9, y + 0.68, 4.75, 0.78, size=12.5, spacing=1.2)
text(s, "Each of these is a rule a database can enforce. That is the opening BloodDrop takes.",
     M, 5.3, W - 2 * M, 0.45, size=15, italic=True, color=NAVY)

# 4 — Section divider
s = slide(bg=NAVY, footer=False)
text(s, "How BloodDrop works", M, 2.9, W - 2 * M, 1.0, size=38, bold=True, color=WHITE,
     font=HEAD_FONT, anchor=MSO_ANCHOR.MIDDLE)
text(s, "Three roles, one alert loop, and a booked slot at the end of it",
     M, 4.0, W - 2 * M, 0.5, size=15, color=RGBColor(0xCA, 0xDC, 0xFC))

# 5 — The loop
s = slide()
title(s, "The alert loop")
steps = [
    ("Request", "A hospital or family posts a need: blood group, units, location, urgency."),
    ("Match", "The server shortlists donors who are compatible, eligible and within the radius."),
    ("Alert", "A capped, reliability-ranked batch is alerted — not everyone in range."),
    ("Respond", "Donors answer available or unavailable. The requester sees a live count."),
    ("Book", "The donor picks a verified blood bank and a slot; the facility records the outcome."),
]
for i, (head, body) in enumerate(steps):
    x = M + i * 2.46
    disc(s, x + 0.78, 1.75, i + 1, d=0.62, size=17)
    text(s, head, x, 2.5, 2.2, 0.38, size=16, bold=True, color=BLOOD, align=PP_ALIGN.CENTER)
    text(s, body, x, 2.92, 2.25, 1.5, size=12.5, align=PP_ALIGN.CENTER, spacing=1.2)
    if i < len(steps) - 1:
        ln = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x + 1.52), Inches(2.04), Inches(0.82), Pt(1.5))
        ln.fill.solid(); ln.fill.fore_color.rgb = MUTED; ln.line.fill.background(); ln.shadow.inherit = False
card(s, M, 4.6, W - 2 * M, 1.0, fill=CREAM)
text(s, "The steps that distinguish BloodDrop are the last two: a visible status instead of silence, "
        "and a booked appointment instead of a phone number and hope.",
     M + 0.3, 4.78, W - 2 * M - 0.6, 0.64, size=14, anchor=MSO_ANCHOR.MIDDLE, spacing=1.2)
notes(s, "Walk left to right. Spend the time on Respond and Book — together they close the loop, and "
         "the facility-recorded outcome is what feeds both the eligibility clock and the reliability score.")

# 6 — Architecture
s = slide(bg=CREAM)
title(s, "System architecture")
tiers = [
    ("CLIENT", "React + Vite", [f"{N_PAGES} screens, React Router", "Context for auth and theme", "Leaflet map for location"]),
    ("API", "Node + Express", [f"{N_ROUTES} REST endpoints", "Bearer-token auth middleware", "Role guard per route"]),
    ("DATA", "PostgreSQL + PostGIS", [f"{N_TABLES} tables, {N_INDEXES} indexes", f"{N_POLICIES} Row Level Security policies", "match_donors() SQL function"]),
]
for i, (label, tech, items) in enumerate(tiers):
    x = M + i * 4.15
    card(s, x, 1.6, 3.7, 2.95)
    text(s, label, x + 0.28, 1.82, 3.1, 0.3, size=11, bold=True, color=MUTED)
    text(s, tech, x + 0.28, 2.14, 3.15, 0.42, size=18, bold=True, color=BLOOD)
    bullets(s, items, x + 0.28, 2.68, 3.2, 1.7, size=12.5)
    if i < 2:
        ar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x + 3.76), Inches(3.05), Inches(0.33), Pt(2))
        ar.fill.solid(); ar.fill.fore_color.rgb = BLOOD; ar.line.fill.background(); ar.shadow.inherit = False
text(s, "Deployed on Vercel: the React build is served as static assets, and the same Express app runs "
        "as a serverless function under /api/*.", M, 4.8, W - 2 * M, 0.45, size=14.5)
text(s, "One Express app serves both local development and production — no second codebase for the "
        "serverless target.", M, 5.25, W - 2 * M, 0.45, size=14.5, italic=True, color=NAVY)

# 7 — Data model
s = slide()
title(s, "Data model")
rows = [("Table", "Holds", "Integrity rule it carries")] + [
    ("profiles", "Identity and role", "role restricted to donor / requester / admin"),
    ("donors", "Blood group, location, stats", "blood_group CHECK; lat-lng range CHECK"),
    ("requests", "An open blood need", "units 1–20; radius 0–100 km; status CHECK"),
    ("alerts", "Who was notified", "UNIQUE (request_id, donor_user_id)"),
    ("responses", "Who answered, and the outcome", "UNIQUE (request_id, donor_user_id)"),
    ("facilities", "Bookable hospitals and blood banks", "type CHECK; only verified ones are bookable"),
    ("appointments", "A donor's booked slot", "slot capacity enforced on booking"),
    ("donor_documents", "Proof of blood group, under review", "doc_type and status CHECK"),
]
tbl_shape = s.shapes.add_table(len(rows), 3, Inches(M), Inches(1.55),
                               Inches(W - 2 * M), Inches(0.34 * len(rows)))
tbl = tbl_shape.table
for w, col in zip((2.3, 3.6, 6.1), tbl.columns):
    col.width = Inches(w)
for ri, row in enumerate(rows):
    tbl.rows[ri].height = Inches(0.34)
    for ci, val in enumerate(row):
        cell = tbl.cell(ri, ci)
        cell.text = ""
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE
        cell.margin_left = cell.margin_right = Inches(0.08)
        cell.fill.solid()
        cell.fill.fore_color.rgb = BLOOD if ri == 0 else WHITE
        p = cell.text_frame.paragraphs[0]
        r = p.add_run(); r.text = val
        r.font.size = Pt(12)
        r.font.bold = ri == 0
        r.font.color.rgb = WHITE if ri == 0 else INK
        r.font.name = BODY_FONT
text(s, f"{N_TABLES} tables in all. Every enumerated column is a CHECK constraint and every foreign key "
        f"cascades — the rules live in the schema, not only in application code.",
     M, 1.62 + 0.34 * len(rows), W - 2 * M, 0.5, size=14, italic=True, color=NAVY)
notes(s, "If asked why constraints belong in the database rather than in Node: application code can be "
         "bypassed by another client, a migration, or a direct SQL session. The database is the last "
         "line that always runs.")

# 8 — Geospatial matching
s = slide(bg=CREAM)
title(s, "Geospatial matching")
bullets(s, [
    "Each donor row stores lat and lng, plus a generated geography column kept in sync automatically.",
    "A GiST index on that column makes radius search an index lookup instead of a table scan.",
    "ST_DWithin is the index-using form. ST_Distance alone would force a sequential scan over every donor.",
], M, 1.65, 6.0, 2.3, size=14)
code(s, ["where st_dwithin(", "    d.geog,", "    st_makepoint(lng, lat)::geography,",
         "    radius_km * 1000", "  )", "order by distance_km asc;"], 6.95, 1.62, 5.7, 1.8)
card(s, M, 3.75, W - 2 * M, 1.5)
disc(s, M + 0.3, 4.02, "!", d=0.46, size=15)
text(s, "The shortlist is then capped and reliability-ranked", M + 0.95, 3.95, 10.8, 0.38,
     size=16, bold=True, color=BLOOD)
text(s, "Alerting every donor in range trains people to ignore alerts. A dispatch reaches a bounded "
        "batch, ordered by how reliably each donor has responded before.",
     M + 0.95, 4.35, 11.0, 0.75, size=13.5, spacing=1.2)
notes(s, "Land this point: ST_DWithin can use a spatial index, ST_Distance cannot. That one choice is "
         "the difference between a lookup and a full scan as the donor table grows.")

# 9 — Hospital discovery
s = slide()
title(s, "Finding the hospitals around a point")
text(s, "The hospital used to be free text and the pin placed by hand, so the name and the location "
        "could disagree.", M, 1.3, W - 2 * M, 0.4, size=14.5)
rule_cards(s, [
    ("For the requester", "Pick a real facility instead of typing one. The name fills in and the pin snaps to the facility's own coordinates."),
    ("For discovery", "Works anywhere there is map data, so the app is not limited to a curated list of one city's hospitals."),
], y=1.8, h=1.6, cols=2, fill=CREAM)
text(s, "Data: OpenStreetMap via Nominatim — global, keyless, and not seeded for any one city.",
     M, 3.6, W - 2 * M, 0.4, size=14.5, bold=True, color=NAVY)
rule_cards(s, [
    ("Rate-limited and cached", "One call a second, answers cached — Nominatim's usage policy, and hospitals do not move."),
    ("Behind authentication", "So the deployment is not an open proxy onto someone else's map server."),
    ("Fails soft", "A failed lookup returns an empty list with a reason. An unreachable third party must never stop a request being posted."),
], y=4.05, h=1.6, numbered=False)
notes(s, "Demo: drop a pin in Durgapur and the list comes back with Durgapur Steel Plant Hospital and "
         "its blood bank. Stress that nothing is hardcoded for Durgapur.")

# 10 — Choosing a bank and booking
s = slide(bg=CREAM)
title(s, "Choosing a blood bank, and booking a slot")
text(s, "Listing banks by distance from the hospital answers the wrong question — the donor is the one "
        "travelling, and the options differ in more than distance.", M, 1.3, W - 2 * M, 0.4, size=14.5)
rule_cards(s, [
    ("Ranked on what matters", "Distance from the donor, whether it is open now, when the next slot is free, and whether it is the bank that serves the patient's hospital."),
    ("It says why", "Each recommendation carries its reason, rather than an opaque score the donor has to trust."),
    ("Then it books", "Slots come from the facility's own opening hours and capacity; only verified facilities are bookable."),
], y=1.8, h=2.2)
card(s, M, 4.25, W - 2 * M, 1.35)
text(s, "The facility records the outcome — not the requester", M + 0.35, 4.42, 11.5, 0.38,
     size=16, bold=True, color=BLOOD)
text(s, "They are the only party who witnessed the donation. Letting a requester self-report over the "
        "top would make the reliability score meaningless, since they could credit a friend or punish "
        "a donor who did turn up.", M + 0.35, 4.82, 11.8, 0.7, size=13.5, spacing=1.2)

# 11 — Donor documents
s = slide()
title(s, "Proving a blood group")
text(s, "A donor's blood group was self-declared, and a wrong one wastes an emergency trip.",
     M, 1.3, W - 2 * M, 0.4, size=14.5)
rule_cards(s, [
    ("Upload", "A donor card, lab report, hospital letter or government ID — JPG, PNG, WEBP or PDF, up to 4 MB."),
    ("Human review", "A moderator looks at it and verifies or rejects. There is no OCR: a person makes the decision."),
    ("Then it is purged", "Files are short-lived by design, so a pile of identity scans never accumulates."),
], y=1.8, h=2.1)
card(s, M, 4.15, W - 2 * M, 1.45, fill=CREAM)
disc(s, M + 0.3, 4.42, "!", d=0.46, size=15)
text(s, "The requester never sees the document", M + 0.95, 4.35, 11.0, 0.38, size=16, bold=True, color=BLOOD)
text(s, "They are told only that the group was checked, against what kind of evidence, and when. A "
        "requester is any member of the public who posted a request — letting them open donors' scans "
        "would make identity documents browsable by strangers.",
     M + 0.95, 4.75, 11.2, 0.75, size=13.5, spacing=1.2)
notes(s, "Expect the question 'is it scanned automatically?' — no. Upload, human review, verdict. "
         "OCR would be the obvious next step and is listed under future scope.")

# 12 — Domain rules
s = slide(bg=CREAM)
title(s, "Domain rules the system enforces")
card(s, M, 1.6, 6.0, 2.95)
disc(s, M + 0.3, 1.88, "A")
text(s, "Blood group compatibility", M + 0.95, 1.86, 4.9, 0.4, size=18, bold=True, color=BLOOD)
bullets(s, [
    "A request names the patient's group; the system searches every donor group medically safe for that patient.",
    "O-negative is the universal red-cell donor; AB-positive the universal recipient.",
    "Encoded as an explicit map, not derived at runtime — it is a medical fact, not a calculation.",
], M + 0.3, 2.48, 5.5, 2.0, size=12.5)
card(s, 6.95, 1.6, 5.7, 2.95)
disc(s, 7.25, 1.88, "B")
text(s, "Donation eligibility", 7.9, 1.86, 4.6, 0.4, size=18, bold=True, color=BLOOD)
bullets(s, [
    "A 90-day minimum gap between whole-blood donations, following Indian and WHO guidance.",
    "Configurable per deployment, so a different national guideline needs no code change.",
    "An ineligible or paused donor is excluded from dispatch rather than alerted and rejected later.",
], 7.25, 2.48, 5.2, 2.0, size=12.5)
text(s, "A confirmed donation resets the donor's eligibility clock automatically — the rule maintains itself.",
     M, 4.78, W - 2 * M, 0.45, size=15, italic=True, color=NAVY)

# 13 — Privacy
s = slide()
title(s, "Privacy by design")
priv = [
    ("Masked by default", "Phone numbers, names and email are masked for everyone, and precise donor locations are coarsened to roughly a 1 km grid."),
    ("Unlocked only on a match", "Real contact details are released only between a donor who accepted and the requester of that specific request."),
    ("Disclosure is announced", "When a number is viewed, the person it belongs to is told who saw it and why. A relay lets both sides talk with no number changing hands."),
]
for i, (head, body) in enumerate(priv):
    y = 1.6 + i * 1.22
    card(s, M, y, W - 2 * M, 1.08, fill=CREAM)
    disc(s, M + 0.3, y + 0.3, i + 1, d=0.48)
    text(s, head, M + 1.0, y + 0.12, 3.3, 0.84, size=16, bold=True, color=BLOOD, anchor=MSO_ANCHOR.MIDDLE)
    text(s, body, 4.75, y + 0.14, 7.3, 0.8, size=13, anchor=MSO_ANCHOR.MIDDLE, spacing=1.2)
text(s, "Donor records are medical data. The default had to be concealment, with disclosure as the "
        "deliberate exception.", M, 5.4, W - 2 * M, 0.45, size=15, italic=True, color=NAVY)

# 14 — Concurrency
s = slide(bg=CREAM)
title(s, "Concurrency: settling races in the database")
text(s, "Three write paths read a value and then wrote it back — correct with one request in flight, "
        "wrong with two.", M, 1.3, W - 2 * M, 0.4, size=14.5)
races = [("Race condition", "The unsafe pattern", "The fix"),
         ("Duplicate response", "Check for a reply, then insert", "Insert first; a unique-violation is the authoritative answer"),
         ("Double-counted outcome", "Read outcome, then write it", "Conditional update — the guard sits in the same statement"),
         ("Lost counter update", "counter = (current || 0) + 1 in Node", "Increment in place, inside SQL")]
rt = s.shapes.add_table(4, 3, Inches(M), Inches(1.82), Inches(W - 2 * M), Inches(0.58 * 4)).table
for w, col in zip((3.1, 4.3, 4.6), rt.columns):
    col.width = Inches(w)
for ri, row in enumerate(races):
    rt.rows[ri].height = Inches(0.58)
    for ci, val in enumerate(row):
        cell = rt.cell(ri, ci)
        cell.text = ""
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE
        cell.margin_left = cell.margin_right = Inches(0.08)
        cell.fill.solid()
        cell.fill.fore_color.rgb = BLOOD if ri == 0 else WHITE
        p = cell.text_frame.paragraphs[0]
        r = p.add_run(); r.text = val
        r.font.size = Pt(12.5)
        r.font.bold = ri == 0
        r.font.color.rgb = WHITE if ri == 0 else INK
        r.font.name = BODY_FONT
code(s, ["update responses set outcome = $1", " where id = $2", "   and outcome is null;"],
     M, 4.3, 6.0, 1.15)
card(s, 6.95, 4.3, 5.7, 1.15)
text(s, "A check in application code can always be beaten, because the read and the write are separate "
        "events. Only the database can make them one.",
     7.2, 4.42, 5.25, 0.92, size=13.5, anchor=MSO_ANCHOR.MIDDLE, spacing=1.2)
notes(s, "Expect: why not a transaction with SELECT FOR UPDATE? That is pessimistic locking and it works, "
         "but these conflicts are rare, so an atomic conditional update and a unique constraint give the "
         "same guarantee without holding a lock.")

# 15 — What was built
s = slide()
title(s, "What was built")
for i, (v, l) in enumerate([(str(N_TABLES), "database tables"), (str(N_ROUTES), "REST endpoints"),
                            (str(N_PAGES), "React screens"), (str(N_CHECKS), "automated checks")]):
    stat(s, M + i * 3.15, 1.6, 2.9, v, l)
card(s, M, 3.4, W - 2 * M, 1.8, fill=CREAM)
bullets(s, [
    "Full-stack implementation: React SPA, Express API and a PostgreSQL schema with PostGIS, deployed on Vercel.",
    "An in-memory mock database mirrors the SQL exactly, so the whole application runs and demos with no cloud dependency.",
    "A deployment guard refuses to boot in production on missing credentials, rather than silently falling back to the mock.",
], M + 0.35, 3.6, 11.6, 1.5, size=13.5)
text(s, f"Figures above are read from the source by facts.py when this deck is generated — "
        f"{N_POLICIES} RLS policies and {N_INDEXES} indexes besides.",
     M, 5.35, W - 2 * M, 0.45, size=13, italic=True, color=MUTED)

# 16 — Limitations
s = slide(bg=CREAM)
title(s, "Limitations and future scope")
card(s, M, 1.6, 6.0, 3.1)
text(s, "Current limitations", M + 0.3, 1.82, 5.4, 0.4, size=18, bold=True, color=BLOOD)
bullets(s, [
    "Email and SMS drivers are stubbed; delivery falls back to the in-app inbox.",
    "Donor search queries the database directly, with no caching layer.",
    "Document review is entirely manual — no OCR, no automated cross-check.",
    "Hosting dependency: a managed database going offline takes the application down.",
], M + 0.3, 2.35, 5.5, 2.3, size=12.5)
card(s, 6.95, 1.6, 5.7, 3.1)
text(s, "Future scope", 7.25, 1.82, 5.1, 0.4, size=18, bold=True, color=BLOOD)
bullets(s, [
    "Real SMS and push delivery, so an alert reaches a phone that is not already open.",
    "Redis in front of donor search — availability changes far slower than it is read.",
    "OCR to pre-read an uploaded donor card before a human confirms it.",
    "An immutable audit log of every access to donor medical data.",
], 7.25, 2.35, 5.2, 2.3, size=12.5)
text(s, "Naming these honestly is part of the engineering. Each one is a known gap with a known next step.",
     M, 4.88, W - 2 * M, 0.45, size=15, italic=True, color=NAVY)

# 17 — Close
s = slide(bg=BLOOD, footer=False)
text(s, "Thank you", M, 2.6, 9.0, 1.1, size=46, bold=True, color=WHITE, font=HEAD_FONT)
text(s, "BloodDrop treats an emergency blood request as a matching problem under time pressure.",
     M, 3.85, 11.5, 0.4, size=17, color=WHITE)
text(s, "Compatibility, eligibility and distance narrow the shortlist; the database — not the "
        "application — guarantees integrity; and donor privacy is the default rather than an afterthought.",
     M, 4.3, 11.8, 0.8, size=14, color=PINK, spacing=1.2)
text(s, "github.com/AnimeshSatyapragyanPatra/blooddrop", M, 5.3, 10.0, 0.4, size=15, bold=True, color=WHITE)
text(s, "Questions welcome", M, 5.72, 10.0, 0.35, size=14, italic=True, color=PINK)
notes(s, "Close on the one-line thesis, then invite questions. If asked what you would do differently: "
         "an automated test suite from the start, and not depending on a single managed database with "
         "no fallback.")


path = OUT / "BloodDrop-Seminar.pptx"
prs.core_properties.title = "BloodDrop — Emergency Blood Donor Alert Network"
prs.core_properties.author = "; ".join(f"{n} ({r})" for n, r in AUTHORS)
prs.core_properties.subject = "Final Year Project Seminar"
prs.save(path)
print(f"{path.name}: {len(prs.slides._sldIdLst)} slides "
      f"({N_TABLES} tables, {N_ROUTES} routes, {N_PAGES} pages, {N_CHECKS} checks) "
      f"— {date.today():%d %B %Y}")
