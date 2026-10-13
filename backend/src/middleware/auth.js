import { supabase } from "../lib/supabase.js";
import { ensureProfile } from "../controllers/authController.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing authorization token" });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "Invalid or expired token" });

    let profile;
    try {
      profile = await ensureProfile(data.user);
    } catch {
      return res.status(403).json({ error: "Profile not found" });
    }

    req.user = {
      id: profile.user_id,
      profileId: profile.id,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      role: profile.role,
      organization: profile.organization,
      verified: Boolean(profile.verified),
      facilityId: profile.facility_id || null,
    };
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Authentication failed" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have access to this resource" });
    }
    next();
  };
}
