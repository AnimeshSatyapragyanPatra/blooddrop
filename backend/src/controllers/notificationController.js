import { supabase } from "../lib/supabase.js";

export async function listNotifications(req, res) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });

  res.json({
    unread: (data || []).filter((n) => !n.read).length,
    notifications: (data || []).map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      requestId: n.request_id,
      read: Boolean(n.read),
      createdAt: n.created_at,
    })),
  });
}

export async function markRead(req, res) {
  const id = req.params.id;
  if (id === "all") {
    await supabase.from("notifications").update({ read: true }).eq("user_id", req.user.id);
    return res.json({ ok: true });
  }
  const { data } = await supabase.from("notifications").select("user_id").eq("id", id).maybeSingle();
  if (!data || data.user_id !== req.user.id) return res.status(404).json({ error: "Notification not found" });
  await supabase.from("notifications").update({ read: true }).eq("id", id);
  res.json({ ok: true });
}
