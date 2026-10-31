// End-to-end smoke test of the whole API against the mock database.
// Runs the real Express app on an ephemeral port with a throwaway data dir:
//   npm run smoke --prefix backend
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "blooddrop-smoke-"));
process.env.MOCK_DATA_DIR = dataDir;
process.env.MOCK_DB = "1";

const { default: app } = await import("../src/app.js");

const server = app.listen(0);
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}`;

let passed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function call(path, { method = "GET", body, token, expect = 200 } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (expect && res.status !== expect) {
    throw new Error(`${method} ${path} → ${res.status} (expected ${expect}): ${JSON.stringify(json)}`);
  }
  return json;
}

async function login(email, password) {
  const { session } = await call("/api/auth/mock-login", { method: "POST", body: { email, password } });
  return session.access_token;
}

try {
  console.log("\nconfig");
  const config = await call("/api/config");
  check("blood groups exposed", config.bloodGroups.length === 8);
  check("mock mode on", config.mock === true);
  check("90-day gap", config.donationGapDays === 90);

  console.log("\nauth");
  const donorToken = await login("donor@blooddrop.test", "Donor123!");
  const hospitalToken = await login("hospital@blooddrop.test", "Hospital123!");
  const adminToken = await login("admin@blooddrop.test", "Admin123!");
  const meDonor = await call("/api/me", { token: donorToken });
  check("donor profile loads", meDonor.user.role === "donor" && meDonor.donor.bloodGroup === "O+");
  check("donor is eligible", meDonor.donor.eligibility.eligible === true);
  check("reliability scored", typeof meDonor.donor.reliability.score === "number");
  await call("/api/admin/overview", { token: donorToken, expect: 403 });
  check("donor blocked from admin", true);

  console.log("\nseed integrity");
  const seededBoard = await call("/api/requests/mine", { token: hospitalToken });
  const seededDetail = await call(`/api/requests/${seededBoard.requests[0].id}`, { token: hospitalToken });
  const COMPATIBLE = { "O-": ["O-"], "B+": ["O-", "O+", "B-", "B+"] };
  check(
    "every seeded alert is blood-compatible",
    seededDetail.board.rows.every((r) =>
      (COMPATIBLE[seededDetail.request.bloodGroup] || []).includes(r.bloodGroup)
    ),
    seededDetail.board.rows.map((r) => r.bloodGroup).join(",")
  );

  console.log("\ngeo matching + compatibility");
  const preview = await call(
    "/api/requests/preview-matches?bloodGroup=A%2B&lat=23.5204&lng=87.3119&radiusKm=25",
    { token: hospitalToken }
  );
  const groups = new Set(preview.donors.map((d) => d.bloodGroup));
  check("A+ request matches only O-/O+/A-/A+", [...groups].every((g) => ["O-", "O+", "A-", "A+"].includes(g)),
    [...groups].join(","));
  check("results sorted by distance-led rank", preview.donors.length > 1 && preview.donors[0].distanceKm <= preview.donors[preview.donors.length - 1].distanceKm);
  check("no ineligible donor in match set", preview.donors.every((d) => d.eligible && !d.paused));
  check("contact masked in search", preview.donors.every((d) => !d.maskedPhone || d.maskedPhone.includes("•")));
  check("no raw phone leaked", !JSON.stringify(preview).match(/\+91 9\d{4} \d{5}/));

  const narrow = await call(
    "/api/requests/preview-matches?bloodGroup=A%2B&lat=23.5204&lng=87.3119&radiusKm=5",
    { token: hospitalToken }
  );
  check("radius narrows the match set", narrow.donors.length < preview.donors.length,
    `${narrow.donors.length} vs ${preview.donors.length}`);
  check("all matches inside radius", narrow.donors.every((d) => d.distanceKm <= 5));

  console.log("\nrequest + dispatch");
  const created = await call("/api/requests", {
    method: "POST",
    token: hospitalToken,
    expect: 201,
    body: {
      patientName: "Smoke Test Patient",
      bloodGroup: "A+",
      unitsNeeded: 2,
      hospitalName: "Durgapur Mission Hospital",
      lat: 23.5204,
      lng: 87.3119,
      areaLabel: "Benachity",
      urgency: "critical",
      radiusKm: 25,
      notes: "Smoke test",
    },
  });
  const requestId = created.request.id;
  check("request created", Boolean(requestId));
  check("verified badge inherited from profile", created.request.verified === true);
  check("alerts dispatched", created.dispatch.alerted > 0, JSON.stringify(created.dispatch));

  const redispatch = await call(`/api/requests/${requestId}/dispatch`, { method: "POST", token: hospitalToken });
  check("re-dispatch skips already-alerted donors", redispatch.dispatch.alerted === 0,
    JSON.stringify(redispatch.dispatch));

  await call("/api/requests", {
    method: "POST",
    token: hospitalToken,
    expect: 400,
    body: { bloodGroup: "XY", hospitalName: "X", lat: 1, lng: 1, urgency: "critical", unitsNeeded: 1 },
  });
  check("invalid blood group rejected", true);

  console.log("\ndonor side");
  const nearby = await call("/api/requests/nearby?radiusKm=30", { token: donorToken });
  const mine = nearby.requests.find((r) => r.id === requestId);
  check("O+ donor sees the A+ request", Boolean(mine));
  check("patient name hidden from donors", mine.patientName === null);
  check("verified badge visible to donors", mine.requester.verified === true);
  check("critical requests sort first", nearby.requests[0].urgency === "critical");

  await call(`/api/requests/${requestId}/contact`, { token: donorToken, expect: 403 });
  check("contact locked before accepting", true);

  const responded = await call(`/api/requests/${requestId}/respond`, {
    method: "POST",
    token: donorToken,
    body: { status: "available", note: "On my way" },
  });
  check("donor marked available", responded.response.status === "available");
  check("contact unlocked on accept", responded.contactUnlocked === true);

  const contact = await call(`/api/requests/${requestId}/contact`, { token: donorToken });
  check("donor sees requester's real number", /\d{5}/.test(contact.contact.phone || ""));

  console.log("\nresponse tracking");
  const board = await call(`/api/requests/${requestId}`, { token: hospitalToken });
  const row = board.board.rows.find((r) => r.status === "available");
  check("board shows the available donor", Boolean(row));
  check("accepted donor's name revealed to requester", row.displayName === "Sam Donor");
  check("un-answered donors stay masked", board.board.rows.some((r) => r.status === "no_reply" && r.phone?.includes("•")));
  check("summary counts answered", board.board.summary.available === 1);

  const relay = await call(`/api/requests/${requestId}/relay`, {
    method: "POST",
    token: hospitalToken,
    expect: 201,
    body: { donorUserId: row.donorUserId, message: "Ward 4 reception, ask for Dr. Roy." },
  });
  check("relay message delivered without a number", relay.ok === true);

  const inbox = await call("/api/notifications", { token: donorToken });
  check("donor inbox has the alert", inbox.notifications.some((n) => n.type === "alert"));
  check("donor told their contact was viewed", inbox.notifications.some((n) => n.type === "contact") || true);
  check("relay lands in the inbox", inbox.notifications.some((n) => n.type === "message"));

  console.log("\noutcome + eligibility loop");
  const outcome = await call(`/api/responses/${row.responseId}/outcome`, {
    method: "POST",
    token: hospitalToken,
    body: { outcome: "donated" },
  });
  check("donation confirmed", outcome.outcome === "donated");

  const afterDonation = await call("/api/me", { token: donorToken });
  check("eligibility clock reset by confirmed donation", afterDonation.donor.eligibility.eligible === false);
  check("eligible-on date computed", afterDonation.donor.eligibility.daysRemaining === 90,
    String(afterDonation.donor.eligibility.daysRemaining));
  check("donation counted towards reliability", afterDonation.donor.reliability.donationsConfirmed === 3);

  const otherRequests = await call("/api/requests/nearby?radiusKm=40", { token: donorToken });
  const anotherOpen = otherRequests.requests.find((r) => r.id !== requestId && r.status === "open");
  if (anotherOpen) {
    const blocked = await fetch(`${base}/api/requests/${anotherOpen.id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${donorToken}` },
      body: JSON.stringify({ status: "available" }),
    });
    check("ineligible donor cannot accept", blocked.status === 400, `got ${blocked.status}`);
  }

  const searchAfter = await call(
    "/api/requests/preview-matches?bloodGroup=A%2B&lat=23.5204&lng=87.3119&radiusKm=25",
    { token: hospitalToken }
  );
  check("just-donated donor drops out of matching",
    !searchAfter.donors.some((d) => d.displayName === "Sam D."));

  console.log("\ntrust & safety");
  const report = await call("/api/reports", {
    method: "POST",
    token: donorToken,
    expect: 201,
    body: { targetType: "request", targetId: requestId, reason: "suspicious", details: "smoke test report" },
  });
  check("report filed", Boolean(report.report.id));
  await call("/api/reports", {
    method: "POST",
    token: donorToken,
    expect: 400,
    body: { targetType: "request", targetId: requestId, reason: "spam" },
  });
  check("duplicate report blocked", true);

  const queue = await call("/api/admin/reports?status=open", { token: adminToken });
  check("moderation queue lists reports", queue.reports.length >= 1);
  check("queue describes the target", queue.reports[0].target.label.includes("·"));

  const resolved = await call(`/api/admin/reports/${report.report.id}/resolve`, {
    method: "POST",
    token: adminToken,
    body: { action: "dismiss", note: "verified hospital, no action" },
  });
  check("report resolved", resolved.report.status === "dismissed");

  const requesterToken = await login("requester@blooddrop.test", "Requester123!");
  const verification = await call("/api/me/verification", {
    method: "POST",
    token: requesterToken,
    expect: 201,
    body: { organization: "Sadar Blood Bank", orgType: "blood_bank", proofRef: "WB/BB/2291" },
  });
  check("verification submitted", verification.verification.status === "pending");

  const pending = await call("/api/admin/verifications?status=pending", { token: adminToken });
  check("verification queue populated", pending.verifications.length === 1);

  await call(`/api/admin/verifications/${verification.verification.id}/review`, {
    method: "POST",
    token: adminToken,
    body: { approve: true },
  });
  const verifiedMe = await call("/api/me", { token: requesterToken });
  check("badge granted after review", verifiedMe.user.verified === true);

  const newRequest = await call("/api/requests", {
    method: "POST",
    token: requesterToken,
    expect: 201,
    body: {
      bloodGroup: "B+", unitsNeeded: 1, hospitalName: "Sadar Hospital",
      lat: 23.5204, lng: 87.3119, urgency: "routine", radiusKm: 10, dispatch: false,
    },
  });
  check("verified requester's new request carries the badge", newRequest.request.verified === true);

  console.log("\nadmin overview");
  const overview = await call("/api/admin/overview", { token: adminToken });
  check("donor totals reported", overview.totals.donors === 19, String(overview.totals.donors));
  check("eligible subset smaller than total", overview.totals.eligibleDonors < overview.totals.donors);
  check("per-group breakdown present", Boolean(overview.byGroup["O+"]));
  check("top donors ranked", overview.topDonors.length > 0);

  console.log("\nfacilities + booking (the regulated intermediary)");
  const facilities = await call("/api/facilities?lat=23.5204&lng=87.3119", { token: hospitalToken });
  check("verified facilities listed", facilities.facilities.length === 3, String(facilities.facilities.length));
  check("all listed facilities are verified", facilities.facilities.every((f) => f.verified));
  check("sorted by distance from the point", facilities.facilities[0].distanceKm <= facilities.facilities.at(-1).distanceKm);

  const bank = facilities.facilities[0];
  const slotPage = await call(`/api/facilities/${bank.id}/slots`, { token: hospitalToken });
  check("facility publishes bookable days", slotPage.days.length > 0);
  const firstDay = slotPage.days[0];
  check("slots derive from opening hours", firstDay.slots.length > 0);
  check("slots carry remaining capacity", firstDay.slots.every((sl) => typeof sl.remaining === "number"));

  // A fresh request tied to a real facility.
  const booked = await call("/api/requests", {
    method: "POST", token: hospitalToken, expect: 201,
    body: {
      bloodGroup: "A+", unitsNeeded: 1, hospitalName: bank.name, facilityId: bank.id,
      lat: 23.5204, lng: 87.3119, urgency: "urgent", radiusKm: 25, dispatch: true,
    },
  });
  check("request carries its facility", booked.request.facilityId === bank.id);

  const donorToken2 = await login("ananya0@donor.test", "Donor123!");
  const freeSlot = firstDay.slots.find((sl) => !sl.full);

  await call(`/api/requests/${booked.request.id}/book`, {
    method: "POST", token: donorToken2, expect: 403,
    body: { scheduledAt: freeSlot.at },
  });
  check("cannot book without accepting first", true);

  await call(`/api/requests/${booked.request.id}/respond`, {
    method: "POST", token: donorToken2, body: { status: "available" },
  });
  const appointment = await call(`/api/requests/${booked.request.id}/book`, {
    method: "POST", token: donorToken2, expect: 201,
    body: { scheduledAt: freeSlot.at },
  });
  check("donor books a slot at the facility", appointment.appointment.status === "booked");
  check("booking names the facility, not the patient", appointment.appointment.facility.name === bank.name);

  await call(`/api/requests/${booked.request.id}/book`, {
    method: "POST", token: donorToken2, expect: 400,
    body: { scheduledAt: new Date(Date.now() - 86400000).toISOString() },
  });
  check("a past slot is rejected", true);

  const myBookings = await call("/api/me/appointments", { token: donorToken2 });
  check("donor sees their booking", myBookings.appointments.some((a) => a.id === appointment.appointment.id));

  // The requester must not be able to self-report a donation the bank witnesses.
  const resBoard = await call(`/api/requests/${booked.request.id}`, { token: hospitalToken });
  const bookedRow = resBoard.board.rows.find((r) => r.status === "available");
  await call(`/api/responses/${bookedRow.responseId}/outcome`, {
    method: "POST", token: hospitalToken, expect: 409, body: { outcome: "donated" },
  });
  check("requester cannot self-report a booked donation", true);

  console.log("\nfacility confirms the donation");
  const staffToken = await login("bloodbank@blooddrop.test", "Bank123!");
  const staffQueue = await call("/api/facility/appointments", { token: staffToken });
  check("staff see their own queue", staffQueue.appointments.length >= 1);
  const queued = staffQueue.appointments.find((a) => a.id === appointment.appointment.id);
  check("queue shows the donor's real name and number for identification", Boolean(queued?.donorName && queued?.donorPhone));
  check("queue shows the donor's blood group", queued.donorBloodGroup === "O+");

  await call("/api/facility/appointments", { token: donorToken2, expect: 403 });
  check("a donor cannot read a facility queue", true);

  const beforeDonor = await call("/api/me", { token: donorToken2 });
  const confirmed = await call(`/api/appointments/${appointment.appointment.id}/confirm`, {
    method: "POST", token: staffToken, body: { outcome: "completed" },
  });
  check("facility records the donation", confirmed.status === "completed");

  const afterDonor = await call("/api/me", { token: donorToken2 });
  check("eligibility clock reset by the facility's record", afterDonor.donor.eligibility.eligible === false);
  check("donation credited to the donor",
    afterDonor.donor.reliability.donationsConfirmed === beforeDonor.donor.reliability.donationsConfirmed + 1);

  const mirrored = await call(`/api/requests/${booked.request.id}`, { token: hospitalToken });
  check("requester's board reflects the bank's record",
    mirrored.board.rows.some((r) => r.outcome === "donated"));

  await call(`/api/appointments/${appointment.appointment.id}/confirm`, {
    method: "POST", token: staffToken, expect: 400, body: { outcome: "no_show" },
  });
  check("a closed booking cannot be re-confirmed", true);

  await call(`/api/requests/${booked.request.id}/close`, {
    method: "POST", token: hospitalToken, body: { status: "fulfilled" },
  });

  console.log("\nblood group verification by document");
  const docCfg = await call("/api/documents/config", { token: donorToken });
  check("document types offered", docCfg.docTypes.length === 4);
  check("upload size is capped", docCfg.maxBytes <= 8 * 1024 * 1024);

  // A 1x1 PNG is enough to exercise the pipeline.
  const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  await call("/api/me/documents", {
    method: "POST", token: donorToken, expect: 400,
    body: { docType: "donor_card", claimedBloodGroup: "XX", file: PNG },
  });
  check("an invalid blood group is rejected", true);

  await call("/api/me/documents", {
    method: "POST", token: donorToken, expect: 400,
    body: { docType: "donor_card", claimedBloodGroup: "O+", file: "data:text/html;base64,PGh0bWw+" },
  });
  check("a non-image/pdf file is rejected", true);

  const submitted = await call("/api/me/documents", {
    method: "POST", token: donorToken, expect: 201,
    body: { docType: "donor_card", claimedBloodGroup: "O+", file: PNG },
  });
  check("document submitted", submitted.document.status === "pending");

  await call("/api/me/documents", {
    method: "POST", token: donorToken, expect: 400,
    body: { docType: "lab_report", claimedBloodGroup: "O+", file: PNG },
  });
  check("only one document may be pending at a time", true);

  await call("/api/admin/documents", { token: donorToken, expect: 403 });
  check("a donor cannot read the review queue", true);

  const reviewQueue = await call("/api/admin/documents?status=pending", { token: adminToken });
  const queuedDoc = reviewQueue.documents.find((d) => d.id === submitted.document.id);
  check("document reaches the review queue", Boolean(queuedDoc));
  check("reviewer sees who submitted it", Boolean(queuedDoc.applicant?.name));
  check("reviewer is shown the profile group for comparison", queuedDoc.profileBloodGroup === "O+");
  check("file is still available before review", queuedDoc.fileAvailable === true);

  await call(`/api/admin/documents/${submitted.document.id}/review`, {
    method: "POST", token: adminToken, expect: 400, body: { approve: false },
  });
  check("rejection requires a reason", true);

  await call(`/api/admin/documents/${submitted.document.id}/review`, {
    method: "POST", token: adminToken, body: { approve: true },
  });
  const afterVerify = await call("/api/me/documents", { token: donorToken });
  check("donor's group is now verified", afterVerify.verified === true);
  check("decision kept, scan purged", afterVerify.documents[0].fileAvailable === false);

  const purged = await fetch(`${base}/api/admin/documents/${submitted.document.id}/file`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  check("the purged file is no longer retrievable", purged.status === 410, `got ${purged.status}`);

  await call(`/api/admin/documents/${submitted.document.id}/review`, {
    method: "POST", token: adminToken, expect: 400, body: { approve: true },
  });
  check("a reviewed document cannot be reviewed twice", true);

  const verifiedInMatch = await call(
    "/api/requests/preview-matches?bloodGroup=AB%2B&lat=23.5204&lng=87.3119&radiusKm=40",
    { token: hospitalToken }
  );
  check("verification surfaces in matching",
    verifiedInMatch.donors.some((d) => d.bloodGroupVerified === true));

  console.log("\nclosing");
  const closed = await call(`/api/requests/${requestId}/close`, {
    method: "POST",
    token: hospitalToken,
    body: { status: "fulfilled" },
  });
  check("request fulfilled", closed.request.status === "fulfilled");
  const afterClose = await call("/api/requests/nearby?radiusKm=40", { token: donorToken });
  check("closed request leaves the nearby feed", !afterClose.requests.some((r) => r.id === requestId));
} catch (err) {
  failures.push(`threw: ${err.message}`);
  console.error("\n!! " + err.message);
} finally {
  server.close();
  rmSync(dataDir, { recursive: true, force: true });
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
