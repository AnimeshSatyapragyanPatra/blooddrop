"""
Regenerates both project PDFs from the current codebase.

    python3 docs/make_reports.py

Run it after any change: the structural numbers (tables, routes, pages, tests)
are read from the code, so the documents cannot quietly go stale.
No credentials are included in either document by design.
"""
from pathlib import Path
from datetime import date

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image, KeepTogether,
)

import facts as facts_mod

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(__file__).resolve().parent
SHOTS = OUT / "screenshots"

BLOOD = colors.HexColor("#b91c1c")
INK = colors.HexColor("#1c1917")
MUTED = colors.HexColor("#78716c")
RULE = colors.HexColor("#e7e5e4")

S = getSampleStyleSheet()
TITLE = ParagraphStyle("t", parent=S["Title"], fontName="Helvetica-Bold", fontSize=26,
                       textColor=INK, leading=30, alignment=TA_LEFT, spaceAfter=4)
SUB = ParagraphStyle("s", parent=S["Normal"], fontSize=11.5, textColor=MUTED, leading=16, spaceAfter=18)
H1 = ParagraphStyle("h1", parent=S["Heading1"], fontName="Helvetica-Bold", fontSize=16,
                    textColor=BLOOD, spaceBefore=16, spaceAfter=7)
H2 = ParagraphStyle("h2", parent=S["Heading2"], fontName="Helvetica-Bold", fontSize=12,
                    textColor=INK, spaceBefore=11, spaceAfter=4)
BODY = ParagraphStyle("b", parent=S["Normal"], fontSize=10, leading=15, spaceAfter=7, textColor=INK)
SMALL = ParagraphStyle("sm", parent=BODY, fontSize=8.8, textColor=MUTED, leading=12)
CODE = ParagraphStyle("c", parent=BODY, fontName="Courier", fontSize=8.5, leading=11,
                      backColor=colors.HexColor("#f5f5f4"), borderPadding=5, spaceAfter=8)
Q = ParagraphStyle("q", parent=BODY, fontName="Helvetica-Bold", fontSize=10.5,
                   textColor=INK, spaceBefore=10, spaceAfter=3)
A = ParagraphStyle("a", parent=BODY, fontSize=9.6, leading=14, textColor=colors.HexColor("#44403c"),
                   leftIndent=10, spaceAfter=3)


def bullets(items):
    return [Paragraph(f"•&nbsp;&nbsp;{t}", BODY) for t in items]


def table(rows, widths, header=True):
    t = Table(rows, colWidths=widths, hAlign="LEFT")
    style = [
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.8),
        ("TEXTCOLOR", (0, 0), (-1, -1), INK),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, RULE),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    if header:
        style += [("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                  ("TEXTCOLOR", (0, 0), (-1, 0), BLOOD),
                  ("LINEBELOW", (0, 0), (-1, 0), 0.8, BLOOD)]
    t.setStyle(TableStyle(style))
    return t


def shot(name, caption, width=165 * mm):
    p = SHOTS / name
    if not p.exists():
        return []
    from PIL import Image as PILImage
    w, h = PILImage.open(p).size
    img = Image(str(p), width=width, height=width * h / w)
    return [KeepTogether([img, Spacer(1, 3), Paragraph(caption, SMALL)]), Spacer(1, 10)]


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(20 * mm, 12 * mm, "BloodDrop — local blood & emergency donor alert network")
    canvas.drawRightString(A4[0] - 20 * mm, 12 * mm, f"Page {doc.page}")
    canvas.setStrokeColor(RULE)
    canvas.line(20 * mm, 16 * mm, A4[0] - 20 * mm, 16 * mm)
    canvas.restoreState()


def build(path, story):
    doc = SimpleDocTemplate(str(path), pagesize=A4,
                            leftMargin=20 * mm, rightMargin=20 * mm,
                            topMargin=18 * mm, bottomMargin=22 * mm,
                            title=path.stem.replace("-", " "), author="Animesh Satyapragyan Patra")
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return path


# ---------------------------------------------------------------- report ----

def project_report(f):
    s = []
    s += [Paragraph("BloodDrop", TITLE),
          Paragraph("A local blood &amp; emergency donor alert network — project report", SUB)]

    s += [table([
        ["Live application", "blooddrop-sigma.vercel.app"],
        ["Source", "github.com/AnimeshSatyapragyanPatra/blooddrop"],
        ["Stack", "React 19 · Express · Supabase Postgres + PostGIS · Vercel"],
        ["Scale", f"{len(f['tables'])} tables · {len(f['routes'])} API endpoints · "
                  f"{len(f['pages'])} screens · {f['assertions']} automated checks"],
        ["Report generated", date.today().strftime("%d %B %Y")],
    ], [38 * mm, 127 * mm], header=False), Spacer(1, 6)]

    s += [Paragraph("1. The problem", H1), Paragraph(
        "When a hospital runs short of blood, the search today happens on WhatsApp. A message with a "
        "phone number is forwarded through groups until somebody responds. It fails in four specific "
        "ways: the forward keeps circulating long after the need is met; it reaches people by social "
        "proximity rather than by blood compatibility or distance; nobody can tell a real request from "
        "a prank; and the requester receives silence rather than a status, so they cannot tell whether "
        "anyone is coming.", BODY)]
    s += [Paragraph(
        "BloodDrop replaces the forward with a system that matches on the things that actually matter "
        "and reports back.", BODY)]

    s += shot("01-login.jpg", "Figure 1 — Sign-in.")

    s += [Paragraph("2. How it works", H1)]
    s += [Paragraph("2.1 The core loop", H2)]
    s += bullets([
        "<b>A donor registers</b> with blood group, a location pinned on a map, and the date they last gave.",
        "<b>A requester posts</b> the group needed, units, hospital, urgency and an alert radius.",
        "<b>The system matches</b> — PostGIS finds donors inside the radius, the app filters to compatible "
        "blood groups, removes anyone inside the 90-day donation gap, and ranks by distance with a nudge "
        "for reliability.",
        "<b>Alerts dispatch</b> to the shortlist — capped so alerts stay meaningful.",
        "<b>Donors answer</b> \"available\" or \"can't make it\", so the requester sees a status instead of silence.",
        "<b>The donor books a slot</b> at a licensed blood bank, which is where blood is legally collected.",
        "<b>The blood bank records the outcome</b>, which resets the donor's 90-day clock automatically.",
    ])

    s += shot("02-donor-home.jpg", "Figure 2 — A donor's alert feed: eligibility, reliability, and requests they can help with.")
    s += shot("04-post-request.jpg", "Figure 3 — Posting a request. The panel on the right counts matching donors live as the radius changes.")

    s += [PageBreak()]
    s += [Paragraph("2.2 Matching rules", H2), Paragraph(
        "Three rules decide who is alerted, and all three are enforced on the server.", BODY)]
    s += [table([
        ["Rule", "Why it matters"],
        ["Red-cell compatibility, not equality",
         "A request for A+ alerts O-, O+, A- and A+ donors. Matching on an exact string would leave the "
         "universal donor idle during an emergency."],
        ["The 90-day donation gap",
         "A donor who gave recently is hidden from matching entirely, and cannot accept even if they try. "
         "Alerting them wastes their trip and risks their health."],
        ["Distance first, reliability second",
         "A donor 1 km away always outranks one 12 km away; between similar distances, the donor who "
         "actually turns up is alerted first."],
    ], [46 * mm, 119 * mm])]

    s += [Paragraph("2.3 Choosing where to donate", H2), Paragraph(
        "Blood cannot pass from a donor to a patient directly — it must be collected at a licensed "
        "facility, screened and cross-matched first. The app therefore sends an accepting donor to a "
        "booked slot at a blood bank, and ranks the options for that donor: distance from them (not from "
        "the hospital), whether the bank is open, when it can next take them, and whether it is the bank "
        "that serves the patient. One option is marked <i>Suggested</i>, with the reasons shown rather "
        "than hidden in a score.", BODY)]

    s += shot("03-booking.jpg", "Figure 4 — Booking. Slots are derived from each facility's opening hours.")

    s += [PageBreak()]
    s += [Paragraph("3. Trust and safety", H1), Paragraph(
        "An app that broadcasts medical need and personal contact details creates risks of its own. "
        "Five mechanisms address them.", BODY)]
    s += [table([
        ["Mechanism", "What it prevents"],
        ["Phone masking", "Numbers show as +91 ••••• ••210 and unlock only between a donor who accepted "
                          "and that requester. The person whose number was shown is told who viewed it. "
                          "A relay lets both sides message with no number shared at all."],
        ["Verified requester badge", "Hospitals submit a registration number which a moderator checks. "
                                     "It cannot be self-assigned, and it is a snapshot taken when the "
                                     "request is posted."],
        ["Verified blood group", "A donor can upload a donor card or lab report; a moderator confirms it. "
                                 "Requesters see what the group was checked against — never the document."],
        ["Reliability score", "Response rate and confirmed-donation rate, smoothed so a new donor starts "
                              "neutral rather than at zero."],
        ["Report and moderation", "Any request can be flagged. Removing one notifies the requester and "
                                  "every donor who responded, so nobody makes a wasted trip."],
    ], [40 * mm, 125 * mm])]

    s += [Paragraph("3.1 Who may confirm a donation", H2), Paragraph(
        "Earlier the requester marked a donor as having donated. That let them credit a friend or punish "
        "someone who did attend, which made the reliability score self-reported by an interested party. "
        "The blood bank is the only party that witnessed the donation, so confirmation now sits with "
        "them; a requester attempting it is refused and pointed at the bank.", BODY)]

    s += [Paragraph("3.2 Document retention", H2), Paragraph(
        "Uploaded proof is deleted as soon as a decision is recorded — the row keeps the outcome and the "
        "kind of evidence, not the scan. Holding identity documents past their purpose is a liability "
        "that grows with every upload and serves nothing once the review is done.", BODY)]

    s += [PageBreak()]
    s += [Paragraph("4. Architecture", H1)]
    s += [Paragraph("4.1 Stack", H2)]
    s += [table(
        [["Layer", "Technology"]] +
        [["Frontend", ", ".join(f"{k} {v.lstrip('^~')}" for k, v in list(f["frontend_deps"].items()))]] +
        [["Build", ", ".join(f"{k}" for k in f["frontend_dev"])]] +
        [["Backend", ", ".join(f"{k} {v.lstrip('^~')}" for k, v in f["backend_deps"].items())]] +
        [["Database", "Supabase Postgres with the PostGIS extension"]] +
        [["Hosting", "Vercel — static frontend plus one serverless function"]],
        [26 * mm, 139 * mm])]

    s += [Paragraph("4.2 Request path", H2), Paragraph(
        "Browser &rarr; Vercel static site &rarr; <font face='Courier'>/api/*</font> rewritten to a "
        "serverless function running the same Express app as local development &rarr; Supabase.", BODY)]

    s += [Paragraph("4.3 Domain logic", H2), Paragraph(
        "The rules live in small single-purpose modules rather than inside the route handlers, so each "
        "can be read and tested on its own.", BODY)]
    descriptions = {
        "blood": "red-cell compatibility — who can give to whom",
        "eligibility": "the 90-day donation gap and the eligible-from date",
        "geo": "great-circle distance",
        "matching": "compatibility + radius + eligibility + ranking",
        "recommend": "which blood bank this donor should go to, and why",
        "reliability": "smoothed response and show rates",
        "privacy": "name, phone and location masking",
        "slots": "bookable times derived from opening hours",
        "storage": "document storage; local disk or Supabase Storage",
        "verification": "what a requester is told about a verified blood group",
        "notify": "alert delivery across channels",
        "mockDb": "an in-memory stand-in for Supabase so the app runs with no setup",
        "views": "row to API shape mappers",
        "demoData": "the demo dataset, shared by mock and real seeding",
        "supabase": "client selection and the production safety guard",
    }
    s += [table([["Module", "Responsibility"]] +
                [[f"{n}.js", descriptions.get(n, "")] for n in f["libs"] if n in descriptions],
                [30 * mm, 135 * mm])]

    s += [PageBreak()]
    s += [Paragraph("5. Database", H1), Paragraph(
        f"{len(f['tables'])} tables, {f['indexes']} indexes and {f['policies']} row-level-security "
        f"policies, applied through {len(f['migrations'])} migrations.", BODY)]
    purpose = {
        "profiles": "every user: role, organisation, verified flag",
        "donors": "blood group, location, last donation, reliability counters",
        "facilities": "licensed blood banks: hours, capacity, licence number",
        "requests": "an emergency request and its alert radius",
        "alerts": "who was alerted for which request, and on what channel",
        "responses": "a donor's answer to an alert",
        "appointments": "a booked donation slot at a facility",
        "donor_documents": "proof of blood group and the review decision",
        "reports": "flags raised against a request or user",
        "verifications": "hospital / blood bank badge applications",
        "notifications": "the in-app inbox",
    }
    s += [table([["Table", "Holds"]] + [[t, purpose.get(t, "")] for t in f["tables"]],
                [38 * mm, 127 * mm])]

    s += [Paragraph("5.1 The spatial query", H2), Paragraph(
        "Distance is computed in the database, not in the application. The matching function uses "
        "<font face='Courier'>ST_DWithin</font> against a GiST index on a generated "
        "<font face='Courier'>geography</font> column, so the search stays fast as the donor table grows. "
        "<font face='Courier'>ST_Distance</font> alone would force a full scan.", BODY)]
    s += [Paragraph(
        "and st_dwithin(d.geog,<br/>&nbsp;&nbsp;st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,<br/>"
        "&nbsp;&nbsp;p_radius_km * 1000)", CODE)]

    s += [Paragraph("6. Running without any accounts", H1), Paragraph(
        "The repository contains a hand-written in-memory stand-in for Supabase — its auth, its query "
        "builder and the PostGIS matching function — so the whole application runs on a fresh clone with "
        "no account, no keys and no network. The controllers cannot tell the difference: they call "
        "<font face='Courier'>supabase.rpc(\"match_donors\", …)</font> either way. It exists so the "
        "project can be demonstrated anywhere, and so the test suite needs no live database.", BODY)]

    s += [Paragraph("7. Testing", H1), Paragraph(
        f"A single suite of {f['assertions']} assertions boots the real Express application on an "
        f"ephemeral port and exercises it over HTTP. It covers blood compatibility, radius filtering, "
        f"eligibility, dispatch, the masking rules, booking, facility isolation, document review and "
        f"moderation — including the negative cases: booking without accepting, booking a past or full "
        f"slot, a donor reading another facility's queue, and a requester trying to confirm a donation "
        f"the blood bank witnessed.", BODY)]
    s += [Paragraph("npm run smoke --prefix backend", CODE)]

    s += [Paragraph("8. Deployment", H1), Paragraph(
        "The repository root deploys to Vercel as-is. The frontend builds to a static site; "
        "<font face='Courier'>api/index.js</font> re-exports the same Express application as a "
        "serverless function. A deployment with missing Supabase credentials refuses to start rather "
        "than silently falling back to the in-memory database, which would otherwise look healthy while "
        "discarding every registration on each cold start.", BODY)]

    s += [Paragraph("9. Honest limitations", H1)]
    s += bullets([
        "Email and SMS are seams, not integrations — the in-app inbox is the channel that actually delivers.",
        "Facility opening hours are one window per day, with no holidays or per-day variation.",
        "Moderation is manual; there is no automated fraud detection.",
        "The engagement tier from the original plan — certificates, milestone badges, camp calendar, "
        "eligibility reminders — is not built, nor the predictive-shortage and WhatsApp-bridge ideas.",
        "Demo accounts exist for evaluation and would have to be removed before any real use.",
    ])
    return s


# -------------------------------------------------------------------- Q&A ----

def qa(pairs):
    out = []
    for q, a in pairs:
        out.append(KeepTogether([Paragraph(q, Q), Paragraph(a, A)]))
    return out


def questions_report(f):
    s = []
    s += [Paragraph("BloodDrop", TITLE),
          Paragraph("Questions you may be asked, and how to answer them — by layer", SUB)]
    s += [Paragraph(
        "Grouped into frontend, backend, and database. The harder questions are the ones about why a "
        "decision was made rather than what the code does, so those are answered first in each section.",
        BODY), Spacer(1, 4)]

    s += [Paragraph("Frontend — React, Vite, Tailwind, Leaflet", H1)]
    s += qa([
        ("Why React with plain JavaScript rather than TypeScript?",
         "The project is small enough that the type safety would not have paid for the setup cost, and "
         "the risky logic — compatibility, eligibility, distance — lives on the server where it is "
         "covered by tests. On a larger team I would use TypeScript."),
        ("How does the map work, and what does it cost?",
         "Leaflet with OpenStreetMap tiles. Nothing: no API key, no billing, no usage cap. Google Maps "
         "would need a billing account. Markers are drawn as div icons rather than images, so there are "
         "no broken asset paths after bundling."),
        ("Why is blood group a grid of buttons instead of a dropdown?",
         "There are only eight values and it is the field every screen turns on. A grid is one tap "
         "instead of tap–scroll–tap, which matters on a phone in an emergency. It is built on real radio "
         "inputs, so keyboard and screen-reader behaviour comes for free."),
        ("How does dark mode work?",
         "A single <font face='Courier'>dark</font> class on the root element. Tailwind compiles every "
         "<font face='Courier'>dark:</font> utility into a rule scoped to it, so both rule sets ship and "
         "one class decides which applies — the switch costs no network request and no re-render. An "
         "inline script in index.html sets the class before React mounts, otherwise a dark-mode user "
         "gets a white flash on every load."),
        ("How do you keep the response board live?",
         "Polling, paused while the tab is hidden and refetching when it returns, with a minimum gap so "
         "flicking between tabs cannot cause a burst. This mattered: the first version polled regardless "
         "of visibility and one open tab made roughly ten thousand API calls a day."),
        ("Why not Supabase Realtime instead of polling?",
         "Polling works identically in the offline mock and against Supabase, which keeps one code path. "
         "Realtime would be the upgrade, and it would only change the hook."),
        ("How is state managed?",
         "React context for authentication and theme; everything else is local component state. There is "
         "no Redux because there is no shared mutable state complex enough to need it."),
        ("What stops a donor's exact home location being shown?",
         "Coordinates are rounded to roughly a kilometre grid before they reach anyone else, and only a "
         "distance and an area label are displayed."),
    ])

    s += [PageBreak(), Paragraph("Backend — Node, Express", H1)]
    s += qa([
        ("Where does the domain logic live, and why not in the routes?",
         "In small single-purpose modules under <font face='Courier'>lib/</font> — compatibility, "
         "eligibility, distance, ranking, masking, slots. Route handlers validate input and call them. "
         "It means the rules can be read without untangling HTTP, and tested directly."),
        ("Explain the matching algorithm.",
         "Given a patient's group, derive the donor groups that can safely give to it. Ask the database "
         "for donors of those groups inside the radius. Drop anyone inside the 90-day gap or who has "
         "paused. Rank by distance with a small reliability adjustment, so a nearer donor always wins but "
         "a reliable one breaks a tie. Alert a capped shortlist rather than everyone."),
        ("Why cap the number alerted?",
         "Alerting everyone in range trains people to ignore alerts. A capped, ranked shortlist keeps "
         "them meaningful, and the requester can send another round that reaches only donors not already "
         "contacted."),
        ("How does phone masking actually work?",
         "Numbers never leave the server in list or search responses — they are masked before "
         "serialisation. They unlock only between a donor who accepted and the requester of that "
         "request, through a dedicated endpoint that also notifies the person whose number was shown. "
         "There is also a relay so both sides can message with no number shared."),
        ("Why does the blood bank confirm donations rather than the requester?",
         "Because the bank is the only party that witnessed it. When the requester confirmed, they could "
         "credit a friend or mark a genuine donor absent, which made the reliability score self-reported "
         "by someone with an interest in it. A requester who tries now receives a 409 pointing at the bank."),
        ("How are the bookable slots produced?",
         "Derived at request time from the facility's opening hours, slot length and capacity — not "
         "stored. A facility changing its hours therefore needs no migration and no backfill; only the "
         "bookings are rows. Past slots are filtered out, and a slot at capacity is marked full."),
        ("What happens to an uploaded document?",
         "It is size-checked and type-checked on the server rather than trusting the browser, stored "
         "privately, shown to one moderator, and deleted the moment a decision is recorded. Requesting "
         "it afterwards returns 410. Only the decision and the kind of evidence survive."),
        ("How do you avoid N+1 queries?",
         "Collections are fetched with a single <font face='Courier'>in (…)</font> lookup and joined in "
         "memory. A 25-donor response board was 50 sequential round trips before this; it is now two."),
        ("What stops a deployment running against the wrong database?",
         "If the app detects a deployed environment with no Supabase credentials, it refuses to start "
         "and names the missing variable, rather than falling back to the in-memory database — which "
         "would look healthy while discarding every registration on each cold start."),
        ("How is it tested?",
         f"A single suite of {f['assertions']} assertions boots the real Express app on an ephemeral "
         "port and drives it over HTTP, including the negative cases. It runs against the in-memory "
         "database, so it needs no credentials and no network."),
    ])

    s += [PageBreak(), Paragraph("Database — Supabase, Postgres, PostGIS", H1)]
    s += qa([
        ("Why PostGIS rather than calculating distance in the application?",
         "Because filtering has to happen before the rows are fetched. "
         "<font face='Courier'>ST_DWithin</font> uses a GiST index on a geography column, so the "
         "database returns only donors inside the radius. Pulling every donor and measuring in "
         "JavaScript would work for a hundred donors and collapse at a hundred thousand."),
        ("What is the geography column and why is it generated?",
         "A <font face='Courier'>geography(Point, 4326)</font> column derived automatically from the "
         "lat and lng the app writes. Generating it means the spatial data can never drift out of step "
         "with the coordinates, which it would if the application had to remember to update both."),
        ("Why is distance for facilities computed in JavaScript instead?",
         "A region has dozens of facilities but potentially thousands of donors. An indexed spatial "
         "query earns its complexity for one and not the other — that is a deliberate asymmetry, not an "
         "inconsistency."),
        ("What does row-level security give you here?",
         f"{f['policies']} policies ensure that even with direct database access a user reads only their "
         "own profile, donor record, responses and notifications. The API uses the service role and "
         "bypasses them, so they are defence in depth rather than the primary control — demonstrated by "
         "the public key returning zero donor rows."),
        ("Why does the app hold its own counters instead of counting rows?",
         "Reliability needs alerts received, responses given, donations confirmed and no-shows for every "
         "donor in a match set. Counting rows per donor on each match would be the N+1 problem again. "
         "The counters are written at the same points the events occur."),
        ("How is the schema managed?",
         f"{len(f['migrations'])} ordered SQL migrations under <font face='Courier'>supabase/migrations/</font>. "
         "One lesson learned: adding a column to a function's return type requires dropping the function "
         "first, since Postgres will not replace one whose row type changed — so that migration drops and "
         "recreates inside a transaction."),
        ("Where are uploaded files stored?",
         "A private Supabase Storage bucket, size- and type-restricted, never public. Locally the same "
         "interface writes to disk instead, so the feature works with no account."),
        ("What happens when the free Supabase project pauses?",
         "The hostname stops resolving and the browser reports a failed fetch at login. It is a property "
         "of the free tier after about a week of inactivity, and the project is restored from the "
         "dashboard with data and keys intact."),
    ])

    s += [PageBreak(), Paragraph("Questions about judgement", H1)]
    s += qa([
        ("What is the hardest problem in this project?",
         "Not the geography — it is deciding who is allowed to assert what. Blood group, whether a "
         "donation happened, and whether a request is genuine are all claims someone benefits from "
         "making falsely. Most of the design is about moving each claim to the party with no incentive "
         "to lie: the blood bank confirms donations, a moderator confirms blood groups and hospital "
         "badges, and the donor alone decides when their number is revealed."),
        ("What would you build next?",
         "SMS, because the people least likely to have the app open are the ones in the areas with the "
         "thinnest donor coverage. After that, predictive shortage alerts from request history."),
        ("What is the weakest part?",
         "Moderation does not scale. One queue worked by hand is fine for a demonstration and would fail "
         "immediately at volume; it needs rate limits, duplicate detection and trusted-reporter weighting."),
        ("What did you get wrong and fix?",
         "The first design had donors meeting requesters directly, which is not how transfusion works — "
         "blood must be collected at a licensed facility. Adding facilities also exposed a worse flaw: "
         "the requester was confirming donations, so the reliability score was being reported by the "
         "person it benefited."),
    ])
    return s


if __name__ == "__main__":
    f = facts_mod.gather()
    a = build(OUT / "BloodDrop-Project-Report.pdf", project_report(f))
    b = build(OUT / "BloodDrop-Questions.pdf", questions_report(f))
    for p in (a, b):
        print(f"  {p.name}  ({p.stat().st_size // 1024} KB)")
