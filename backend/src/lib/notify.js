// Alert dispatch. Every alert is always written to the in-app inbox (the
// notifications table) — that is the channel that works with zero configuration
// and zero cost. Email / SMS / web-push are pluggable drivers on top of it.
//
// With no provider keys set, drivers log to the server console and are recorded
// as "logged" so the demo shows the full dispatch trail without a paid account.
import { supabase } from "./supabase.js";

// With no provider configured these channels cannot actually send anything.
// They used to print a line per recipient, which made a single dispatch look
// like 25 lines of real traffic in the log. Off unless explicitly asked for.
const TRACE = process.env.NOTIFY_TRACE === "1";

const DRIVERS = {
  async inapp({ userId, title, body, requestId }) {
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "alert",
      title,
      body,
      request_id: requestId || null,
      read: false,
    });
    return "sent";
  },

  async email({ to, title, body }) {
    if (TRACE) console.log(`[blooddrop:email→${to}] ${title} — ${body}`);
    // Wire a real provider here (Resend/SendGrid); left as a seam on purpose.
    return "logged";
  },

  async sms({ to, title, body }) {
    if (TRACE) console.log(`[blooddrop:sms→${to}] ${title} — ${body}`);
    return "logged";
  },

  async push({ userId, title }) {
    if (TRACE) console.log(`[blooddrop:push→${userId}] ${title}`);
    return "logged";
  },
};

/**
 * Deliver one alert on the donor's preferred channel, plus the in-app inbox.
 * Returns the channel actually used and its delivery state.
 */
export async function deliver({ userId, email, phone, preference, title, body, requestId }) {
  await DRIVERS.inapp({ userId, title, body, requestId });

  const channel = ["email", "sms", "push"].includes(preference) ? preference : "inapp";
  if (channel === "inapp") return { channel: "inapp", status: "sent" };

  const to = channel === "email" ? email : phone;
  if (!to) return { channel: "inapp", status: "sent" };

  try {
    const status = await DRIVERS[channel]({ userId, to, title, body });
    return { channel, status };
  } catch (err) {
    console.error(`[blooddrop] ${channel} dispatch failed:`, err.message);
    return { channel, status: "failed" };
  }
}

/** Non-alert in-app message (status changes, moderation outcomes, nudges). */
export async function notifyInApp({ userId, type, title, body, requestId }) {
  await supabase.from("notifications").insert({
    user_id: userId,
    type: type || "info",
    title,
    body,
    request_id: requestId || null,
    read: false,
  });
}
